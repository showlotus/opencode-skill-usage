import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import {
  appendFileSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(homedir(), '.config', 'opencode')
const logPath = join(configDir, 'skill-usage.jsonl')
const legacyLogPath = join(configDir, 'skill-usage.log')
const skillMdPath = resolve(__dirname, '../skills/skill-usage/SKILL.md')

// Read the bundled skill body once at module load, stripping YAML frontmatter
// so only the instruction body is used as the command template.
const skillContent = (() => {
  try {
    const raw = readFileSync(skillMdPath, 'utf8')
    const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
    return match ? match[1].trim() : raw
  } catch {
    return ''
  }
})()

const timestamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// Append one JSONL record. Kept as a single writer so the on-disk format stays
// identical across plugin versions.
const appendRecord = (name, callType, directory) => {
  appendFileSync(
    logPath,
    JSON.stringify({
      timestamp: timestamp(),
      skill: name,
      directory: directory ?? 'unknown',
      call_type: callType,
    }) + '\n'
  )
}

// One-time migration: convert a legacy TSV log (skill-usage.log) to JSONL and
// remove it. Runs at module load; failures are silent so the plugin keeps working.
const migrateLegacyLog = () => {
  try {
    if (!existsSync(legacyLogPath)) return
    if (existsSync(logPath)) {
      // Migration already happened; the old file is just a leftover.
      unlinkSync(legacyLogPath)
      return
    }
    const lines = readFileSync(legacyLogPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        if (line.startsWith('{')) return line
        const m = line.match(/^\[([^\]]*)\]\t([^\t]*)\t([^\t]*)\t([^\t]*)$/)
        if (!m) return null
        const [, time, skill, directory, callType] = m
        return JSON.stringify({
          timestamp: time,
          skill,
          directory,
          call_type: callType,
        })
      })
      .filter(Boolean)
    const tmpPath = `${logPath}.tmp`
    writeFileSync(tmpPath, lines.length ? lines.join('\n') + '\n' : '')
    renameSync(tmpPath, logPath)
    unlinkSync(legacyLogPath)
  } catch {
    // ignore: fall back to normal operation
  }
}

migrateLegacyLog()

// OpenCode v2 plugin that records skill invocations from two sources:
//   1. agent-initiated skill tool calls (call_type: "auto")
//   2. user slash-command invocations (call_type: "manual")
// The command registers the bundled skill body as the /skill-usage template so
// it is available without manual opencode.json skills.paths configuration.
// Each invocation appends one JSONL line (timestamp, skill name, project
// directory, call_type) to skill-usage.jsonl next to this file. A legacy
// skill-usage.log (TSV) is migrated once at module load.
//
// Only the opencode 2.x plugin API is supported: 2.x reads id/setup() and
// passes the domain APIs on the context. opencode 1.x called server(); that
// hook was removed in 2.0.0, so 1.x users must pin opencode-skill-usage@1.
export default {
  id: 'skill-usage',
  setup: async (ctx) => {
    const directory = ctx.location?.directory

    // Register /skill-usage unconditionally. `editor.add` is a name-keyed set,
    // and opencode registers config commands after plugin transforms (the
    // config command plugin runs in the post group), so a user-defined
    // /skill-usage still wins. 2.x has no global command.execute.before, so
    // the command records itself.
    await ctx.command.transform((editor) => {
      editor.add({
        name: 'skill-usage',
        description: 'Query and aggregate skill invocation stats',
        execute: async ({ sessionID, prompt, delivery }) => {
          appendRecord('skill-usage', 'manual', directory)
          const args = typeof prompt?.text === 'string' ? prompt.text.trim() : ''
          await ctx.session.prompt({
            ...prompt,
            sessionID,
            text: args ? `${skillContent}\n\n${args}` : skillContent,
            delivery,
          })
        },
      })
    })

    // Agent-initiated skill calls. 2.x's skill tool takes { id }; keep a
    // fallback so a nonstandard tool named "skill" that passes { name } is
    // still recorded.
    await ctx.tool.hook('execute.before', (event) => {
      if (event.tool !== 'skill') return
      const input = event.input
      appendRecord(input?.id ?? input?.name ?? 'unknown', 'auto', directory)
    })

    // User slash-invocations of skills surface as prompt skill attachments.
    // The prompt hook is not an exactly-once boundary, so dedupe by admission,
    // and only record skills that actually resolve (skip typos).
    const seen = new Set()
    await ctx.session.hook('prompt', async (event) => {
      const skills = event.prompt?.skills
      if (!Array.isArray(skills) || skills.length === 0) return
      const listed = await ctx.skill.list().catch(() => null)
      const known = Array.isArray(listed) ? listed : listed?.data
      const ids = Array.isArray(known) ? new Set(known.map((s) => s?.id)) : null
      for (const skill of skills) {
        const id = skill?.id
        if (!id) continue
        if (ids && !ids.has(id)) continue
        const key = `${event.sessionID}:${event.messageID}:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        if (seen.size > 500) seen.delete(seen.values().next().value)
        appendRecord(id, 'manual', directory)
      }
    })
  },
}

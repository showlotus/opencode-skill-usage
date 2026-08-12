import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { appendFileSync, readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logPath = join(homedir(), '.config', 'opencode', 'skill-usage.log')
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
  return `[${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}]`
}

// OpenCode plugin that records skill invocations from two sources:
//   1. tool.execute.before — agent-initiated skill tool calls (call_type: "auto")
//   2. command.execute.before — user slash-command invocations (call_type: "manual")
// The config hook registers the bundled skill as a slash command so it is
// auto-available without manual opencode.json skills.paths configuration.
// This works because Command init runs after Plugin config hooks (Command
// layer depends on Skill, which finishes before Command starts).
// System commands (name contains ".") are filtered, since skill ids follow
// kebab-case without dots. Each invocation appends a TSV row (timestamp, skill
// name, project directory, call_type) to skill-usage.log next to this file.
export default {
  id: 'skill-usage',
  server: async (input) => {
    const directory = input?.directory
    const record = (name, callType) =>
      appendFileSync(logPath, `${timestamp()}\t${name}\t${directory ?? 'unknown'}\t${callType}\n`)
    return {
      config: async (config) => {
        config.command = config.command || {}
        if (!config.command['skill-usage']) {
          config.command['skill-usage'] = {
            description: 'Query and aggregate skill invocation stats',
            template: skillContent,
          }
        }
      },
      'tool.execute.before': async (toolInput, output) => {
        if (toolInput.tool !== 'skill') return
        record(output.args?.name ?? 'unknown', 'auto')
      },
      'command.execute.before': async (cmdInput) => {
        const name = cmdInput.command
        if (!name || name.includes('.')) return
        record(name, 'manual')
      },
    }
  },
}

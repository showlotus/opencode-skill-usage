# AGENTS.md

OpenCode v1/v2 plugin (plain ESM, zero runtime deps) that logs every skill invocation to a JSONL file and auto-registers a `/skill-usage` command. There are no tests, lint, or build scripts — don't invent verification commands.

## Layout

- `plugin/index.js` — plugin entry, dual-implementation default export:
  - v1 (`server(input)`): `config` hook registers the `/skill-usage` command; `tool.execute.before` / `command.execute.before` hooks append log lines.
  - v2 (`setup(ctx)`): registers the command via `ctx.command.transform`, records auto calls via `ctx.tool.hook("execute.before")`, records manual calls in the command executor and via `ctx.session.hook("prompt")` (`event.prompt.skills`).
  - Shared: `appendRecord` writes JSONL; at module load a one-time migration converts a legacy TSV `skill-usage.log` to JSONL and removes it.
- `skills/skill-usage/SKILL.md` — dual-use: the skill (frontmatter `name`/`description`) AND the `/skill-usage` command template. The plugin strips YAML frontmatter at load; only the body is used as the template.

## Critical invariants

- Keep the default export shape `{ id, setup, server }`. opencode 1.x calls `server()`; opencode 2.x reads `id`/`setup()` and ignores `server()`. V1 implementations do not run in V2. Do **not** import `@opencode/plugin` — `Plugin.define` is an identity helper and the package must stay zero-dependency.
- `plugin/index.js:17` resolves `../skills/skill-usage/SKILL.md` and reads it **once at module load** (lines 21–29); on read failure it silently falls back to `''`. Renaming/moving that file breaks the command template with no error. Changes to SKILL.md only take effect after an opencode restart (config is loaded once at startup).
- The log is written to `~/.config/opencode/skill-usage.jsonl` (`plugin/index.js:15`), **outside the repo**. Never create or commit a log file in the repo; `*.log` in `.gitignore` is only for stray repo logs. The legacy name `skill-usage.log` must never be written again — the migration (`plugin/index.js:53`) removes it.
- Log line format is JSONL: one JSON object per line with exact fields `{"timestamp":"YYYY/MM/DD HH:MM:SS","skill":...,"directory":...,"call_type":"manual"|"auto"}` (call_type is `manual` for user slash-commands, `auto` for agent-initiated). Preserve it exactly — the `node -e` query templates in SKILL.md and user shell scripts depend on it.
- V2 API mappings that matter: skill tool input is `{ id }` (v1 was `{ name }`, keep the fallback), `command.executed` is **not** in the V2 public event stream (never rely on it), and the prompt hook is not an exactly-once boundary (keep the `sessionID:messageID:id` dedupe set and the `ctx.skill.list()` existence filter for manual skill logging).
- SKILL.md's "Execution directive" deliberately tells agents to treat skill-usage content as an active query request. That behavior is intended; don't weaken it when editing.

## Publish

- Releases are manual only: bump `version` in `package.json`, push, then run the `Publish to npm` workflow via `workflow_dispatch` (`.github/workflows/publish.yml`, requires `NPM_TOKEN`). Nothing publishes on push/tag.
- Only `plugin/` and `skills/` are published (package.json `files`); keep SKILL.md inside `skills/` or the runtime template load breaks for npm installs.
- pnpm 8.11.0 (pinned in `packageManager` and the workflow); `ai-code-review.yml` needs `CHAT_TOKEN` secret.

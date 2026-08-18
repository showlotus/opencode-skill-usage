# AGENTS.md

OpenCode plugin (plain ESM, zero runtime deps) that logs every skill invocation to a JSONL file and auto-registers a `/skill-usage` command. There are no tests, lint, or build scripts — don't invent verification commands.

## Layout

- `plugin/index.js` — plugin entry: `config` hook registers the `/skill-usage` command; `tool.execute.before` / `command.execute.before` hooks append log lines. At module load it runs a one-time migration that converts a legacy TSV `skill-usage.log` to JSONL and then removes it.
- `skills/skill-usage/SKILL.md` — dual-use: the skill (frontmatter `name`/`description`) AND the `/skill-usage` command template. The plugin strips YAML frontmatter at load; only the body is used as the template.

## Critical invariants

- `plugin/index.js:17` resolves `../skills/skill-usage/SKILL.md` and reads it **once at module load** (lines 21–29); on read failure it silently falls back to `''`. Renaming/moving that file breaks the command template with no error. Changes to SKILL.md only take effect after an opencode restart (config is loaded once at startup).
- The log is written to `~/.config/opencode/skill-usage.jsonl` (`plugin/index.js:15`), **outside the repo**. Never create or commit a log file in the repo; `*.log` in `.gitignore` is only for stray repo logs. The legacy name `skill-usage.log` must never be written again — the migration (`plugin/index.js:39`) removes it.
- Log line format is JSONL: one JSON object per line with exact fields `{"timestamp":"YYYY/MM/DD HH:MM:SS","skill":...,"directory":...,"call_type":"manual"|"auto"}` (call_type is `manual` for user slash-commands, `auto` for agent-initiated). Preserve it exactly — the `node -e` query templates in SKILL.md and user shell scripts depend on it.
- SKILL.md's "Execution directive" deliberately tells agents to treat skill-usage content as an active query request. That behavior is intended; don't weaken it when editing.

## Publish

- Releases are manual only: bump `version` in `package.json`, push, then run the `Publish to npm` workflow via `workflow_dispatch` (`.github/workflows/publish.yml`, requires `NPM_TOKEN`). Nothing publishes on push/tag.
- Only `plugin/` and `skills/` are published (package.json `files`); keep SKILL.md inside `skills/` or the runtime template load breaks for npm installs.
- pnpm 8.11.0 (pinned in `packageManager` and the workflow); `ai-code-review.yml` needs `CHAT_TOKEN` secret.

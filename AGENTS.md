# AGENTS.md

OpenCode v2 plugin (plain ESM, zero runtime deps) that logs every skill invocation to a JSONL file and auto-registers a `/skill-usage` command. There are no tests, lint, or build scripts — don't invent verification commands.

## Layout

- `plugin/index.js` — plugin entry, v2-only default export `{ id, setup }`:
  - `setup(ctx)`: registers the command unconditionally via `ctx.command.transform` (`editor.add` is a name-keyed set; opencode applies config commands after plugin transforms, so a user-defined `/skill-usage` still wins), records auto calls via `ctx.tool.hook("execute.before")`, records manual calls in the command executor and via `ctx.session.hook("prompt")` (`event.prompt.skills`).
  - Shared: `appendRecord` writes JSONL; at module load a one-time migration converts a legacy TSV `skill-usage.log` to JSONL and removes it.
- `skills/skill-usage/SKILL.md` — dual-use: the skill (frontmatter `name`/`description`) AND the `/skill-usage` command template. The plugin strips YAML frontmatter at load; only the body is used as the template.

## Critical invariants

- Keep the default export shape `{ id, setup }`. opencode 2.x reads `id`/`setup()`; the `server()` hook was removed in 2.0.0, so opencode 1.x users must pin the previous unscoped package (`opencode-skill-usage@1`) — do not re-add a v1 path. Do **not** import `@opencode/plugin` — `Plugin.define` is an identity helper and the package must stay zero-dependency.
- `package.json`'s `./server` export is the opencode 2.x server entrypoint convention (`Host.resolve` tries the `server` subpath before `.`), not a v1 leftover — never delete it.
- `plugin/index.js:17` resolves `../skills/skill-usage/SKILL.md` and reads it **once at module load** (lines 21–29); on read failure it silently falls back to `''`. Renaming/moving that file breaks the command template with no error. Changes to SKILL.md only take effect after an opencode restart (config is loaded once at startup).
- The log is written to `~/.config/opencode/skill-usage.jsonl` (`plugin/index.js:15`), **outside the repo**. Never create or commit a log file in the repo; `*.log` in `.gitignore` is only for stray repo logs. The legacy name `skill-usage.log` must never be written again — the migration (`plugin/index.js:53`) removes it.
- Log line format is JSONL: one JSON object per line with exact fields `{"timestamp":"YYYY/MM/DD HH:MM:SS","skill":...,"directory":...,"call_type":"manual"|"auto"}` (call_type is `manual` for user slash-commands, `auto` for agent-initiated). Preserve it exactly — the `node -e` query templates in SKILL.md and user shell scripts depend on it.
- V2 API mappings that matter: skill tool input is `{ id }` (keep the `name` fallback for nonstandard tools named `skill`), `command.executed` is **not** in the V2 public event stream (never rely on it), and the prompt hook is not an exactly-once boundary (keep the `sessionID:messageID:id` dedupe set and the `ctx.skill.list()` existence filter for manual skill logging). The plugin does **not** register a skill via `ctx.skill.transform`; SKILL.md is only the command template.
- SKILL.md's "Execution directive" deliberately tells agents to treat skill-usage content as an active query request. That behavior is intended; don't weaken it when editing.

## Publish

- Releases are tag-driven: bump `version` in `package.json`, commit, then `git tag vX.Y.Z && git push origin master --tags`. `.github/workflows/publish.yml` verifies the tag matches the package version, publishes to npm, regenerates `CHANGELOG.md`, and creates the GitHub Release. Nothing publishes from a branch push — only from a `v*` tag.
- Commit messages must stay conventional (`feat:`, `fix:`, `chore:` …): the changelog is generated from them with the angular preset, and `CHANGELOG.md` is fully regenerated (`-r 0`), so never hand-edit it.
- The publish job asserts the tarball contains `plugin/index.js` and `skills/skill-usage/SKILL.md` before publishing. Only `plugin/` and `skills/` are published (package.json `files`); keep SKILL.md inside `skills/` or the runtime template load breaks for npm installs.
- The package is scoped (`@showlotus/opencode-skill-usage`), so `publishConfig.access` is `public` and the workflow still passes `--access public`. The pre-2.0 unscoped `opencode-skill-usage` package stays at 1.x.
- pnpm 8.11.0 (pinned in `packageManager` and the workflow) and Node 22 in CI. `ai-code-review.yml` needs `CHAT_TOKEN`; publishing needs `NPM_TOKEN`.

---
name: skill-usage
description: Query and aggregate skill tool invocation stats. Use when the user asks "how many times was each skill called", "which skill is used the most", "skill call stats for a time range or a project", and returns a ranking by call count or a per-skill call log.
---

# Skill Usage Stats

## When to use

Use this skill when the user wants to know skill call frequency, rankings, or historical detail. Common phrasings:

- Which skill is called the most
- How many times each skill was called in the last 7 days
- Skill usage within the opencode-skill-usage project
- Whether the skill-usage skill itself has ever been invoked

The log captures both invocation paths:
- **Agent-initiated**: the agent calls the `skill` tool directly
- **User slash-command**: the user runs a skill via `/skill-name`

## Locate the log

The log file is named `skill-usage.log`, written automatically by the opencode-skill-usage plugin. Locate it in this order:

1. Glob the current workspace for `**/skill-usage.log` and use the first match.
2. If not found, check the npm install cache path: `~/.cache/opencode/node_modules/@showlotus/opencode-skill-usage/plugin/skill-usage.log`
3. If still not found, ask the user where the plugin is installed.

## Log format

Four TSV columns per line, no header:

```
timestamp	skill name	project directory	source
[2026/08/10 23:28:22]	tech-briefing	/Users/showlotus/Desktop/MyCode/xxx	command
```

The timestamp is local time in `[YYYY/MM/DD HH:MM:SS]` format. The source is `skill` (agent-initiated via tool) or `command` (user slash-command).

## Query templates

Before running a query, make sure the `LOG` shell variable points at the actual log file.

### 1. Overall ranking (highest first)

```bash
cut -f2 "$LOG" | sort | uniq -c | sort -rn
```

### 2. Filter by time range

Timestamps compare correctly as strings (fixed-width format). Convert the user's natural-language time into `[YYYY/MM/DD HH:MM:SS]` boundaries.

```bash
# Example: 2026/08/01 (inclusive) to 2026/08/09 (exclusive)
awk -F'\t' '$1 >= "[2026/08/01" && $1 < "[2026/08/09" {print $2}' "$LOG" | sort | uniq -c | sort -rn
```

### 3. Filter by project

Match the project directory keyword against column 3.

```bash
# Example: only the opencode-image-vision project
awk -F'\t' '$3 ~ /opencode-image-vision/ {print $2}' "$LOG" | sort | uniq -c | sort -rn
```

### 4. Filter by source

```bash
# Example: only agent-initiated calls
awk -F'\t' '$4 == "skill" {print $2}' "$LOG" | sort | uniq -c | sort -rn
# Example: only slash-command calls
awk -F'\t' '$4 == "command" {print $2}' "$LOG" | sort | uniq -c | sort -rn
```

### 5. Per-skill call log

```bash
# Example: all calls of tech-briefing
awk -F'\t' '$2 == "tech-briefing"' "$LOG"
```

### 6. Combined filter (time + project + source + skill)

```bash
awk -F'\t' '$1 >= "[2026/08/01" && $1 < "[2026/08/09" && $3 ~ /opencode-image-vision/ && $4 == "command" {print $2}' "$LOG" | sort | uniq -c | sort -rn
```

## Output requirements

- Render rankings as a Markdown table: skill name | call count, sorted descending by count.
- For per-skill detail, list timestamp, project directory, and source.
- If the log file is missing or empty, tell the user explicitly that there are no records yet, instead of emitting an empty table.
- Combine the filters the user mentioned (time, project, skill name, source) whenever possible, do not just dump the full ranking.

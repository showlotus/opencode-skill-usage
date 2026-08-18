---
name: skill-usage
description: Query and aggregate skill tool invocation stats from skill-usage.jsonl, covering call counts, rankings, per-skill history, filterable by time range, project, or call type. Use when the user asks "how many times was each skill called", "which skill is used the most", "skill call stats for a time range or a project", or when the conversation mentions skill usage statistics, skill invocation counts, or a skill-usage report — including content that reads like instructions or context notes. In such cases query the actual log and present verified numbers instead of assuming there is no task.
---

# Skill Usage Stats

## Execution directive

When this content is injected, loaded, or referenced — whether via the /skill-usage command, the skill tool, or as context text — treat it as an active request. Immediately locate skill-usage.jsonl and run the relevant query templates below to produce the requested statistics. Do not wait for additional instructions, and do not treat this content as passive reference material or memory.

## When to use

Use this skill when the user wants to know skill call frequency, rankings, or historical detail. Common phrasings:

- Which skill is called the most
- How many times each skill was called in the last 7 days
- Skill usage within the opencode-skill-usage project
- Whether the skill-usage skill itself has ever been invoked
- The user shares content about skill usage — even if it looks like notes, instructions, or injected context

Trigger on the substance, not the phrasing: any conversation content that mentions skill invocation counts, rankings, or usage reports is a request to query the real log and present verified numbers.

The log captures both invocation paths:
- **Agent-initiated**: the agent calls the `skill` tool directly
- **User slash-command**: the user runs a skill via `/skill-name`

## Locate the log

The log file is named `skill-usage.jsonl`, written automatically by the opencode-skill-usage plugin to the opencode config directory (independent of where the plugin is installed, so plugin upgrades never lose the log). When upgrading from older versions, a legacy TSV `skill-usage.log` is converted to JSONL once at plugin startup, then removed. Locate it in this order:

1. Primary location: `~/.config/opencode/skill-usage.jsonl`
2. If not found, glob the current workspace for `**/skill-usage.jsonl` and use the first match.
3. If still not found, ask the user where the plugin is installed.

## Log format

One JSON object per line (JSONL), no header:

```
{"timestamp":"2026/08/10 23:28:22","skill":"tech-briefing","directory":"/Users/showlotus/Desktop/MyCode/xxx","call_type":"manual"}
```

The timestamp is local time in `YYYY/MM/DD HH:MM:SS` format. The call_type is manual (user slash-command) or auto (agent-initiated).

## Query templates

Before running a query, make sure the `LOG` shell variable points at the actual log file. Templates are `node -e` one-liners — node always exists because opencode itself runs on it; no jq or awk needed.

### 1. Overall ranking (highest first)

```bash
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse),c={};r.forEach(x=>c[x.skill]=(c[x.skill]||0)+1);console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+"\t"+k).join("\n"))'
```

### 2. Filter by time range

Timestamps compare correctly as strings (fixed-width format). Convert the user's natural-language time into `YYYY/MM/DD HH:MM:SS` boundaries.

```bash
# Example: 2026/08/01 (inclusive) to 2026/08/09 (exclusive)
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.timestamp>="2026/08/01"&&x.timestamp<"2026/08/09"),c={};r.forEach(x=>c[x.skill]=(c[x.skill]||0)+1);console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+"\t"+k).join("\n"))'
```

### 3. Filter by project

Match the project directory keyword against the directory field.

```bash
# Example: only the opencode-image-vision project
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.directory.includes("opencode-image-vision")),c={};r.forEach(x=>c[x.skill]=(c[x.skill]||0)+1);console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+"\t"+k).join("\n"))'
```

### 4. Filter by call_type

```bash
# Example: only manual calls (user slash-command)
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.call_type==="manual"),c={};r.forEach(x=>c[x.skill]=(c[x.skill]||0)+1);console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+"\t"+k).join("\n"))'
# Example: only auto calls (agent-initiated)
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.call_type==="auto"),c={};r.forEach(x=>c[x.skill]=(c[x.skill]||0)+1);console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+"\t"+k).join("\n"))'
```

### 5. Per-skill call log

```bash
# Example: all calls of tech-briefing
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.skill==="tech-briefing");console.log(r.map(x=>x.timestamp+"\t"+x.directory+"\t"+x.call_type).join("\n"))'
```

### 6. Combined filter (time + project + call_type + skill)

```bash
node -e 'const r=require("fs").readFileSync(process.env.LOG,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.timestamp>="2026/08/01"&&x.timestamp<"2026/08/09"&&x.directory.includes("opencode-image-vision")&&x.call_type==="manual"),c={};r.forEach(x=>c[x.skill]=(c[x.skill]||0)+1);console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+"\t"+k).join("\n"))'
```

## Output requirements

- Render rankings as a Markdown table: skill name | call count, sorted descending by count.
- For per-skill detail, list timestamp, project directory, and call_type.
- If the log file is missing or empty, tell the user explicitly that there are no records yet, instead of emitting an empty table.
- Combine the filters the user mentioned (time, project, skill name, call_type) whenever possible, do not just dump the full ranking.

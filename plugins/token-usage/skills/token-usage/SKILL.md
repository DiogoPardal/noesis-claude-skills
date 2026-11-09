---
name: token-usage
description: Report Claude Code token usage for the current project from .claude/hooks/token-stats.json. Use when the user asks how many tokens were used, which models or sessions used them, or wants a usage or cost summary for this project.
---

# Token usage report

A hook from this plugin runs at the end of every turn (`Stop`) and every subagent (`SubagentStop`). It reads the session transcripts and keeps running totals in `.claude/hooks/token-stats.json` at the project root.

## File format

```json
{
  "totals":   { "requests": 0, "input": 0, "output": 0, "cached": 0, "cacheWrite": 0, "total": 0 },
  "models":   { "<model id>":   { "...same fields as totals..." } },
  "sessions": { "<session id>": { "...same fields...", "firstSeen": "<ISO>", "lastSeen": "<ISO>" } },
  "cursors":  { "<session id>": { "main": 0, "subagents/<file>.jsonl": 0 } },
  "updatedAt": "<ISO>"
}
```

- `input`: uncached input tokens. `cached`: cache reads. `cacheWrite`: cache writes. `output`: output tokens.
- `total` is `input + output` only. It does **not** include `cached` or `cacheWrite`; say so whenever you report it.
- `requests` counts assistant API responses, not user prompts.
- `cursors` are internal bookkeeping (byte offsets already counted). Never edit them.

## How to report

1. Read the file. If it does not exist, say that no usage has been recorded yet for this project and that the plugin's hook may not be active.
2. Give the totals first, then a per-model breakdown sorted by `total`, then sessions only if the user asks.
3. Mention `updatedAt`: the current turn is counted only after it ends.
4. For cost, ask which price list to use or state the prices you assume; do not present cost estimates as exact.

Never modify or delete `token-stats.json`.

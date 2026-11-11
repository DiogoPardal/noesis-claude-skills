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

1. Read the file. If it does not exist, say that no usage has been recorded yet for this project and help the user find out why (see "When the file is missing").
2. Give the totals first, then a per-model breakdown sorted by `total`, then sessions only if the user asks.
3. Mention `updatedAt`: the current turn is counted only after it ends.
4. For cost, ask which price list to use or state the prices you assume; do not present cost estimates as exact.

## When the file is missing

The hook writes the file after the first reply that ends in a session started after the plugin was installed. If it is still missing, check these causes in order:

1. **Node.js is missing or older than 18.** The hook runs `node`, so without it nothing is recorded, even though this skill still loads. Ask the user to run `node --version` in a terminal. If it fails or shows a version below 18, suggest installing the Node.js LTS from https://nodejs.org (on Windows also `winget install OpenJS.NodeJS.LTS`) and then fully closing and reopening the Claude app so it sees the new `PATH`. Only run an install command if the user asks you to; never install it on your own initiative.
2. **The session started before the plugin was installed or enabled.** Hooks load when a session starts. Ask the user to open a new session in the same folder, send one message, and ask again.
3. **The plugin is not enabled for this folder**, or hooks are turned off. Check that `"token-usage@noesis": true` is in `enabledPlugins` in the user's or project's `.claude/settings.json`, and that `disableAllHooks` is not `true`.

Never modify or delete `token-stats.json`.

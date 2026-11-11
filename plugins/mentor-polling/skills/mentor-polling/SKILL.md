---
name: mentor-polling
description: How to wait for and read OutSystems Mentor runs (mentor_prompt / mentor_get_run) without wasting time or tokens. Use whenever you start a Mentor prompt and need to poll its run, page through a finished run's answer, or interpret compacted mentor_get_run output.
---

# Polling OutSystems Mentor runs

Mentor work is asynchronous: a start tool (for example `mentor_prompt`) returns a run id, and `mentor_get_run` reports progress until the run reaches a terminal status (`succeeded`, `failed` or `cancelled`).

## How to poll

- Poll the same run at most about once every 45 seconds. When this skill's plugin is installed, a hook enforces that pause for you before each `mentor_get_run` call, so a call may take a while to return. That is expected, not a hang.
- Do not start a second prompt in the same session while a run is still in progress just because a poll is slow.
- Once a run is terminal, stop polling for progress. Later calls for that run (to page through the answer) are not delayed.
- If a run is `failed` or `cancelled`, report that status and the last messages to the user before retrying anything.

## Reading the output

When the plugin is installed, `mentor_get_run` output is compacted before you see it:

- consecutive text chunks are merged into one `{ "msgType": "text", "text": ... }` event;
- reasoning events keep only a title: `{ "msgType": "reasoning", "title": ... }`;
- status events keep only their label: `{ "msgType": "status", "statusType": ... }`;
- any other event type is kept unchanged;
- identical run documents are listed once.

The compacted text is all the information you need to follow the run. Do not ask for the raw output unless the user is debugging the hooks.

## Without the hooks

If the plugin's hooks are not active (another agent, or hooks disabled), follow the same cadence yourself: wait about 45 seconds between polls of the same run and summarize long outputs instead of repeating them.

If the plugin is installed but polls return at once and the output is not compacted, the hooks are not running. The most common cause is Node.js missing or older than 18: the hooks run `node`. Ask the user to run `node --version` in a terminal. If it fails, suggest installing the Node.js LTS from https://nodejs.org (on Windows also `winget install OpenJS.NodeJS.LTS`) and then fully reopening the Claude app. Only run an install command if the user asks you to. If Node.js is fine, a new session is needed: hooks load when a session starts.

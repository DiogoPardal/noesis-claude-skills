// PreToolUse hook: spaces out mentor_get_run polls for the same run so the agent does not hammer the API.
// It only delays the call; it never makes a permission decision, so the normal permission flow still applies.
const fs = require('node:fs');
const path = require('node:path');

const MINIMUM_INTERVAL_MS = Number(process.env.MENTOR_POLL_INTERVAL_MS) || 45_000;
const STATE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (input += chunk));
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function isMentorPoll(toolName) {
  return /(?:^|__)mentor_get_run$/i.test(toolName);
}

function getRunId(toolInput) {
  const input = toolInput && typeof toolInput === 'object' ? toolInput : {};
  const runId = input.runId ?? input.run_id ?? input.id;
  return runId == null || runId === '' ? '' : String(runId);
}

function stateFileOf(event) {
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  return path.join(root, '.claude', 'hooks', '.mentor-poll-state.json');
}

// Written by mentor-get-run-filter.cjs when a poll returns a terminal status.
function isFinishedRun(event, runId) {
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  try {
    const finished = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'hooks', '.mentor-finished-runs.json'), 'utf8'));
    return Object.hasOwn(finished, runId);
  } catch {
    return false;
  }
}

function loadState(stateFile, now) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const lastPoll = state.lastPoll && typeof state.lastPoll === 'object' ? state.lastPoll : {};
    return {
      lastPoll: Object.fromEntries(
        Object.entries(lastPoll).filter(([, timestamp]) => now - Number(timestamp) < STATE_MAX_AGE_MS),
      ),
    };
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    return { lastPoll: {} };
  }
}

function saveState(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, stateFile);
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) return;

  const event = JSON.parse(raw);
  if (!isMentorPoll(String(event.tool_name ?? ''))) return;

  const runId = getRunId(event.tool_input);
  if (!runId) return;

  // The agent is done; reading the rest of its answer needs no pacing.
  if (isFinishedRun(event, runId)) return;

  const stateFile = stateFileOf(event);
  const previousPoll = Number(loadState(stateFile, Date.now()).lastPoll[runId] ?? 0);
  const waitMs = previousPoll ? Math.max(0, MINIMUM_INTERVAL_MS - (Date.now() - previousPoll)) : 0;

  if (waitMs > 0) {
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  // Reload after waiting so polls for other runs recorded in the meantime are not overwritten.
  const now = Date.now();
  const state = loadState(stateFile, now);
  state.lastPoll[runId] = now;
  saveState(stateFile, state);
}

main().catch(error => {
  // A throttle failure must never block the poll.
  process.stderr.write(`Mentor poll throttle warning: ${error.message}\n`);
  process.exitCode = 0;
});

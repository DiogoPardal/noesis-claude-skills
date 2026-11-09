// PostToolUse hook: compacts mentor_get_run output (drops reasoning/status events, merges text chunks,
// removes duplicate run documents) before Claude sees it.
// Ported from dresend/scripts-ai-outsystems@e9579633 (.claude/hooks/mentor-get-run-filter.cjs).
// Only change: the helper is always loaded from this folder (the old ../../.github/hooks fallback did not exist).
const fs = require('node:fs');
const path = require('node:path');

const { parseJson, parseJsonDocuments, compactResult, serializeDocuments } = require('./mentor-run-text.cjs');

const TARGET_TOOL = /(?:^|__)mentor_get_run$/i;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);
const FINISHED_FILE = '.mentor-finished-runs.json';
const FINISHED_MAX_AGE_MS = 6 * 60 * 60 * 1_000;

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (input += chunk));
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function hooksDirOf(event) {
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  return path.join(root, '.claude', 'hooks');
}

// All-text content blocks joined into one string, or null when any block is something else.
function joinTextBlocks(content) {
  if (!Array.isArray(content) || content.length === 0) return null;
  if (!content.every(block => block?.type === 'text' && typeof block.text === 'string')) return null;
  return content.map(block => block.text).join('\n');
}

// MCP tool_response may be a string, a content-block array or a { content: [...] } object.
// Returns the text plus a function that rebuilds the response in the same shape.
function locateText(response) {
  if (typeof response === 'string') return { text: response, rebuild: text => text };
  if (Array.isArray(response)) {
    const text = joinTextBlocks(response);
    return text === null ? null : { text, rebuild: value => [{ type: 'text', text: value }] };
  }
  if (response && typeof response === 'object') {
    const text = joinTextBlocks(response.content);
    if (text === null) return null;
    return {
      text,
      rebuild: value => {
        // structuredContent would still carry the uncompacted run.
        const { structuredContent, ...rest } = response;
        return { ...rest, content: [{ type: 'text', text: value }] };
      },
    };
  }
  return null;
}

function characterCount(value) {
  return Array.from(value).length;
}

function savingsStats(originalText, finalText) {
  const originalCharacters = characterCount(originalText);
  const finalCharacters = characterCount(finalText);
  const savedCharacters = Math.max(0, originalCharacters - finalCharacters);
  return {
    originalCharacters,
    finalCharacters,
    savedCharacters,
    savedPercent: originalCharacters ? Math.round((savedCharacters / originalCharacters) * 100) : 0,
  };
}

function appendLog(event, name, entry) {
  const dir = hooksDirOf(event);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, name), `${JSON.stringify(entry)}\n`, 'utf8');
}

function logTerminalRun(event, documents, stats) {
  const terminal = documents.find(document => TERMINAL_STATUSES.has(String(document.status ?? '').toLowerCase()));
  if (!terminal) return;
  appendLog(event, '.mentor-get-run-filter.jsonl', {
    timestamp: new Date().toISOString(),
    runId: terminal.runId ?? null,
    status: terminal.status,
    originalCharacters: stats.originalCharacters,
    finalCharacters: stats.finalCharacters,
    savedPercent: stats.savedPercent,
  });
}

// The throttle reads this file: once a run is terminal the agent is done, so later polls (paging through
// the answer) have nothing to wait for. Only the filter writes it, so the throttle's state file stays untouched.
function recordFinishedRun(event, text) {
  const terminal = (parseJsonDocuments(text) ?? []).find(document =>
    TERMINAL_STATUSES.has(String(document?.status ?? '').toLowerCase()),
  );
  if (!terminal) return;

  const toolInput = event.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
  const runId = terminal.runId ?? toolInput.runId ?? toolInput.run_id ?? toolInput.id;
  if (runId == null || runId === '') return;

  const dir = hooksDirOf(event);
  const file = path.join(dir, FINISHED_FILE);
  const now = Date.now();
  let finished = {};
  try {
    finished = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Missing or corrupt file: start fresh.
  }
  finished = Object.fromEntries(
    Object.entries(finished).filter(([, stamp]) => now - Number(stamp) < FINISHED_MAX_AGE_MS),
  );
  finished[String(runId)] = now;

  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(finished, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

// Returns the hook output, or null to leave the tool result unchanged.
// persist: false skips the files the hook writes (finished-run marker and savings log).
function processEvent(event, { persist = true } = {}) {
  if (!event || !TARGET_TOOL.test(String(event.tool_name ?? ''))) return null;

  const located = locateText(event.tool_response);
  if (!located) return null;

  if (persist) {
    try {
      recordFinishedRun(event, located.text);
    } catch (error) {
      process.stderr.write(`Mentor run filter state warning: ${error.message}\n`);
    }
  }

  const documents = compactResult(located.text);
  if (documents === null) return null;

  const text = serializeDocuments(documents);
  const stats = savingsStats(located.text, text);
  // Never replace the output with something larger (also keeps the hook idempotent).
  if (stats.finalCharacters >= stats.originalCharacters) return null;

  if (persist) {
    try {
      logTerminalRun(event, documents, stats);
    } catch (error) {
      process.stderr.write(`Mentor run filter log warning: ${error.message}\n`);
    }
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: located.rebuild(text),
    },
  };
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) return;
  const event = parseJson(raw);

  // Set MENTOR_HOOK_DEBUG=1 to capture the real payload shape for troubleshooting.
  // WARNING: this writes the full event (tool input and the complete Mentor response) to disk.
  if (process.env.MENTOR_HOOK_DEBUG && event && TARGET_TOOL.test(String(event.tool_name ?? ''))) {
    appendLog(event, '.mentor-hook-debug.jsonl', event);
  }

  const output = processEvent(event);
  if (output !== null) process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Mentor run filter warning: ${error.message}\n`);
    process.exitCode = 0;
  });
}

module.exports = { locateText, savingsStats, processEvent };

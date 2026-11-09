// Stop/SubagentStop hook: aggregates token usage from Claude Code transcripts into .claude/hooks/token-stats.json.
// Counts the main transcript and every subagent transcript of the session, once per assistant message.
// Ported from dresend/scripts-ai-outsystems@e9579633 (.claude/hooks/token-usage-tracker.cjs).
// Only change: a leading UTF-8 BOM on stdin is ignored (as in the global ~/.claude/hooks tracker).
const fs = require('node:fs');
const path = require('node:path');

const TOKEN_FIELDS = ['input', 'output', 'cached', 'cacheWrite'];
const USAGE_KEYS = {
  input: 'input_tokens',
  output: 'output_tokens',
  cached: 'cache_read_input_tokens',
  cacheWrite: 'cache_creation_input_tokens',
};

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (input += chunk));
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function emptyTotals() {
  return { requests: 0, input: 0, output: 0, cached: 0, cacheWrite: 0, total: 0 };
}

function addUsage(totals, usage) {
  totals.requests += 1;
  for (const field of TOKEN_FIELDS) totals[field] += usage[field];
  totals.total += usage.input + usage.output;
}

function bucket(map, key) {
  return (map[key] ??= emptyTotals());
}

function toCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function loadStats(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Missing or corrupt file: start fresh.
  }
  return {};
}

// Totals and cursors live in the same file and are replaced atomically, so concurrent hooks stay consistent.
function saveStats(file, stats) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(stats, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

// Reads only complete lines past the saved byte offset so each line is counted once.
function readNewEntries(file, offset) {
  const size = fs.statSync(file).size;
  const start = size < offset ? 0 : offset;
  if (size === start) return { entries: [], nextOffset: start };
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    const lastNewline = buffer.lastIndexOf(0x0a);
    if (lastNewline < 0) return { entries: [], nextOffset: start };
    const entries = [];
    for (const line of buffer.subarray(0, lastNewline + 1).toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines.
      }
    }
    return { entries, nextOffset: start + lastNewline + 1 };
  } finally {
    fs.closeSync(fd);
  }
}

// One API response is written as several transcript lines that share a message id; keep the last usage per id.
function usagePerMessage(entries) {
  const messages = new Map();
  entries.forEach((entry, index) => {
    if (entry?.type !== 'assistant' || !entry.message?.usage) return;
    const model = String(entry.message.model || 'unknown');
    if (model === '<synthetic>') return;
    const usage = {};
    for (const field of TOKEN_FIELDS) usage[field] = toCount(entry.message.usage[USAGE_KEYS[field]]);
    messages.set(entry.message.id || entry.uuid || `line:${index}`, { model, usage, ts: entry.timestamp });
  });
  return [...messages.values()];
}

function applyMessages(stats, sessionId, messages) {
  stats.models ??= {};
  stats.sessions ??= {};
  const session = (stats.sessions[sessionId] ??= { ...emptyTotals(), firstSeen: '', lastSeen: '' });

  for (const { model, usage, ts } of messages) {
    addUsage(stats.totals, usage);
    addUsage(bucket(stats.models, model), usage);
    addUsage(session, usage);

    const stamp = ts ? new Date(ts).toISOString() : '';
    if (stamp && stamp !== 'Invalid Date') {
      session.firstSeen ||= stamp;
      session.lastSeen = stamp;
    }
  }
}

// Main transcript plus <transcript dir>/<session id>/subagents/*.jsonl.
function transcriptFiles(event) {
  const main = path.resolve(event.transcript_path);
  const files = new Map([['main', main]]);
  const subagentsDir = path.join(path.dirname(main), event.session_id, 'subagents');
  try {
    for (const name of fs.readdirSync(subagentsDir)) {
      if (name.endsWith('.jsonl')) files.set(`subagents/${name}`, path.join(subagentsDir, name));
    }
  } catch {
    // No subagents were used in this session.
  }
  if (event.agent_transcript_path) {
    const agentFile = path.resolve(event.agent_transcript_path);
    files.set(`subagents/${path.basename(agentFile)}`, agentFile);
  }
  return files;
}

async function main() {
  const raw = (await readStdin()).replace(/^﻿/, '');
  const event = raw.trim() ? JSON.parse(raw) : {};
  const sessionId = String(event.session_id || '');
  if (!sessionId || !event.transcript_path || !fs.existsSync(event.transcript_path)) {
    process.stderr.write('token-usage-tracker: transcript not found.\n');
    return;
  }

  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const hooksDir = path.join(root, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const statsFile = path.join(hooksDir, 'token-stats.json');

  const stats = loadStats(statsFile);
  stats.totals ??= emptyTotals();
  stats.cursors ??= {};
  const cursors = (stats.cursors[sessionId] ??= {});

  for (const [key, file] of transcriptFiles(event)) {
    if (!fs.existsSync(file)) continue;
    const { entries, nextOffset } = readNewEntries(file, cursors[key] ?? 0);
    cursors[key] = nextOffset;
    applyMessages(stats, sessionId, usagePerMessage(entries));
  }

  stats.updatedAt = new Date().toISOString();
  saveStats(statsFile, stats);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`token-usage-tracker: ${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { usagePerMessage, applyMessages, readNewEntries };

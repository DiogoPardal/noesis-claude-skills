const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PLUGIN_SCRIPTS, tmpProject, runHook, hooksDir, readJsonIfExists } = require('./helpers.cjs');

const SESSION = 'session-synthetic';

function line(id, model, input, output, extra = {}) {
  return `${JSON.stringify({
    type: 'assistant',
    timestamp: '2026-11-09T10:00:00.000Z',
    message: { id, model, usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 5, cache_creation_input_tokens: 1 } },
    ...extra,
  })}\n`;
}

function setup() {
  const project = tmpProject();
  const transcripts = path.join(project, 'transcripts');
  fs.mkdirSync(transcripts, { recursive: true });
  const main = path.join(transcripts, `${SESSION}.jsonl`);
  fs.writeFileSync(main, '');
  const event = { session_id: SESSION, transcript_path: main, hook_event_name: 'Stop' };
  const stats = () => readJsonIfExists(path.join(hooksDir(project), 'token-stats.json'));
  const run = (extra = {}) => runHook(PLUGIN_SCRIPTS.tracker, { ...event, ...extra }, { projectDir: project });
  return { project, transcripts, main, run, stats };
}

test('counts each assistant message once, per model and session', () => {
  const t = setup();
  fs.writeFileSync(t.main, [
    line('msg-1', 'model-a', 10, 2),
    line('msg-1', 'model-a', 10, 20), // same message streamed again: the last usage wins
    line('msg-2', 'model-b', 7, 3),
    line('msg-3', '<synthetic>', 99, 99),
    `${JSON.stringify({ type: 'user', message: { content: 'hi' } })}\n`,
    'not json\n',
  ].join(''));
  assert.equal(t.run().status, 0);
  const s = t.stats();
  assert.deepEqual(s.totals, { requests: 2, input: 17, output: 23, cached: 10, cacheWrite: 2, total: 40 });
  assert.equal(s.models['model-a'].output, 20);
  assert.equal(s.models['model-b'].requests, 1);
  assert.equal(s.sessions[SESSION].requests, 2);
});

test('is incremental: re-running adds nothing, new lines are added once', () => {
  const t = setup();
  fs.writeFileSync(t.main, line('msg-1', 'model-a', 10, 2));
  t.run();
  t.run();
  assert.equal(t.stats().totals.requests, 1);
  fs.appendFileSync(t.main, line('msg-2', 'model-a', 1, 1));
  t.run();
  assert.deepEqual([t.stats().totals.requests, t.stats().totals.input], [2, 11]);
});

test('an incomplete last line is not consumed until it is complete', () => {
  const t = setup();
  const full = line('msg-1', 'model-a', 10, 2);
  fs.writeFileSync(t.main, full.slice(0, 20));
  t.run();
  assert.equal(t.stats().totals.requests, 0);
  fs.writeFileSync(t.main, full);
  t.run();
  assert.equal(t.stats().totals.requests, 1);
});

test('includes subagent transcripts, without counting the same file twice', () => {
  const t = setup();
  const subDir = path.join(t.transcripts, SESSION, 'subagents');
  fs.mkdirSync(subDir, { recursive: true });
  const agentFile = path.join(subDir, 'agent-1.jsonl');
  fs.writeFileSync(agentFile, line('sub-1', 'model-a', 4, 4));
  fs.writeFileSync(t.main, line('msg-1', 'model-a', 1, 1));
  t.run({ hook_event_name: 'SubagentStop', agent_transcript_path: agentFile });
  assert.equal(t.stats().totals.requests, 2);
});

test('a missing transcript is reported and writes nothing', () => {
  const project = tmpProject();
  const r = runHook(PLUGIN_SCRIPTS.tracker, { session_id: SESSION, transcript_path: path.join(project, 'nope.jsonl') }, { projectDir: project });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /transcript not found/);
  assert.equal(fs.existsSync(path.join(hooksDir(project), 'token-stats.json')), false);
});

// KNOWN LIMITATION (kept on purpose so a future fix flips this test): deduplication by message id only
// happens inside one read. If the lines of one message are split across two hook runs (possible at
// SubagentStop, when the main transcript can lag), that message is counted twice.
test('known limitation: a message split across two runs is counted twice', () => {
  const t = setup();
  fs.writeFileSync(t.main, line('msg-1', 'model-a', 10, 2));
  t.run();
  fs.appendFileSync(t.main, line('msg-1', 'model-a', 10, 20));
  t.run();
  assert.equal(t.stats().totals.requests, 2);
});

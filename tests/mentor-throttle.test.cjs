const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PLUGIN_SCRIPTS, tmpProject, runHook, hooksDir, readJsonIfExists } = require('./helpers.cjs');
const { preToolUseEvent } = require('./fixtures/mentor-run.cjs');

const INTERVAL_MS = 1500;
const env = { MENTOR_POLL_INTERVAL_MS: String(INTERVAL_MS) };
const stateFile = dir => path.join(hooksDir(dir), '.mentor-poll-state.json');

test('first poll is not delayed and is recorded; it makes no permission decision', () => {
  const dir = tmpProject();
  const r = runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent(), { projectDir: dir, env });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'no JSON output means no permission decision');
  assert.ok(r.ms < INTERVAL_MS - 200, `took ${r.ms} ms`);
  assert.ok(readJsonIfExists(stateFile(dir)).lastPoll['run-synthetic-1']);
});

test('a second poll of the same run waits for the interval; another run does not', () => {
  const dir = tmpProject();
  runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent(), { projectDir: dir, env });
  const same = runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent(), { projectDir: dir, env });
  assert.ok(same.ms >= INTERVAL_MS - 300, `same run waited only ${same.ms} ms`);

  const other = runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent({ toolInput: { run_id: 'run-other' } }), { projectDir: dir, env });
  assert.ok(other.ms < INTERVAL_MS - 200, `other run took ${other.ms} ms`);
  const state = readJsonIfExists(stateFile(dir)).lastPoll;
  assert.ok(state['run-synthetic-1'] && state['run-other'], 'both runs are kept in the state');
});

test('a finished run is not delayed', () => {
  const dir = tmpProject();
  runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent(), { projectDir: dir, env });
  fs.writeFileSync(path.join(hooksDir(dir), '.mentor-finished-runs.json'), JSON.stringify({ 'run-synthetic-1': Date.now() }));
  const r = runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent(), { projectDir: dir, env });
  assert.ok(r.ms < INTERVAL_MS - 200, `finished run took ${r.ms} ms`);
});

test('other tools and calls without a run id are ignored', () => {
  const dir = tmpProject();
  runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent({ toolName: 'mcp__outsystems__mentor_prompt' }), { projectDir: dir, env });
  runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent({ toolInput: {} }), { projectDir: dir, env });
  assert.equal(fs.existsSync(stateFile(dir)), false);
});

test('a corrupt state file or bad input never blocks the poll', () => {
  const dir = tmpProject();
  fs.mkdirSync(hooksDir(dir), { recursive: true });
  fs.writeFileSync(stateFile(dir), '{ not json');
  const corrupt = runHook(PLUGIN_SCRIPTS.throttle, preToolUseEvent(), { projectDir: dir, env });
  assert.equal(corrupt.status, 0);
  assert.ok(readJsonIfExists(stateFile(dir)).lastPoll['run-synthetic-1']);

  const bad = runHook(PLUGIN_SCRIPTS.throttle, 'not json', { projectDir: dir, env });
  assert.equal(bad.status, 0);
  assert.match(bad.stderr, /Mentor poll throttle warning/);
});

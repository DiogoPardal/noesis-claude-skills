const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PLUGIN_SCRIPTS, tmpProject, runHook, hooksDir, readJsonIfExists } = require('./helpers.cjs');
const { runText, postToolUseEvent } = require('./fixtures/mentor-run.cjs');
const { processEvent } = require(PLUGIN_SCRIPTS.filter);
const { parseJsonDocuments } = require(path.join(path.dirname(PLUGIN_SCRIPTS.filter), 'mentor-run-text.cjs'));

function compactedText(output) {
  return output.hookSpecificOutput.updatedToolOutput;
}

test('other tools are left unchanged and no files are written', () => {
  const dir = tmpProject();
  const r = runHook(PLUGIN_SCRIPTS.filter, postToolUseEvent(runText(), { toolName: 'mcp__outsystems__mentor_get_event' }), { projectDir: dir });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(fs.existsSync(hooksDir(dir)), false);
});

test('compacts a run: merges text, keeps one reasoning/status label, keeps other events, removes duplicates', () => {
  const output = processEvent(postToolUseEvent(runText()), { persist: false });
  assert.ok(output, 'expected the output to be replaced');
  assert.equal(output.hookSpecificOutput.hookEventName, 'PostToolUse');
  const docs = parseJsonDocuments(compactedText(output));
  assert.equal(docs.length, 1, 'duplicate documents are removed');
  assert.deepEqual(docs[0].events, [
    { msgType: 'text', text: 'Creating the Customer entity.' },
    { msgType: 'reasoning', title: 'Planning the data model' },
    { msgType: 'status', statusType: 'Building' },
    { MsgType: 'toolCall', name: 'create_entity', args: { name: 'Customer' } },
    { msgType: 'text', text: 'Done with step one.' },
  ]);
  assert.equal(docs[0].runId, 'run-synthetic-1');
  assert.equal(docs[0].status, 'running');
});

test('output is never larger, and compaction is idempotent', () => {
  const original = runText();
  const once = compactedText(processEvent(postToolUseEvent(original), { persist: false }));
  assert.ok(once.length < original.length);
  assert.equal(processEvent(postToolUseEvent(once), { persist: false }), null, 'second pass leaves the result unchanged');
});

test('keeps the response shape: content-block array', () => {
  const output = processEvent(postToolUseEvent([{ type: 'text', text: runText() }]), { persist: false });
  const updated = compactedText(output);
  assert.ok(Array.isArray(updated));
  assert.equal(updated.length, 1);
  assert.equal(updated[0].type, 'text');
});

test('keeps the response shape: { content } object, and drops structuredContent', () => {
  const response = { content: [{ type: 'text', text: runText() }], structuredContent: { big: true }, isError: false };
  const updated = compactedText(processEvent(postToolUseEvent(response), { persist: false }));
  assert.equal(updated.isError, false);
  assert.equal(updated.content.length, 1);
  assert.equal('structuredContent' in updated, false);
});

test('leaves non-text and non-JSON responses unchanged', () => {
  assert.equal(processEvent(postToolUseEvent([{ type: 'image', data: 'x' }]), { persist: false }), null);
  assert.equal(processEvent(postToolUseEvent('plain text, not JSON'), { persist: false }), null);
  assert.equal(processEvent(postToolUseEvent('{"no":"events"}'), { persist: false }), null);
});

test('marks terminal runs for the throttle and logs only counts', () => {
  const dir = tmpProject();
  const r = runHook(PLUGIN_SCRIPTS.filter, postToolUseEvent(runText({ status: 'succeeded' })), { projectDir: dir });
  assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout).hookSpecificOutput.updatedToolOutput);

  const finished = readJsonIfExists(path.join(hooksDir(dir), '.mentor-finished-runs.json'));
  assert.ok(Object.hasOwn(finished, 'run-synthetic-1'));

  const log = fs.readFileSync(path.join(hooksDir(dir), '.mentor-get-run-filter.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(log.length, 1);
  assert.deepEqual(Object.keys(log[0]).sort(), ['finalCharacters', 'originalCharacters', 'runId', 'savedPercent', 'status', 'timestamp']);
  assert.ok(!JSON.stringify(log).includes('Customer'), 'the log holds no response content');
});

test('debug log is written only when MENTOR_HOOK_DEBUG is set', () => {
  const off = tmpProject();
  runHook(PLUGIN_SCRIPTS.filter, postToolUseEvent(runText()), { projectDir: off });
  assert.equal(fs.existsSync(path.join(hooksDir(off), '.mentor-hook-debug.jsonl')), false);

  const on = tmpProject();
  runHook(PLUGIN_SCRIPTS.filter, postToolUseEvent(runText()), { projectDir: on, env: { MENTOR_HOOK_DEBUG: '1' } });
  assert.equal(fs.existsSync(path.join(hooksDir(on), '.mentor-hook-debug.jsonl')), true);
});

test('invalid input never fails the hook', () => {
  const dir = tmpProject();
  const r = runHook(PLUGIN_SCRIPTS.filter, 'this is not json', { projectDir: dir });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

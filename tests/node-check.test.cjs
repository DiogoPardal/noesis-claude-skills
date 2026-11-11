// The SessionStart hook of each plugin warns Claude when Node.js 18+ is missing. It cannot use node, so it runs in
// PowerShell ("shell": "powershell" in hooks.json). These tests run the exact command from hooks.json in Windows
// PowerShell with node present, with node missing, and with an old node version.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, tmpProject } = require('./helpers.cjs');

const PLUGINS = ['mentor-polling', 'token-usage'];
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const skip = process.platform !== 'win32' || !fs.existsSync(POWERSHELL) ? 'needs Windows PowerShell' : false;

function nodeCheckOf(id) {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugins', id, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.equal(hooks.SessionStart.length, 1);
  assert.equal(hooks.SessionStart[0].matcher, 'startup|resume');
  const hook = hooks.SessionStart[0].hooks[0];
  assert.equal(hook.shell, 'powershell');
  return hook.command;
}

// Runs a PowerShell command with PATH replaced (Windows spells it "Path", so drop every casing first).
function runPowerShell(command, pathValue) {
  const env = {};
  for (const [key, val] of Object.entries(process.env)) if (key.toUpperCase() !== 'PATH') env[key] = val;
  env.PATH = pathValue;
  return spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', command], { env, encoding: 'utf8' });
}

function assertWarning(id, stdout) {
  const out = stdout.trim();
  assert.match(out, new RegExp(`^Noesis plugin ${id}: Node\\.js 18 or later was not found`));
  assert.match(out, /https:\/\/nodejs\.org/);
  assert.match(out, /winget install OpenJS\.NodeJS\.LTS/);
  assert.match(out, /Do not install it without the user approval\.$/);
}

for (const id of PLUGINS) {
  test(`${id}: Node check is silent when node 18+ is on the PATH`, { skip }, () => {
    const r = runPowerShell(nodeCheckOf(id), path.dirname(process.execPath));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '');
  });

  test(`${id}: Node check asks Claude to suggest installing Node.js when node is missing`, { skip }, () => {
    const r = runPowerShell(nodeCheckOf(id), tmpProject());
    assert.equal(r.status, 0, r.stderr);
    assertWarning(id, r.stdout);
  });

  test(`${id}: Node check warns when node is older than 18`, { skip }, () => {
    const r = runPowerShell(`function node { 'v16.20.2' }; ${nodeCheckOf(id)}`, tmpProject());
    assert.equal(r.status, 0, r.stderr);
    assertWarning(id, r.stdout);
  });
}

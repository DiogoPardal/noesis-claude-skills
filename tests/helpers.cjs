// Test helpers. All data is synthetic; no real transcripts or Mentor responses are used.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
// Tests run the scripts from the generated plugins, which proves each plugin is self-contained.
const PLUGIN_SCRIPTS = {
  throttle: path.join(ROOT, 'plugins', 'mentor-polling', 'scripts', 'mentor-poll-throttle.cjs'),
  filter: path.join(ROOT, 'plugins', 'mentor-polling', 'scripts', 'mentor-get-run-filter.cjs'),
  tracker: path.join(ROOT, 'plugins', 'token-usage', 'scripts', 'token-usage-tracker.cjs'),
};

// A temporary project folder whose path contains spaces, like many Windows/OneDrive paths.
function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'noesis skills test '));
}

function runHook(script, input, { projectDir, env = {} } = {}) {
  const cleanEnv = { ...process.env };
  delete cleanEnv.MENTOR_HOOK_DEBUG;
  delete cleanEnv.MENTOR_POLL_INTERVAL_MS;
  delete cleanEnv.CLAUDE_PROJECT_DIR;
  const started = Date.now();
  const result = spawnSync(process.execPath, [script], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...cleanEnv, ...(projectDir ? { CLAUDE_PROJECT_DIR: projectDir } : {}), ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, ms: Date.now() - started };
}

function hooksDir(projectDir) {
  return path.join(projectDir, '.claude', 'hooks');
}

function readJsonIfExists(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

module.exports = { ROOT, PLUGIN_SCRIPTS, tmpProject, runHook, hooksDir, readJsonIfExists };

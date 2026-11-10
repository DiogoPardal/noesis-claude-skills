const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, tmpProject } = require('./helpers.cjs');
const { validateRepo } = require('../tools/validate.cjs');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hooksOf = id => readJson(path.join(ROOT, 'plugins', id, 'hooks', 'hooks.json')).hooks;

// A copy of the real catalogue in a temporary folder, to break on purpose.
function copyOfRepo() {
  const copy = tmpProject();
  for (const dir of ['plugins', '.claude-plugin']) fs.cpSync(path.join(ROOT, dir), path.join(copy, dir), { recursive: true });
  return copy;
}

function expectErrors(repo, expected) {
  const { errors } = validateRepo(repo);
  for (const e of expected) assert.ok(errors.some(x => x.startsWith(e)), `missing error: ${e}\n${errors.join('\n')}`);
}

test('the catalogue is valid', () => {
  const { errors, warnings, plugins } = validateRepo(ROOT);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(plugins, ['mentor-polling', 'token-usage']);
});

test('plugins keep their identifiers, skills and hook wiring', () => {
  assert.deepEqual(Object.keys(hooksOf('mentor-polling')).sort(), ['PostToolUse', 'PreToolUse']);
  assert.deepEqual(Object.keys(hooksOf('token-usage')).sort(), ['Stop', 'SubagentStop']);

  const command = script => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/${script}"`;
  const mentor = hooksOf('mentor-polling');
  assert.equal(mentor.PreToolUse[0].matcher, 'mcp__.*__mentor_get_run$');
  assert.equal(mentor.PreToolUse[0].hooks[0].command, command('mentor-poll-throttle.cjs'));
  assert.equal(mentor.PostToolUse[0].matcher, 'mcp__.*__mentor_get_run$');
  assert.equal(mentor.PostToolUse[0].hooks[0].command, command('mentor-get-run-filter.cjs'));
  for (const event of ['Stop', 'SubagentStop']) {
    assert.equal(hooksOf('token-usage')[event][0].hooks[0].command, command('token-usage-tracker.cjs'));
  }

  for (const [id, skill] of [['mentor-polling', 'mentor-polling'], ['token-usage', 'token-usage']]) {
    assert.ok(fs.existsSync(path.join(ROOT, 'plugins', id, 'skills', skill, 'SKILL.md')), `${id} ships the ${skill} skill`);
  }

  const catalogue = readJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
  assert.equal(catalogue.name, 'noesis');
  assert.deepEqual(catalogue.plugins.map(p => [p.name, p.source]), [
    ['mentor-polling', './plugins/mentor-polling'],
    ['token-usage', './plugins/token-usage'],
  ]);
});

test('the validator rejects bad skills, manifests and hooks', () => {
  const repo = copyOfRepo();
  const plugin = path.join(repo, 'plugins', 'token-usage');
  const skill = (dir, content) => {
    fs.mkdirSync(path.join(plugin, 'skills', dir), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'skills', dir, 'SKILL.md'), content);
  };
  skill('good-one', '---\nname: good-one\ndescription: Fine.\n---\nSee `references/missing.md`.\n');
  skill('Bad_Name', '---\nname: Bad_Name\ndescription: x\n---\n');
  skill('mismatch', '---\nname: other\ndescription: x\n---\n');
  skill('no-desc', '---\nname: no-desc\n---\n');
  skill('no-frontmatter', '# Title\n');

  const manifestFile = path.join(plugin, '.claude-plugin', 'plugin.json');
  fs.writeFileSync(manifestFile, JSON.stringify({ ...readJson(manifestFile), name: 'renamed', version: '1' }));

  fs.writeFileSync(path.join(plugin, 'hooks', 'hooks.json'), JSON.stringify({
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/missing.cjs"', timeout: 0 }] }],
      SubagentStop: [{ matcher: '(', hooks: [{ type: 'command', command: 'node ../outside.cjs', timeout: 15 }] }],
      NotAnEvent: [],
    },
  }));

  const at = 'plugins/token-usage';
  expectErrors(repo, [
    `${at}/skills/good-one: references a missing file: references/missing.md`,
    `${at}/skills/Bad_Name: "name" must be lowercase`,
    `${at}/skills/mismatch: "name" (other) must match the folder name (mismatch)`,
    `${at}/skills/no-desc: frontmatter "description" is required`,
    `${at}/skills/no-frontmatter: SKILL.md must start with`,
    `${at}/.claude-plugin/plugin.json: "name" (renamed) must match the folder name`,
    `${at}/.claude-plugin/plugin.json: "version" must be semver`,
    `${at}/hooks/hooks.json: Stop: "timeout" must be`,
    `${at}/hooks/hooks.json: Stop: script not found: scripts/missing.cjs`,
    `${at}/hooks/hooks.json: SubagentStop: invalid matcher regex`,
    `${at}/hooks/hooks.json: SubagentStop: command must be node`,
    `${at}/hooks/hooks.json: unknown hook event "NotAnEvent"`,
    '.claude-plugin/marketplace.json: plugin "token-usage": "version" differs',
  ]);
});

test('the validator keeps scripts self-contained and flags unused ones', () => {
  const repo = copyOfRepo();
  const scripts = path.join(repo, 'plugins', 'mentor-polling', 'scripts');
  fs.appendFileSync(path.join(scripts, 'mentor-get-run-filter.cjs'), "\nrequire('../../token-usage/scripts/token-usage-tracker.cjs');\nrequire('./gone.cjs');\n");
  fs.writeFileSync(path.join(scripts, 'orphan.cjs'), '// not wired\n');

  const { errors, warnings } = validateRepo(repo);
  const at = 'plugins/mentor-polling/scripts/mentor-get-run-filter.cjs';
  assert.ok(errors.some(e => e.startsWith(`${at}: may only require node: modules`)), errors.join('\n'));
  assert.ok(errors.some(e => e.startsWith(`${at}: requires a missing file: ./gone.cjs`)), errors.join('\n'));
  assert.ok(warnings.some(w => w.startsWith('plugins/mentor-polling/scripts/orphan.cjs: not run by any hook')), warnings.join('\n'));
});

test('the validator checks the catalogue against the plugin folders', () => {
  const repo = copyOfRepo();
  const file = path.join(repo, '.claude-plugin', 'marketplace.json');
  const catalogue = readJson(file);
  catalogue.plugins[0].source = './elsewhere';
  catalogue.plugins[0].description = 'changed';
  catalogue.plugins.push({ name: 'ghost', source: './plugins/ghost' });
  catalogue.plugins.splice(1, 1);
  fs.writeFileSync(file, JSON.stringify(catalogue));
  fs.rmSync(path.join(repo, 'plugins', 'mentor-polling', '.claude-plugin'), { recursive: true });

  const at = '.claude-plugin/marketplace.json';
  expectErrors(repo, [
    'plugins/mentor-polling: missing .claude-plugin/plugin.json',
    `${at}: plugin "mentor-polling": "source" must be "./plugins/mentor-polling"`,
    `${at}: plugin "ghost" has no folder in plugins/`,
    `${at}: plugin "token-usage" is not listed in the catalogue`,
  ]);
});

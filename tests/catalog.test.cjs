const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, tmpProject } = require('./helpers.cjs');
const { validateRepo } = require('../tools/validate.cjs');
const { build, generate } = require('../tools/build.cjs');

test('the catalogue is valid', () => {
  const { errors, warnings } = validateRepo(ROOT);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('generated plugins are up to date with the sources', () => {
  const { ok, problems } = build(ROOT, { check: true });
  assert.ok(ok, problems.join('\n'));
});

test('plugins are self-contained and wire the expected hooks', () => {
  const files = generate(ROOT);
  const hooks = id => JSON.parse(files.get(`plugins/${id}/hooks/hooks.json`).toString()).hooks;

  assert.deepEqual(Object.keys(hooks('mentor-polling')).sort(), ['PostToolUse', 'PreToolUse']);
  assert.deepEqual(Object.keys(hooks('token-usage')).sort(), ['Stop', 'SubagentStop']);

  for (const id of ['mentor-polling', 'token-usage']) {
    for (const entries of Object.values(hooks(id))) {
      for (const { hooks: commands } of entries) {
        const { command } = commands[0];
        assert.match(command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/[a-z-]+\.cjs"$/);
        const script = command.match(/scripts\/([a-z-]+\.cjs)/)[1];
        assert.ok(files.has(`plugins/${id}/scripts/${script}`), `${id} ships ${script}`);
      }
    }
  }
  assert.ok(files.has('plugins/mentor-polling/scripts/mentor-run-text.cjs'), 'the filter helper is shipped with it');
  assert.ok(files.has('plugins/mentor-polling/skills/mentor-polling/SKILL.md'));
  assert.ok(files.has('plugins/token-usage/skills/token-usage/SKILL.md'));
});

test('the validator rejects bad skills and capabilities', () => {
  const repo = tmpProject();
  const skill = (dir, content) => {
    fs.mkdirSync(path.join(repo, 'skills', dir), { recursive: true });
    fs.writeFileSync(path.join(repo, 'skills', dir, 'SKILL.md'), content);
  };
  skill('good-one', '---\nname: good-one\ndescription: Fine.\n---\nSee `references/missing.md`.\n');
  skill('Bad_Name', '---\nname: Bad_Name\ndescription: x\n---\n');
  skill('mismatch', '---\nname: other\ndescription: x\n---\n');
  skill('no-desc', '---\nname: no-desc\n---\n');
  skill('no-frontmatter', '# Title\n');
  fs.mkdirSync(path.join(repo, 'capabilities'));
  fs.writeFileSync(path.join(repo, 'capabilities', 'cap.json'), JSON.stringify({
    id: 'cap', version: '1', description: 'x', skills: ['ghost'],
    hooks: { PreToolUse: [{ script: 'missing.cjs', timeout: 0 }], NotAnEvent: [] },
  }));

  const { errors } = validateRepo(repo);
  const expect = [
    'skills/good-one: references a missing file: references/missing.md',
    'skills/Bad_Name: "name" must be lowercase',
    'skills/mismatch: "name" (other) must match the folder name (mismatch)',
    'skills/no-desc: frontmatter "description" is required',
    'skills/no-frontmatter: SKILL.md must start with',
    'capabilities/cap.json: "version" must be semver',
    'capabilities/cap.json: skill "ghost" does not exist',
    'capabilities/cap.json: PreToolUse: script "missing.cjs" is not listed',
    'capabilities/cap.json: PreToolUse: "timeout" must be',
    'capabilities/cap.json: unknown hook event "NotAnEvent"',
  ];
  for (const e of expect) assert.ok(errors.some(x => x.startsWith(e)), `missing error: ${e}\n${errors.join('\n')}`);
});

test('the build check detects edited sources and stale generated files', () => {
  const copy = tmpProject();
  for (const dir of ['skills', 'capabilities', 'runtime', 'plugins', '.claude-plugin']) {
    fs.cpSync(path.join(ROOT, dir), path.join(copy, dir), { recursive: true });
  }
  assert.ok(build(copy, { check: true }).ok);

  fs.appendFileSync(path.join(copy, 'skills', 'token-usage', 'SKILL.md'), '\nEdited.\n');
  fs.writeFileSync(path.join(copy, 'plugins', 'token-usage', 'leftover.txt'), 'x');
  const { ok, problems } = build(copy, { check: true });
  assert.equal(ok, false);
  assert.ok(problems.includes('out of date: plugins/token-usage/skills/token-usage/SKILL.md'));
  assert.ok(problems.includes('stale: plugins/token-usage/leftover.txt'));

  assert.ok(build(copy).ok);
  assert.ok(build(copy, { check: true }).ok);
  assert.equal(fs.existsSync(path.join(copy, 'plugins', 'token-usage', 'leftover.txt')), false);
});

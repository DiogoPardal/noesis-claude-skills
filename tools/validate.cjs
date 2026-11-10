// Validates every plugin under plugins/ and the marketplace catalogue .claude-plugin/marketplace.json.
// plugins/<id>/ is the only source of each plugin: what is validated here is exactly what Claude Code installs.
// Exit code 1 on any error.
// Usage: node tools/validate.cjs [repoRoot]
const fs = require('node:fs');
const path = require('node:path');
const {
  NAME_PATTERN, SEMVER_PATTERN, KNOWN_FRONTMATTER, HOOK_EVENTS,
  listDirs, parseFrontmatter, readJson,
} = require('./lib.cjs');

// Hook commands must run a script shipped inside the plugin itself.
const COMMAND_PATTERN = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([^"/\\]+\.cjs)"$/;
const REQUIRE_PATTERN = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

function validateSkill(skillsDir, id, where, report) {
  const dir = path.join(skillsDir, id);
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(file)) return report.error(where, 'missing SKILL.md');

  const { data, error, body, bodyLines } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (error) return report.error(where, error);

  const name = typeof data.name === 'string' ? data.name : '';
  if (!name) report.error(where, 'frontmatter "name" is required');
  else {
    if (name.length > 64) report.error(where, '"name" is longer than 64 characters');
    if (!NAME_PATTERN.test(name)) report.error(where, `"name" must be lowercase letters, digits and single hyphens: "${name}"`);
    if (name !== id) report.error(where, `"name" (${name}) must match the folder name (${id})`);
  }

  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (!description) report.error(where, 'frontmatter "description" is required');
  else if (description.length > 1024) report.error(where, `"description" is ${description.length} characters (max 1024)`);

  if (typeof data.compatibility === 'string' && data.compatibility.length > 500) {
    report.error(where, '"compatibility" is longer than 500 characters');
  }
  for (const key of Object.keys(data)) {
    if (!KNOWN_FRONTMATTER.has(key)) report.warn(where, `unknown frontmatter field "${key}"`);
  }
  if (bodyLines > 500) report.warn(where, `SKILL.md body has ${bodyLines} lines (spec recommends under 500)`);

  // Relative files the skill points at must exist: `references/x.md` in backticks and [text](relative/link).
  const referenced = new Set();
  for (const m of body.matchAll(/`((?:references|scripts|assets)\/[^`\s]+)`/g)) referenced.add(m[1]);
  for (const m of body.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) referenced.add(m[1].split('#')[0]);
  for (const ref of referenced) {
    if (ref && !fs.existsSync(path.join(dir, ref))) report.error(where, `references a missing file: ${ref}`);
  }
}

// Returns the script file names that hooks.json runs.
function validateHooks(file, scriptsDir, where, report) {
  const used = new Set();
  let manifest;
  try {
    manifest = readJson(file);
  } catch (error) {
    report.error(where, `invalid JSON: ${error.message}`);
    return used;
  }
  const hooks = manifest?.hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    report.error(where, '"hooks" must be an object of event names');
    return used;
  }

  for (const [event, entries] of Object.entries(hooks)) {
    if (!HOOK_EVENTS.has(event)) report.error(where, `unknown hook event "${event}"`);
    if (!Array.isArray(entries)) { report.error(where, `${event}: must be an array`); continue; }
    for (const entry of entries) {
      if (entry.matcher !== undefined) {
        try { new RegExp(entry.matcher); } catch { report.error(where, `${event}: invalid matcher regex ${entry.matcher}`); }
      }
      if (!Array.isArray(entry.hooks) || entry.hooks.length === 0) {
        report.error(where, `${event}: each entry needs a non-empty "hooks" array`);
        continue;
      }
      for (const hook of entry.hooks) {
        if (hook.type !== 'command') report.error(where, `${event}: hook "type" must be "command"`);
        if (!(Number.isInteger(hook.timeout) && hook.timeout >= 1 && hook.timeout <= 600)) {
          report.error(where, `${event}: "timeout" must be an integer number of seconds between 1 and 600`);
        }
        const match = COMMAND_PATTERN.exec(String(hook.command ?? ''));
        if (!match) {
          report.error(where, `${event}: command must be node "\${CLAUDE_PLUGIN_ROOT}/scripts/<name>.cjs"`);
          continue;
        }
        if (!fs.existsSync(path.join(scriptsDir, match[1]))) report.error(where, `${event}: script not found: scripts/${match[1]}`);
        used.add(match[1]);
      }
    }
  }
  return used;
}

// Scripts may only load node: built-ins or other scripts of the same plugin, so each plugin stays self-contained.
// Returns the script file names required by other scripts.
function validateScripts(scriptsDir, where, report) {
  const required = new Set();
  const scripts = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).filter(f => f.endsWith('.cjs')).sort() : [];
  for (const script of scripts) {
    const source = fs.readFileSync(path.join(scriptsDir, script), 'utf8');
    for (const m of source.matchAll(REQUIRE_PATTERN)) {
      const target = m[1];
      if (target.startsWith('node:')) continue;
      if (!/^\.\/[^/\\]+\.cjs$/.test(target)) {
        report.error(`${where}/${script}`, `may only require node: modules or ./<file>.cjs in the same folder: ${target}`);
      } else if (!fs.existsSync(path.join(scriptsDir, target.slice(2)))) {
        report.error(`${where}/${script}`, `requires a missing file: ${target}`);
      } else {
        required.add(target.slice(2));
      }
    }
  }
  return { scripts, required };
}

// Returns the parsed plugin.json, or null when it is unusable.
function validatePlugin(root, id, report) {
  const base = path.join(root, 'plugins', id);
  const where = `plugins/${id}`;
  if (!NAME_PATTERN.test(id)) report.error(where, 'folder name must be lowercase letters, digits and single hyphens');

  let manifest = null;
  const manifestFile = path.join(base, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(manifestFile)) report.error(where, 'missing .claude-plugin/plugin.json');
  else {
    try {
      manifest = readJson(manifestFile);
    } catch (error) {
      report.error(`${where}/.claude-plugin/plugin.json`, `invalid JSON: ${error.message}`);
    }
  }
  if (manifest) {
    const at = `${where}/.claude-plugin/plugin.json`;
    if (manifest.name !== id) report.error(at, `"name" (${manifest.name}) must match the folder name (${id})`);
    if (!SEMVER_PATTERN.test(String(manifest.version ?? ''))) report.error(at, '"version" must be semver (e.g. 1.0.0)');
    if (!manifest.description || String(manifest.description).length > 1024) {
      report.error(at, '"description" is required (max 1024 characters)');
    }
  }

  const skillsDir = path.join(base, 'skills');
  const skills = listDirs(skillsDir);
  for (const skill of skills) validateSkill(skillsDir, skill, `${where}/skills/${skill}`, report);

  const scriptsDir = path.join(base, 'scripts');
  const hooksFile = path.join(base, 'hooks', 'hooks.json');
  const used = fs.existsSync(hooksFile) ? validateHooks(hooksFile, scriptsDir, `${where}/hooks/hooks.json`, report) : new Set();
  const { scripts, required } = validateScripts(scriptsDir, `${where}/scripts`, report);
  for (const script of scripts) {
    if (!used.has(script) && !required.has(script)) report.warn(`${where}/scripts/${script}`, 'not run by any hook nor required by another script');
  }

  if (!skills.length && !used.size) report.error(where, 'a plugin needs at least one skill or hook');
  return manifest;
}

function validateMarketplace(root, manifests, report) {
  const where = '.claude-plugin/marketplace.json';
  let catalogue;
  try {
    catalogue = readJson(path.join(root, '.claude-plugin', 'marketplace.json'));
  } catch (error) {
    return report.error(where, `missing or invalid JSON: ${error.message}`);
  }
  if (!catalogue.name) report.error(where, '"name" is required');
  if (!catalogue.owner?.name) report.error(where, '"owner.name" is required');
  if (!Array.isArray(catalogue.plugins)) return report.error(where, '"plugins" must be an array');

  const listed = new Set();
  for (const entry of catalogue.plugins) {
    const name = String(entry?.name ?? '');
    if (listed.has(name)) report.error(where, `plugin "${name}" is listed twice`);
    listed.add(name);
    if (!manifests.has(name)) { report.error(where, `plugin "${name}" has no folder in plugins/`); continue; }
    if (entry.source !== `./plugins/${name}`) report.error(where, `plugin "${name}": "source" must be "./plugins/${name}"`);
    const manifest = manifests.get(name);
    if (!manifest) continue;
    for (const field of ['version', 'description']) {
      if (entry[field] !== manifest[field]) {
        report.error(where, `plugin "${name}": "${field}" differs from plugins/${name}/.claude-plugin/plugin.json`);
      }
    }
  }
  for (const id of manifests.keys()) if (!listed.has(id)) report.error(where, `plugin "${id}" is not listed in the catalogue`);
}

function validateRepo(root) {
  const errors = [];
  const warnings = [];
  const report = {
    error: (where, message) => errors.push(`${where}: ${message}`),
    warn: (where, message) => warnings.push(`${where}: ${message}`),
  };

  const plugins = listDirs(path.join(root, 'plugins'));
  const manifests = new Map(plugins.map(id => [id, validatePlugin(root, id, report)]));
  validateMarketplace(root, manifests, report);

  return { errors, warnings, plugins };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const { errors, warnings, plugins } = validateRepo(root);
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
  console.log(`${plugins.length} plugin(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exitCode = errors.length ? 1 : 0;
}

module.exports = { validateRepo };

// Validates skills/ (Agent Skills format) and capabilities/ (Noesis manifests). Exit code 1 on any error.
// Usage: node tools/validate.cjs [repoRoot]
const fs = require('node:fs');
const path = require('node:path');
const {
  NAME_PATTERN, SEMVER_PATTERN, KNOWN_FRONTMATTER, HOOK_EVENTS,
  listDirs, parseFrontmatter, readJson,
} = require('./lib.cjs');

function validateSkill(root, id, report) {
  const dir = path.join(root, 'skills', id);
  const where = `skills/${id}`;
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(file)) return report.error(where, 'missing SKILL.md');

  const { data, error, body, bodyLines } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (error) return report.error(where, error);

  const name = typeof data.name === 'string' ? data.name : '';
  if (!name) report.error(where, 'frontmatter "name" is required');
  else {
    if (name.length > 64) report.error(where, `"name" is longer than 64 characters`);
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

function validateCapability(root, file, skills, report) {
  const where = `capabilities/${file}`;
  let manifest;
  try {
    manifest = readJson(path.join(root, 'capabilities', file));
  } catch (error) {
    return report.error(where, `invalid JSON: ${error.message}`);
  }

  const id = path.basename(file, '.json');
  if (manifest.id !== id) report.error(where, `"id" (${manifest.id}) must match the file name (${id})`);
  if (!NAME_PATTERN.test(String(manifest.id ?? ''))) report.error(where, '"id" must be lowercase letters, digits and single hyphens');
  if (!SEMVER_PATTERN.test(String(manifest.version ?? ''))) report.error(where, '"version" must be semver (e.g. 1.0.0)');
  if (!manifest.description || String(manifest.description).length > 1024) {
    report.error(where, '"description" is required (max 1024 characters)');
  }

  const declaredSkills = manifest.skills ?? [];
  if (!Array.isArray(declaredSkills)) report.error(where, '"skills" must be an array');
  for (const skill of Array.isArray(declaredSkills) ? declaredSkills : []) {
    if (!skills.includes(skill)) report.error(where, `skill "${skill}" does not exist in skills/`);
  }

  const runtime = manifest.runtime ?? [];
  const scripts = new Set();
  for (const rel of Array.isArray(runtime) ? runtime : []) {
    if (!/^runtime\/[^\0]+$/.test(rel) || rel.includes('..')) report.error(where, `runtime path must be inside runtime/: ${rel}`);
    else if (!fs.existsSync(path.join(root, rel))) report.error(where, `runtime file not found: ${rel}`);
    const base = path.posix.basename(rel);
    if (scripts.has(base)) report.error(where, `two runtime files share the name ${base}`);
    scripts.add(base);
  }

  const hooks = manifest.hooks ?? {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!HOOK_EVENTS.has(event)) report.error(where, `unknown hook event "${event}"`);
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!scripts.has(entry.script)) report.error(where, `${event}: script "${entry.script}" is not listed in "runtime"`);
      if (!(Number.isInteger(entry.timeout) && entry.timeout >= 1 && entry.timeout <= 600)) {
        report.error(where, `${event}: "timeout" must be an integer number of seconds between 1 and 600`);
      }
      if (entry.matcher !== undefined) {
        try { new RegExp(entry.matcher); } catch { report.error(where, `${event}: invalid matcher regex ${entry.matcher}`); }
      }
    }
  }

  if (!declaredSkills.length && !Object.keys(hooks).length) report.error(where, 'a capability needs at least one skill or hook');
  return declaredSkills;
}

function validateRepo(root) {
  const errors = [];
  const warnings = [];
  const report = {
    error: (where, message) => errors.push(`${where}: ${message}`),
    warn: (where, message) => warnings.push(`${where}: ${message}`),
  };

  const skills = listDirs(path.join(root, 'skills'));
  for (const id of skills) validateSkill(root, id, report);

  const capabilityDir = path.join(root, 'capabilities');
  const files = fs.existsSync(capabilityDir) ? fs.readdirSync(capabilityDir).filter(f => f.endsWith('.json')).sort() : [];
  const shipped = new Set();
  for (const file of files) for (const skill of validateCapability(root, file, skills, report) ?? []) shipped.add(skill);
  for (const id of skills) if (!shipped.has(id)) report.warn(`skills/${id}`, 'not included in any capability, so it is never shipped');

  return { errors, warnings, skills, capabilities: files.map(f => path.basename(f, '.json')) };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const { errors, warnings, skills, capabilities } = validateRepo(root);
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
  console.log(`${skills.length} skill(s), ${capabilities.length} capability(ies): ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exitCode = errors.length ? 1 : 0;
}

module.exports = { validateRepo };

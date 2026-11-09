// Generates one Claude Code plugin per capability under plugins/<id>/ and the marketplace manifest
// .claude-plugin/marketplace.json. Plugins are copied into Claude Code's cache on install, so each one must be
// self-contained: its skills, its runtime scripts and its hooks/hooks.json.
//
// Usage: node tools/build.cjs [--check] [repoRoot]
//   --check  writes nothing; exits 1 if the generated files on disk are missing or out of date.
const fs = require('node:fs');
const path = require('node:path');
const { listFilesRecursive, readJson } = require('./lib.cjs');
const { validateRepo } = require('./validate.cjs');

const MARKETPLACE_NAME = 'noesis';
const OWNER = { name: 'Noesis' };

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// Returns a Map of repo-relative path -> Buffer for everything the build owns.
function generate(root) {
  const out = new Map();
  const capabilityFiles = fs.readdirSync(path.join(root, 'capabilities')).filter(f => f.endsWith('.json')).sort();
  const marketplacePlugins = [];

  for (const file of capabilityFiles) {
    const cap = readJson(path.join(root, 'capabilities', file));
    const base = `plugins/${cap.id}`;

    out.set(`${base}/.claude-plugin/plugin.json`, Buffer.from(json({
      name: cap.id,
      version: cap.version,
      description: cap.description,
      author: OWNER,
    })));

    for (const skill of cap.skills ?? []) {
      const skillDir = path.join(root, 'skills', skill);
      for (const rel of listFilesRecursive(skillDir)) {
        out.set(`${base}/skills/${skill}/${rel}`, fs.readFileSync(path.join(skillDir, rel)));
      }
    }

    for (const rel of cap.runtime ?? []) {
      out.set(`${base}/scripts/${path.posix.basename(rel)}`, fs.readFileSync(path.join(root, rel)));
    }

    const hookEvents = Object.entries(cap.hooks ?? {});
    if (hookEvents.length) {
      const hooks = {};
      for (const [event, entries] of hookEvents) {
        hooks[event] = entries.map(entry => ({
          ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
          hooks: [{
            type: 'command',
            command: `node "\${CLAUDE_PLUGIN_ROOT}/scripts/${entry.script}"`,
            timeout: entry.timeout,
          }],
        }));
      }
      out.set(`${base}/hooks/hooks.json`, Buffer.from(json({ description: cap.description, hooks })));
    }

    marketplacePlugins.push({ name: cap.id, source: `./${base}`, description: cap.description, version: cap.version });
  }

  out.set('.claude-plugin/marketplace.json', Buffer.from(json({
    name: MARKETPLACE_NAME,
    owner: OWNER,
    metadata: { description: 'Noesis AI skills for Claude Code' },
    plugins: marketplacePlugins,
  })));
  return out;
}

// Files currently on disk that the build owns (everything under plugins/ plus the marketplace file).
function existingOwned(root) {
  const files = listFilesRecursive(path.join(root, 'plugins')).map(rel => `plugins/${rel}`);
  if (fs.existsSync(path.join(root, '.claude-plugin', 'marketplace.json'))) files.push('.claude-plugin/marketplace.json');
  return files;
}

function diff(root, generated) {
  const problems = [];
  for (const [rel, content] of generated) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) problems.push(`missing: ${rel}`);
    else if (!fs.readFileSync(file).equals(content)) problems.push(`out of date: ${rel}`);
  }
  for (const rel of existingOwned(root)) if (!generated.has(rel)) problems.push(`stale: ${rel}`);
  return problems;
}

function build(root, { check = false } = {}) {
  const { errors } = validateRepo(root);
  if (errors.length) return { ok: false, problems: errors.map(e => `invalid: ${e}`) };

  const generated = generate(root);
  if (check) {
    const problems = diff(root, generated);
    return { ok: problems.length === 0, problems };
  }

  // Remove only files the build owns that are no longer generated, then write the new set.
  for (const rel of existingOwned(root)) if (!generated.has(rel)) fs.rmSync(path.join(root, rel));
  for (const [rel, content] of generated) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) fs.writeFileSync(file, content);
  }
  return { ok: true, problems: [], files: generated.size };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const root = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
  const result = build(root, { check });
  for (const p of result.problems) console.log(p);
  if (check) console.log(result.ok ? 'plugins are up to date' : 'run "npm run build" and commit the result');
  else if (result.ok) console.log(`built ${result.files} file(s)`);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { build, generate };

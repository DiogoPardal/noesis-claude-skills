// Shared helpers for validate.cjs and build.cjs. No dependencies beyond Node's standard library.
const fs = require('node:fs');
const path = require('node:path');

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// Agent Skills spec fields plus the Claude Code extensions documented at code.claude.com/docs/en/skills.
const KNOWN_FRONTMATTER = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
  'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
]);

const HOOK_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop', 'SessionStart', 'UserPromptSubmit',
  'UserPromptExpansion', 'Notification', 'PreCompact', 'SessionEnd',
]);

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
}

function listFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

// Minimal YAML frontmatter reader: `key: value`, quoted values, block scalars (| and >) and one level of nested keys.
// Returns { data, error }.
function parseFrontmatter(text) {
  const source = text.replace(/^﻿/, '');
  const lines = source.split(/\r?\n/);
  if (lines[0] !== '---') return { data: null, error: 'SKILL.md must start with a "---" frontmatter line' };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { data: null, error: 'frontmatter is not closed with "---"' };

  const data = {};
  let index = 1;
  while (index < end) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith('#')) { index += 1; continue; }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) return { data: null, error: `cannot parse frontmatter line ${index + 1}: ${line}` };
    const [, key, rest] = match;
    index += 1;
    if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-' || rest === '') {
      const block = [];
      while (index < end && (/^\s+/.test(lines[index]) || !lines[index].trim())) {
        block.push(lines[index]);
        index += 1;
      }
      if (rest === '') {
        // Nested map (e.g. metadata) or a list: keep the raw text; only presence matters to the validator.
        data[key] = block.length ? { raw: block.join('\n') } : '';
      } else {
        const trimmed = block.map(l => l.trim());
        data[key] = rest.startsWith('|') ? trimmed.join('\n').trim() : trimmed.join(' ').trim();
      }
    } else {
      data[key] = unquote(rest);
    }
  }
  return { data, error: null, body: lines.slice(end + 1).join('\n'), bodyLines: lines.length - end - 1 };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = {
  NAME_PATTERN, SEMVER_PATTERN, KNOWN_FRONTMATTER, HOOK_EVENTS,
  listDirs, listFilesRecursive, parseFrontmatter, readJson,
};

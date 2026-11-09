// Parsing/compaction library for mentor_get_run output. Used by mentor-get-run-filter.cjs; not a hook.
// Ported unchanged from dresend/scripts-ai-outsystems@e9579633 (.claude/hooks/mentor-run-text.cjs).
const fs = require('node:fs');

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Locate consecutive JSON documents without treating braces inside strings as boundaries.
function parseJsonDocuments(value) {
  const documents = [];
  let offset = 0;

  while (offset < value.length) {
    while (/\s/.test(value[offset] ?? '')) offset += 1;
    if (offset >= value.length) break;

    const opening = value[offset];
    if (opening !== '{' && opening !== '[') return null;

    const closings = [];
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let index = offset; index < value.length; index += 1) {
      const character = value[index];

      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === '{' || character === '[') {
        closings.push(character === '{' ? '}' : ']');
      } else if (character === '}' || character === ']') {
        if (closings.pop() !== character) return null;
        if (closings.length === 0) {
          end = index + 1;
          break;
        }
      }
    }

    if (end < 0) return null;
    const document = parseJson(value.slice(offset, end));
    if (document === null) return null;
    documents.push(document);
    offset = end;
  }

  return documents.length > 0 ? documents : null;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.keys(value).sort();
    return `{${fields.map(field => `${JSON.stringify(field)}:${canonicalJson(value[field])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function eventOf(value) {
  if (typeof value === 'string') return parseJson(value);
  return value && typeof value === 'object' ? value : null;
}

// Consecutive text events form one message; any other event ends it.
function textsOf(events) {
  const texts = [];
  let run = null;
  const flush = () => {
    if (run?.trim()) texts.push(run.trim());
    run = null;
  };

  for (const value of events) {
    const event = eventOf(value);
    const type = String(event?.MsgType ?? event?.msgType ?? '').toLowerCase();

    if (type === 'text') {
      if (typeof event.text === 'string') run = (run ?? '') + event.text;
      continue;
    }

    flush();
    const label = type === 'reasoning' ? event.title : type === 'status' ? event.statusType : null;
    if (typeof label === 'string' && label.trim()) texts.push(label.trim());
  }

  flush();
  return texts;
}

function convertText(text) {
  const documents = parseJsonDocuments(text);
  if (!documents) return null;

  const seen = new Set();
  const converted = [];
  for (const document of documents) {
    if (!document || typeof document !== 'object' || Array.isArray(document) || !Array.isArray(document.events)) {
      return null;
    }

    const key = canonicalJson(document);
    if (seen.has(key)) continue;
    seen.add(key);
    converted.push({ ...document, events: textsOf(document.events) });
  }

  return converted.map(document => JSON.stringify(document)).join('\n');
}

function firstFilled(...values) {
  const found = values.find(value => typeof value === 'string' && value.trim());
  return found ? found.trim() : '';
}

// Text chunks are merged per message; reasoning and status events keep one label; every other event is kept as parsed.
function compactEvents(events) {
  const compacted = [];
  let run = '';
  const flush = () => {
    if (run) compacted.push({ msgType: 'text', text: run });
    run = '';
  };

  for (const value of events) {
    const event = eventOf(value);
    if (!event) continue;
    const type = String(event.MsgType ?? event.msgType ?? '').toLowerCase();

    if (type === 'text') {
      if (typeof event.text === 'string') run += event.text;
    } else if (type === 'reasoning') {
      flush();
      compacted.push({ msgType: 'reasoning', title: firstFilled(event.title, event.text, type) });
    } else if (type === 'status') {
      const label = firstFilled(event.statusType, event.text);
      if (label) {
        flush();
        compacted.push({ msgType: 'status', statusType: label });
      }
    } else {
      flush();
      compacted.push(event);
    }
  }

  flush();
  return compacted;
}

function serializeDocuments(documents) {
  return documents.map(document => JSON.stringify(document, null, 2)).join('\n');
}

function compactResult(textResult) {
  const documents = parseJsonDocuments(textResult);
  if (!documents) return null;

  const compacted = [];
  const seen = new Set();
  for (const document of documents) {
    if (!document || typeof document !== 'object' || Array.isArray(document) || !Array.isArray(document.events)) {
      return null;
    }

    const result = { ...document, events: compactEvents(document.events) };
    // Deduplicate after compaction, ignoring object key order and discarded event details.
    const key = canonicalJson(result);
    if (!seen.has(key)) {
      seen.add(key);
      compacted.push(result);
    }
  }

  return compacted;
}

function main() {
  const input = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
  // stderr keeps stdout reserved for the converted JSON.
  console.error(`input:\n${input}`);
  const output = convertText(input);
  if (output === null) {
    process.stderr.write('Input is not a run output JSON.\n');
    process.exitCode = 1;
    return;
  }
  console.error(`output:\n${output}`);
  process.stdout.write(`${output}\n`);
}

if (require.main === module) main();

module.exports = { parseJson, parseJsonDocuments, canonicalJson, textsOf, convertText, compactResult, serializeDocuments };

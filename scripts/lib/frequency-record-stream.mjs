import { createReadStream } from 'node:fs';
import { buildSearchForm, normalizeLemma, validRank } from './associative-index-core.mjs';

const IPM_FIELDS = ['ipm', 'IPM', 'frequency', 'freq'];
const WORD_FIELDS = ['word', 'lemma', 'form'];

function finitePositiveNumber(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function explicitIpm(record) {
  for (const field of IPM_FIELDS) {
    if (Object.hasOwn(record, field)) return finitePositiveNumber(record[field]);
  }
  return null;
}

function explicitLemma(record) {
  for (const field of WORD_FIELDS) {
    if (Object.hasOwn(record, field)) return record[field];
  }
  return undefined;
}

function frequencyRecord(lemmaValue, ipmValue, rankValue, sourceId) {
  const original = String(lemmaValue ?? '').trim();
  const normalized = normalizeLemma(original);
  const searchForm = buildSearchForm(original);
  const ipm = finitePositiveNumber(ipmValue);
  if (!normalized || !searchForm || ipm == null) return null;
  const rank = validRank(rankValue);
  return { original, normalized, search_form: searchForm, lemma: normalized, frequency_lookup_key: normalized, ipm, ...(rank != null ? { rank } : {}), ...(sourceId ? { source: sourceId } : {}) };
}

function recordsFromTopLevelEntry(key, value, sourceId) {
  const records = [];
  if (typeof value === 'number') {
    const record = frequencyRecord(key, value, undefined, sourceId);
    if (record) records.push(record);
    return records;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return records;

  const ipm = explicitIpm(value);
  if (ipm != null) {
    const record = frequencyRecord(explicitLemma(value) ?? key, ipm, value.rank, sourceId);
    if (record) records.push(record);
    return records;
  }

  const keyIsRank = /^\d+$/.test(String(key));
  for (const [nestedWord, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue === 'number') {
      const record = frequencyRecord(nestedWord, nestedValue, keyIsRank ? key : undefined, sourceId);
      if (record) records.push(record);
    } else if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      const nestedIpm = explicitIpm(nestedValue);
      if (nestedIpm != null) {
        const record = frequencyRecord(explicitLemma(nestedValue) ?? nestedWord, nestedIpm, nestedValue.rank ?? (keyIsRank ? key : undefined), sourceId);
        if (record) records.push(record);
      }
    }
  }
  return records;
}

function recordsFromArrayItem(value, sourceId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = frequencyRecord(explicitLemma(value), explicitIpm(value), value.rank, sourceId);
  return record ? [record] : [];
}

function parseJsonStringAt(buffer, start) {
  let escaped = false;
  for (let index = start + 1; index < buffer.length; index += 1) {
    const char = buffer[index];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      return { value: JSON.parse(buffer.slice(start, index + 1)), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(buffer, index) {
  while (index < buffer.length && /\s/.test(buffer[index])) index += 1;
  return index;
}

function findJsonValueEnd(buffer, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < buffer.length; index += 1) {
    const char = buffer[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') {
      if (depth === 0) return index;
      depth -= 1;
      if (depth === 0) return index + 1;
    } else if (depth === 0 && (char === ',' || char === '}' || char === ']')) {
      return index;
    }
  }
  return null;
}

async function* topLevelEntries(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  try {
  let buffer = '';
  let index = 0;
  let container = null;
  let arrayIndex = 0;
  for await (const chunk of stream) {
    buffer += chunk;
    parseLoop: while (true) {
      index = skipWhitespace(buffer, index);
      if (!container) {
        if (index >= buffer.length) break;
        container = buffer[index];
        if (container !== '[' && container !== '{') throw new Error(`Unsupported JSON root in ${filePath}`);
        index += 1;
      }
      index = skipWhitespace(buffer, index);
      if (index >= buffer.length) break;
      if ((container === '[' && buffer[index] === ']') || (container === '{' && buffer[index] === '}')) break parseLoop;
      if (buffer[index] === ',') { index += 1; continue; }

      if (container === '[') {
        const end = findJsonValueEnd(buffer, index);
        if (end == null) break;
        yield { key: String(arrayIndex++), value: JSON.parse(buffer.slice(index, end)), root: 'array' };
        index = end;
      } else {
        if (buffer[index] !== '"') throw new Error(`Expected object key in ${filePath}`);
        const parsedKey = parseJsonStringAt(buffer, index);
        if (!parsedKey) break;
        let valueStart = skipWhitespace(buffer, parsedKey.end);
        if (valueStart >= buffer.length) break;
        if (buffer[valueStart] !== ':') throw new Error(`Expected colon after object key in ${filePath}`);
        valueStart = skipWhitespace(buffer, valueStart + 1);
        const end = findJsonValueEnd(buffer, valueStart);
        if (end == null) break;
        yield { key: parsedKey.value, value: JSON.parse(buffer.slice(valueStart, end)), root: 'object' };
        index = end;
      }
      if (index > 1024 * 1024) {
        buffer = buffer.slice(index);
        index = 0;
      }
    }
  }
  } finally {
    stream.destroy();
  }
}

function recordsForFormat(entry, format, sourceId, filePath) {
  if (format === 'legacy-json') return entry.root === 'array' ? recordsFromArrayItem(entry.value, sourceId) : recordsFromTopLevelEntry(entry.key, entry.value, sourceId);
  if (format === 'ranked-word-ipm-object') {
    if (entry.root !== 'object') throw new Error(`Expected ranked word/IPM object root in ${filePath}`);
    const records = [];
    if (!/^\d+$/.test(String(entry.key)) || !entry.value || typeof entry.value !== 'object' || Array.isArray(entry.value)) return records;
    for (const [word, ipm] of Object.entries(entry.value)) {
      if (typeof ipm !== 'number') throw new Error(`Invalid ranked word/IPM value in ${sourceId || filePath} at rank ${entry.key}`);
      const record = frequencyRecord(word, ipm, entry.key, sourceId);
      if (record) records.push(record);
    }
    return records;
  }
  throw new Error(`Unsupported frequency source format: ${format}`);
}

export async function* streamFrequencyRecords({ filePath, sourceId = '', format = 'legacy-json', maxRecords } = {}) {
  if (!filePath) throw new Error('streamFrequencyRecords requires filePath');
  const limit = maxRecords == null ? Infinity : Number(maxRecords);
  let emitted = 0;
  for await (const entry of topLevelEntries(filePath)) {
    const records = recordsForFormat(entry, format, sourceId, filePath);
    for (const record of records) {
      if (emitted >= limit) return;
      emitted += 1;
      yield record;
      if (emitted >= limit) return;
    }
  }
}

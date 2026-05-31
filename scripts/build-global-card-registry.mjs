import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ACCEPTED_ROOT = path.join(ROOT, 'cards', 'accepted');
const REGISTRY_PATH = path.join(ROOT, 'cards', 'registry.json');
const VORD_TYPES = ['iv', 'av', 'in', 'vc', 'gv'];
const VORD_TYPE_LABELS = {
  iv: 'indoeropan vordes',
  av: 'associativ vordes',
  in: 'internationalismes',
  vc: 'vordes of communités',
  gv: 'grammatic vordes'
};
const VORD_TYPE_SET = new Set(VORD_TYPES);
const ID_RE = /^(iv|av|in|vc|gv)_[0-9a-fA-F]{32}$/;

async function listJsonFiles(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function fail(filePath, message) {
  const relative = path.relative(ROOT, filePath);
  throw new Error(`${relative}: ${message}`);
}

function pathVordType(filePath) {
  return path.relative(ACCEPTED_ROOT, filePath).split(path.sep)[0];
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function languageTranslations(card) {
  const translations = {};
  if (card.translation && typeof card.translation === 'object') {
    const code = text(card.translation.language);
    const word = text(card.translation.word);
    if (code && word) translations[code] = word;
  }
  if (Array.isArray(card.language_results)) {
    for (const result of card.language_results) {
      if (!result || typeof result !== 'object') continue;
      const code = text(result.code);
      const word = text(result.word);
      if (code && word && !translations[code]) translations[code] = word;
    }
  }
  return translations;
}

function normalizeSearch(value) {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectStrings(value, output, seen = new WeakSet()) {
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output, seen));
    return;
  }
  Object.values(value).forEach((item) => collectStrings(item, output, seen));
}

export function makeSearchBlob(card) {
  const chunks = [];
  chunks.push(card.id, card.vord_type, VORD_TYPE_LABELS[card.vord_type]);
  chunks.push(card.interal?.word, card.interal?.ipa, card.translation?.language, card.translation?.word, card.interal?.part_of_speech);
  chunks.push(card.author?.display_name);
  chunks.push(...stringArray(card.supported_groups));
  if (card.language_results) collectStrings(card.language_results, chunks);

  const reserved = new Set(['id', 'version', 'card_type', 'vord_type', 'word_type', 'status', 'created_at', 'created_at_source', 'accepted_at', 'interal', 'translation', 'author', 'supported_groups', 'calculation', 'language_results']);
  for (const [key, value] of Object.entries(card)) {
    if (!reserved.has(key)) collectStrings(value, chunks);
  }

  return normalizeSearch(chunks.filter((chunk) => typeof chunk === 'string' && chunk.trim()).join(' '));
}

function validateCard(card, filePath, expectedType, seenIds) {
  if (!VORD_TYPE_SET.has(expectedType)) fail(filePath, `invalid accepted folder "${expectedType}"`);
  if (!card || typeof card !== 'object' || Array.isArray(card)) fail(filePath, 'card must be a JSON object');
  if (typeof card.id !== 'string' || !card.id) fail(filePath, 'id is required');
  if (!ID_RE.test(card.id)) fail(filePath, `id must match <vord_type>_ + 32 hex chars: "${card.id}"`);
  if (seenIds.has(card.id)) fail(filePath, `duplicate id "${card.id}"`);
  seenIds.add(card.id);
  if (!card.id.startsWith(`${expectedType}_`)) fail(filePath, `id must start with "${expectedType}_"`);
  if (card.word_type !== undefined) fail(filePath, 'use vord_type short code instead of word_type');
  if (!VORD_TYPE_SET.has(card.vord_type)) fail(filePath, `invalid vord_type "${card.vord_type}"`);
  if (card.vord_type !== expectedType) fail(filePath, `vord_type "${card.vord_type}" does not match folder "${expectedType}"`);
  if (card.status !== 'accepted') fail(filePath, 'status must be "accepted"');
  if (!card.interal || typeof card.interal !== 'object' || typeof card.interal.word !== 'string' || !card.interal.word.trim()) {
    fail(filePath, 'interal.word is required');
  }
}

function cleanRegistry(registry) {
  if (!registry || typeof registry !== 'object') return registry;
  const clone = { ...registry };
  delete clone.generated_at;
  return clone;
}

async function readExistingRegistry() {
  try {
    return JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const files = await listJsonFiles(ACCEPTED_ROOT);
const seenIds = new Set();
const cards = [];

for (const filePath of files) {
  const expectedType = pathVordType(filePath);
  const raw = await readFile(filePath, 'utf8');
  let card;
  try {
    card = JSON.parse(raw);
  } catch (error) {
    fail(filePath, `invalid JSON: ${error.message}`);
  }
  validateCard(card, filePath, expectedType, seenIds);

  const compact = {
    id: text(card.id),
    vord_type: VORD_TYPE_LABELS[card.vord_type] || '',
    vord_type_code: text(card.vord_type),
    status: text(card.status),
    word: text(card.interal?.word),
    ipa: text(card.interal?.ipa),
    translation_language: text(card.translation?.language),
    translation_word: text(card.translation?.word),
    translations: languageTranslations(card),
    part_of_speech: text(card.interal?.part_of_speech),
    created_at: text(card.created_at),
    created_at_source: text(card.created_at_source),
    accepted_at: text(card.accepted_at),
    author: text(card.author?.display_name),
    author_contact_type: text(card.author?.contacts?.[0]?.type),
    author_contact_url: text(card.author?.contacts?.[0]?.url),
    pi_percent: finiteNumber(card.calculation?.pi_percent),
    supported_groups: stringArray(card.supported_groups),
    detail_path: path.relative(ROOT, filePath).split(path.sep).join('/'),
    search_blob: makeSearchBlob(card)
  };
  cards.push(compact);
}

cards.sort((a, b) => a.id.localeCompare(b.id));

const nextRegistryComparable = {
  version: '1.0',
  registry_type: 'vordesen_card_registry',
  title: 'Registre of vordesen cartes',
  count: cards.length,
  vord_types: VORD_TYPES,
  cards
};

const existing = await readExistingRegistry();
if (existing && JSON.stringify(cleanRegistry(existing)) === JSON.stringify(nextRegistryComparable)) {
  console.log('Registry content unchanged.');
  process.exit(0);
}

const nextRegistry = {
  version: nextRegistryComparable.version,
  registry_type: nextRegistryComparable.registry_type,
  title: nextRegistryComparable.title,
  generated_at: new Date().toISOString(),
  count: nextRegistryComparable.count,
  vord_types: nextRegistryComparable.vord_types,
  cards: nextRegistryComparable.cards
};

await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
await writeFile(REGISTRY_PATH, `${JSON.stringify(nextRegistry, null, 2)}\n`);
console.log(`Registry written with ${cards.length} cards.`);

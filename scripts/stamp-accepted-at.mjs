import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ACCEPTED_ROOT = path.join(ROOT, 'cards', 'accepted');
const VORD_TYPES = new Set([
  'iv',
  'av',
  'in',
  'vc',
  'gv',
  'al',
  'af'
]);

const ID_RE =
  /^(iv|av|in|vc|gv|al|af)_(?:[0-9A-Za-z]{12}|[0-9a-fA-F]{32})$/;

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

function pathVordType(filePath) {
  const relative = path.relative(ACCEPTED_ROOT, filePath).split(path.sep);
  return relative[0];
}

function fail(filePath, message) {
  const relative = path.relative(ROOT, filePath);
  throw new Error(`${relative}: ${message}`);
}

function validateCard(card, filePath, expectedType) {
  if (!VORD_TYPES.has(expectedType)) fail(filePath, `invalid accepted folder "${expectedType}"`);
  if (!card || typeof card !== 'object' || Array.isArray(card)) fail(filePath, 'card must be a JSON object');
  if (typeof card.id !== 'string' || !card.id) fail(filePath, 'id is required');
  if (!ID_RE.test(card.id)) {
    fail(
      filePath,
      `id must match <vord_type>_ + 12 Base62 chars or 32 hex chars: "${card.id}"`
    );
  }
  const filenameId = path.basename(filePath, '.json');
  if (filenameId !== card.id) {
    fail(
      filePath,
      `filename must match card id: expected "${card.id}.json"`
    );
  }
  if (!card.id.startsWith(`${expectedType}_`)) fail(filePath, `id must start with "${expectedType}_"`);
  if (card.vord_type === undefined) {
    card.vord_type = expectedType;
  }
  if (card.word_type !== undefined) {
    delete card.word_type;
  }
  if (card.vord_type !== expectedType) fail(filePath, `vord_type "${card.vord_type}" does not match folder "${expectedType}"`);
  if (card.status !== 'accepted') fail(filePath, 'status must be "accepted"');
  if (!card.interal || typeof card.interal !== 'object' || typeof card.interal.word !== 'string' || !card.interal.word.trim()) {
    fail(filePath, 'interal.word is required');
  }
}

const files = await listJsonFiles(ACCEPTED_ROOT);
let stamped = 0;

for (const filePath of files) {
  const expectedType = pathVordType(filePath);
  const raw = await readFile(filePath, 'utf8');
  let card;
  try {
    card = JSON.parse(raw);
  } catch (error) {
    fail(filePath, `invalid JSON: ${error.message}`);
  }

  validateCard(card, filePath, expectedType);

  if (!card.accepted_at) {
    card.accepted_at = new Date().toISOString();
    stamped += 1;
    await writeFile(filePath, `${JSON.stringify(card, null, 2)}\n`);
  } else if (card.word_type !== undefined || card.vord_type !== expectedType) {
    await writeFile(filePath, `${JSON.stringify(card, null, 2)}\n`);
  }
}

console.log(`Accepted cards checked: ${files.length}. Newly stamped: ${stamped}.`);

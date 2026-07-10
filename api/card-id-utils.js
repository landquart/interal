import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const CARD_PREFIXES = {
  internationalismes: 'in',
  associativvordes: 'av',
  indoeuropanvordes: 'iv',
  vordesofcommunites: 'vc',
  grammaticebrevivordes: 'gv',
  altervordes: 'al',
  affixes: 'af'
};

export const SEQUENCE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SEQUENCE_LENGTH = 12;
export const FALLBACK_ID_RE = /^(iv|av|in|vc|gv|al|af)_[0-9A-Za-z]{12}$/;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const GITHUB_CARD_REGISTRY_URL = (process.env.GITHUB_CARD_REGISTRY_URL || '').trim();

let supabaseClient = null;

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export function encodeBase62Padded(value, length = SEQUENCE_LENGTH) {
  let number = BigInt(value);
  if (number < 0n) throw new ValidationError('Sequence must be non-negative');
  const base = BigInt(SEQUENCE_ALPHABET.length);
  let encoded = '';
  do {
    encoded = SEQUENCE_ALPHABET[Number(number % base)] + encoded;
    number /= base;
  } while (number > 0n);
  if (encoded.length > length) throw new ValidationError('Sequence overflow', 500);
  return encoded.padStart(length, '0');
}

export function decodeBase62(value) {
  const text = String(value || '');
  if (!new RegExp(`^[0-9A-Za-z]{${SEQUENCE_LENGTH}}$`).test(text)) {
    throw new ValidationError('Invalid sequence');
  }
  const base = BigInt(SEQUENCE_ALPHABET.length);
  let number = 0n;
  for (const char of text) {
    const index = SEQUENCE_ALPHABET.indexOf(char);
    if (index < 0) throw new ValidationError('Invalid sequence');
    number = number * base + BigInt(index);
  }
  return number;
}

export function isDatabaseLimitError(error) {
  const message = String(error?.message || error?.error || error || '').toLowerCase();
  if (/invalid|validation|payload too large|method not allowed|path|section|title/.test(message)) return false;
  return (
    message.includes('quota') ||
    message.includes('storage') ||
    message.includes('database size') ||
    message.includes('disk') ||
    message.includes('no space') ||
    message.includes('insert') ||
    message.includes('could not create share state') ||
    message.includes('could not generate unique card id') ||
    message.includes('resource exhausted') ||
    message.includes('write')
  );
}

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    });
  }
  return supabaseClient;
}

function collectIds(value, output = new Set(), seen = new WeakSet()) {
  if (typeof value === 'string') {
    if (FALLBACK_ID_RE.test(value)) output.add(value);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (seen.has(value)) return output;
  seen.add(value);
  if (Array.isArray(value)) value.forEach((item) => collectIds(item, output, seen));
  else Object.values(value).forEach((item) => collectIds(item, output, seen));
  return output;
}

async function readSupabaseIds(prefix) {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('cards').select('id').like('id', `${prefix}_%`).limit(10000);
  if (error) {
    console.warn('Could not read Supabase card ids for fallback generation:', { message: error.message, code: error.code });
    return [];
  }
  return (data || []).map((row) => row?.id).filter(Boolean);
}

async function readLocalRegistryIds() {
  try {
    const json = JSON.parse(await readFile(path.join(process.cwd(), 'cards', 'registry.json'), 'utf8'));
    return [...collectIds(json)];
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Could not read local card registry for fallback generation:', error.message);
    return [];
  }
}

async function readGithubRegistryIds() {
  if (!GITHUB_CARD_REGISTRY_URL || typeof fetch !== 'function') return [];
  try {
    const response = await fetch(GITHUB_CARD_REGISTRY_URL, { cache: 'no-store' });
    if (!response.ok) return [];
    return [...collectIds(await response.json())];
  } catch (error) {
    console.warn('Could not read GitHub card registry for fallback generation:', error.message);
    return [];
  }
}

// Supabase inserts provide the real uniqueness guarantee in the primary mode.
// Fallback sequential mode is best-effort only: it reads Supabase/local/GitHub
// registries to avoid known IDs, but it does not reserve the candidate by writing
// to durable storage. For a full fallback guarantee, immediately persist the card
// to the GitHub JSON registry or another durable registry.
export async function getNextFallbackCardId(section) {
  const prefix = CARD_PREFIXES[section];
  if (!prefix) throw new ValidationError('Invalid card section');
  const ids = new Set([...(await readSupabaseIds(prefix)), ...(await readLocalRegistryIds()), ...(await readGithubRegistryIds())].filter((id) => FALLBACK_ID_RE.test(id)));
  let max = 0n;
  for (const id of ids) {
    if (!id.startsWith(`${prefix}_`)) continue;
    const sequence = decodeBase62(id.slice(prefix.length + 1));
    if (sequence > max) max = sequence;
  }
  for (let attempt = 1n; attempt <= 100n; attempt += 1n) {
    const id = `${prefix}_${encodeBase62Padded(max + attempt)}`;
    if (!ids.has(id)) return id;
  }
  throw new ValidationError('Could not find a unique fallback card id', 409);
}

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const DEFAULT_ALLOWED_ORIGINS = [
  'https://landquart.github.io',
  'https://interal.vercel.app'
];

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const EFFECTIVE_ALLOWED_ORIGINS = ALLOWED_ORIGINS.length
  ? ALLOWED_ORIGINS
  : DEFAULT_ALLOWED_ORIGINS;

const CARD_PREFIXES = {
  internationalismes: 'in',
  associativvordes: 'av',
  indoeuropanvordes: 'iv',
  vordesofcommunites: 'vc',
  grammaticebrevivordes: 'gv',
  altervordes: 'al',
  affixes: 'af'
};

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RANDOM_ID_LENGTH = 12;
const MAX_PAYLOAD_BYTES = 50_000;
const MAX_ID_ATTEMPTS = 10;

let supabaseClient = null;

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function validateEnvironment() {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

function getSupabaseClient() {
  validateEnvironment();

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    });
  }

  return supabaseClient;
}

function getAllowedOrigin(req) {
  const origin = req.headers.origin;

  if (origin && EFFECTIVE_ALLOWED_ORIGINS.includes(origin)) return origin;

  return EFFECTIVE_ALLOWED_ORIGINS[0] || 'https://landquart.github.io';
}

function getCorsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}

function sendJson(req, res, status, data) {
  res.writeHead(status, getCorsHeaders(req));
  res.end(JSON.stringify(data));
}

function createBase62Id(length = RANDOM_ID_LENGTH) {
  let id = '';

  while (id.length < length) {
    const bytes = randomBytes(length);
    const maxValidByte = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

    for (const byte of bytes) {
      if (id.length >= length) break;
      if (byte >= maxValidByte) continue;

      id += ALPHABET[byte % ALPHABET.length];
    }
  }

  return id;
}

function createCardId(section) {
  const prefix = CARD_PREFIXES[section];

  if (!prefix) {
    throw new ValidationError('Invalid card section');
  }

  return `${prefix}_${createBase62Id(RANDOM_ID_LENGTH)}`;
}

function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ValidationError('Invalid request body');
    }
  }
  return null;
}

function getPayloadSizeBytes(payload) {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

function validateCreateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Invalid request body');
  }

  const section = typeof body.section === 'string' ? body.section.trim() : '';
  const title = body.title;
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null;
  const payload = body.payload;

  if (!CARD_PREFIXES[section]) {
    throw new ValidationError('Invalid card section');
  }

  if (typeof title !== 'string' || !title.trim()) {
    throw new ValidationError('Invalid title');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Invalid payload');
  }

  if (getPayloadSizeBytes(payload) > MAX_PAYLOAD_BYTES) {
    throw new ValidationError('Payload too large');
  }

  return {
    section,
    title: title.trim(),
    category,
    payload
  };
}

async function createCard(req, res) {
  const { section, title, category, payload } = validateCreateBody(getRequestBody(req));
  const client = getSupabaseClient();

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const id = createCardId(section);
    const discussionId = `card-${id}`;
    const cardPayload = {
      ...payload,
      id,
      section,
      status: 'pending',
      discussionId
    };
    const row = {
      id,
      section,
      status: 'pending',
      title,
      category: category || null,
      discussion_id: discussionId,
      payload: cardPayload
    };

    const { data, error } = await client.from('cards').insert(row).select('*').single();

    if (!error) {
      sendJson(req, res, 200, {
        ok: true,
        id,
        section,
        status: 'pending',
        discussionId,
        card: data || row,
        persistence: {
          saved: true,
          mode: 'supabase'
        }
      });
      return;
    }

    if (error.code === '23505') continue;

    console.error('cards insert error', {
      code: error?.code || null,
      message: error?.message || null,
      details: error?.details || null,
      hint: error?.hint || null,
      section,
      titlePresent: typeof title === 'string' && title.trim().length > 0,
      payloadBytes: getPayloadSizeBytes(payload),
      insertedFields: Object.keys(row)
    });

    const insertError = new Error('Card persistence failed');
    insertError.code = 'SUPABASE_INSERT_FAILED';
    insertError.cause = error;
    throw insertError;
  }

  throw new Error('Could not generate unique card id');
}

function sendHealthCheck(req, res) {
  sendJson(req, res, 200, {
    ok: true,
    hasSupabaseUrl: Boolean(SUPABASE_URL),
    hasSupabaseKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    allowedSections: Object.keys(CARD_PREFIXES)
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(req));
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && req.query?.health === '1') {
      sendHealthCheck(req, res);
      return;
    }

    if (req.method === 'POST') {
      await createCard(req, res);
      return;
    }

    sendJson(req, res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('cards error:', { name: error?.name || null, message: error?.message || null, status: error?.status || null });

    const status = error instanceof ValidationError ? error.status : 500;
    sendJson(req, res, status, {
      ok: false,
      error: error instanceof ValidationError ? error.message : error?.message === 'Card persistence failed' ? 'Card persistence failed' : 'Internal server error',
      code: error instanceof ValidationError ? 'VALIDATION_ERROR' : error?.code || 'INTERNAL_ERROR'
    });
  }
}

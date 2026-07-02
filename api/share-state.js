import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();

const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim();

const PUBLIC_SHARE_ORIGIN = 'https://interal.vercel.app';

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

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ID_LENGTH = 12;
const MAX_PAYLOAD_BYTES = 50_000;

let supabaseClient = null;

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function getSupabaseKeyInfo() {
  return {
    exists: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    length: SUPABASE_SERVICE_ROLE_KEY.length,
    looksLikeLegacyJwt: SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ'),
    looksLikeSecretKey: SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_')
  };
}

function validateEnvironment() {
  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  if (!SUPABASE_URL.startsWith('https://') || !SUPABASE_URL.includes('.supabase.co')) {
    throw new Error('Invalid SUPABASE_URL');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
    throw new Error(
      'Invalid SUPABASE_SERVICE_ROLE_KEY: use legacy service_role JWT key that starts with eyJ, not sb_secret or publishable key'
    );
  }
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

  if (origin && EFFECTIVE_ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

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

function createBase62Id(length = ID_LENGTH) {
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

function isValidId(id) {
  return /^[0-9A-Za-z]{12}$/.test(id);
}

function normalizePath(path) {
  const value = String(path || '').trim();
  const prefixed = value.startsWith('/') ? value : `/${value}`;

  if (prefixed.startsWith('/interal/')) {
    return prefixed;
  }

  return `/interal${prefixed}`;
}

function isAllowedPath(path) {
  return /^\/interal\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevivordes|altervordes|affixes)\/?$/.test(path);
}

function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
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

  const path = normalizePath(body.path);
  const payload = body.payload;

  if (!isAllowedPath(path)) {
    throw new ValidationError('Invalid path');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Invalid payload');
  }

  if (payload.source !== 'interal-form-draft') {
    throw new ValidationError('Invalid payload source');
  }

  if (!payload.fields || typeof payload.fields !== 'object' || Array.isArray(payload.fields)) {
    throw new ValidationError('Invalid payload fields');
  }

  if (payload.path && normalizePath(payload.path) !== path) {
    throw new ValidationError('Payload path does not match request path');
  }

  const normalizedPayload = {
    ...payload,
    version: payload.version || 1,
    source: 'interal-form-draft',
    path
  };

  if (getPayloadSizeBytes(normalizedPayload) > MAX_PAYLOAD_BYTES) {
    throw new ValidationError('Payload too large', 413);
  }

  return {
    path,
    payload: normalizedPayload
  };
}

function toPublicPath(path) {
  return String(path || '/').replace(/^\/interal/, '') || '/';
}

function createPublicShareUrl(path, id) {
  const publicUrl = new URL(toPublicPath(path), PUBLIC_SHARE_ORIGIN);
  publicUrl.searchParams.set('s', id);

  return publicUrl.toString();
}

async function createShareState(req, res) {
  const body = getRequestBody(req);
  const { path, payload } = validateCreateBody(body);
  const client = getSupabaseClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = createBase62Id();

    const { error } = await client
      .from('share_states')
      .insert({
        id,
        path,
        payload,
        expires_at: null
      });

    if (!error) {
      sendJson(req, res, 200, {
        ok: true,
        id,
        path,
        url: createPublicShareUrl(path, id)
      });

      return;
    }

    if (error.code === '23505') {
      continue;
    }

    throw error;
  }

  throw new Error('Could not generate unique share id');
}

async function readShareState(req, res) {
  const id = String(req.query?.id || '');

  if (!isValidId(id)) {
    throw new ValidationError('Invalid id');
  }

  const client = getSupabaseClient();

  const { data, error } = await client
    .from('share_states')
    .select('id, path, payload, expires_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    sendJson(req, res, 404, {
      ok: false,
      error: 'Share state not found'
    });

    return;
  }

  if (data.expires_at && Date.now() > Date.parse(data.expires_at)) {
    sendJson(req, res, 410, {
      ok: false,
      error: 'Share state expired'
    });

    return;
  }

  const { error: touchError } = await client.rpc('touch_share_state', {
    p_id: id
  });

  if (touchError) {
    console.warn('Could not update share state stats:', touchError);
  }

  sendJson(req, res, 200, {
    ok: true,
    id: data.id,
    path: data.path,
    payload: data.payload
  });
}

function sendHealthCheck(req, res) {
  const keyInfo = getSupabaseKeyInfo();

  sendJson(req, res, 200, {
    ok: true,
    supabaseUrl: SUPABASE_URL || null,
    hasSupabaseUrl: Boolean(SUPABASE_URL),
    hasSupabaseKey: keyInfo.exists,
    keyLength: keyInfo.length,
    keyLooksLikeLegacyJwt: keyInfo.looksLikeLegacyJwt,
    keyLooksLikeSecretKey: keyInfo.looksLikeSecretKey,
    expectedKeyType: 'legacy service_role JWT starting with eyJ',
    allowedOrigins: EFFECTIVE_ALLOWED_ORIGINS
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
      await createShareState(req, res);
      return;
    }

    if (req.method === 'GET') {
      await readShareState(req, res);
      return;
    }

    sendJson(req, res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('share-state error:', error);

    const status = error instanceof ValidationError
      ? error.status
      : 500;

    sendJson(req, res, status, {
      ok: false,
      error: error instanceof ValidationError ? error.message : 'Internal server error'
    });
  }
}

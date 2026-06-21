const crypto = require('crypto');

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CODE_LENGTH = 12;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RECORDS = 1000;
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

const store = globalThis.__interalShareStateStore || new Map();
globalThis.__interalShareStateStore = store;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  res.setHeader('Allow', 'GET, POST, OPTIONS');
  send(res, 405, { error: 'Method not allowed' });
}

function cleanup(now = Date.now()) {
  for (const [code, record] of store) {
    if (!record || record.expiresAt <= now) store.delete(code);
  }
  while (store.size > MAX_RECORDS) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
}

function randomBase62(length = CODE_LENGTH) {
  let code = '';
  const limit = Math.floor(256 / BASE62.length) * BASE62.length;
  while (code.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < limit) code += BASE62[byte % BASE62.length];
  }
  return code;
}

function createCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = randomBase62();
    if (!store.has(code)) return code;
  }
  throw new Error('Could not create unique code');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isValidEntries(entries) {
  return Array.isArray(entries) && entries.every((entry) => (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'string' &&
    (entry[1] === 1 || typeof entry[1] === 'string')
  ));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  cleanup();

  if (req.method === 'POST') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body || '{}');
      if (!isValidEntries(parsed.entries)) {
        send(res, 400, { error: 'Invalid state entries' });
        return;
      }
      const code = createCode();
      store.set(code, { entries: parsed.entries, expiresAt: Date.now() + TTL_MS });
      send(res, 201, { code });
    } catch (error) {
      send(res, error.message === 'Request body is too large' ? 413 : 400, { error: error.message || 'Bad request' });
    }
    return;
  }

  if (req.method === 'GET') {
    const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const code = requestUrl.searchParams.get('code') || '';
    if (!/^[0-9A-Za-z]{12}$/.test(code)) {
      send(res, 400, { error: 'Invalid code' });
      return;
    }
    const record = store.get(code);
    if (!record || record.expiresAt <= Date.now()) {
      store.delete(code);
      send(res, 404, { error: 'State not found' });
      return;
    }
    send(res, 200, { entries: record.entries });
    return;
  }

  methodNotAllowed(res);
};

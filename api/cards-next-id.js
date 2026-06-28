import { CARD_PREFIXES, ValidationError, getNextFallbackCardId } from './card-id-utils.js';

const DEFAULT_ALLOWED_ORIGINS = ['https://landquart.github.io', 'https://interal.vercel.app'];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const EFFECTIVE_ALLOWED_ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;

function getAllowedOrigin(req) {
  const origin = req.headers.origin;
  return origin && EFFECTIVE_ALLOWED_ORIGINS.includes(origin) ? origin : EFFECTIVE_ALLOWED_ORIGINS[0];
}
function getCorsHeaders(req) { return { 'Access-Control-Allow-Origin': getAllowedOrigin(req), 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }; }
function sendJson(req, res, status, data) { res.writeHead(status, getCorsHeaders(req)); res.end(JSON.stringify(data)); }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, getCorsHeaders(req)); res.end(); return; }
  try {
    if (req.method !== 'GET') { sendJson(req, res, 405, { ok: false, error: 'Method not allowed' }); return; }
    const section = String(req.query?.section || '').trim();
    if (!CARD_PREFIXES[section]) throw new ValidationError('Invalid card section');
    const id = await getNextFallbackCardId(section);
    sendJson(req, res, 200, { ok: true, mode: 'fallback-sequential', section, id, guarantee: 'best-effort-read-check-only' });
  } catch (error) {
    const status = error instanceof ValidationError ? error.status : 500;
    console.error('cards-next-id error:', { message: error.message, name: error.name });
    sendJson(req, res, status, { ok: false, error: error instanceof ValidationError ? error.message : 'Internal server error' });
  }
}

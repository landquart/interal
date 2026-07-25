import altervordesAnalyzeHandler from './altervordes-analyze-core.js';
import { sanitizeUnsupportedSimpleNounClaims } from './lib/altervordes-noun-guard.js';
import { normalizeInterfaceLanguage } from './lib/interface-language.js';

const MAX_BODY_BYTES = 50_000;

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Payload too large');
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function createCaptureResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), { name, value });
    },
    get headers() {
      return headers;
    },
    end(value = '') {
      this.body = String(value ?? '');
      return this;
    }
  };
}

function copyHeaders(captured, res) {
  for (const { name, value } of captured.headers.values()) {
    res.setHeader(name, value);
  }
}

export default async function handler(req, res) {
  let requestBody;
  try {
    requestBody = await readRequestBody(req);
  } catch (error) {
    res.statusCode = error.status || 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: error.message || 'Invalid body' }));
  }

  req.body = requestBody;
  const captured = createCaptureResponse();
  await altervordesAnalyzeHandler(req, captured);

  copyHeaders(captured, res);
  res.statusCode = captured.statusCode;

  let responsePayload;
  try {
    responsePayload = captured.body ? JSON.parse(captured.body) : null;
  } catch {
    return res.end(captured.body);
  }

  if (responsePayload?.ok === true && responsePayload.analysis) {
    const source = requestBody?.payload && typeof requestBody.payload === 'object'
      ? requestBody.payload
      : requestBody;
    const input = {
      ...source,
      interfaceLanguage: normalizeInterfaceLanguage(
        requestBody?.interfaceLanguage || source?.interfaceLanguage
      )
    };
    responsePayload.analysis = sanitizeUnsupportedSimpleNounClaims(responsePayload.analysis, input);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(responsePayload));
}

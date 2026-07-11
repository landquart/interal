import qwenAnalyze from './qwen-analyze.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    let payload = {};
    try { payload = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { payload = {}; }
    req.body = { task: 'determine_valen_type', interfaceLanguage: payload.interfaceLanguage, payload };
  }
  return qwenAnalyze(req, res);
}

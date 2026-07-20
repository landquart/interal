import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOne(path, before, after) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one replacement target, found ${count}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOne(
  'api/qwen-candidates.js',
  `export default async function handler(req, res) {\n  cors(req, res);\n  if (req.method === 'OPTIONS') {\n    res.statusCode = 204;\n    return res.end();\n  }\n  try {\n    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });\n    const input = validateInput(await readBody(req));\n    const response = await callYandex(input);\n    const qwenCandidates = normalizeResult(extractJson(response.content));\n    const guaranteedCandidates = guaranteedAllomorphCandidates(input);\n    return send(res, 200, {\n      ok: true,\n      candidates: mergeCandidateMaps(guaranteedCandidates, qwenCandidates),\n      qwenCandidates,\n      guaranteedCandidates,\n      model: response.model,\n      currentModels: input.currentModels\n    });\n  } catch (error) {\n    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;\n    return send(res, status, {\n      ok: false,\n      error: status < 500 ? error.message : 'qwen_candidate_generation_failed',\n      errorCode: status < 500 ? 'QWEN_CANDIDATE_INVALID_REQUEST' : 'QWEN_CANDIDATE_GENERATION_FAILED',\n      details: String(error.details || error.message || error).slice(0, 1200)\n    });\n  }\n}\n`,
  `export default async function handler(req, res) {\n  cors(req, res);\n  if (req.method === 'OPTIONS') {\n    res.statusCode = 204;\n    return res.end();\n  }\n  try {\n    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });\n    const input = validateInput(await readBody(req));\n    const guaranteedCandidates = guaranteedAllomorphCandidates(input);\n    let qwenCandidates = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]));\n    let model = null;\n    let qwenAuditError = null;\n    try {\n      const response = await callYandex(input);\n      qwenCandidates = normalizeResult(extractJson(response.content));\n      model = response.model;\n    } catch (error) {\n      const hasGuaranteedCandidates = CONTROL_LANGUAGES.some(language => guaranteedCandidates[language]?.length);\n      if (!hasGuaranteedCandidates) throw error;\n      qwenAuditError = {\n        errorCode: 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE',\n        details: String(error.details || error.message || error).slice(0, 1200)\n      };\n    }\n    return send(res, 200, {\n      ok: true,\n      candidates: mergeCandidateMaps(guaranteedCandidates, qwenCandidates),\n      qwenCandidates,\n      guaranteedCandidates,\n      qwenAuditError,\n      model,\n      currentModels: input.currentModels\n    });\n  } catch (error) {\n    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;\n    return send(res, status, {\n      ok: false,\n      error: status < 500 ? error.message : 'qwen_candidate_generation_failed',\n      errorCode: status < 500 ? 'QWEN_CANDIDATE_INVALID_REQUEST' : 'QWEN_CANDIDATE_GENERATION_FAILED',\n      details: String(error.details || error.message || error).slice(0, 1200)\n    });\n  }\n}\n`
);

await replaceOne(
  'tests/associative-qwen-candidate-generation.test.mjs',
  `assert.equal(responseHeaders['Cache-Control'], 'no-store', 'candidate responses are not cached');\n\nglobalThis.fetch = previousFetch;`,
  `assert.equal(responseHeaders['Cache-Control'], 'no-store', 'candidate responses are not cached');\n\nlet fallbackResponseText = '';\nconst fallbackResponse = {\n  statusCode: 0,\n  setHeader() {},\n  end(value = '') { fallbackResponseText = String(value); }\n};\nglobalThis.fetch = async () => { throw new Error('simulated Qwen outage'); };\nawait endpointModule.default({\n  method: 'POST',\n  headers: {},\n  body: { root: 'alter', targetMeaning: 'other', interfaceLanguage: 'en', existingCandidates: {}, currentModels: {} }\n}, fallbackResponse);\nconst fallbackPayload = JSON.parse(fallbackResponseText);\nassert.equal(fallbackResponse.statusCode, 200, 'known allomorph candidates survive a Qwen transport failure');\nassert.deepEqual(fallbackPayload.candidates.en, [\n  { word: 'altruism', root_variant: 'altru' },\n  { word: 'altruist', root_variant: 'altru' }\n]);\nassert.equal(fallbackPayload.qwenAuditError.errorCode, 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE');\n\nglobalThis.fetch = previousFetch;`
);

await replaceOne(
  'tests/associative-qwen-candidate-generation.test.mjs',
  `assert.match(endpointSource, /mergeCandidateMaps\\(guaranteedCandidates, qwenCandidates\\)/, 'guaranteed allomorph candidates cannot be suppressed by an empty model response');`,
  `assert.match(endpointSource, /mergeCandidateMaps\\(guaranteedCandidates, qwenCandidates\\)/, 'guaranteed allomorph candidates cannot be suppressed by an empty model response');\nassert.match(endpointSource, /QWEN_CANDIDATE_AUDIT_UNAVAILABLE/, 'known allomorph candidates survive Qwen transport and parsing failures');`
);

await rm('scripts/apply-qwen-audit-fallback.mjs', { force: true });
await rm('.github/workflows/apply-qwen-audit-fallback.yml', { force: true });
console.log('Applied Qwen audit fallback patch.');

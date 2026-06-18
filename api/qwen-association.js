const PRIMARY_MODEL = 'qwen3.6-35b-a3b/latest';
const REVIEW_MODEL = 'qwen3-235b-a22b-fp8/latest';
const YANDEX_COMPLETION_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(payload);
}

function modelConfig(model, review) {
  const useReview = review === true || model === REVIEW_MODEL;
  return useReview
    ? {
        kind: 'review',
        model: REVIEW_MODEL,
        apiKey: process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex,
        folderId: process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8
      }
    : {
        kind: 'primary',
        model: model || PRIMARY_MODEL,
        apiKey: process.env.Qwen3_6_35B_Yandex,
        folderId: process.env.yandex_folder_Qwen3_6_35B
      };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const { system, user, model = PRIMARY_MODEL, review = false } = req.body || {};
  if (!system || !user) return sendJson(res, 400, { error: 'Missing system or user prompt' });

  const selected = modelConfig(model, review);
  if (!selected.apiKey) return sendJson(res, 500, { error: `Missing Yandex API key for ${selected.kind} model` });
  if (!selected.folderId) return sendJson(res, 500, { error: `Missing Yandex folder ID for ${selected.kind} model` });

  const yandexBody = {
    modelUri: `gpt://${selected.folderId}/${selected.model}`,
    completionOptions: { stream: false, temperature: 0, maxTokens: 1200 },
    messages: [
      { role: 'system', text: system },
      { role: 'user', text: user }
    ]
  };

  try {
    const response = await fetch(YANDEX_COMPLETION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${selected.apiKey}`
      },
      body: JSON.stringify(yandexBody)
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { text }; }

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: 'Yandex API error',
        status: response.status,
        details: data
      });
    }

    const content =
      data?.result?.alternatives?.[0]?.message?.text ||
      data?.alternatives?.[0]?.message?.text ||
      '';

    return sendJson(res, 200, { content, raw: data });
  } catch (error) {
    return sendJson(res, 502, { error: 'Yandex API error', status: 502, details: error.message });
  }
};

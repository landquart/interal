const CONTROL_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const AUXILIARY_LANGUAGES = ['pl', 'sv', 'ca', 'oc', 'ro'];

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty model response.');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Model response does not contain a JSON object.');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}
function normalizeString(value, fallback = '') { return typeof value === 'string' ? value.trim() : fallback; }
function normalizeArray(value) { return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []; }
function normalizeLanguageMap(value, languages, fallback = '') {
  const result = {};
  const source = value && typeof value === 'object' ? value : {};
  languages.forEach((lang) => { result[lang] = normalizeString(source[lang], fallback); });
  return result;
}
function normalizeLanguageArrayMap(value, languages) {
  const result = {};
  const source = value && typeof value === 'object' ? value : {};
  languages.forEach((lang) => { result[lang] = normalizeArray(source[lang]); });
  return result;
}
function makeStrictCard(input, generated) {
  const now = new Date().toISOString();
  const card = generated && typeof generated === 'object' ? generated : {};
  const criteria = card.criteria?.controlLanguagePresence || {};
  const forms = card.forms || {};
  return {
    id: normalizeString(card.id, normalizeString(input.id, `af_${Math.random().toString(36).slice(2, 14)}`)),
    status: normalizeString(card.status, normalizeString(input.status, 'draft')),
    form: normalizeString(card.form, normalizeString(input.form)),
    morphemeType: normalizeString(card.morphemeType, normalizeString(input.morphemeType, 'suffix')),
    procedure: 'alter_affix',
    version: normalizeString(card.version, normalizeString(input.version, '1.0')),
    card_type: normalizeString(card.card_type, normalizeString(input.card_type, 'affix_card')),
    vord_type: normalizeString(card.vord_type, normalizeString(input.vord_type, 'af')),
    created_at: normalizeString(card.created_at, normalizeString(input.created_at, now)),
    meaning: normalizeLanguageMap(card.meaning || input.meaning, CONTROL_LANGUAGES),
    criteria: { controlLanguagePresence: { required: normalizeString(criteria.required, 'partial_presence_or_alternative_need'), actual: normalizeString(criteria.actual, 'weak_or_partial') } },
    forms: {
      controlLanguages: normalizeLanguageArrayMap(forms.controlLanguages || input.forms?.controlLanguages, CONTROL_LANGUAGES),
      auxiliaryLanguages: normalizeLanguageArrayMap(forms.auxiliaryLanguages || input.forms?.auxiliaryLanguages, AUXILIARY_LANGUAGES)
    }
  };
}
function buildPrompt(input) {
  return `
Ты создаёшь JSON-карточку иного аффикса для Interal.

Методология:
Иные аффиксы нужны тогда, когда для необходимого значения аффиксы в контрольных языках значительно различаются (единственный вариант) или более распространённый аффикс имеет несколько морфологических форм из-за деривации и/или несколько значений (альтернативный вариант).
Критерии: действительная необходимость в единственном или альтернативном варианте, нет конфликтов, наибольшая краткость среди альтернатив, частичная международная представленность, включая вспомогательные языки, возможность деривации, наиболее ясное значение среди альтернатив.
Стандартизация: учитывай не только обычную форму в отдельных словах, но и форму в производных словах. Окончания языков-источников не переносятся автоматически; выбирается более распространённая, прототипная или удобная для деривации форма.

Верни только JSON-объект строго этой структуры, без markdown и без дополнительных полей:
{
  "id": "string",
  "status": "draft",
  "form": "string",
  "morphemeType": "suffix",
  "procedure": "alter_affix",
  "version": "1.0",
  "card_type": "affix_card",
  "vord_type": "af",
  "created_at": "ISO datetime string",
  "meaning": {
    "en": "string",
    "de": "string",
    "fr": "string",
    "es": "string",
    "it": "string",
    "ru": "string"
  },
  "criteria": {
    "controlLanguagePresence": {
      "required": "partial_presence_or_alternative_need",
      "actual": "weak_or_partial"
    }
  },
  "forms": {
    "controlLanguages": {
      "en": ["string"],
      "de": ["string"],
      "fr": ["string"],
      "es": ["string"],
      "it": ["string"],
      "ru": ["string"]
    },
    "auxiliaryLanguages": {
      "pl": ["string"],
      "sv": ["string"],
      "ca": ["string"],
      "oc": ["string"],
      "ro": ["string"]
    }
  }
}

Важное правило: для alter_affix поле forms показывает альтернативные аффиксальные средства для той же функции в языках, а не обязательно варианты самой формы.

Входная карточка:
${JSON.stringify(input, null, 2)}
`;
}
async function callYandexQwen(input) {
  const apiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
  const folderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
  if (!apiKey || !folderId) throw new Error('Missing Yandex Qwen environment variables.');
  const modelUri = `gpt://${folderId}/qwen3-235b-a22b-instruct-2507-fp8/latest`;
  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Api-Key ${apiKey}`, 'x-folder-id': folderId },
    body: JSON.stringify({
      modelUri,
      completionOptions: { stream: false, temperature: 0.1, maxTokens: 2200 },
      messages: [
        { role: 'system', text: 'You return only valid JSON. Do not add explanations.' },
        { role: 'user', text: buildPrompt(input) }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || data?.message || 'Yandex Qwen request failed.');
  return extractJson(data?.result?.alternatives?.[0]?.message?.text);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const input = req.body || {};
    if (input.procedure !== 'alter_affix') return res.status(400).json({ error: 'This endpoint is only for alter_affix cards.' });
    const generated = await callYandexQwen(input);
    const card = makeStrictCard(input, generated);
    return res.status(200).json({ card });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Affix analysis failed.' });
  }
}

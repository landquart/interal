import { readFileSync } from 'node:fs';
import { getQwenLanguageInstruction, normalizeInterfaceLanguage } from './lib/interface-language.js';
import {
  buildAltervordesSystemPrompt as buildAltervordesSystemPromptV2,
  buildAltervordesUserPrompt as buildAltervordesUserPromptV2
} from './lib/altervordes-prompts.js';
import { calculateAssociativeAffix } from '../shared/associative-affix-calculation.mjs';

const DERIVATION_CONTEXT = JSON.parse(
  readFileSync(new URL('./interal-derivation-context.json', import.meta.url), 'utf8')
);

const MAX_BODY_BYTES = 50_000;
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const QWEN_ASSOCIATIVE_PRIMARY_MODEL = 'qwen3.6-35b-a3b/latest';
const QWEN_ASSOCIATIVE_REVIEW_MODEL = 'qwen3-235b-a22b-fp8/latest';
const QWEN_235_MODEL = QWEN_ASSOCIATIVE_REVIEW_MODEL;
const CONTROL_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const AUXILIARY_LANGUAGES = ['pl', 'sv', 'ca', 'oc', 'ro'];
const TARGET_TRANSLATION_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const TARGET_TRANSLATION_CODES = new Set(TARGET_TRANSLATION_LANGUAGES);
const TARGET_TRANSLATION_CACHE = new Map();
const OFFLINE_TARGET_TRANSLATIONS = {
  'ru:правило': { ru: 'правило', en: 'rule', de: 'Regel', es: 'regla', fr: 'règle', it: 'regola' },
  'ru:солнце': { ru: 'солнце', en: 'sun', de: 'Sonne', es: 'sol', fr: 'soleil', it: 'sole' }
};



const POS_VALUES = new Set(['noun','adjective','verb','adverb','pronoun','numeral','interjection','function_word','other']);
const DECISIONS = new Set(['accepted','rejected','needs_manual_review']);
const CONTROL_CODES = ['en','de','fr','es','it','ru'];
const AUX_CODES = ['pl','sv','ca','oc','ro'];
function cors(req,res){const o=req.headers.origin||'*'; res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); res.setHeader('Cache-Control','no-store');}
function send(res,status,payload){res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(payload));}
async function raw(req){let size=0,ch=[]; for await(const c of req){const b=Buffer.isBuffer(c)?c:Buffer.from(String(c)); size+=b.length; if(size>MAX_BODY_BYTES){const e=Error('Payload too large'); e.status=413; throw e;} ch.push(b);} return Buffer.concat(ch).toString('utf8');}
async function body(req){if(req.body&&typeof req.body==='object')return req.body; if(typeof req.body==='string')return JSON.parse(req.body||'{}'); const r=await raw(req); return r?JSON.parse(r):{};}
function extract(text){const t=String(text||'').trim(); try{return JSON.parse(t)}catch{} const f=t.match(/```(?:json)?\s*([\s\S]*?)```/i); if(f)try{return JSON.parse(f[1])}catch{} const i=t.indexOf('{'),j=t.lastIndexOf('}'); if(i>=0&&j>i)return JSON.parse(t.slice(i,j+1)); throw Object.assign(Error('AI returned invalid JSON'),{status:502});}
function validateAltervordes(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Invalid body'),{status:400}); input.translation=String(input.translation||'').trim(); input.interfaceLanguage=normalizeInterfaceLanguage(input.interfaceLanguage); input.partOfSpeech=String(input.partOfSpeech||'').trim(); input.candidate=String(input.candidate||'').trim(); input.comment=String(input.comment||'').trim(); if(!input.translation)throw Object.assign(Error('translation is required'),{status:400}); if(!POS_VALUES.has(input.partOfSpeech))throw Object.assign(Error('Invalid partOfSpeech'),{status:400}); if(!input.candidate)throw Object.assign(Error('candidate is required'),{status:400}); return input;}
function stringMap(value,codes){const out={}; for(const c of codes) out[c]=String(value?.[c]||''); return out;}
function getAiText(responseJson, fallbackText){const message=responseJson?.choices?.[0]?.message?.content; if(typeof message==='string')return message; if(Array.isArray(message))return message.map(part=>part?.text||part?.content||'').join('\n').trim(); return fallbackText;}
async function callYandex(messages,withResponseFormat=true,modelName=QWEN_235_MODEL){const apiKey=process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex; const folderId=process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8; const body={model:`gpt://${folderId}/${modelName}`,messages,temperature:0,max_tokens:2200}; if(withResponseFormat)body.response_format={type:'json_object'}; const response=await fetch(YANDEX_CHAT_COMPLETIONS_URL,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)}); const text=await response.text(); if(!response.ok){const error=Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`); error.status=response.status; error.details=text.slice(0,1200); throw error;} let data; try{data=text?JSON.parse(text):{};}catch{data={text};} return {content:getAiText(data,text),model:body.model,raw:data};}
function normalizeAltervordesResult(r,input,model){const decision=DECISIONS.has(r?.decision)?r.decision:'needs_manual_review'; const eligible=decision==='accepted' && r?.eligible===true; return {
  section:'altervordes', procedure:'alter-vordes-step-6', responseLanguage:normalizeInterfaceLanguage(r?.responseLanguage||input.interfaceLanguage), eligible, decision,
  recommendedForm:String(r?.recommendedForm||input.candidate), partOfSpeech:POS_VALUES.has(r?.partOfSpeech)?r.partOfSpeech:input.partOfSpeech, inputTranslation:String(r?.inputTranslation||input.translation),
  translations:{ controlLanguages:stringMap(r?.translations?.controlLanguages,CONTROL_CODES), auxiliaryLanguages:stringMap(r?.translations?.auxiliaryLanguages,AUX_CODES) },
  analysis:{ brevity:String(r?.analysis?.brevity||''), pronounceability:String(r?.analysis?.pronounceability||''), conflicts:String(r?.analysis?.conflicts||''), neutrality:String(r?.analysis?.neutrality||''), controlAndAuxiliaryEvidence:String(r?.analysis?.controlAndAuxiliaryEvidence||''), partOfSpeechSuitability:String(r?.analysis?.partOfSpeechSuitability||''), derivationalPotential:String(r?.analysis?.derivationalPotential||''), interalRuleCompatibility:String(r?.analysis?.interalRuleCompatibility||'') },
  derivation:{
    canFormVerb:Boolean(r?.derivation?.canFormVerb),
    canFormNoun:Boolean(r?.derivation?.canFormNoun),
    canFormAdjective:Boolean(r?.derivation?.canFormAdjective),
    possibleDerivations:Array.isArray(r?.derivation?.possibleDerivations)?r.derivation.possibleDerivations.map(String).slice(0,24):[],
    appliedRules:Array.isArray(r?.derivation?.appliedRules)?r.derivation.appliedRules.map(String).slice(0,20):[],
    deWahlRuleNotes:String(r?.derivation?.deWahlRuleNotes||''),
    suffixAndEndingNotes:String(r?.derivation?.suffixAndEndingNotes||''),
    ruleSourceVersion:String(r?.derivation?.ruleSourceVersion||DERIVATION_CONTEXT.version||'')
  },
  risks:Array.isArray(r?.risks)?r.risks.map(String).slice(0,12):[], suggestedSaferForms:Array.isArray(r?.suggestedSaferForms)?r.suggestedSaferForms.map(String).slice(0,2):[], shortConclusion:String(r?.shortConclusion||'').slice(0,1600), finalDecisionByHuman:true,
  model:{ name:model, role:'advisory evaluator', finalDecisionByHuman:true }
};}
function buildAltervordesSystemPrompt(interfaceLanguage){return `You are an expert evaluator for the Interal auxiliary language.

${getQwenLanguageInstruction(interfaceLanguage)}

You analyze only Alter vordes: words that failed the five main lexical selection procedures and therefore require an additional qualitative evaluation.

You must not calculate percentages or numeric scores.

You must use the following Interal derivation context as binding rules. This context is extracted from the Interal grammar and the semantic transparency document. Do not ignore it. Do not invent rules that contradict it.

INTERAL_DERIVATION_CONTEXT:
${JSON.stringify(DERIVATION_CONTEXT, null, 2)}

Core obligations:
1. Translate the user's single input meaning into control languages and auxiliary languages.
2. Evaluate the candidate Interal form qualitatively.
3. Pay special attention to future derivation.
4. Check compatibility with:
   - modified de Wahl rule;
   - Interal endings;
   - suffixes and prefixes;
   - logical vs international derivative meanings;
   - possible need for -u, -i, -al, -ari, -ic;
   - semantic transparency and lexicalization risks.
5. If the candidate form cannot support a stable derivative family, mark it as rejected or needs_manual_review.
6. If the candidate form creates unresolved logical vs international ambiguity, mark it as rejected or needs_manual_review.
7. If the derivational risk is serious, eligible must be false.
8. The final decision is advisory and finalDecisionByHuman must be true.

Return only valid JSON. No markdown. No explanations outside JSON.`;}
function buildAltervordesUserPrompt(input){return `Evaluate this candidate word for Interal Alter vordes.

Alter vordes are words that do not pass any of the five main lexical selection procedures:
1. grammatical and short function words;
2. internationalisms;
3. professional, cultural, social or subcultural community words;
4. common Indo-European words;
5. associative words.

This is not a mathematical procedure. Do not output percentages or numeric scores.

Input:
${JSON.stringify(input,null,2)}

Tasks:
1. Translate the input meaning into all control languages: English, German, French, Spanish, Italian, Russian.
2. Translate the input meaning into all auxiliary languages: Polish, Swedish, Catalan, Occitan, Romanian.
3. Analyze whether the candidate Interal form can be accepted as an Alter vordes form.
4. Evaluate the form qualitatively by brevity, pronounceability, semantic and phonetic/graphic conflicts, neutrality, part of speech, future derivational potential, Interal endings, suffixes and prefixes, modified de Wahl rule if relevant, and whether the root allows natural derivations without excessive distortion.
5. Use INTERAL_DERIVATION_CONTEXT from the system prompt as binding context.
6. In derivation.appliedRules, explicitly list which Interal rules were relevant.
7. In derivation.deWahlRuleNotes, explain whether the candidate is compatible with the modified de Wahl rule.
8. In derivation.suffixAndEndingNotes, explain relevant suffix/ending behavior.
9. If the form has serious derivational risk, unresolved ambiguity, or rule conflict, set eligible false.
10. Do not create alternative forms unless the candidate is clearly unsuitable. If unsuitable, suggest at most 2 safer forms.
11. Return whether JSON card creation should be allowed.

Output only valid JSON using this schema shape:
{
  "responseLanguage": "ru | en",
  "decision": "accepted | rejected | needs_manual_review",
  "eligible": false,
  "recommendedForm": "",
  "partOfSpeech": "",
  "inputTranslation": "",
  "translations": {
    "controlLanguages": { "en": "", "de": "", "fr": "", "es": "", "it": "", "ru": "" },
    "auxiliaryLanguages": { "pl": "", "sv": "", "ca": "", "oc": "", "ro": "" }
  },
  "analysis": {
    "brevity": "",
    "pronounceability": "",
    "conflicts": "",
    "neutrality": "",
    "controlAndAuxiliaryEvidence": "",
    "partOfSpeechSuitability": "",
    "derivationalPotential": "",
    "interalRuleCompatibility": ""
  },
  "derivation": {
    "canFormVerb": true,
    "canFormNoun": true,
    "canFormAdjective": true,
    "possibleDerivations": [],
    "appliedRules": [],
    "deWahlRuleNotes": "",
    "suffixAndEndingNotes": "",
    "ruleSourceVersion": ""
  },
  "risks": [],
  "suggestedSaferForms": [],
  "shortConclusion": "",
  "finalDecisionByHuman": true
}

Set responseLanguage to the interfaceLanguage from the input. Decision must be accepted, rejected, or needs_manual_review. eligible must be true only for accepted forms. Do not output numeric scores or markdown.`;}


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

const AFFIX_PROCEDURE_CRITERIA = {
  international_affix: { required: 'at_least_5_of_6', actual: 'strong' },
  associativ_affix: { required: 'at_least_3_of_6', actual: 'requires_check' },
  alter_affix: { required: 'partial_presence_or_alternative_need', actual: 'weak_or_partial' }
};
const AFFIX_PROCEDURES = new Set(Object.keys(AFFIX_PROCEDURE_CRITERIA));
const AFFIX_GROUPS = { en: 'Germanic', de: 'Germanic', fr: 'Romance', es: 'Romance', it: 'Romance', ru: 'Slavic' };
function countCoveredLanguageArrays(map = {}) { return CONTROL_LANGUAGES.filter(lang => Array.isArray(map?.[lang]) && map[lang].length > 0).length; }
function evaluateAffixDecision(card) {
  const procedure = card.procedure;
  const evidence = card.evidence || {};
  const controlLanguages = evidence.controlLanguages || card.forms?.controlLanguages || {};
  let accepted = false;
  let needsManualReview = false;
  let calculation = null;
  const criteria = {};

  if (procedure === 'international_affix') {
    const coveredLanguages = countCoveredLanguageArrays(controlLanguages);
    const coveredGroups = new Set(CONTROL_LANGUAGES.filter(lang => Array.isArray(controlLanguages?.[lang]) && controlLanguages[lang].length > 0).map(lang => AFFIX_GROUPS[lang])).size;
    Object.assign(criteria, { covered_languages: coveredLanguages, covered_groups: coveredGroups, required_languages: 5 });
    criteria.immediate_recognition = evidence.immediateRecognition === true;
    criteria.stable_international_presence = evidence.stableInternationalPresence === true;
    accepted = coveredLanguages >= 5 && criteria.immediate_recognition && criteria.stable_international_presence;
  } else if (procedure === 'associativ_affix') {
    const frequencyWords = card.evidence?.frequencyWords || card.frequencyWords || {};
    calculation = calculateAssociativeAffix(frequencyWords);
    Object.assign(criteria, {
      covered_languages: calculation.representedLanguages,
      covered_groups: calculation.representedLanguageGroups,
      required_languages: 3,
      required_groups: 2
    });
    criteria.frequency_language_count = calculation.representedLanguages;
    criteria.ipm_threshold = 3;
    criteria.ipm_passed = calculation.criteria.minimum_ipm_each_language;
    criteria.word_count_passed = calculation.criteria.one_to_five_words_each_language;
    criteria.FAa_threshold = calculation.threshold;
    criteria.FAa_passed = calculation.criteria.FAa_threshold;
    criteria.recognition_type = card.recognitionType || card.criteria?.recognition_type || 'needs_manual_review';
    accepted = calculation.accepted;
  } else {
    const c = card.criteria || {};
    const keys = ['necessityConfirmed','noSeriousConflicts','shortestSuitableAlternative','partialInternationalPresence','derivationallyViable','meaningClear','noBetterStandardProcedure'];
    needsManualReview = keys.some(key => typeof c[key] !== 'boolean');
    accepted = !needsManualReview && keys.every(key => c[key] === true);
    Object.assign(criteria, Object.fromEntries(keys.map(key => [key, c[key] === true])));
  }

  const status = accepted ? 'accepted' : (needsManualReview ? 'needs_manual_review' : 'rejected');
  return { criteria, calculation, decision: { status, accepted, rejected: status === 'rejected', needs_manual_review: status === 'needs_manual_review' }, eligible: accepted };
}

function randomAffixId() {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `af_${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}
function validateAffixesCheckPayload(input) {
  const interfaceLanguage = normalizeInterfaceLanguage(input?.interfaceLanguage);
  const form = normalizeString(input?.form);
  const meaningInput = normalizeString(input?.meaningInput);
  const morphemeType = normalizeString(input?.morphemeType, 'suffix');
  if (!form) throw Object.assign(Error('form is required'), { status: 400 });
  if (!meaningInput) throw Object.assign(Error('meaningInput is required'), { status: 400 });
  if (!['suffix', 'prefix'].includes(morphemeType)) throw Object.assign(Error('Invalid morphemeType'), { status: 400 });
  const comment = normalizeString(input?.comment);
  return { form, meaningInput, morphemeType, comment, interfaceLanguage };
}
function normalizeAffixesCheckCard(generated, input) {
  const card = generated && typeof generated === 'object' ? generated : {};
  const procedure = AFFIX_PROCEDURES.has(card.procedure) ? card.procedure : 'alter_affix';
  const criteria = AFFIX_PROCEDURE_CRITERIA[procedure];
  const meaningFallback = input.meaningInput;
  const normalized = {
    id: /^af_[0-9A-Za-z_-]+$/.test(normalizeString(card.id)) ? normalizeString(card.id) : randomAffixId(),
    status: 'draft',
    form: normalizeString(card.form, input.form),
    morphemeType: ['suffix', 'prefix'].includes(card.morphemeType) ? card.morphemeType : input.morphemeType,
    procedure,
    version: '1.0',
    card_type: 'affix_card',
    vord_type: 'af',
    created_at: normalizeString(card.created_at, new Date().toISOString()),
    meaning: normalizeLanguageMap(card.meaning, CONTROL_LANGUAGES, meaningFallback),
    criteria: card.criteria && typeof card.criteria === 'object' ? card.criteria : { controlLanguagePresence: { required: criteria.required, actual: criteria.actual } },
    evidence: card.evidence && typeof card.evidence === 'object' ? card.evidence : { controlLanguages: normalizeLanguageArrayMap(card.forms?.controlLanguages, CONTROL_LANGUAGES), immediateRecognition: false, stableInternationalPresence: false },
    forms: {
      controlLanguages: normalizeLanguageArrayMap(card.forms?.controlLanguages || card.evidence?.controlLanguages, CONTROL_LANGUAGES),
      auxiliaryLanguages: normalizeLanguageArrayMap(card.forms?.auxiliaryLanguages, AUXILIARY_LANGUAGES)
    },
    risks: normalizeArray(card.risks),
    recommendedForm: normalizeString(card.recommendedForm, normalizeString(card.form, input.form))
  };
  const evaluation = evaluateAffixDecision(normalized);
  if (evaluation.calculation) {
    normalized.evidence.frequencyWords = evaluation.calculation.normalizedFrequencyWords;
    normalized.calculation = evaluation.calculation;
  }
  normalized.criteria = { ...normalized.criteria, ...evaluation.criteria };
  normalized.decision = evaluation.decision;
  normalized.eligible = evaluation.eligible;
  return normalized;
}
function buildAffixesCheckPrompt(input) { return `You check an Interal affix and create exactly one strict JSON card.

Methodology for affixes:
- international_affix: present in many widespread borrowings and/or stable common Indo-European correspondences; at least 5 of 6 control languages; form/pronunciation may differ if immediate recognition remains possible.
- associativ_affix: present in at least 3 control languages and 2 language groups; borrowings are fewer; recognition is associative and analogical, not immediate; provide 1–5 frequent borrowing candidates per represented language. IPM values are provisional and will be deterministically verified against local frequency lists.
- alter_affix: needed when affixes for the required meaning differ significantly across control languages, or when a more widespread affix has several morphological forms because of derivation and/or several meanings.
- Standardization: consider both ordinary forms in individual words and forms in derived words; do not automatically transfer source-language endings; choose the more widespread, prototypical, or derivationally convenient form.
- If the optional input comment is present, use it only as analyst context for interpreting the candidate affix; do not copy the comment into the output JSON and do not add explanatory fields.

Input:
${JSON.stringify(input, null, 2)}

Select procedure as one of: international_affix, associativ_affix, alter_affix.
Return checkable data, not a declaration of acceptance. Include evidence, risks, recommendedForm and separate boolean criteria. Return only valid JSON. Do not add markdown. Schema:
{"id":"af_string","status":"draft","form":"string","morphemeType":"suffix or prefix","procedure":"international_affix or associativ_affix or alter_affix","version":"1.0","card_type":"affix_card","vord_type":"af","created_at":"ISO datetime string","meaning":{"en":"string","de":"string","fr":"string","es":"string","it":"string","ru":"string"},"criteria":{"necessityConfirmed":true,"noSeriousConflicts":true,"shortestSuitableAlternative":true,"partialInternationalPresence":true,"derivationallyViable":true,"meaningClear":true,"noBetterStandardProcedure":true,"recognition_type":"associative"},"evidence":{"controlLanguages":{"en":[],"de":[],"fr":[],"es":[],"it":[],"ru":[]},"immediateRecognition":true,"stableInternationalPresence":true,"frequencyWords":{"en":[{"word":"string","ipm":3}]}},"forms":{"controlLanguages":{"en":[],"de":[],"fr":[],"es":[],"it":[],"ru":[]},"auxiliaryLanguages":{"pl":[],"sv":[],"ca":[],"oc":[],"ro":[]}}}`; }

function normalizeAffixesAlterCard(generated, input) {
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
function buildAffixesAlterPrompt(input) { return `Ты создаёшь JSON-карточку иного аффикса для Interal.

Методология:
Иные аффиксы нужны тогда, когда для необходимого значения аффиксы в контрольных языках значительно различаются как единственный вариант, или более распространённый аффикс имеет несколько морфологических форм из-за деривации и/или несколько значений как альтернативный вариант.

Критерии: действительная необходимость в единственном или альтернативном варианте, нет конфликтов, наибольшая краткость среди альтернатив, частичная международная представленность, в том числе среди вспомогательных языков, возможность деривации, наиболее ясное значение среди альтернатив.

Стандартизация: учитывать не только обычную форму аффикса в отдельных словах, но и форму в производных словах. Окончания языков-источников не переносятся автоматически; выбирается более распространённая, прототипная или удобная для деривации форма.

Важное правило: для alter_affix поле forms показывает альтернативные аффиксальные средства для той же функции в языках, а не обязательно варианты самой формы. Например для -ilo forms.controlLanguages может содержать en:["-er","-or"], de:["-er"], fr:["-eur","-oir"], es:["-dor"], it:["-tore"], ru:["-ло","-тель"].

Верни только JSON-объект строго этой структуры, без markdown и без дополнительных полей: {"id":"string","status":"draft","form":"string","morphemeType":"suffix","procedure":"alter_affix","version":"1.0","card_type":"affix_card","vord_type":"af","created_at":"ISO datetime string","meaning":{"en":"string","de":"string","fr":"string","es":"string","it":"string","ru":"string"},"criteria":{"controlLanguagePresence":{"required":"partial_presence_or_alternative_need","actual":"weak_or_partial"}},"forms":{"controlLanguages":{"en":["string"],"de":["string"],"fr":["string"],"es":["string"],"it":["string"],"ru":["string"]},"auxiliaryLanguages":{"pl":["string"],"sv":["string"],"ca":["string"],"oc":["string"],"ro":["string"]}}}

Входная карточка:
${JSON.stringify(input, null, 2)}`; }


function makeError(message, status = 400, errorCode = 'QWEN_INVALID_REQUEST') { return Object.assign(Error(message), { status, errorCode }); }
function normalizeLanguageCode(value) { return String(value || '').trim().toLowerCase(); }
function normalizeCacheText(value) { return String(value || '').trim().toLocaleLowerCase('ru'); }
function targetTranslationCacheKey(targetMeaning, sourceLanguage) { return `${sourceLanguage}:${normalizeCacheText(targetMeaning)}`; }
function validateTargetTranslationPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw makeError('Invalid body', 400, 'TARGET_TRANSLATION_INVALID_INPUT');
  const targetMeaning = normalizeString(payload.targetMeaning);
  const sourceLanguage = normalizeLanguageCode(payload.sourceLanguage);
  const targetLanguages = Array.isArray(payload.targetLanguages) ? [...new Set(payload.targetLanguages.map(normalizeLanguageCode))] : [];
  if (!targetMeaning) throw makeError('targetMeaning is required', 400, 'TARGET_TRANSLATION_INVALID_INPUT');
  if (!TARGET_TRANSLATION_CODES.has(sourceLanguage)) throw makeError('Unsupported sourceLanguage', 400, 'TARGET_TRANSLATION_UNSUPPORTED_LANGUAGE');
  if (!targetLanguages.length) throw makeError('targetLanguages must be a non-empty array', 400, 'TARGET_TRANSLATION_INVALID_INPUT');
  if (targetLanguages.some((code) => !TARGET_TRANSLATION_CODES.has(code))) throw makeError('Unsupported targetLanguages', 400, 'TARGET_TRANSLATION_UNSUPPORTED_LANGUAGE');
  return { targetMeaning, sourceLanguage, targetLanguages };
}
function validateTargetTranslationResult(result, input) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw makeError('AI returned non-object JSON', 502, 'TARGET_TRANSLATION_INVALID_JSON');
  const translations = result.translations;
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) throw makeError('AI returned missing translations object', 502, 'TARGET_TRANSLATION_INVALID_JSON');
  const normalized = {};
  for (const language of input.targetLanguages) {
    const value = translations[language];
    if (typeof value !== 'string') throw makeError(`AI returned missing translation for ${language}`, 502, 'TARGET_TRANSLATION_INVALID_JSON');
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80 || /[\r\n]/.test(trimmed)) throw makeError(`AI returned invalid translation for ${language}`, 502, 'TARGET_TRANSLATION_INVALID_VALUE');
    normalized[language] = trimmed;
  }
  return { translations: normalized };
}
function buildTargetTranslationMessages(input) {
  return [
    { role: 'system', content: 'You are a precise translator. Return only valid JSON. Translate only the target meaning. Do not generate candidate words. Do not explain anything.' },
    { role: 'user', content: `Translate one target meaning from ${input.sourceLanguage} into these language codes: ${input.targetLanguages.join(', ')}. Values must be short strings only, without explanations, alternatives, comments, markdown, or candidate generation. Return exactly this JSON shape: {"translations":{${input.targetLanguages.map((code) => `"${code}":""`).join(',')}}}. Input: ${JSON.stringify(input)}` }
  ];
}
async function runTargetTranslation(payload) {
  const input = validateTargetTranslationPayload(payload);
  const key = targetTranslationCacheKey(input.targetMeaning, input.sourceLanguage);
  const cached = TARGET_TRANSLATION_CACHE.get(key) || OFFLINE_TARGET_TRANSLATIONS[key];
  if (cached && input.targetLanguages.every((language) => typeof cached[language] === 'string' && cached[language].trim())) {
    const translations = Object.fromEntries(input.targetLanguages.map((language) => [language, cached[language].trim()]));
    TARGET_TRANSLATION_CACHE.set(key, { ...(TARGET_TRANSLATION_CACHE.get(key) || {}), ...translations });
    return { ok: true, translations, cached: true };
  }
  const result = await callYandex(buildTargetTranslationMessages(input), true);
  const parsed = validateTargetTranslationResult(extract(result.content), input);
  TARGET_TRANSLATION_CACHE.set(key, { ...(TARGET_TRANSLATION_CACHE.get(key) || {}), ...parsed.translations });
  return { ok: true, ...parsed, cached: false, model: result.model };
}

function numOrNull(value){ const n=Number(value); return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):null; }
function normalizeAssociationResult(r,input,model){ return { word: normalizeString(r?.word,input.word), target_meaning: normalizeString(r?.target_meaning,input.targetMeaning), directness: numOrNull(r?.directness ?? r?.Di), field_relatedness: numOrNull(r?.field_relatedness ?? r?.Pr), domain_shift: numOrNull(r?.domain_shift ?? r?.Sh), responseLanguage: normalizeInterfaceLanguage(r?.responseLanguage||input.interfaceLanguage), short_explanation: normalizeString(r?.short_explanation||r?.explanation), model }; }
function validateAssociationPayload(payload, interfaceLanguage){ const source=payload&&typeof payload==='object'?payload:{}; const input={ interfaceLanguage, language: normalizeString(source.language), targetMeaning: normalizeString(source.targetMeaning), word: normalizeString(source.word), swow: source.swow || {}, review: source.review === true, primary: source.primary || null }; if(!input.language) throw Object.assign(Error('language is required'),{status:400}); if(!input.targetMeaning) throw Object.assign(Error('targetMeaning is required'),{status:400}); if(!input.word) throw Object.assign(Error('word is required'),{status:400}); return input; }
function associationModelForRequest(input){ return input.review === true ? QWEN_ASSOCIATIVE_REVIEW_MODEL : QWEN_ASSOCIATIVE_PRIMARY_MODEL; }
function buildAssociationPrompt(input){ return `Evaluate semantic association between a target meaning and an associative word for Interal. Do not generate candidate words. Return only valid JSON. Use 0-100 integer scores.
Di/directness = how directly the word points to target meaning.
Pr/field_relatedness = how strongly the word belongs to same semantic field.
Sh/domain_shift = how strongly modern meaning belongs to a different competing domain.
Review mode: ${input.review===true}. If review mode, independently review primary scores.
Input: ${JSON.stringify(input,null,2)}
Return {"word":"","target_meaning":"","directness":0,"field_relatedness":0,"domain_shift":0,"responseLanguage":"${input.interfaceLanguage}","short_explanation":""}`; }
async function runAssociationScore(payload, interfaceLanguage){ const input=validateAssociationPayload(payload, interfaceLanguage); const modelName=associationModelForRequest(input); const result=await callYandex([{role:'system',content:'You are a lexical association evaluator. Return only valid JSON.'},{role:'user',content:buildAssociationPrompt(input)}], true, modelName); return { ok:true, analysis: normalizeAssociationResult(extract(result.content), input, result.model), model: result.model, modelRole: input.review === true ? 'review' : 'primary' }; }


const TASKS = {
  affixes_check: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8', buildPrompt: buildAffixesCheckPrompt, normalize: normalizeAffixesCheckCard },
  affixes_alter_card: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8', buildPrompt: buildAffixesAlterPrompt, normalize: normalizeAffixesAlterCard },
  altervordes: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8' },
  community_word_check: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8' },
  grammar_short_word_check: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8' },
  associative_word_score: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8' },
  associative_target_translation: { modelEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex', folderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8' }
};

async function runAltervordes(payload, interfaceLanguage) {
  if (!process.env[TASKS.altervordes.modelEnv]) throw Object.assign(Error(`Missing Yandex API key: ${TASKS.altervordes.modelEnv}`), { status: 500 });
  if (!process.env[TASKS.altervordes.folderEnv]) throw Object.assign(Error(`Missing Yandex folder id: ${TASKS.altervordes.folderEnv}`), { status: 500 });
  const input = validateAltervordes({ ...payload, interfaceLanguage });
  const messages = [
    { role: 'system', content: buildAltervordesSystemPromptV2(input.interfaceLanguage, DERIVATION_CONTEXT) },
    { role: 'user', content: buildAltervordesUserPromptV2(input) }
  ];
  let result;
  try { result = await callYandex(messages, true); }
  catch (error) { if (error.status && error.status >= 400 && error.status < 500) result = await callYandex(messages, false); else throw error; }
  return { ok: true, analysis: normalizeAltervordesResult(extract(result.content), input, result.model) };
}
async function runAffixesCheck(payload, interfaceLanguage) {
  const input = validateAffixesCheckPayload({ ...payload, interfaceLanguage });
  const messages = [
    {
      role: 'system',
      content: 'You return only valid JSON. Do not add explanations.'
    },
    {
      role: 'user',
      content: buildAffixesCheckPrompt(input)
    }
  ];

  let result;
  try {
    result = await callYandex(messages, true);
  } catch (error) {
    if (error.status && error.status >= 400 && error.status < 500) {
      result = await callYandex(messages, false);
    } else {
      throw error;
    }
  }

  const generated = extract(result.content);
  const card = normalizeAffixesCheckCard(generated, input);
  return { ok: true, analysis: { eligible: card.eligible === true, decision: card.decision, recommendedForm: card.recommendedForm || card.form, form: card.form, morphemeType: card.morphemeType, procedure: card.procedure, meaning: card.meaning, criteria: card.criteria, calculation: card.calculation, evidence: card.evidence, forms: card.forms, shortConclusion: card.eligible ? (interfaceLanguage === 'en' ? 'The affix can be saved as a candidate card.' : 'Аффикс можно сохранить как карточку-кандидат.') : (interfaceLanguage === 'en' ? 'The affix did not pass deterministic criteria or needs manual review.' : 'Аффикс не прошёл детерминированные критерии или требует ручной проверки.'), risks: card.risks || [] }, card };
}


function buildCommunityWordPrompt(input, interfaceLanguage) { return `Consultatively evaluate a community word. Return strict JSON only. Interface language: ${interfaceLanguage}. Input: ${JSON.stringify(input,null,2)}. Return {"responseLanguage":"${interfaceLanguage}","answers":[{"criterion":1,"answer":"yes|partially|no","explanation":""},{"criterion":2,"answer":"yes|partially|no","explanation":""},{"criterion":3,"answer":"yes|partially|no","explanation":""}],"formRecommendation":"keep_unchanged|light_adaptation|not_applicable","decision":"accepted|rejected","confidence":0.8}.`; }
function buildGrammarShortWordPrompt(input, interfaceLanguage) { return `Consultatively evaluate a grammar/short word. Return strict JSON only. Interface language: ${interfaceLanguage}. Input: ${JSON.stringify(input,null,2)}. Return {"responseLanguage":"${interfaceLanguage}","criteria":{"brevity":{"passed":true,"explanation":""},"pronounceability":{"passed":true,"explanation":""},"recognizability":{"passed":false,"explanation":""},"no_conflict":{"passed":true,"explanation":""}},"confidence":0.8}.`; }
async function runSimpleConsultativeTask(payload, interfaceLanguage, kind) {
  const prompt = kind === 'community_word_check' ? buildCommunityWordPrompt(payload, interfaceLanguage) : buildGrammarShortWordPrompt(payload, interfaceLanguage);
  const result = await callYandex([{ role: 'system', content: 'Return only valid JSON. The final decision is advisory; client code applies deterministic criteria.' }, { role: 'user', content: prompt }], true);
  return { ok: true, analysis: extract(result.content), model: result.model };
}

async function runAffixesAlterCard(payload) {
  if (payload?.procedure !== 'alter_affix') throw Object.assign(Error('This task is only for alter_affix cards.'), { status: 400 });
  const messages = [
    { role: 'system', content: 'You return only valid JSON. Do not add explanations.' },
    { role: 'user', content: buildAffixesAlterPrompt(payload) }
  ];
  let result;
  try { result = await callYandex(messages, true); }
  catch (error) { if (error.status && error.status >= 400 && error.status < 500) result = await callYandex(messages, false); else throw error; }
  const generated = extract(result.content);
  return { card: normalizeAffixesAlterCard(generated, payload) };
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const request = await body(req);
    const task = String(request?.task || '').trim();
    const payload = request?.payload && typeof request.payload === 'object' ? request.payload : {};
    const interfaceLanguage = normalizeInterfaceLanguage(request?.interfaceLanguage || payload.interfaceLanguage);
    if (!TASKS[task]) return send(res, 400, { ok: false, error: 'Unknown Qwen task' });
    if (task === 'affixes_check') return send(res, 200, await runAffixesCheck(payload, interfaceLanguage));
    if (task === 'affixes_alter_card') return send(res, 200, await runAffixesAlterCard(payload));
    if (task === 'altervordes') return send(res, 200, await runAltervordes(payload, interfaceLanguage));
    if (task === 'associative_word_score') return send(res, 200, await runAssociationScore(payload, interfaceLanguage));
    if (task === 'associative_target_translation') return send(res, 200, await runTargetTranslation(payload));
    if (task === 'community_word_check' || task === 'grammar_short_word_check') return send(res, 200, await runSimpleConsultativeTask(payload, interfaceLanguage, task));
    return send(res, 400, { ok: false, error: 'Unsupported Qwen task' });
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return send(res, status, { ok: false, error: status < 500 ? e.message : 'qwen_analyze_failed', errorCode: e.errorCode || (status < 500 ? 'QWEN_INVALID_REQUEST' : 'QWEN_ANALYZE_FAILED'), details: String(e.details || e.message || e).slice(0, 1200) });
  }
}

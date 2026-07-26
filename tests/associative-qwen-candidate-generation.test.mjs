import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compareFinalModelCandidates,
  normalizeQwenCandidateSuggestions,
  normalizeQwenCandidateValidation,
  applyQwenCandidateValidation,
  buildQwenCandidateAuditPayload,
  buildFinalQwenValidationPayload,
  refineCandidatesWithQwenAudit,
  validateFinalCandidatesWithQwen,
  QWEN_RUNTIME_CONFIG,
  selectBestFinalModels
} from '../associativvordes/js/qwen-client.js';
import { lexicalModelDescriptor } from '../associativvordes/js/candidate-model-family.js';

const validChecks = Object.freeze({
  language_match: true,
  dictionary_lemma: true,
  root_relation: true,
  semantic_relevance: true,
  distinct_model: true
});
const keepDecision = (word, canonical_lexeme = word, extra = {}) => ({
  word,
  decision: 'keep',
  checks: { ...validChecks },
  canonical_lexeme,
  ...extra
});
const duplicateDecision = (word, same_model_as, canonical_lexeme, extra = {}) => ({
  word,
  decision: 'remove_duplicate',
  checks: { ...validChecks, distinct_model: false },
  canonical_lexeme,
  same_model_as,
  ...extra
});

assert.equal(QWEN_RUNTIME_CONFIG.enableCandidateGeneration, true, 'top-five model refinement is enabled');
assert.equal(QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage, 2, 'candidate generation is strictly bounded per language');
assert.equal(QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, 5, 'the initial stage analyzes five frequency-selected models');
assert.ok(QWEN_RUNTIME_CONFIG.candidateRequestTimeoutMs > QWEN_RUNTIME_CONFIG.requestTimeoutMs, 'the multilingual candidate audit has a longer timeout than one word score');

const normalized = normalizeQwenCandidateSuggestions({
  candidates: {
    ru: [
      { word: 'альтруизм', root_variant: 'альтру' },
      { word: ' альтруист ', rootVariant: 'альтру' },
      { word: 'АЛЬТРУИЗМ', root_variant: 'альтру' },
      { word: 'строка\nс переносом', root_variant: 'строка' }
    ],
    en: [{ word: 'altruism', root_variant: 'altru' }, { word: 'altruist', root_variant: 'altru' }, { word: 'alterity', root_variant: 'alter' }]
  }
});

assert.deepEqual(normalized.ru, [
  { word: 'альтруизм', root_variant: 'альтру' },
  { word: 'альтруист', root_variant: 'альтру' }
], 'Russian suggestions preserve native spelling, normalize fields, deduplicate, and obey the limit');
assert.deepEqual(normalized.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
], 'English suggestions obey the same deterministic limit');
assert.deepEqual(normalized.de, [], 'missing language arrays normalize to empty lists');

const validationTopModels = {
  en: [
    { word: 'alternate', model_key: 'en|alternate', frequency_score: 80 },
    { word: 'alternately', model_key: 'en|alternately', frequency_score: 30 }
  ],
  fr: [
    { word: 'alternative', model_key: 'fr|alternative', frequency_score: 85 },
    { word: 'alternatif', model_key: 'fr|alternatif', frequency_score: 70 }
  ],
  ru: [
    { word: 'альтернативный', model_key: 'ru|alternativnyj', frequency_score: 90 },
    { word: 'альтернативка', model_key: 'ru|alternativka', frequency_score: 20 },
    { word: 'альтер-эго', model_key: 'ru|alter-ego', frequency_score: 60 },
    { word: 'альтер', model_key: 'ru|alter', frequency_score: 50 }
  ]
};
const normalizedValidation = normalizeQwenCandidateValidation({
  candidateValidation: {
    en: [
      keepDecision('alternate', 'alternate', { reason: 'frequency representative' }),
      duplicateDecision('alternately', 'alternate', 'alternate', { reason: 'adverbial form' })
    ],
    fr: [
      keepDecision('alternative', 'alternatif'),
      duplicateDecision('alternatif', 'alternative', 'alternatif')
    ],
    ru: [
      keepDecision('альтернативный', 'альтернатива'),
      duplicateDecision('альтернативка', 'альтернативный', 'альтернатива'),
      keepDecision('альтер-эго', 'альтер-эго'),
      { word: 'альтер', decision: 'remove_irrelevant', checks: { ...validChecks, dictionary_lemma: false, semantic_relevance: false }, canonical_lexeme: 'альтер', reason: 'tokenization artefact from альтер эго' }
    ]
  }
}, validationTopModels, ['en', 'fr', 'ru']);
assert.ok(Array.isArray(normalizedValidation.en), 'a complete validation is accepted');
assert.equal(normalizedValidation.en[1].same_model_as, 'alternate', 'a duplicate must point to the retained representative');

const validationPools = {
  en: [...validationTopModels.en, { word: 'alteration', model_key: 'en|alteration', frequency_score: 25 }],
  fr: [...validationTopModels.fr, { word: 'altération', model_key: 'fr|alteration', frequency_score: 15 }],
  ru: [...validationTopModels.ru, { word: 'альтерация', model_key: 'ru|alteracija', frequency_score: 10 }]
};
const appliedValidation = applyQwenCandidateValidation(validationPools, normalizedValidation, validationTopModels, ['en', 'fr', 'ru']);
assert.deepEqual(selectBestFinalModels(appliedValidation.candidatesByLanguage.en, 5).map(item => item.word), ['alternate'], 'duplicate removal does not backfill an unreviewed sixth model');
assert.deepEqual(selectBestFinalModels(appliedValidation.candidatesByLanguage.fr, 5).map(item => item.word), ['alternative'], 'French part-of-speech variants count as one Qwen-validated model');
assert.deepEqual(selectBestFinalModels(appliedValidation.candidatesByLanguage.ru, 5).map(item => item.word), ['альтернативный', 'альтер-эго'], 'Russian duplicate and tokenization artefact are excluded without forcing five results');
assert.deepEqual(appliedValidation.diagnostics, {
  validatedLanguageCount: 3,
  validationIncompleteLanguageCount: 0,
  validationKeptCount: 4,
  validationRemovedDuplicateCount: 3,
  validationRemovedIrrelevantCount: 1,
  validationRemovedWrongLanguageCount: 0,
  validationCanonicalDuplicateCount: 0,
  validationFailClosedCount: 0,
  validationIncompleteLanguages: [],
  validationFailClosedLanguages: []
});

const incompleteValidation = normalizeQwenCandidateValidation({
  candidateValidation: { en: [keepDecision('alternate')] }
}, validationTopModels, ['en']);
assert.equal(incompleteValidation.en, null, 'an incomplete Qwen verdict cannot silently remove an unchecked candidate');
const incompleteApplied = applyQwenCandidateValidation(validationPools, incompleteValidation, validationTopModels, ['en']);
assert.deepEqual(selectBestFinalModels(incompleteApplied.candidatesByLanguage.en, 5).map(item => item.word), ['alternate', 'alternately', 'alteration'], 'incomplete validation preserves the deterministic fallback set');
const strictIncompleteApplied = applyQwenCandidateValidation(
  { en: validationTopModels.en.map(item => ({ ...item, selected: true })) },
  incompleteValidation,
  validationTopModels,
  ['en'],
  { failClosed: true, validationField: 'qwen_final_validation' }
);
assert.deepEqual(selectBestFinalModels(strictIncompleteApplied.candidatesByLanguage.en, 5), [], 'the final validation fails closed instead of filling a five-model quota');
assert.ok(strictIncompleteApplied.candidatesByLanguage.en.every(item => item.selected === false), 'an incomplete final verdict cannot leave a provisional model selected');

const wrongLanguageValidation = normalizeQwenCandidateValidation({
  candidateValidation: {
    fr: [
      keepDecision('alternative', 'alternatif'),
      {
        word: 'alternatif',
        decision: 'keep',
        checks: { ...validChecks, language_match: false },
        canonical_lexeme: 'alternate',
        reason: 'English corpus token'
      }
    ]
  }
}, validationTopModels, ['fr']);
assert.equal(wrongLanguageValidation.fr[1].decision, 'remove_wrong_language', 'a failed language check cannot be overridden by a keep label');

const semanticOnlyRejection = normalizeQwenCandidateValidation({
  candidateValidation: {
    en: [{
      word: 'alternate',
      decision: 'remove_irrelevant',
      checks: { ...validChecks, semantic_relevance: false },
      reason: 'second semantic opinion'
    }, keepDecision('alternately', 'alternately')]
  }
}, validationTopModels, ['en']);
assert.equal(semanticOnlyRejection.en[0].decision, 'keep', 'the structural audit cannot erase an independently scored word solely on a second semantic opinion');
assert.equal(semanticOnlyRejection.en[0].canonical_lexeme, 'alternate', 'a kept word safely supplies its own canonical family when Qwen omits one');

const canonicalCollision = normalizeQwenCandidateValidation({
  candidateValidation: {
    en: [
      keepDecision('alternate', 'alternate'),
      keepDecision('alternately', 'alternate')
    ]
  }
}, validationTopModels, ['en']);
const canonicalApplied = applyQwenCandidateValidation(
  { en: validationTopModels.en.map(item => ({ ...item, selected: true })) },
  canonicalCollision,
  validationTopModels,
  ['en'],
  { failClosed: true, validationField: 'qwen_final_validation' }
);
assert.deepEqual(selectBestFinalModels(canonicalApplied.candidatesByLanguage.en, 5).map(item => item.word), ['alternate'], 'equal canonical lexemes are deterministically collapsed even when Qwen labels both keep');
assert.equal(canonicalApplied.diagnostics.validationCanonicalDuplicateCount, 1);

const lowerFrequencyRepresentative = normalizeQwenCandidateValidation({
  candidateValidation: {
    en: [
      duplicateDecision('alternate', 'alternately', 'alternate'),
      keepDecision('alternately', 'alternate')
    ]
  }
}, validationTopModels, ['en']);
assert.equal(lowerFrequencyRepresentative.en, null, 'Qwen cannot replace a model representative with its lower-frequency variant');

const evaluatedModels = [
  { word: 'alternative', model_key: 'm1', frequency_score: 95, final_score: 35, rank: 1 },
  { word: 'alteration', model_key: 'm2', frequency_score: 90, final_score: 50, rank: 2 },
  { word: 'alterity', model_key: 'm3', frequency_score: 85, final_score: 45, rank: 3 },
  { word: 'alternate', model_key: 'm4', frequency_score: 80, final_score: 40, rank: 4 },
  { word: 'alterable', model_key: 'm5', frequency_score: 75, final_score: 30, rank: 5 },
  { word: 'altruism', model_key: 'm6', frequency_score: 60, final_score: 82, rank: 6 },
  { word: 'altruist', model_key: 'm7', frequency_score: 55, final_score: 78, rank: 7 }
];
const finalFive = selectBestFinalModels(evaluatedModels, 5);
assert.deepEqual(finalFive.map(item => item.word), ['alternative', 'alteration', 'alterity', 'alternate', 'alterable'], 'final five are selected by frequency even when lower-F supplemental models have higher P');
assert.ok(compareFinalModelCandidates(evaluatedModels[5], evaluatedModels[0]) > 0, 'final model comparison falls back to F when root-match evidence is equal');

const qualityFirst = selectBestFinalModels([
  { word: 'exact-derivative', model_key: 'exact', frequency_score: 20, match: { type: 'exact', distance: 0, similarity: 1 } },
  { word: 'fuzzy-lookalike', model_key: 'fuzzy', frequency_score: 99, match: { type: 'fuzzy', distance: 1, similarity: 0.8 } }
], 5);
assert.deepEqual(qualityFirst.map(item => item.word), ['exact-derivative', 'fuzzy-lookalike'], 'match quality takes precedence over frequency in the final model set');

const guaranteedRussianModels = selectBestFinalModels([
  { word: 'альтернатива', model_key: 'ru|alternative', frequency_score: 99, match: { type: 'exact' } },
  { word: 'изменение', model_key: 'ru|change', frequency_score: 90, match: { type: 'exact' } },
  { word: 'другой', model_key: 'ru|other', frequency_score: 80, match: { type: 'exact' } },
  { word: 'иначе', model_key: 'ru|otherwise', frequency_score: 70, match: { type: 'exact' } },
  { word: 'вариант', model_key: 'ru|variant', frequency_score: 60, match: { type: 'exact' } },
  { word: 'альтруизм', model_key: 'ru|altruism', frequency_score: 20, guaranteed_allomorph: true, match: { type: 'special' } },
  { word: 'альтруист', model_key: 'ru|altruist', frequency_score: 10, guaranteed_allomorph: true, match: { type: 'special' } }
], 5);
assert.deepEqual(
  guaranteedRussianModels.map(item => item.word),
  ['альтруизм', 'альтруист', 'альтернатива', 'изменение', 'другой'],
  'both curated Russian alter → альтру- models survive the five-item ceiling regardless of lower corpus frequency'
);

const sameModel = selectBestFinalModels([
  { word: 'alternative', model_key: 'same', frequency_score: 90, final_score: 30, rank: 1 },
  { word: 'alternatively', model_key: 'same', frequency_score: 60, final_score: 99, rank: 2 }
], 5);
assert.deepEqual(sameModel.map(item => item.word), ['alternative'], 'one model still uses its most frequent representative even when another form has a higher P');


const payloadEvidence = buildQwenCandidateAuditPayload({ en: evaluatedModels }, ['en'], 6);
assert.deepEqual(payloadEvidence.currentTopModels.en.map(item => item.word), ['alternative', 'alteration', 'alterity', 'alternate', 'alterable'], 'currentTopModels contains only the frequency-selected five');
assert.deepEqual(payloadEvidence.knownCandidates.en.map(item => item.word), ['alternative', 'alteration', 'alterity', 'alternate', 'alterable', 'altruism'], 'knownCandidates includes lower-ranked local candidates up to a bounded word limit');
assert.deepEqual(payloadEvidence.knownModelKeys.en, ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'], 'knownModelKeys contains every local model key, not just the top five');

function makeLoader(entriesByWord, { failWords = new Set() } = {}) {
  return {
    calls: [],
    async loadCandidateEntries(language, word) {
      this.calls.push({ language, word });
      if (failWords.has(word)) throw new Error('invalid fixture');
      return entriesByWord[word] ? [entriesByWord[word]] : [];
    }
  };
}

const previousFetchForRefine = globalThis.fetch;
globalThis.document ??= { documentElement: { lang: 'en' } };
const previousGeneratedLimit = QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage;
QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage = 10;
globalThis.fetch = async (_url, options) => ({
  ok: true,
  json: async () => ({
    ok: true,
    candidateValidation: { en: ['alternative', 'alteration', 'alterity', 'alternate', 'alterable'].map(word => keepDecision(word)) },
    guaranteedCandidates: { en: [{ word: 'altruism', root_variant: 'altru' }] },
    candidates: { en: [
      { word: 'alternative', root_variant: 'alter' },
      { word: 'altruism', root_variant: 'altru' },
      { word: 'alterator', root_variant: 'alter' },
      { word: 'novelty', root_variant: 'nov' },
      { word: 'novelty', root_variant: 'nov' },
      { word: 'missing', root_variant: 'miss' },
      { word: 'broken', root_variant: 'brok' }
    ] }
  })
});
const duplicateAlteratorKey = lexicalModelDescriptor({ word: 'alterator', search_form: 'alterator', match: { type: 'special', fragment: 'alter', index: 0 } }, 'nov', 'en').key;
const auditBase = evaluatedModels.map(item => ({ ...item, model_key: item.word === 'alteration' ? duplicateAlteratorKey : item.model_key, model_family_key: item.word === 'alteration' ? duplicateAlteratorKey : item.model_key, search_form: item.word.toLowerCase(), sources: [{ id: 'base' }], match: { fragment: 'alter' } }));
const loader = makeLoader({
  alterator: { word: 'alterator', normalized: 'alterator', search_form: 'alterator', frequency_score: 99, rank: 1, sources: [{ id: 'idx' }] },
  novelty: { word: 'novelty', normalized: 'novelty', search_form: 'novelty', frequency_score: 88, rank: 2, sources: [{ id: 'idx' }] }
}, { failWords: new Set(['broken']) });
const refinedAudit = await refineCandidatesWithQwenAudit({ root: 'nov', targetMeaning: 'new', candidatesByLanguage: { en: auditBase }, loader, languages: ['en'] });
assert.equal(refinedAudit.candidatesByLanguage.en.filter(item => item.word === 'alternative').length, 1, 'word already in current top five is discarded');
assert.equal(refinedAudit.candidatesByLanguage.en.filter(item => item.word === 'altruism').length, 1, 'word below top five but in local pool is not added again');
assert.equal(refinedAudit.candidatesByLanguage.en.find(item => item.word === 'altruism').guaranteed_allomorph, true, 'an existing lower-ranked curated allomorph keeps guaranteed provenance');
assert.equal(refinedAudit.candidatesByLanguage.en.some(item => item.word === 'alterator'), false, 'different word with an existing model_key is not a new model');
assert.equal(refinedAudit.candidatesByLanguage.en.some(item => item.word === 'novelty'), true, 'new word with a new model passes local verification');
assert.equal(loader.calls.some(call => call.word === 'alternative'), false, 'duplicate suggestion does not start semantic or local verification');
assert.deepEqual(refinedAudit.diagnostics, { suggestedCount: 7, duplicateWordCount: 3, duplicateModelCount: 1, locallyMissingCount: 1, verifiedNewModelCount: 1, rejectedInvalidCount: 1, auditRetryCount: 0, validatedLanguageCount: 1, validationIncompleteLanguageCount: 0, validationKeptCount: 5, validationRemovedDuplicateCount: 0, validationRemovedIrrelevantCount: 0, validationRemovedWrongLanguageCount: 0, validationCanonicalDuplicateCount: 0, validationFailClosedCount: 0, validationIncompleteLanguages: [], validationFailClosedLanguages: [], status: 'completed', model: null, usedGuaranteedFallback: false, backendErrorCode: null, backendErrorDetails: null }, 'diagnostics counts duplicate, missing, invalid, verified, validation, and backend audit state');
globalThis.fetch = previousFetchForRefine;
QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage = previousGeneratedLimit;

globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    ok: true,
    candidateValidation: { en: ['alternative', 'alteration', 'alterity', 'alternate', 'alterable'].map(word => keepDecision(word)) },
    candidates: { en: [] }
  })
});
const emptyAudit = await refineCandidatesWithQwenAudit({ root: 'nov', targetMeaning: 'new', candidatesByLanguage: { en: auditBase }, loader: makeLoader({}), languages: ['en'] });
assert.deepEqual(emptyAudit.diagnostics, { suggestedCount: 0, duplicateWordCount: 0, duplicateModelCount: 0, locallyMissingCount: 0, verifiedNewModelCount: 0, rejectedInvalidCount: 0, auditRetryCount: 0, validatedLanguageCount: 1, validationIncompleteLanguageCount: 0, validationKeptCount: 5, validationRemovedDuplicateCount: 0, validationRemovedIrrelevantCount: 0, validationRemovedWrongLanguageCount: 0, validationCanonicalDuplicateCount: 0, validationFailClosedCount: 0, validationIncompleteLanguages: [], validationFailClosedLanguages: [], status: 'completed', model: null, usedGuaranteedFallback: false, backendErrorCode: null, backendErrorDetails: null }, 'empty Qwen suggestion response is a normal completed validation');
globalThis.fetch = previousFetchForRefine;

const finalAuditInput = {
  en: [
    { ...validationTopModels.en[0], selected: true, final_score: 42, match: { type: 'exact' } },
    { ...validationTopModels.en[1], selected: true, final_score: 38 }
  ]
};
finalAuditInput.ru = [
  { word: 'альтруизм', model_key: 'ru|altruism', frequency_score: 20, final_score: 51, selected: true, guaranteed_allomorph: true, match: { type: 'special' } },
  { word: 'альтруист', model_key: 'ru|altruist', frequency_score: 10, final_score: 49, selected: true, guaranteed_allomorph: true, match: { type: 'special' } }
];
const finalValidationPayload = buildFinalQwenValidationPayload(finalAuditInput, ['en']);
assert.deepEqual(finalValidationPayload.currentTopModels.en.map(item => item.word), ['alternate', 'alternately']);
assert.deepEqual(finalValidationPayload.currentTopModels.en.map(item => item.final_score), [42, 38], 'the final audit receives measured post-analysis scores');
assert.equal(finalValidationPayload.currentTopModels.en[0].root_match_type, 'exact', 'deterministic exact-match evidence reaches the structural audit');
assert.equal(finalValidationPayload.currentTopModels.en[1].root_match_type, undefined, 'substring visibility alone is not promoted to exact evidence');
const russianFinalValidationPayload = buildFinalQwenValidationPayload(finalAuditInput, ['ru']);
assert.deepEqual(russianFinalValidationPayload.currentTopModels.ru.map(item => item.root_match_type), ['guaranteed_allomorph', 'guaranteed_allomorph'], 'curated Russian allomorph evidence reaches the structural audit');
let finalValidationRequest = null;
globalThis.fetch = async (_url, options) => {
  finalValidationRequest = JSON.parse(options.body);
  return {
    ok: true,
    json: async () => ({
      ok: true,
      candidateValidation: {
        en: [
          keepDecision('alternate', 'alternate'),
          keepDecision('alternately', 'alternate')
        ]
      },
      candidates: { en: [] },
      audit: { status: 'completed' }
    })
  };
};
const finalAudit = await validateFinalCandidatesWithQwen({
  root: 'alter',
  targetMeaning: 'other',
  candidatesByLanguage: finalAuditInput,
  languages: ['en']
});
assert.equal(finalValidationRequest.validationStage, 'final', 'the independent post-analysis audit is explicitly marked as final');
assert.deepEqual(finalAudit.candidatesByLanguage.en.filter(item => item.selected).map(item => item.word), ['alternate'], 'the post-analysis audit never backfills a removed duplicate');
assert.equal(finalAudit.diagnostics.validationCanonicalDuplicateCount, 1);

globalThis.fetch = async () => { throw new Error('final audit unavailable'); };
const finalFallback = await validateFinalCandidatesWithQwen({
  root: 'alter',
  targetMeaning: 'other',
  candidatesByLanguage: finalAuditInput,
  languages: ['en']
});
assert.deepEqual(finalFallback.candidatesByLanguage.en.filter(item => item.selected).map(item => item.word), ['alternate', 'alternately'], 'a final Qwen outage preserves the independently analyzed selection');
assert.equal(finalFallback.diagnostics.status, 'fallback');
globalThis.fetch = previousFetchForRefine;

const clientSource = await readFile('associativvordes/js/qwen-client.js', 'utf8');
const checkboxHookSource = await readFile('associativvordes/js/qwen-checkbox-hook.js', 'utf8');
const swowClientSource = await readFile('associativvordes/js/swow-client.js', 'utf8');
const endpointSource = await readFile('api/qwen-candidates.js', 'utf8');
const endpointModule = await import('../api/qwen-candidates.js');

assert.equal(typeof endpointModule.default, 'function', 'supplemental candidate API exports a loadable Vercel handler');
assert.equal(endpointModule.maxDuration, 60, 'the server allows enough time for one multilingual audit');

const previousFetch = globalThis.fetch;
const previousApiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
const previousFolderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = 'test-key';
process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = 'test-folder';
let qwenRequestCount = 0;
let sentPrompt = '';
globalThis.fetch = async (_url, options) => {
  qwenRequestCount += 1;
  const request = JSON.parse(options.body);
  sentPrompt = request.messages?.[1]?.content || '';
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            validation: {
              en: [keepDecision('alternative', 'alternative', { reason: 'valid model' })],
              de: [],
              fr: [],
              es: [],
              it: [],
              ru: [keepDecision('альтернатива', 'альтернатива', { reason: 'valid model' })]
            },
            candidates: { en: [], de: [], fr: [], es: [], it: [], ru: [] }
          })
        }
      }]
    })
  };
};

const responseHeaders = {};
let responseText = '';
const response = {
  statusCode: 0,
  setHeader(name, value) { responseHeaders[name] = value; },
  end(value = '') { responseText = String(value); }
};
const currentModels = {
  en: [{ word: 'alternative', model_key: 'en|alternative', frequency_score: 95, association_score: 20, final_score: 46 }],
  ru: [{ word: 'альтернатива', model_key: 'ru|alternativ', frequency_score: 92, association_score: 18, final_score: 44 }]
};
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: { root: 'alter', targetMeaning: 'other', interfaceLanguage: 'en', knownCandidates: { en: [{ word: 'alternative', model_key: 'en|alternative', F: 95 }], ru: [{ word: 'альтернатива', model_key: 'ru|alternativ', F: 92 }] }, knownModelKeys: { en: ['en|alternative'], ru: ['ru|alternativ'] }, currentTopModels: currentModels }
}, response);
const endpointPayload = JSON.parse(responseText);
assert.equal(response.statusCode, 200, 'supplemental endpoint accepts a scored top-five audit request');
assert.deepEqual(endpointPayload.qwenCandidates, { en: [], de: [], fr: [], es: [], it: [], ru: [] }, 'the test models an empty Qwen generation result');
assert.equal(endpointPayload.candidateValidation.en[0].decision, 'keep', 'the endpoint returns the normalized set-level validation');
assert.equal(endpointPayload.audit.status, 'completed', 'complete candidate validation completes the audit');
assert.deepEqual(endpointPayload.candidates.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.de, [
  { word: 'Altruismus', root_variant: 'altru' },
  { word: 'Altruist', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.fr, [
  { word: 'altruisme', root_variant: 'altru' },
  { word: 'altruiste', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.es, [
  { word: 'altruismo', root_variant: 'altru' },
  { word: 'altruista', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.it, [
  { word: 'altruismo', root_variant: 'altru' },
  { word: 'altruista', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.ru, [
  { word: 'альтруизм', root_variant: 'альтру' },
  { word: 'альтруист', root_variant: 'альтру' }
]);
assert.equal(qwenRequestCount, 1, 'the audit still performs one Qwen request');
assert.equal(endpointPayload.currentTopModels.en[0].final_score, 46, 'measured current-model scores reach the server prompt');
assert.match(sentPrompt, /Candidate audit payload/);
assert.match(sentPrompt, /knownCandidates/);
assert.match(sentPrompt, /knownModelKeys/);
assert.match(sentPrompt, /Current top models with measured scores/);
assert.match(sentPrompt, /Empty arrays are valid final decisions/);
assert.match(sentPrompt, /Five is a strict upper limit, not a quota/);
assert.match(sentPrompt, /"alternate" and "alternately" are one model/);
assert.match(sentPrompt, /"alternative" and "alternatif" are one model/);
assert.match(sentPrompt, /"альтернативный" and "альтернативка" are one model/);
assert.match(sentPrompt, /separated first token of "альтер эго"/);
assert.match(sentPrompt, /remove_wrong_language/);
assert.match(sentPrompt, /language_match/);
assert.match(sentPrompt, /canonical_lexeme/);
assert.equal(responseHeaders['Cache-Control'], 'no-store', 'candidate responses are not cached');

let finalEndpointResponseText = '';
const finalEndpointResponse = {
  statusCode: 0,
  setHeader() {},
  end(value = '') { finalEndpointResponseText = String(value); }
};
globalThis.fetch = async (_url, options) => {
  const request = JSON.parse(options.body);
  sentPrompt = request.messages?.[1]?.content || '';
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            validation: {
              en: [
                keepDecision('alternate', 'alternate'),
                keepDecision('alternately', 'alternate')
              ],
              de: [],
              fr: [],
              es: [],
              it: [],
              ru: []
            },
            candidates: { en: [{ word: 'altruism', root_variant: 'altru' }], de: [], fr: [], es: [], it: [], ru: [] }
          })
        }
      }]
    })
  };
};
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: {
    root: 'alter',
    targetMeaning: 'other',
    interfaceLanguage: 'en',
    validationStage: 'final',
    currentTopModels: {
      en: [
        { word: 'alternate', model_key: 'same-parser-key', frequency_score: 80, final_score: 42 },
        { word: 'alternately', model_key: 'same-parser-key', frequency_score: 30, final_score: 38 }
      ]
    }
  }
}, finalEndpointResponse);
const finalEndpointPayload = JSON.parse(finalEndpointResponseText);
assert.equal(finalEndpointResponse.statusCode, 200);
assert.equal(finalEndpointPayload.currentTopModels.en.length, 2, 'server validation preserves distinct words even when a stale parser gave them the same model key');
assert.deepEqual(finalEndpointPayload.candidates.en, [], 'the final validation stage cannot add or backfill a candidate even if Qwen proposes one');
assert.match(sentPrompt, /FINAL, after independent semantic scoring/);

let guaranteedRussianResponseText = '';
const guaranteedRussianResponse = {
  statusCode: 0,
  setHeader() {},
  end(value = '') { guaranteedRussianResponseText = String(value); }
};
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          validation: {
            en: [],
            de: [],
            fr: [],
            es: [],
            it: [],
            ru: [
              {
                word: 'альтруизм',
                decision: 'remove_wrong_language',
                checks: { ...validChecks, language_match: false, dictionary_lemma: false, root_relation: false },
                canonical_lexeme: 'альтруизм',
                reason: 'incorrect Qwen verdict'
              },
              duplicateDecision('альтруист', 'альтруизм', 'альтруизм')
            ]
          },
          candidates: { en: [], de: [], fr: [], es: [], it: [], ru: [] }
        })
      }
    }]
  })
});
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: {
    root: 'alter',
    targetMeaning: 'другой',
    interfaceLanguage: 'ru',
    validationStage: 'final',
    currentTopModels: {
      ru: [
        { word: 'альтруизм', model_key: 'ru|altruism', frequency_score: 20, final_score: 51, root_match_type: 'guaranteed_allomorph' },
        { word: 'альтруист', model_key: 'ru|altruist', frequency_score: 10, final_score: 49, root_match_type: 'guaranteed_allomorph' }
      ]
    }
  }
}, guaranteedRussianResponse);
const guaranteedRussianPayload = JSON.parse(guaranteedRussianResponseText);
assert.deepEqual(
  guaranteedRussianPayload.candidateValidation.ru.map(item => item.decision),
  ['keep', 'keep'],
  'Qwen cannot remove or collapse the two curated Russian alter → альтру- models'
);
assert.deepEqual(
  guaranteedRussianPayload.currentTopModels.ru.map(item => item.root_match_type),
  ['guaranteed_allomorph', 'guaranteed_allomorph'],
  'the backend preserves guaranteed-allomorph provenance'
);

let fallbackResponseText = '';
const fallbackResponse = {
  statusCode: 0,
  setHeader() {},
  end(value = '') { fallbackResponseText = String(value); }
};
globalThis.fetch = async () => { throw new Error('simulated Qwen outage'); };
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: { root: 'alter', targetMeaning: 'other', interfaceLanguage: 'en', existingCandidates: {}, currentModels: {} }
}, fallbackResponse);
const fallbackPayload = JSON.parse(fallbackResponseText);
assert.equal(fallbackResponse.statusCode, 200, 'known allomorph candidates survive a Qwen transport failure');
assert.deepEqual(fallbackPayload.candidates.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
]);
assert.equal(fallbackPayload.qwenAuditError.errorCode, 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE');

globalThis.fetch = previousFetch;
if (previousApiKey == null) delete process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
else process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = previousApiKey;
if (previousFolderId == null) delete process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
else process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = previousFolderId;

assert.match(clientSource, /key === 'selected' && value === true/, 'checking an unscored word activates the Qwen-analysis hook');
assert.match(clientSource, /stateCandidateHasQwen\(candidate\)/, 'the checkbox hook does not repeat an existing Qwen score');
assert.match(checkboxHookSource, /persistedCandidate[\s\S]*if \(persistedCandidate\) return result/, 'the overflow hook complements rather than duplicates the primary checkbox hook');
assert.match(checkboxHookSource, /input\.word-select\[data-lang=/, 'visible rows beyond the compact-state limit are located directly in the table');
assert.match(checkboxHookSource, /await window\.analyzeItem\(language, index\)/, 'checking an unscored row beyond the first 80 still runs analysis');
assert.match(swowClientSource, /import '\.\/qwen-checkbox-hook\.js'/, 'the checkbox guard remains in the normal runtime module graph');
assert.match(clientSource, /currentTopModels[\s\S]*knownCandidates[\s\S]*knownModelKeys[\s\S]*getQwenCandidateSuggestions/, 'the candidate audit sends top five, full known words, and known model keys');
assert.match(clientSource, /loadCandidateEntries\(language, suggestion\.word/, 'generated words must be found in the local static index');
assert.match(clientSource, /buildSearchForm\(entry\.word\) === requested/, 'local verification requires an exact normalized lemma');
assert.match(clientSource, /qwen_suggestion_verified_in_local_index/, 'only locally verified suggestions are marked for insertion');
assert.match(clientSource, /waitForCandidateAnalysis/, 'every verified supplement is scored before final selection');
assert.match(clientSource, /selectBestFinalModels[\s\S]*compareFinalModelCandidates/, 'the final five use root-match quality before measured F');
assert.match(clientSource, /rebalanceSelectedModels/, 'supplements can replace weaker members of the original five');
assert.match(clientSource, /buildQwenCandidateAuditPayload/, 'the audit builds compact known-candidate payloads from the full local pool');
assert.match(clientSource, /findIndexByWord/, 'a suggested word already present lower in the full result is located instead of discarded');
assert.match(clientSource, /findIndexByModel/, 'an existing representative of the suggested model is reused');
assert.match(clientSource, /allCandidates/, 'final rebalancing uses the full runtime candidate list rather than the truncated saved-state snapshot');
assert.match(clientSource, /duplicateWordCount/, 'duplicate suggestions are counted before local verification');

assert.match(endpointSource, /provisionally selected up to five parser-separated candidates per language/, 'server treats parser groups as provisional rather than guaranteed distinct models');
assert.match(endpointSource, /credible chance of entering the frequency-selected top five/, 'Qwen proposes plausible frequency improvements');
assert.match(endpointSource, /If the retained models are already adequate, return an empty candidate array/, 'Qwen may correctly propose nothing outside the configured high-confidence allomorphs');
assert.match(endpointSource, /ROOT_ALLOMORPH_CANDIDATES/, 'known high-confidence allomorph models are guaranteed after the audit');
assert.match(endpointSource, /mergeCandidateMaps\(guaranteedCandidates, qwenCandidates\)/, 'guaranteed allomorph candidates cannot be suppressed by an empty model response');
assert.match(endpointSource, /QWEN_CANDIDATE_AUDIT_UNAVAILABLE/, 'known allomorph candidates survive Qwen transport and parsing failures');
assert.match(endpointSource, /English altruism\/altruist and Russian альтруизм\/альтруист/, 'prompt explicitly covers alter → altru-');
assert.match(endpointSource, /remove_duplicate/, 'the Qwen audit can explicitly remove duplicate models');
assert.match(endpointSource, /remove_irrelevant/, 'the Qwen audit can explicitly remove irrelevant or tokenized candidates');
assert.match(endpointSource, /structural-integrity audit/, 'the final audit is structural rather than a second semantic scorer');
assert.match(endpointSource, /ROOT_ALLOMORPH_HINTS/, 'historical allomorph hints remain available');
assert.doesNotMatch(endpointSource, /missingLanguages[\s\S]*repair/, 'empty arrays are no longer treated as a second model request');
assert.match(endpointSource, /buildSearchForm\(word\)[\s\S]*buildSearchForm\(rootVariant\)/, 'native and transliterated root variants share one canonical search form');

console.log('Associative Qwen top-five refinement tests passed.');

import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOnce(path, search, replacement, label) {
  const source = await readFile(path, 'utf8');
  let next;
  if (search instanceof RegExp) {
    const matches = source.match(search);
    if (!matches) throw new Error(`${label}: pattern not found in ${path}`);
    next = source.replace(search, replacement);
  } else {
    const count = source.split(search).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one match in ${path}, found ${count}`);
    next = source.replace(search, replacement);
  }
  await writeFile(path, next);
}

const modelModule = `import { buildSearchForm } from './search-normalizer.js';

const OUTER_ENDINGS = Object.freeze({
  en: ['ingly', 'edly', 'ly', 'ing', 'ed', 'est', 'er', 'es', 's'],
  de: ['erweise', 'eren', 'erer', 'eres', 'erem', 'est', 'en', 'er', 'es', 'em', 'e', 'n', 's'],
  fr: ['issements', 'issement', 'ements', 'ement', 'amment', 'emment', 'ment', 'ées', 'ée', 'és', 'es', 's', 'e'],
  es: ['amientos', 'amiento', 'imientos', 'imiento', 'mente', 'ados', 'adas', 'idos', 'idas', 'ando', 'iendo', 'es', 'os', 'as', 'o', 'a'],
  it: ['amenti', 'amento', 'imenti', 'imento', 'mente', 'ando', 'endo', 'ati', 'ate', 'ito', 'ita', 'iti', 'ite', 'i', 'e', 'o', 'a'],
  ru: [
    'nymi', 'nogo', 'nego', 'nomu', 'nemu', 'nyh', 'nih', 'naja', 'njaja', 'noe', 'nee', 'nye', 'nie',
    'nyj', 'nij', 'noj', 'nuju', 'njuju', 'nym', 'nim', 'nom', 'nem', 'no',
    'jami', 'ami', 'jakh', 'jah', 'ah', 'ogo', 'ego', 'omu', 'emu', 'ymi', 'imi', 'yh', 'ih',
    'aja', 'jaja', 'oe', 'ee', 'ye', 'ie', 'uju', 'juu', 'oj', 'ej', 'yj', 'ij',
    'ov', 'ev', 'om', 'em', 'am', 'jam', 'u', 'ju', 'y', 'i', 'a', 'ja', 'e'
  ]
});

function stripOuterEnding(value, endings, minimumLength = 4) {
  for (const ending of endings) {
    if (!value.endsWith(ending) || value.length - ending.length < minimumLength) continue;
    return value.slice(0, -ending.length);
  }
  return value;
}

function writingSystem(value) {
  const text = String(value || '');
  const latin = /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(text);
  const cyrillic = /[\\u0400-\\u04ff]/u.test(text);
  const greek = /[\\u0370-\\u03ff]/u.test(text);
  const count = Number(latin) + Number(cyrillic) + Number(greek);
  if (count > 1) return 'mixed';
  if (cyrillic) return 'cyrillic';
  if (greek) return 'greek';
  if (latin) return 'latin';
  return 'other';
}

function latinDiacriticSignature(value, system) {
  if (system !== 'latin') return 'plain';
  const decomposed = String(value || '').normalize('NFD');
  const marks = [];
  let baseIndex = -1;
  for (const char of decomposed) {
    if (/\\p{M}/u.test(char)) marks.push(\`${'${baseIndex}'}:\${char.codePointAt(0).toString(16)}\`);
    else baseIndex += 1;
  }
  return marks.length ? marks.join(',') : 'plain';
}

export function canonicalLexicalStem(value, language = 'en') {
  const normalized = buildSearchForm(value).replace(/[^a-z0-9'-]+/g, '');
  if (!normalized) return '';
  const endings = OUTER_ENDINGS[language] || OUTER_ENDINGS.en;
  let stem = stripOuterEnding(normalized, endings);
  if ((language === 'es' || language === 'it') && normalized.endsWith('mente')) stem = stripOuterEnding(stem, endings);
  if (language === 'fr' && stem.endsWith('if') && stem.length > 5) stem = \`${'${stem.slice(0, -2)}'}iv\`;
  return stem;
}

export function lexicalModelDescriptor(candidate, root, language = 'en') {
  const word = String(candidate?.word || candidate?.normalized || '');
  const wordForm = buildSearchForm(candidate?.search_form || word);
  if (!wordForm) return { key: '', label: '', stem: '', prefix: '', fragment: '' };
  const rootForm = buildSearchForm(root);
  const fragment = buildSearchForm(candidate?.match?.fragment || rootForm);
  const explicitIndex = Number(candidate?.match?.index);
  const inferredIndex = fragment ? wordForm.indexOf(fragment) : (rootForm ? wordForm.indexOf(rootForm) : -1);
  const index = Number.isInteger(explicitIndex) && explicitIndex >= 0 ? explicitIndex : Math.max(0, inferredIndex);
  const prefix = index > 0 ? wordForm.slice(0, index) : '';
  let stem = canonicalLexicalStem(wordForm, language) || wordForm;
  if (rootForm && wordForm.includes(rootForm) && stem.length < rootForm.length) stem = rootForm;
  const system = writingSystem(word);
  const diacritics = latinDiacriticSignature(word, system);
  const key = \`${'${language}'}|\${system}|\${diacritics}|\${prefix}|\${fragment || rootForm}|\${stem}\`;
  const label = prefix ? \`${'${prefix}'}-\${stem}\` : stem;
  return { key, label, stem, prefix, fragment: fragment || rootForm };
}

export function lexicalModelFamilyKey(candidate, root, language = 'en') {
  return lexicalModelDescriptor(candidate, root, language).key;
}

export function candidateFrequencyScore(candidate) {
  const values = [
    candidate?.frequency_score,
    candidate?.analysis?.frequency?.frequency_score,
    candidate?.frequencyProfile?.frequency_score
  ];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return Number.NEGATIVE_INFINITY;
}

function totalIpm(candidate) {
  return Array.isArray(candidate?.sources)
    ? candidate.sources.reduce((sum, source) => sum + (Number.isFinite(Number(source?.ipm)) ? Number(source.ipm) : 0), 0)
    : 0;
}

export function compareFrequencyRepresentatives(left, right) {
  return candidateFrequencyScore(right) - candidateFrequencyScore(left)
    || (Number.isInteger(left?.rank) ? left.rank : Number.POSITIVE_INFINITY) - (Number.isInteger(right?.rank) ? right.rank : Number.POSITIVE_INFINITY)
    || totalIpm(right) - totalIpm(left)
    || String(left?.word || '').localeCompare(String(right?.word || ''));
}

export function selectHighestFrequencyPerModel(candidates, root, language = 'en') {
  const groups = new Map();
  for (const [index, source] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const descriptor = lexicalModelDescriptor(source, root, language);
    const candidate = {
      ...source,
      model_family_key: descriptor.key || source?.model_family_key || '',
      model_key: descriptor.key || source?.model_key || '',
      model_label: descriptor.label || source?.model_label || source?.model || '',
      model: descriptor.label || source?.model || ''
    };
    const key = candidate.model_key || \`manual:\${language}:\${index}:\${buildSearchForm(candidate.word)}\`;
    const group = groups.get(key) || { key, members: [], representative: null };
    group.members.push(candidate);
    if (!group.representative || compareFrequencyRepresentatives(candidate, group.representative) < 0) group.representative = candidate;
    groups.set(key, group);
  }
  const groupList = [...groups.values()];
  const selected = groupList.map(group => group.representative);
  const dropped = groupList.flatMap(group => group.members.filter(candidate => candidate !== group.representative));
  return { candidates: selected, dropped, groups: groupList };
}
`;
await writeFile('associativvordes/js/candidate-model-family.js', modelModule);

await replaceOnce(
  'associativvordes/js/candidate-finder.js',
  "import { lexicalModelFamilyKey, selectHighestFrequencyPerModel } from './candidate-model-family.js';",
  "import { lexicalModelDescriptor, selectHighestFrequencyPerModel } from './candidate-model-family.js';",
  'candidate finder model import'
);
await replaceOnce(
  'associativvordes/js/candidate-finder.js',
  `    candidate.model_family_key = lexicalModelFamilyKey(candidate, root, language);\n    matched.push(candidate);`,
  `    const model = lexicalModelDescriptor(candidate, root, language);\n    candidate.model_family_key = model.key;\n    candidate.model_key = model.key;\n    candidate.model_label = model.label;\n    matched.push(candidate);`,
  'candidate finder model metadata'
);

await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  /export const THRESHOLDS = \{[\s\S]*?\n\};/,
  `export const THRESHOLDS = { main: 35 };`,
  'single final threshold'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  /export function passesWordThreshold\(score\) \{[\s\S]*?\n\}/,
  `export function passesWordThreshold(score) {\n  return isFiniteScore(score);\n}`,
  'word threshold compatibility'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  "export const CRITICAL_DECISION_REASONS = ['no_calculated_data', 'fewer_than_3_languages', 'fewer_than_2_groups', 'final_association_below_35', 'semantic_not_confirmed'];",
  "export const CRITICAL_DECISION_REASONS = ['no_calculated_data', 'final_association_below_35'];",
  'critical decision reasons'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  "export const WARNING_DECISION_REASONS = ['some_languages_no_candidates', 'some_languages_index_error', 'some_languages_qwen_error', 'calculation_incomplete'];",
  "export const WARNING_DECISION_REASONS = ['fewer_than_3_languages', 'fewer_than_2_groups', 'semantic_not_confirmed', 'some_languages_no_candidates', 'some_languages_index_error', 'some_languages_qwen_error', 'calculation_incomplete'];",
  'warning decision reasons'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  "  const accepted = representedLangs >= 3 && groups.size >= 2 && finalAssociationPassesThreshold(finalAssociation) && semanticConfirmed;",
  "  const accepted = hasCalculatedData && finalAssociationPassesThreshold(finalAssociation);",
  'final acceptance policy'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  `    if (Number(result.representedLangs) < 3) add(critical, 'fewer_than_3_languages');\n    if (Number(result.groups) < 2) add(critical, 'fewer_than_2_groups');\n    if (Number(result.finalAssociation) < THRESHOLDS.main) add(critical, 'final_association_below_35');\n    if (!result.semanticConfirmed) add(critical, 'semantic_not_confirmed');`,
  `    if (Number(result.finalAssociation) < THRESHOLDS.main) add(critical, 'final_association_below_35');\n    if (Number(result.representedLangs) < 3) add(warnings, 'fewer_than_3_languages');\n    if (Number(result.groups) < 2) add(warnings, 'fewer_than_2_groups');\n    if (!result.semanticConfirmed) add(warnings, 'semantic_not_confirmed');`,
  'decision reason severity'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  "  return Boolean(result.hasCalculatedData && finalAssociationPassesThreshold(result.finalAssociation) && result.accepted && result.semanticConfirmed);",
  "  return Boolean(result.hasCalculatedData && finalAssociationPassesThreshold(result.finalAssociation) && result.accepted);",
  'json card final threshold only'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  /export function classifyScore\(final_score\) \{[\s\S]*?\n\}/,
  `export function classifyScore(final_score) {\n  return isFiniteScore(final_score) ? 'evaluated' : 'unavailable';\n}`,
  'neutral word classification'
);
await replaceOnce(
  'associativvordes/js/association-analyzer.js',
  /  let review = null;[\s\S]*?  const classification = finalEvaluation\.classification;/,
  `  const review = null;\n  const finalEvaluation = { ...primary, combination_method: 'primary_only' };\n  const classification = finalEvaluation.classification;`,
  'remove score-triggered review threshold'
);

await replaceOnce(
  'associativvordes/js/render-results.js',
  /export function thresholdStatusLabel\(status, lang = 'ru'\) \{[\s\S]*?\n\}/,
  `export function thresholdStatusLabel(status, lang = 'ru') {\n  const labels = lang === 'en'\n    ? { evaluated: 'evaluated', unavailable: 'unavailable' }\n    : { evaluated: 'оценено', unavailable: 'нет данных' };\n  return labels[status] || labels.unavailable;\n}`,
  'neutral result status label'
);

await replaceOnce(
  'associativvordes/js/associative-state.js',
  "    root: '', meaning: '', elementType: 'root', maxModels: 5,",
  "    root: '', meaning: '', elementType: 'root', maxModels: Number.MAX_SAFE_INTEGER,",
  'state unlimited models'
);
await replaceOnce(
  'associativvordes/js/associative-state.js',
  "  const row = { word: '', model: '', analysis: null, frequency_score: null, association_score: null, final_score: null, selected: false, ...candidate };",
  "  const row = { word: '', model: '', model_key: '', analysis: null, frequency_score: null, association_score: null, final_score: null, selected: false, ...candidate };",
  'manual candidate model key'
);
await replaceOnce(
  'associativvordes/js/associative-state.js',
  "    item.model = inferModel(value, state.root, state.elementType);",
  "    item.model = inferModel(value, state.root, state.elementType);\n    item.model_key = '';",
  'clear model key on word edit'
);
await replaceOnce(
  'associativvordes/js/associative-state.js',
  "          model: String(item.model || ''), selected: Boolean(item.selected), association_score: finiteOrNull(item.association_score), final_score: finiteOrNull(item.final_score), analysisStatus: item.analysisStatus || null,",
  "          model: String(item.model || ''), model_key: String(item.model_key || item.model_family_key || ''), selected: Boolean(item.selected), association_score: finiteOrNull(item.association_score), final_score: finiteOrNull(item.final_score), analysisStatus: item.analysisStatus || null,",
  'persist state model key'
);
await replaceOnce(
  'associativvordes/js/associative-state.js',
  "  restored.maxModels = Number.isFinite(Number(fields.maxModels)) ? Math.max(1, Math.min(20, Number(fields.maxModels))) : 5;",
  "  restored.maxModels = Number.isFinite(Number(fields.maxModels)) ? Math.max(1, Number(fields.maxModels)) : Number.MAX_SAFE_INTEGER;",
  'restore unlimited models'
);

await replaceOnce(
  'associativvordes/script.js',
  "import { analyzeAssociativeWord, THRESHOLDS, passesWordThreshold, finalAssociationPassesThreshold, calculateLanguageScore, calculateFinalAssociation, buildDecisionReasons, decisionStatusForResult, canCreateAssociativeJsonCard, normalizeLanguageStatus, summarizeLanguageStatuses } from './js/association-analyzer.js';",
  "import { analyzeAssociativeWord, finalAssociationPassesThreshold, calculateLanguageScore, calculateFinalAssociation, buildDecisionReasons, decisionStatusForResult, canCreateAssociativeJsonCard, normalizeLanguageStatus, summarizeLanguageStatuses } from './js/association-analyzer.js';",
  'script threshold imports'
);
await replaceOnce(
  'associativvordes/script.js',
  "import { findCandidatesForRoot } from './js/candidate-finder.js';",
  "import { findCandidatesForRoot } from './js/candidate-finder.js';\nimport { lexicalModelDescriptor, selectHighestFrequencyPerModel, compareFrequencyRepresentatives } from './js/candidate-model-family.js';",
  'script model imports'
);
await replaceOnce(
  'associativvordes/script.js',
  /    function inferModel\(word, root, elementType, item = \{\}\) \{[\s\S]*?\n    \}\n\n    function inferAssociation/,
  `    function inferModel(word, root, elementType, item = {}, language = 'en') {\n      if (elementType === 'preposition') {\n        const normalizedRoot = stripDiacritics(root);\n        const searchForm = stripDiacritics(String(item.search_form || word || ''));\n        const index = Number.isInteger(item.match?.index) ? item.match.index : searchForm.indexOf(normalizedRoot);\n        const after = index >= 0 ? searchForm.slice(index + normalizedRoot.length) : '';\n        const next = after.match(/^[a-zа-яёα-ωάέήίόύώϊϋΐΰ]+/i);\n        return next ? \`${'${normalizedRoot}'}+\${next[0].slice(0, 6)}\` : \`${'${normalizedRoot}'}+\`;\n      }\n      return lexicalModelDescriptor({ ...item, word }, root, language).label || getManualModelLabel();\n    }\n\n    function withModelIdentity(item, root, langCode) {\n      const descriptor = lexicalModelDescriptor(item, root, langCode);\n      return {\n        ...item,\n        model_family_key: descriptor.key || item.model_family_key || '',\n        model_key: descriptor.key || item.model_key || '',\n        model_label: descriptor.label || item.model_label || item.model || '',\n        model: descriptor.label || item.model || getManualModelLabel()\n      };\n    }\n\n    function reconcileModelRepresentatives(items, root, langCode) {\n      const prepared = (Array.isArray(items) ? items : []).map(item => withModelIdentity(item, root, langCode));\n      const selection = selectHighestFrequencyPerModel(prepared, root, langCode);\n      return selection.groups.map(group => {\n        const representative = group.representative;\n        const selectedInGroup = group.members.some(item => item.selected);\n        const hasScore = Number.isFinite(wordWeight(representative));\n        return { ...representative, selected: hasScore ? (representative.selected || selectedInGroup) : Boolean(representative.selected) };\n      });\n    }\n\n    function reconcileLanguageModels(langCode) {\n      state.languages[langCode] = reconcileModelRepresentatives(state.languages[langCode], state.root, langCode);\n      return state.languages[langCode];\n    }\n\n    function inferAssociation`,
  'script canonical model helpers'
);
await replaceOnce(
  'associativvordes/script.js',
  /    function groupByBestModel\(items, maxModels\) \{[\s\S]*?\n    \}/,
  `    function groupByBestModel(items, maxModels = Infinity, langCode = 'en') {\n      return reconcileModelRepresentatives(items, state.root, langCode)\n        .filter(item => Number.isFinite(wordWeight(item)))\n        .slice(0, maxModels)\n        .map(item => ({ ...item, selected: true }));\n    }`,
  'frequency-based model grouping'
);
await replaceOnce(
  'associativvordes/script.js',
  "          selected: passesWordThreshold(analysis.final_score)",
  "          selected: Number.isFinite(Number(analysis.final_score))",
  'automatic selection without word threshold'
);
await replaceOnce(
  'associativvordes/script.js',
  "        model: inferModel(candidate.word, root, state.elementType, candidate),\n        selected: false,",
  "        model_key: candidate.model_key || candidate.model_family_key || '',\n        model: candidate.model_label || inferModel(candidate.word, root, state.elementType, candidate, langCode),\n        selected: false,",
  'preserve candidate model identity'
);
await replaceOnce(
  'associativvordes/script.js',
  "      state.maxModels = 5;",
  "      state.maxModels = Number.MAX_SAFE_INTEGER;",
  'remove five-model cap'
);
await replaceOnce(
  'associativvordes/script.js',
  "        const preparedCandidates = validCandidates.map(item => ({ ...item, selected: false, analysisStatus: 'pending' }));",
  "        const preparedCandidates = reconcileModelRepresentatives(validCandidates, root, lang.code).map(item => ({ ...item, selected: false, analysisStatus: 'pending' }));",
  'reconcile before analysis'
);
await replaceOnce(
  'associativvordes/script.js',
  "        nextLangs[lang.code] = preparedCandidates.map(item => analyzedByWord.get(normalizeText(item.word)) || item);",
  "        nextLangs[lang.code] = reconcileModelRepresentatives(preparedCandidates.map(item => analyzedByWord.get(normalizeText(item.word)) || item), root, lang.code);",
  'reconcile after analysis'
);
await replaceOnce(
  'associativvordes/script.js',
  /    function scoringCandidates\(langCode\) \{[\s\S]*?\n    \}/,
  `    function scoringCandidates(langCode) {\n      const reconciled = reconcileModelRepresentatives(state.languages[langCode], state.root, langCode);\n      state.languages[langCode] = reconciled;\n      return reconciled\n        .filter(item => item.selected && Number.isFinite(wordWeight(item)))\n        .sort((a, b) => compareFrequencyRepresentatives(a, b));\n    }`,
  'score all selected model representatives'
);
await replaceOnce(
  'associativvordes/script.js',
  "                <dt>${labels.model}</dt><dd><input class=\"interal-input derivative-model-input\" value=\"${escapeHtml(item.model)}\" onchange=\"updateItem('${lang}', ${idx}, 'model', this.value)\"></dd>",
  "                <dt>${labels.model}</dt><dd><span class=\"mono\">${escapeHtml(item.model || item.model_key || '—')}</span></dd>",
  'make model identity read-only'
);
await replaceOnce(
  'associativvordes/script.js',
  "      item.model = item.model || inferModel(item.word, state.root, state.elementType);",
  "      Object.assign(item, withModelIdentity(item, state.root, lang));",
  'analyze canonical model identity'
);
await replaceOnce(
  'associativvordes/script.js',
  "        item.selected = passesWordThreshold(item.analysis.final_score);",
  "        item.selected = Number.isFinite(Number(item.analysis.final_score));",
  'manual analysis selection without threshold'
);
await replaceOnce(
  'associativvordes/script.js',
  "      const languageItems = state.languages[lang] || [];",
  "      state.languages[lang] = reconcileModelRepresentatives(state.languages[lang], state.root, lang);\n      const languageItems = state.languages[lang] || [];",
  'reconcile after manual analysis'
);
await replaceOnce(
  'associativvordes/script.js',
  "              model: String(item.model || ''),\n              selected: Boolean(item.selected),",
  "              model: String(item.model || ''),\n              model_key: String(item.model_key || item.model_family_key || ''),\n              selected: Boolean(item.selected),",
  'persist page model key'
);
await replaceOnce(
  'associativvordes/script.js',
  "    window.QWEN_RUNTIME_CONFIG = QWEN_RUNTIME_CONFIG;",
  `    window.QWEN_RUNTIME_CONFIG = QWEN_RUNTIME_CONFIG;\n    window.InteralAssociativeModels = {\n      reconcile: (language) => reconcileLanguageModels(language),\n      descriptor: (language, candidate) => lexicalModelDescriptor(candidate, state.root, language),\n      findRepresentative: (language, modelKey) => (state.languages[language] || []).find(item => (item.model_key || lexicalModelDescriptor(item, state.root, language).key) === modelKey) || null\n    };`,
  'expose full-state model reconciliation'
);

await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "import { API_CONFIG } from './swow-client.js';",
  "import { API_CONFIG } from './swow-client.js';\nimport { lexicalModelDescriptor, compareFrequencyRepresentatives } from './candidate-model-family.js';",
  'qwen model imports'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  /function modelForGeneratedCandidate\(entry, suggestion, canonicalRoot, buildSearchForm\) \{[\s\S]*?\n\}/,
  `function modelForGeneratedCandidate(entry, suggestion, canonicalRoot, language) {\n  const searchForm = entry.search_form || entry.word;\n  const variant = suggestion.root_variant || canonicalRoot;\n  const variantIndex = buildSearchForm(searchForm).indexOf(buildSearchForm(variant));\n  const match = { type: 'special', distance: 0, similarity: 1, fragment: buildSearchForm(variant), index: Math.max(0, variantIndex) };\n  return lexicalModelDescriptor({ ...entry, match }, canonicalRoot, language);\n}`,
  'qwen generated model descriptor'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "async function addVerifiedCandidateToRuntime(language, suggestion, entry, root, buildSearchForm) {\n  if (!activateLanguageTab(language)) return false;",
  `async function addVerifiedCandidateToRuntime(language, suggestion, entry, root, buildSearchForm) {\n  const descriptor = modelForGeneratedCandidate(entry, suggestion, root, language);\n  const proposed = { ...entry, model_key: descriptor.key, model: descriptor.label, frequencyProfile: { frequency_score: entry.frequency_score } };\n  const existing = window.InteralAssociativeModels?.findRepresentative?.(language, descriptor.key);\n  if (existing && compareFrequencyRepresentatives(proposed, existing) >= 0) return false;\n  if (!activateLanguageTab(language)) return false;`,
  'qwen skip lower-frequency duplicate model'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "  window.updateItem(language, index, 'model', modelForGeneratedCandidate(entry, suggestion, root, buildSearchForm));\n  return true;",
  "  window.updateItem(language, index, 'model_key', descriptor.key);\n  window.updateItem(language, index, 'model', descriptor.label);\n  window.InteralAssociativeModels?.reconcile?.(language);\n  return true;",
  'qwen reconcile inserted model'
);

const policyTest = `import assert from 'node:assert/strict';
import { lexicalModelDescriptor, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';
import { calculateLanguageScore, calculateFinalAssociation, classifyScore, passesWordThreshold, decisionStatusForResult } from '../associativvordes/js/association-analyzer.js';
import { readFile } from 'node:fs/promises';

function candidate(word, search_form, frequency_score, final_score, rank = null) {
  return {
    word, normalized: word.toLowerCase(), search_form, frequency_score, final_score, rank,
    selected: true, match: { type: 'exact', distance: 0, similarity: 1, fragment: 'alter', index: 0 },
    sources: [{ id: 'test', file: 'test.json', category: 'normative', ipm: frequency_score }]
  };
}

const variants = [
  candidate('альтернатива', 'alternativa', 92, 18, 1),
  candidate('альтернативный', 'alternativnyj', 71, 95, 2),
  candidate('альтернативно', 'alternativno', 55, 88, 3),
  candidate('альтруизм', 'altruizm', 80, 40, 4),
  candidate('альтруист', 'altruist', 75, 45, 5)
];
variants[3].match = { type: 'special', distance: 0, similarity: 1, fragment: 'altru', index: 0 };
variants[4].match = { type: 'special', distance: 0, similarity: 1, fragment: 'altru', index: 0 };

const selection = selectHighestFrequencyPerModel(variants, 'alter', 'ru');
assert.deepEqual(selection.candidates.map(item => item.word).sort(), ['альтернатива', 'альтруизм', 'альтруист'].sort(), 'one highest-frequency representative remains per derivational model');
assert.equal(selection.candidates.find(item => item.word.startsWith('альтернатив')).word, 'альтернатива', 'frequency F, not final P, selects the representative');
assert.equal(lexicalModelDescriptor(variants[0], 'alter', 'ru').key, lexicalModelDescriptor(variants[1], 'alter', 'ru').key, 'part-of-speech variants share one model key');
assert.notEqual(lexicalModelDescriptor(variants[3], 'alter', 'ru').key, lexicalModelDescriptor(variants[4], 'alter', 'ru').key, 'altruism and altruist remain separate derivational models');

assert.equal(passesWordThreshold(1), true, 'a finite low word score is not removed by a threshold');
assert.equal(classifyScore(1), 'evaluated', 'word status is neutral rather than pass/fail');
const language = calculateLanguageScore([
  { selected: true, final_score: 80 },
  { selected: true, final_score: 50 },
  { selected: true, final_score: 20 }
]);
assert.equal(language.normalized, 50, 'low-scoring models remain in the language mean');

const accepted = calculateFinalAssociation({
  languages: [{ code: 'en', group: 'Germanic' }],
  languageResults: [{ normalized: 40, sum: 40, count: 1, semanticConfirmed: true }],
  languageStatuses: { en: { status: 'completed' } }
});
assert.equal(accepted.accepted, true, 'the final FA threshold is the only numerical acceptance threshold');
assert.equal(decisionStatusForResult(accepted), 'accept');
const rejected = calculateFinalAssociation({
  languages: [{ code: 'en', group: 'Germanic' }],
  languageResults: [{ normalized: 34, sum: 34, count: 1, semanticConfirmed: true }],
  languageStatuses: { en: { status: 'completed' } }
});
assert.equal(decisionStatusForResult(rejected), 'reject');

const script = await readFile('associativvordes/script.js', 'utf8');
assert.doesNotMatch(script, /state\\.maxModels = 5/);
assert.doesNotMatch(script, /slice\\(0, state\\.maxModels\\)/);
assert.doesNotMatch(script, /passesWordThreshold/);
assert.doesNotMatch(script, /derivative-model-input/);
assert.match(script, /model_key: candidate\\.model_key/);
assert.match(script, /reconcileModelRepresentatives/);
assert.match(script, /window\\.InteralAssociativeModels/);

const qwen = await readFile('associativvordes/js/qwen-client.js', 'utf8');
assert.match(qwen, /compareFrequencyRepresentatives\\(proposed, existing\\)/);
assert.match(qwen, /InteralAssociativeModels\\?\\.reconcile/);

console.log('Associative model-selection and threshold policy tests passed.');
`;
await writeFile('tests/associative-model-selection-policy.test.mjs', policyTest);

await rm('scripts/apply-associative-model-policy-refactor.mjs', { force: true });
await rm('.github/workflows/apply-associative-model-policy-refactor.yml', { force: true });
console.log('Applied associative model-selection and threshold refactor.');

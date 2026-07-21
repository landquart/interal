const DEFAULT_LANGUAGE_CODES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const PAGE_STATE_VERSION = 1;
const PAGE_STATE_NAME = 'associativvordes';
export const MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE = 5;
const MAX_STATE_CANDIDATES_PER_LANGUAGE = 20;
const MAX_STATE_SOURCES_PER_CANDIDATE = 12;
const MAX_STATE_WARNING_LENGTH = 240;
const MAX_STATE_EXPLANATION_LENGTH = 1200;

function languageCodes(languages = DEFAULT_LANGUAGE_CODES) {
  return languages.map((language) => typeof language === 'string' ? language : language.code).filter(Boolean);
}

function defaultLanguageStatus(status = 'idle', extra = {}) {
  return { status, errorCode: null, message: null, ...extra };
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function truncateStateText(value, limit) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function warningEntry(code, details) {
  const entry = { code: truncateStateText(code, MAX_STATE_WARNING_LENGTH) };
  if (details != null) entry.details = truncateStateText(typeof details === 'string' ? details : JSON.stringify(details), MAX_STATE_WARNING_LENGTH);
  return entry;
}

function warningKey(entry) {
  return `${entry?.code || ''}:${entry?.details || ''}`;
}

function addDedupedWarning(list, code, details) {
  if (!code) return false;
  const entry = warningEntry(code, details);
  if (list.some(item => warningKey(item) === warningKey(entry))) return false;
  list.push(entry);
  return true;
}

export function createEmptyWarnings({ languages = DEFAULT_LANGUAGE_CODES } = {}) {
  const codes = languageCodes(languages);
  return {
    run: [],
    languages: Object.fromEntries(codes.map(code => [code, []])),
    candidates: Object.fromEntries(codes.map(code => [code, {}]))
  };
}

export function migrateAssociativeWarnings(source = {}, { languages = DEFAULT_LANGUAGE_CODES } = {}) {
  const warnings = createEmptyWarnings({ languages });
  const codes = languageCodes(languages);
  const incoming = source?.warnings && typeof source.warnings === 'object' && !Array.isArray(source.warnings) ? source.warnings : {};
  for (const warning of (Array.isArray(incoming.run) ? incoming.run : [])) addDedupedWarning(warnings.run, warning?.code || warning, warning?.details);
  for (const code of codes) {
    for (const warning of (Array.isArray(incoming.languages?.[code]) ? incoming.languages[code] : [])) addDedupedWarning(warnings.languages[code], warning?.code || warning, warning?.details);
    const candidates = incoming.candidates?.[code] && typeof incoming.candidates[code] === 'object' ? incoming.candidates[code] : {};
    for (const [candidateId, list] of Object.entries(candidates)) {
      warnings.candidates[code][candidateId] = [];
      for (const warning of (Array.isArray(list) ? list : [])) addDedupedWarning(warnings.candidates[code][candidateId], warning?.code || warning, warning?.details);
      if (!warnings.candidates[code][candidateId].length) delete warnings.candidates[code][candidateId];
    }
  }
  if (Array.isArray(source?.warnings)) {
    for (const warning of source.warnings) addDedupedWarning(warnings.run, warning?.code || warning, warning?.details);
  }
  return warnings;
}

export function addRunWarning(state, code, details) {
  state.warnings = migrateAssociativeWarnings(state, { languages: Object.keys(state.languages || state.languageStatuses || {}) });
  return addDedupedWarning(state.warnings.run, code, details);
}

export function addLanguageWarning(state, language, code, details) {
  state.warnings = migrateAssociativeWarnings(state, { languages: Object.keys(state.languages || state.languageStatuses || {}) });
  state.warnings.languages[language] ||= [];
  return addDedupedWarning(state.warnings.languages[language], code, details);
}

export function addCandidateWarning(state, language, candidateId, code, details) {
  state.warnings = migrateAssociativeWarnings(state, { languages: Object.keys(state.languages || state.languageStatuses || {}) });
  state.warnings.candidates[language] ||= {};
  state.warnings.candidates[language][candidateId] ||= [];
  return addDedupedWarning(state.warnings.candidates[language][candidateId], code, details);
}

export function hasAnyAssociativeWarnings(warnings = {}) {
  const normalized = migrateAssociativeWarnings({ warnings }, { languages: Object.keys(warnings.languages || warnings.candidates || {}) });
  return Boolean(normalized.run.length || Object.values(normalized.languages).some(list => list.length) || Object.values(normalized.candidates).some(map => Object.values(map).some(list => list.length)));
}

export function hasLanguageAssociativeWarnings(warnings = {}, language) {
  const normalized = migrateAssociativeWarnings({ warnings }, { languages: Object.keys(warnings.languages || warnings.candidates || {}) });
  return Boolean(normalized.languages[language]?.length || Object.values(normalized.candidates[language] || {}).some(list => list.length));
}

function sourceFileNameForState(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || '';
}

function compactStateSource(source) {
  if (!source || typeof source !== 'object') return null;
  const id = String(source.id || source.reference || source.ref || '').trim();
  const file = sourceFileNameForState(source.file || source.filename || source.path || source.source || source.reference || source.ref);
  const category = String(source.category || source.corpus_category || source.type || source.name || '').trim();
  const ipm = finiteOrNull(source.ipm ?? source.IPM ?? source.frequency_ipm ?? source.value ?? source.score ?? source.frequency ?? source.count);
  if (!id || !file || !category || ipm == null) return null;
  return { id, file, category, ipm };
}

function compactStateSources(sources) {
  const sourceList = Array.isArray(sources) ? sources : [];
  return {
    sources: sourceList.slice(0, MAX_STATE_SOURCES_PER_CANDIDATE).map(compactStateSource).filter(Boolean),
    source_count: sourceList.length,
    sources_truncated: sourceList.length > MAX_STATE_SOURCES_PER_CANDIDATE
  };
}

function compactStateMatch(match) {
  if (!match || typeof match !== 'object' || Array.isArray(match)) return null;
  const type = String(match.type || '').trim();
  if (!['exact', 'special', 'fuzzy'].includes(type)) return null;
  const distance = finiteOrNull(match.distance);
  const similarity = finiteOrNull(match.similarity);
  const fragment = typeof match.fragment === 'string' ? match.fragment : '';
  const index = Number(match.index);
  if (distance == null || similarity == null || !fragment || !Number.isInteger(index) || index < 0) return null;
  return { type, distance, similarity, fragment, index };
}

function compactStateSwowStrength(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactStateSwowSide(side) {
  const source = side && typeof side === 'object' && !Array.isArray(side) ? side : {};
  return { found: source.found === true, r1_strength: compactStateSwowStrength(source.r1_strength), r123_strength: compactStateSwowStrength(source.r123_strength) };
}

function compactStateSwowEvidence(swow) {
  const source = swow && typeof swow === 'object' && !Array.isArray(swow) ? swow : {};
  const bonus = compactStateSwowStrength(source.bonus);
  return { bonus: bonus ?? 0, target_to_word: compactStateSwowSide(source.target_to_word), word_to_target: compactStateSwowSide(source.word_to_target) };
}

export function createEmptyAssociativeState({ languages = DEFAULT_LANGUAGE_CODES, createLanguageStatus = defaultLanguageStatus } = {}) {
  const codes = languageCodes(languages);
  return {
    root: '', meaning: '', elementType: 'root', maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE,
    languages: Object.fromEntries(codes.map(code => [code, []])),
    checked: false,
    languageStatuses: Object.fromEntries(codes.map(code => [code, createLanguageStatus('idle')])),
    warnings: createEmptyWarnings({ languages: codes }),
    globalStatus: 'idle'
  };
}

export function invalidateSearchResult(state, { createEmptyState = createEmptyAssociativeState, shouldSkip = () => false, onInvalidateActiveRuns } = {}) {
  if (shouldSkip()) return false;
  onInvalidateActiveRuns?.();
  const empty = createEmptyState();
  state.checked = false;
  state.languages = empty.languages;
  state.languageStatuses = empty.languageStatuses;
  state.globalStatus = 'idle';
  return true;
}

export function invalidateFinalCalculation(state, { shouldSkip = () => false } = {}) {
  if (shouldSkip()) return false;
  // Candidate selection and manual row changes are recalculated locally by renderAll().
  // `checked` controls result visibility and must remain true until the search inputs change.
  if (!state.checked) state.globalStatus = 'idle';
  return true;
}

export function addManualCandidate(state, lang, candidate = {}) {
  state.languages[lang] ||= [];
  const row = { word: '', model: '', model_key: '', analysis: null, frequency_score: null, association_score: null, final_score: null, selected: false, ...candidate };
  state.languages[lang].push(row);
  invalidateFinalCalculation(state);
  return row;
}

export function updateCandidate(state, lang, idx, key, value, { inferModel = () => '', normalizeText = value => String(value || '').trim() } = {}) {
  const item = state.languages?.[lang]?.[idx];
  if (!item) return null;
  item[key] = value;
  if (key === 'word') {
    item.model = inferModel(value, state.root, state.elementType);
    item.model_key = '';
    item.analysisStatus = normalizeText(value) ? 'analyzing' : 'unavailable';
    item.analysis = null;
    item.frequency_score = null;
    item.association_score = null;
    item.final_score = null;
  }
  invalidateFinalCalculation(state);
  return item;
}

export function deleteCandidate(state, lang, idx) {
  const items = state.languages?.[lang];
  if (!Array.isArray(items)) return null;
  const [removed] = items.splice(idx, 1);
  invalidateFinalCalculation(state);
  return removed || null;
}

function compactAssociativeLanguages(languages, languageList = DEFAULT_LANGUAGE_CODES) {
  const output = {};
  for (const code of languageCodes(languageList)) {
    output[code] = (Array.isArray(languages?.[code]) ? languages[code] : [])
      .filter((item) => item && (item.selected || item.word))
      .slice(0, MAX_STATE_CANDIDATES_PER_LANGUAGE)
      .map((item) => {
        const sourceState = compactStateSources(item.sources);
        return {
          word: String(item.word || ''), normalized: String(item.normalized || ''), search_form: String(item.search_form || ''),
          match: compactStateMatch(item.match), rank: finiteOrNull(item.rank), frequency_score: finiteOrNull(item.frequency_score),
          category_breakdown: item.category_breakdown && typeof item.category_breakdown === 'object' ? cloneJson(item.category_breakdown) : {},
          sources: sourceState.sources, source_count: sourceState.source_count, sources_truncated: sourceState.sources_truncated,
          warnings: Array.isArray(item.warnings) ? item.warnings.slice(0, 8).map(w => truncateStateText(w, MAX_STATE_WARNING_LENGTH)) : [],
          category_score: finiteOrNull(item.category_score), category_weight: finiteOrNull(item.category_weight),
          frequencyProfile: item.frequencyProfile && typeof item.frequencyProfile === 'object' ? { frequency_score: finiteOrNull(item.frequencyProfile.frequency_score), rank: finiteOrNull(item.frequencyProfile.rank), category_score: finiteOrNull(item.frequencyProfile.category_score), category_weight: finiteOrNull(item.frequencyProfile.category_weight) } : null,
          model: String(item.model || ''), model_key: String(item.model_key || item.model_family_key || ''), selected: Boolean(item.selected), association_score: finiteOrNull(item.association_score), final_score: finiteOrNull(item.final_score), analysisStatus: item.analysisStatus || null,
          analysis: item.analysis ? { final_score: finiteOrNull(item.analysis.final_score), frequency: item.analysis.frequency ? { frequency_score: finiteOrNull(item.analysis.frequency.frequency_score) } : null, swow: item.analysis.swow ? compactStateSwowEvidence(item.analysis.swow) : null, association: item.analysis.association ? { association_score: finiteOrNull(item.analysis.association.association_score), directness: finiteOrNull(item.analysis.association.directness), field_relatedness: finiteOrNull(item.analysis.association.field_relatedness), domain_shift: finiteOrNull(item.analysis.association.domain_shift), semantic_confirmed: item.analysis.association.semantic_confirmed === true, explanation: truncateStateText(item.analysis.association.explanation, MAX_STATE_EXPLANATION_LENGTH) } : null, warnings: Array.isArray(item.analysis.warnings) ? item.analysis.warnings.slice(0, 8).map(w => truncateStateText(w, MAX_STATE_WARNING_LENGTH)) : [] } : null
        };
      });
  }
  return output;
}

export function compactAssociativeState(state, { languages = DEFAULT_LANGUAGE_CODES, activeLang = 'en', calculateResult } = {}) {
  const checked = Boolean(state.checked);
  const r = calculateResult?.();
  return cloneJson({ version: PAGE_STATE_VERSION, page: PAGE_STATE_NAME, state: { root: state.root || '', meaning: state.meaning || '', elementType: state.elementType || 'root', maxModels: state.maxModels, activeLang, languages: compactAssociativeLanguages(state.languages, languages), languageStatuses: state.languageStatuses, warnings: migrateAssociativeWarnings(state, { languages }), globalStatus: state.globalStatus, checked, result: checked && r ? r : null } });
}

function unwrapAssociativePageState(saved = {}) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  if (saved.version === PAGE_STATE_VERSION && saved.page === PAGE_STATE_NAME && saved.state && typeof saved.state === 'object') return saved.state;
  if (saved.version === 2 && saved.fields && typeof saved.fields === 'object') return { ...saved.fields, activeLang: saved.ui?.activeLanguageTab, checked: Boolean(saved.flags?.checked || saved.checked || saved.result), result: saved.result || null };
  return null;
}

function normalizeGlobalStatusForRestore(status, checked) {
  if (['loading_index', 'grouping_candidates', 'candidate_audit', 'analyzing', 'reviewing', 'loading'].includes(status) || (status === 'idle' && checked)) return 'aborted';
  if (['completed', 'completed_with_warnings', 'no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted', 'idle'].includes(status)) return status;
  return checked ? 'completed' : 'idle';
}

export function restoreAssociativeState(saved = {}, { languages = DEFAULT_LANGUAGE_CODES, createLanguageStatus = defaultLanguageStatus, currentLang = () => 'ru', activeLang = 'en' } = {}) {
  const fields = unwrapAssociativePageState(saved);
  if (!fields || (fields.languages && typeof fields.languages !== 'object') || (fields.languageStatuses && typeof fields.languageStatuses !== 'object')) return null;
  const restored = createEmptyAssociativeState({ languages, createLanguageStatus });
  restored.root = typeof fields.root === 'string' ? fields.root : '';
  restored.meaning = typeof fields.meaning === 'string' ? fields.meaning : '';
  restored.elementType = fields.elementType === 'preposition' ? 'preposition' : 'root';
  restored.maxModels = Number.isFinite(Number(fields.maxModels))
    ? Math.max(1, Math.min(MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, Number(fields.maxModels)))
    : MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE;
  restored.languages = compactAssociativeLanguages(fields.languages || fields.selectedLanguageResults || {}, languages);
  restored.warnings = migrateAssociativeWarnings(fields, { languages });
  restored.checked = Boolean(fields.checked || fields.result);
  const message = currentLang() === 'en' ? 'The previous calculation was interrupted. Run it again.' : 'Предыдущий расчёт был прерван. Запустите его повторно.';
  restored.languageStatuses = Object.fromEntries(languageCodes(languages).map(code => {
    const source = fields.languageStatuses?.[code] && typeof fields.languageStatuses[code] === 'object' ? fields.languageStatuses[code] : createLanguageStatus('idle');
    const interrupted = ['loading_index', 'grouping_candidates', 'candidate_audit', 'analyzing', 'reviewing', 'loading'].includes(source.status) || (source.status === 'idle' && Boolean(restored.checked));
    const status = interrupted ? 'aborted' : (source.status || 'idle');
    return [code, { ...createLanguageStatus(status), ...source, status, errorCode: status === 'aborted' ? 'RESTORE_INTERRUPTED' : (source.errorCode || null), message: status === 'aborted' ? message : (source.message || null) }];
  }));
  restored.globalStatus = normalizeGlobalStatusForRestore(fields.globalStatus || (fields.result ? 'completed' : 'idle'), restored.checked);
  if (restored.globalStatus === 'aborted') restored.checked = true;
  const codes = languageCodes(languages);
  const nextActiveLang = codes.includes(fields.activeLang) ? fields.activeLang : (codes.includes(fields.activeLanguageTab) ? fields.activeLanguageTab : activeLang || codes[0]);
  return { state: restored, activeLang: nextActiveLang };
}

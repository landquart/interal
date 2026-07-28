export const CANONICAL_VORD_TYPES = ['iv', 'av', 'in', 'vc', 'gv', 'al', 'af'];
export const LEGACY_VORD_TYPE_PREFIXES = ['iev', 'gbv'];
export const VORD_TYPE_LABELS = Object.freeze({
  iv: 'indoeuropan vordes',
  av: 'associativ vordes',
  in: 'internationalismes',
  vc: 'vordes of communités',
  gv: 'grammatic e brevi vordes',
  al: 'alter vordes',
  af: 'affixes'
});
const TYPE_SET = new Set(CANONICAL_VORD_TYPES);
const ASSOCIATIVE_LANGUAGE_GROUPS = Object.freeze({
  en: 'Germanic',
  de: 'Germanic',
  fr: 'Romance',
  es: 'Romance',
  it: 'Romance',
  ru: 'Slavic'
});
const ASSOCIATIVE_GROUP_ORDER = Object.freeze(['Germanic', 'Romance', 'Slavic']);
const ASSOCIATIVE_PARTS_OF_SPEECH = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'particle',
  'numeral',
  'other'
]);

export class CardSchemaError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = 'CardSchemaError';
    this.path = path;
  }
}

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const FINAL_PERCENTAGE_SCHEMAS = Object.freeze({
  av: Object.freeze({
    code: 'FA',
    paths: Object.freeze(['result.FA', 'calculation.FA', 'FA'])
  }),
  iv: Object.freeze({
    code: 'PI',
    paths: Object.freeze(['result.pi_percent', 'calculation.pi_percent', 'pi_percent'])
  })
});
const finiteOrNull = value => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function fieldAtPath(object, path) {
  const keys = path.split('.');
  let current = object;
  for (const key of keys) {
    if (!isRecord(current) || !hasOwn(current, key)) return { found: false, value: undefined };
    current = current[key];
  }
  return { found: true, value: current };
}

function setFieldAtPath(object, path, value) {
  const keys = path.split('.');
  let current = object;
  keys.slice(0, -1).forEach((key) => {
    if (!isRecord(current[key])) current[key] = {};
    current = current[key];
  });
  current[keys.at(-1)] = value;
}

export function getCardFinalPercentage(card) {
  const schema = FINAL_PERCENTAGE_SCHEMAS[card?.vord_type];
  if (!schema) return undefined;
  for (const sourcePath of schema.paths) {
    const field = fieldAtPath(card, sourcePath);
    if (field.found) {
      return {
        code: schema.code,
        value: field.value,
        source_path: sourcePath
      };
    }
  }
  return undefined;
}

export function getCardPiPercent(card) {
  const finalPercentage = getCardFinalPercentage(card);
  return finalPercentage?.code === 'PI' ? finalPercentage.value : undefined;
}

export function normalizeCardFinalPercentage(card) {
  const next = typeof structuredClone === 'function' ? structuredClone(card) : JSON.parse(JSON.stringify(card));
  const finalPercentage = getCardFinalPercentage(next);
  if (finalPercentage && typeof finalPercentage.value === 'string' && finalPercentage.value.trim()) {
    const number = Number(finalPercentage.value);
    if (Number.isFinite(number)) setFieldAtPath(next, finalPercentage.source_path, number);
  }
  return next;
}

export function normalizeCardPi(card) {
  return normalizeCardFinalPercentage(card);
}

function associativeEvidence(card) {
  const evidence = Array.isArray(card.language_evidence)
    ? card.language_evidence
    : (Array.isArray(card.language_results) ? card.language_results : []);
  return evidence.filter(isRecord);
}

function associativeLanguageCode(item) {
  return String(item.language || item.code || '').trim().toLowerCase();
}

export function normalizeAssociativeCard(card) {
  if (!isRecord(card) || card.vord_type !== 'av') return card;
  const next = typeof structuredClone === 'function' ? structuredClone(card) : JSON.parse(JSON.stringify(card));
  const evidence = associativeEvidence(next);
  const codes = [...new Set(evidence.map(associativeLanguageCode).filter(code => ASSOCIATIVE_LANGUAGE_GROUPS[code]))];
  const derivedGroups = [...new Set(codes.map(code => ASSOCIATIVE_LANGUAGE_GROUPS[code]))]
    .sort((a, b) => ASSOCIATIVE_GROUP_ORDER.indexOf(a) - ASSOCIATIVE_GROUP_ORDER.indexOf(b));

  const existingGroups = Array.isArray(next.supported_groups)
    ? next.supported_groups.filter(group => ASSOCIATIVE_GROUP_ORDER.includes(group))
    : [];
  next.supported_groups = [...new Set([...existingGroups, ...derivedGroups])]
    .sort((a, b) => ASSOCIATIVE_GROUP_ORDER.indexOf(a) - ASSOCIATIVE_GROUP_ORDER.indexOf(b));

  const sourceResult = isRecord(next.result) ? next.result : {};
  const sourceCalculation = isRecord(next.calculation) ? next.calculation : {};
  const representedLanguages = finiteOrNull(
    sourceResult.represented_languages
      ?? sourceCalculation.represented_languages
      ?? sourceCalculation.languagesRepresented
      ?? sourceCalculation.representedLangs
  );
  const representedGroups = finiteOrNull(
    sourceResult.represented_groups
      ?? sourceCalculation.represented_groups
      ?? sourceCalculation.languageGroups
      ?? sourceCalculation.groups
  );

  next.result = {
    ...sourceResult,
    ...(sourceResult.TA == null && sourceCalculation.TA != null ? { TA: sourceCalculation.TA } : {}),
    ...(sourceResult.FA == null && sourceCalculation.FA != null ? { FA: sourceCalculation.FA } : {}),
    represented_languages: representedLanguages ?? codes.length,
    represented_groups: representedGroups ?? next.supported_groups.length
  };

  if (isRecord(next.calculation)) {
    next.calculation = {
      ...next.calculation,
      represented_languages: next.result.represented_languages,
      represented_groups: next.result.represented_groups
    };
  }
  return next;
}

export function validateAuthor(author, basePath = 'author') {
  if (author === undefined || author === null) return;
  if (!isRecord(author)) throw new CardSchemaError(basePath, 'must be an object when present');
  if (Object.keys(author).length === 0) throw new CardSchemaError(basePath, 'must not be empty');
  const hasName = nonEmpty(author.display_name);
  let hasContact = false;
  if (author.contacts !== undefined) {
    if (!Array.isArray(author.contacts)) throw new CardSchemaError(`${basePath}.contacts`, 'must be an array');
    hasContact = author.contacts.some((contact, index) => {
      if (!isRecord(contact)) throw new CardSchemaError(`${basePath}.contacts[${index}]`, 'must be an object');
      const ok = nonEmpty(contact.type) && (nonEmpty(contact.url) || nonEmpty(contact.value));
      if (!ok) throw new CardSchemaError(`${basePath}.contacts[${index}]`, 'must include type and url/value');
      return true;
    });
  }
  if (!hasName && !hasContact) throw new CardSchemaError(basePath, 'must include display_name or a valid contacts entry');
}

export function validateCardSchema(card, options = {}) {
  if (!isRecord(card)) throw new CardSchemaError('$', 'card must be an object');
  if (!nonEmpty(card.vord_type)) throw new CardSchemaError('vord_type', 'is required');
  if (!TYPE_SET.has(card.vord_type)) throw new CardSchemaError('vord_type', `unknown vord_type "${card.vord_type}"`);
  if (options.expectedType && card.vord_type !== options.expectedType) throw new CardSchemaError('vord_type', `does not match expected "${options.expectedType}"`);
  if (card.card_type !== undefined && card.card_type !== 'vord_card') throw new CardSchemaError('card_type', 'must be "vord_card"');
  if (!isRecord(card.interal)) throw new CardSchemaError('interal', 'is required');
  if (!nonEmpty(card.interal.word)) throw new CardSchemaError('interal.word', 'is required');
  if (card.vord_type === 'av' && options.strictAssociative === true) {
    if (!nonEmpty(card.interal.ipa)) throw new CardSchemaError('interal.ipa', 'is required');
    if (!nonEmpty(card.interal.part_of_speech)) throw new CardSchemaError('interal.part_of_speech', 'is required');
    if (!ASSOCIATIVE_PARTS_OF_SPEECH.has(card.interal.part_of_speech)) {
      throw new CardSchemaError('interal.part_of_speech', 'has an invalid value');
    }
    if (!['root', 'preposition'].includes(card.interal.type)) {
      throw new CardSchemaError('interal.type', 'must be "root" or "preposition"');
    }
    if (card.interal.type === 'preposition' && card.interal.part_of_speech !== 'preposition') {
      throw new CardSchemaError('interal.part_of_speech', 'must be "preposition" for a preposition');
    }
    if (card.interal.type === 'root' && card.interal.part_of_speech === 'preposition') {
      throw new CardSchemaError('interal.part_of_speech', 'must describe the selected root');
    }
    if (!isRecord(card.translation)) throw new CardSchemaError('translation', 'is required');
    if (!nonEmpty(card.translation.language)) throw new CardSchemaError('translation.language', 'is required');
    if (!nonEmpty(card.translation.word)) throw new CardSchemaError('translation.word', 'is required');
    if (!isRecord(card.analysis_input)) throw new CardSchemaError('analysis_input', 'is required');
    if (!nonEmpty(card.analysis_input.language)) throw new CardSchemaError('analysis_input.language', 'is required');
    if (!nonEmpty(card.analysis_input.target_meaning)) throw new CardSchemaError('analysis_input.target_meaning', 'is required');
    if (!isRecord(card.result)) throw new CardSchemaError('result', 'is required');
    for (const metric of ['FA', 'TA']) {
      if (typeof card.result[metric] !== 'number' || !Number.isFinite(card.result[metric])) {
        throw new CardSchemaError(`result.${metric}`, 'must be a finite number');
      }
    }
  }
  const finalPercentage = getCardFinalPercentage(card);
  if (
    finalPercentage
    && (typeof finalPercentage.value !== 'number' || !Number.isFinite(finalPercentage.value))
  ) {
    throw new CardSchemaError(finalPercentage.source_path, 'must be a finite number when present');
  }
  validateAuthor(card.author);
  return true;
}

export function normalizeCardSchema(card, options = {}) {
  const normalized = normalizeAssociativeCard(normalizeCardFinalPercentage(card));
  validateCardSchema(normalized, options);
  return normalized;
}

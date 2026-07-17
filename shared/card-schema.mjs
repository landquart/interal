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
const finiteOrNull = value => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function getCardPiPercent(card) {
  if (isRecord(card?.result) && hasOwn(card.result, 'pi_percent')) return card.result.pi_percent;
  if (isRecord(card?.calculation) && hasOwn(card.calculation, 'pi_percent')) return card.calculation.pi_percent;
  if (isRecord(card) && hasOwn(card, 'pi_percent')) return card.pi_percent;
  return undefined;
}

export function normalizeCardPi(card) {
  const next = typeof structuredClone === 'function' ? structuredClone(card) : JSON.parse(JSON.stringify(card));
  const pi = getCardPiPercent(next);
  if (pi !== undefined) {
    if (!isRecord(next.result)) next.result = {};
    next.result.pi_percent = pi;
  }
  return next;
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
  const pi = getCardPiPercent(card);
  if (pi !== undefined && (typeof pi !== 'number' || !Number.isFinite(pi))) throw new CardSchemaError('result.pi_percent', 'must be a finite number when present');
  if (card.vord_type === 'av') {
    if (!isRecord(card.result)) throw new CardSchemaError('result', 'is required for associative cards');
    if (finiteOrNull(card.result.represented_languages) == null) throw new CardSchemaError('result.represented_languages', 'must be a finite number');
    if (finiteOrNull(card.result.represented_groups) == null) throw new CardSchemaError('result.represented_groups', 'must be a finite number');
  }
  validateAuthor(card.author);
  return true;
}

export function normalizeCardSchema(card, options = {}) {
  const normalized = normalizeAssociativeCard(normalizeCardPi(card));
  validateCardSchema(normalized, options);
  return normalized;
}

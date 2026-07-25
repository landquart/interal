const POTENTIAL_LABELS = Object.freeze({
  ru: Object.freeze({ yes: 'Есть.', no: 'Нет.' }),
  en: Object.freeze({ yes: 'Yes.', no: 'No.' })
});

const SAFE_SHORT_CONCLUSIONS = Object.freeze({
  accepted: Object.freeze({
    en: 'The candidate form meets the applicable Interal requirements.',
    de: 'Die Kandidatenform erfüllt die anwendbaren Anforderungen des Interal.',
    fr: 'La forme candidate satisfait aux exigences applicables de l’Interal.',
    es: 'La forma candidata cumple los requisitos aplicables del Interal.',
    it: 'La forma candidata soddisfa i requisiti applicabili dell’Interal.',
    ru: 'Кандидатная форма соответствует применимым требованиям Интераля.'
  }),
  rejected: Object.freeze({
    en: 'The candidate form does not meet the applicable Interal requirements.',
    de: 'Die Kandidatenform erfüllt die anwendbaren Anforderungen des Interal nicht.',
    fr: 'La forme candidate ne satisfait pas aux exigences applicables de l’Interal.',
    es: 'La forma candidata no cumple los requisitos aplicables del Interal.',
    it: 'La forma candidata non soddisfa i requisiti applicabili dell’Interal.',
    ru: 'Кандидатная форма не соответствует применимым требованиям Интераля.'
  }),
  needs_manual_review: Object.freeze({
    en: 'The candidate form requires manual review.',
    de: 'Die Kandidatenform erfordert eine manuelle Prüfung.',
    fr: 'La forme candidate nécessite une vérification manuelle.',
    es: 'La forma candidata requiere una revisión manual.',
    it: 'La forma candidata richiede una verifica manuale.',
    ru: 'Кандидатная форма требует ручной проверки.'
  })
});

function cloneRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function hasDerivationalPotential(raw = {}, input = {}) {
  const derivation = raw?.derivation && typeof raw.derivation === 'object' && !Array.isArray(raw.derivation)
    ? raw.derivation
    : {};
  const capabilities = {
    verb: derivation.canFormVerb === true,
    noun: derivation.canFormNoun === true,
    adjective: derivation.canFormAdjective === true
  };
  const sourcePartOfSpeech = String(input.partOfSpeech || '').trim();
  if (Object.prototype.hasOwnProperty.call(capabilities, sourcePartOfSpeech)) {
    capabilities[sourcePartOfSpeech] = false;
  }
  return Object.values(capabilities).some(Boolean);
}

export function sanitizeGeneratedDerivativeClaims(raw = {}, input = {}) {
  const result = cloneRecord(raw);
  const language = input.interfaceLanguage === 'en' ? 'en' : 'ru';
  const potential = hasDerivationalPotential(result, input);

  if (!result.analysis || typeof result.analysis !== 'object' || Array.isArray(result.analysis)) {
    result.analysis = {};
  }
  result.analysis.derivationalPotential = POTENTIAL_LABELS[language][potential ? 'yes' : 'no'];

  if (!result.derivation || typeof result.derivation !== 'object' || Array.isArray(result.derivation)) {
    result.derivation = {};
  }
  result.derivation.possibleDerivations = [];

  const decision = ['accepted', 'rejected', 'needs_manual_review'].includes(result.decision)
    ? result.decision
    : 'needs_manual_review';
  result.shortConclusion = { ...SAFE_SHORT_CONCLUSIONS[decision] };

  return result;
}

// Backward-compatible export used by the public endpoint.
export const sanitizeUnsupportedSimpleNounClaims = sanitizeGeneratedDerivativeClaims;
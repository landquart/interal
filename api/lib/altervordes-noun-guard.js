const SAFE_DERIVATIONAL_POTENTIAL = Object.freeze({
  ru: 'Конкретные производные не перечисляются. Деривационный потенциал оценивается только по совместимости основы с общей моделью образования слов (§ 6), модифицированным правилом де Валя (§ 75) и правилами соответствующих суффиксов (§§ 80–81). Форма и значение каждого реального производного требуют отдельной морфологической и семантической проверки.',
  en: 'Concrete derivatives are not listed. Derivational potential is assessed only through compatibility with the general word-formation pattern (§ 6), the modified de Wahl rule (§ 75), and the rules of the relevant suffixes (§§ 80–81). The form and meaning of every real derivative require a separate morphological and semantic check.'
});

const SAFE_SHORT_CONCLUSIONS = Object.freeze({
  accepted: Object.freeze({
    en: 'The candidate form is compatible with the applicable Interal rules; concrete derivatives require separate verification.',
    de: 'Die Kandidatenform entspricht den anwendbaren Regeln des Interal; konkrete Ableitungen müssen gesondert geprüft werden.',
    fr: 'La forme candidate est compatible avec les règles applicables de l’Interal ; les dérivés concrets doivent être vérifiés séparément.',
    es: 'La forma candidata es compatible con las reglas aplicables del Interal; las derivaciones concretas requieren una verificación separada.',
    it: 'La forma candidata è compatibile con le regole applicabili dell’Interal; le derivazioni concrete richiedono una verifica separata.',
    ru: 'Кандидатная форма совместима с применимыми правилами Интераля; конкретные производные требуют отдельной проверки.'
  }),
  rejected: Object.freeze({
    en: 'The candidate form cannot be accepted on the basis of the verified analysis; concrete derivatives are not generated.',
    de: 'Die Kandidatenform kann auf Grundlage der geprüften Analyse nicht angenommen werden; konkrete Ableitungen werden nicht erzeugt.',
    fr: 'La forme candidate ne peut pas être acceptée sur la base de l’analyse vérifiée ; aucun dérivé concret n’est généré.',
    es: 'La forma candidata no puede aceptarse según el análisis verificado; no se generan derivaciones concretas.',
    it: 'La forma candidata non può essere accettata sulla base dell’analisi verificata; non vengono generate derivazioni concrete.',
    ru: 'Кандидатная форма не может быть принята по результатам проверенного анализа; конкретные производные не генерируются.'
  }),
  needs_manual_review: Object.freeze({
    en: 'Manual review is required; concrete derivatives are not generated without a separate morphological and semantic check.',
    de: 'Eine manuelle Prüfung ist erforderlich; konkrete Ableitungen werden ohne gesonderte morphologische und semantische Prüfung nicht erzeugt.',
    fr: 'Une vérification manuelle est nécessaire ; aucun dérivé concret n’est généré sans contrôle morphologique et sémantique distinct.',
    es: 'Se requiere una revisión manual; no se generan derivaciones concretas sin una comprobación morfológica y semántica separada.',
    it: 'È necessaria una revisione manuale; non vengono generate derivazioni concrete senza una verifica morfologica e semantica separata.',
    ru: 'Требуется ручная проверка; конкретные производные не генерируются без отдельной морфологической и семантической проверки.'
  })
});

function cloneRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function sanitizeGeneratedDerivativeClaims(raw = {}, input = {}) {
  const result = cloneRecord(raw);
  const language = input.interfaceLanguage === 'en' ? 'en' : 'ru';

  if (!result.analysis || typeof result.analysis !== 'object' || Array.isArray(result.analysis)) {
    result.analysis = {};
  }
  result.analysis.derivationalPotential = SAFE_DERIVATIONAL_POTENTIAL[language];

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

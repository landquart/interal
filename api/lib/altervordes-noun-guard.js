const EXPLICIT_SIMPLE_T_STEM_NOUNS = new Set(['dictate', 'formate']);

const SAFE_DERIVATIONAL_POTENTIAL = Object.freeze({
  ru: 'Простые существительные образуются от презентной формы или корня по общей модели § 6. Деривационная тема на -t и совпадающая с ней форма прошедшего времени не считаются самостоятельными существительными. Суффиксальные производные допустимы только по отдельным правилам и при семантической уместности.',
  en: 'Simple nouns are formed from the present form or root under the general pattern in § 6. A t-final derivational stem and the coinciding past-tense form are not independent nouns. Suffixed derivatives are permitted only under their specific rules and when semantically appropriate.'
});

const SAFE_SHORT_CONCLUSIONS = Object.freeze({
  accepted: Object.freeze({
    en: 'The form is compatible with Interal rules; only derivations supported by the applicable noun and suffix patterns should be used.',
    de: 'Die Form entspricht den Regeln des Interal; verwendet werden dürfen nur Ableitungen, die durch die einschlägigen Substantiv- und Suffixmodelle gestützt sind.',
    fr: 'La forme est compatible avec les règles de l’Interal ; seules les dérivations autorisées par les modèles nominaux et suffixaux applicables doivent être utilisées.',
    es: 'La forma es compatible con las reglas del Interal; solo deben usarse las derivaciones admitidas por los modelos nominales y sufijales aplicables.',
    it: 'La forma è compatibile con le regole dell’Interal; devono essere usate solo le derivazioni ammesse dai modelli nominali e suffissali applicabili.',
    ru: 'Форма соответствует правилам Интераля; следует использовать только производные, подтверждённые применимыми моделями образования существительных и присоединения суффиксов.'
  }),
  rejected: Object.freeze({
    en: 'The form cannot be accepted on the basis of the verified analysis; unsupported noun formations must not be used.',
    de: 'Die Form kann aufgrund der geprüften Analyse nicht angenommen werden; nicht belegte Substantivbildungen dürfen nicht verwendet werden.',
    fr: 'La forme ne peut pas être acceptée sur la base de l’analyse vérifiée ; les formations nominales non attestées ne doivent pas être utilisées.',
    es: 'La forma no puede aceptarse según el análisis verificado; no deben usarse formaciones nominales no justificadas.',
    it: 'La forma non può essere accettata sulla base dell’analisi verificata; non devono essere usate formazioni nominali non giustificate.',
    ru: 'Форма не может быть принята по результатам проверенного анализа; неподтверждённые способы образования существительных использовать нельзя.'
  }),
  needs_manual_review: Object.freeze({
    en: 'Manual review is required; unsupported noun formations must not be treated as evidence of derivational potential.',
    de: 'Eine manuelle Prüfung ist erforderlich; nicht belegte Substantivbildungen dürfen nicht als Nachweis des Ableitungspotenzials gelten.',
    fr: 'Une vérification manuelle est nécessaire ; les formations nominales non attestées ne doivent pas servir de preuve du potentiel dérivationnel.',
    es: 'Se requiere una revisión manual; las formaciones nominales no justificadas no deben considerarse prueba del potencial derivativo.',
    it: 'È necessaria una revisione manuale; le formazioni nominali non giustificate non devono essere considerate prova del potenziale derivazionale.',
    ru: 'Требуется ручная проверка; неподтверждённые существительные нельзя считать доказательством деривационного потенциала.'
  })
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsStandaloneForm(value, form) {
  if (typeof value !== 'string' || !value || !form) return false;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_-])${escapeRegExp(form)}(?![\\p{L}\\p{N}_-])`, 'iu');
  return pattern.test(value);
}

export function getUnsupportedSimpleNounForms(input = {}) {
  const candidate = String(input.candidate || '').trim().toLowerCase();
  if (!candidate || (!candidate.endsWith('ar') && !candidate.endsWith('ir'))) return [];

  const present = candidate.slice(0, -1);
  const pastOrBareStem = `${present}t`;
  const tStemWithE = `${pastOrBareStem}e`;
  const unsupported = [pastOrBareStem];
  if (!EXPLICIT_SIMPLE_T_STEM_NOUNS.has(tStemWithE)) unsupported.push(tStemWithE);
  return unsupported;
}

export function findUnsupportedSimpleNounClaims(raw = {}, input = {}) {
  const unsupported = getUnsupportedSimpleNounForms(input);
  if (!unsupported.length) return [];

  const texts = [
    raw?.analysis?.derivationalPotential,
    ...(Array.isArray(raw?.derivation?.possibleDerivations) ? raw.derivation.possibleDerivations.map(String) : []),
    ...Object.values(raw?.shortConclusion && typeof raw.shortConclusion === 'object' ? raw.shortConclusion : {})
  ];

  return unsupported.filter((form) => texts.some((text) => containsStandaloneForm(text, form)));
}

export function sanitizeUnsupportedSimpleNounClaims(raw = {}, input = {}) {
  const result = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (typeof structuredClone === 'function' ? structuredClone(raw) : JSON.parse(JSON.stringify(raw)))
    : {};
  const unsupported = getUnsupportedSimpleNounForms(input);
  if (!unsupported.length) return result;

  const containsUnsupported = (value) => unsupported.some((form) => containsStandaloneForm(value, form));
  const hadInvalidAnalysis = containsUnsupported(result?.analysis?.derivationalPotential);
  const hadInvalidConclusion = Object.values(result?.shortConclusion && typeof result.shortConclusion === 'object' ? result.shortConclusion : {})
    .some(containsUnsupported);

  if (Array.isArray(result?.derivation?.possibleDerivations)) {
    result.derivation.possibleDerivations = result.derivation.possibleDerivations
      .filter((item) => !containsUnsupported(String(item)));
  }

  if (hadInvalidAnalysis) {
    if (!result.analysis || typeof result.analysis !== 'object') result.analysis = {};
    result.analysis.derivationalPotential = SAFE_DERIVATIONAL_POTENTIAL[input.interfaceLanguage === 'en' ? 'en' : 'ru'];
  }

  if (hadInvalidConclusion) {
    const decision = ['accepted', 'rejected', 'needs_manual_review'].includes(result.decision)
      ? result.decision
      : 'needs_manual_review';
    result.shortConclusion = { ...SAFE_SHORT_CONCLUSIONS[decision] };
  }

  return result;
}

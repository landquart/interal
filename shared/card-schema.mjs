const PI_PERCENT_PATHS = ['result.pi_percent', 'calculation.pi_percent', 'pi_percent'];

export function getPath(object, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], object);
}

export function hasFieldValue(value) {
  return value !== undefined && value !== null && value !== '';
}

export function getFirstAvailableField(object, paths) {
  for (const path of paths) {
    const value = getPath(object, path);
    if (hasFieldValue(value)) return { found: true, path, value };
  }
  return { found: false, path: null, value: undefined };
}

export function getPiPercent(card) {
  return getFirstAvailableField(card, PI_PERCENT_PATHS).value;
}

export function cloneJsonValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function normalizeCardSchema(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
  const card = cloneJsonValue(source);
  const pi = getPiPercent(card);
  if (hasFieldValue(pi)) {
    card.result = {
      ...(card.result || {}),
      pi_percent: Number.isFinite(Number(pi)) ? Number(pi) : pi
    };
  }
  return card;
}

export const CARD_SCHEMAS = {
  iv: {
    required: [
      { label: 'interal.word', paths: ['interal.word'] },
      { label: 'interal.part_of_speech', paths: ['interal.part_of_speech'] },
      { label: 'translation.language', paths: ['translation.language'] },
      { label: 'translation.word', paths: ['translation.word'] },
      { label: 'pi_percent', paths: PI_PERCENT_PATHS, validate: (value) => Number.isFinite(Number(value)) }
    ]
  },
  av: { required: [{ label: 'interal.word', paths: ['interal.word'] }] },
  in: { required: [{ label: 'interal.word', paths: ['interal.word'] }] },
  vc: { required: [{ label: 'interal.word', paths: ['interal.word'] }] },
  gv: { required: [{ label: 'interal.word', paths: ['interal.word'] }] },
  al: { required: [{ label: 'interal.word', paths: ['interal.word'] }] },
  af: { required: [{ label: 'form', paths: ['form'] }] }
};

export function validateOptionalAuthor(card, checks = []) {
  if (!card?.author) return checks;
  const contacts = card.author.contacts;
  checks.push({
    ok: hasFieldValue(card.author.display_name) || (Array.isArray(contacts) && contacts.length > 0),
    label: 'author',
    path: 'author'
  });
  return checks;
}

export function validateCard(source) {
  const card = normalizeCardSchema(source);
  const checks = [
    { ok: Boolean(card && typeof card === 'object' && !Array.isArray(card)), label: 'jsonObjectFound' },
    { ok: card?.card_type === 'vord_card' || card?.card_type === 'affix_card', label: 'card_type', path: 'card_type' }
  ];
  const schema = CARD_SCHEMAS[card?.vord_type] || { required: [] };
  for (const field of schema.required) {
    const result = getFirstAvailableField(card, field.paths);
    checks.push({
      ok: result.found && (!field.validate || field.validate(result.value)),
      label: field.label,
      path: result.path || field.label,
      value: result.value
    });
  }
  validateOptionalAuthor(card, checks);
  return { ok: checks.every((check) => check.ok), checks, card };
}

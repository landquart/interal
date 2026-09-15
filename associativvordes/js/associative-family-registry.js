import { buildSearchForm } from './search-normalizer.js';

const VERIFIED_ROOT_FAMILIES = Object.freeze([
  Object.freeze({ id: 'family:inter', canonical: 'inter', aliases: Object.freeze(['inter']) }),
  Object.freeze({ id: 'family:ocul', canonical: 'ocul', aliases: Object.freeze(['ocul', 'okul']) }),
  Object.freeze({ id: 'family:regul', canonical: 'regul', aliases: Object.freeze(['regul', 'regol']) }),
  Object.freeze({ id: 'family:alter', canonical: 'alter', aliases: Object.freeze(['alter', 'altern', 'altru']) }),
  Object.freeze({ id: 'family:pede', canonical: 'pede', aliases: Object.freeze(['pede', 'ped', 'pedi']) })
]);

function normalizeAlias(value) {
  return buildSearchForm(value).replace(/[^a-z0-9]/g, '');
}

const FAMILY_BY_ALIAS = new Map();
for (const family of VERIFIED_ROOT_FAMILIES) {
  for (const value of [family.canonical, ...family.aliases]) {
    const alias = normalizeAlias(value);
    if (alias) FAMILY_BY_ALIAS.set(alias, family);
  }
}

export function resolveAssociativeFamily(root, { elementType = 'root' } = {}) {
  const canonicalQuery = normalizeAlias(root);
  if (!canonicalQuery) return null;
  if (elementType === 'preposition') {
    return Object.freeze({ id: `prefix-family:${canonicalQuery}`, canonical: canonicalQuery, aliases: Object.freeze([canonicalQuery]), verified: false, element_type: 'preposition' });
  }
  const verified = FAMILY_BY_ALIAS.get(canonicalQuery);
  if (verified) {
    return Object.freeze({ id: verified.id, canonical: normalizeAlias(verified.canonical), aliases: Object.freeze([...new Set(verified.aliases.map(normalizeAlias).filter(Boolean))]), verified: true, element_type: 'root' });
  }
  return Object.freeze({ id: `surface-family:${canonicalQuery}`, canonical: canonicalQuery, aliases: Object.freeze([canonicalQuery]), verified: false, element_type: 'root' });
}

export function familyAliases(root, options) {
  return resolveAssociativeFamily(root, options)?.aliases || [];
}

export function sameAssociativeFamily(left, right, options) {
  const a = resolveAssociativeFamily(left, options);
  const b = resolveAssociativeFamily(right, options);
  return Boolean(a && b && a.id === b.id);
}

export { VERIFIED_ROOT_FAMILIES };

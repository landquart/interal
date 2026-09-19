export const RELATION_TYPE = Object.freeze({
  DIRECT_ALLOMORPH: 'direct_allomorph',
  DIRECT_DESCENDANT: 'direct_descendant',
  BORROWED_FORM: 'borrowed_form',
  INHERITED_FORM: 'inherited_form',
  COMPOUND_COMPONENT: 'compound_component',
  AFFIX_COMPONENT: 'affix_component',
  DISTANT_ANCESTOR: 'distant_ancestor',
  PROTO_RELATION: 'proto_relation',
  HOMONYM: 'homonym',
  UNCERTAIN: 'uncertain'
});

const policy = (relationType, mergeAllowed, reviewRequired, confidence) => Object.freeze({ relationType, mergeAllowed, reviewRequired, confidence });

export const TEMPLATE_RELATION_POLICY = Object.freeze({
  der: policy(RELATION_TYPE.DIRECT_DESCENDANT, true, false, 0.95),
  uder: policy(RELATION_TYPE.DIRECT_DESCENDANT, true, false, 0.9),
  derived: policy(RELATION_TYPE.DIRECT_DESCENDANT, true, false, 0.95),
  'derived from': policy(RELATION_TYPE.DIRECT_DESCENDANT, true, false, 0.95),
  bor: policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.9),
  'bor+': policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.9),
  lbor: policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.9),
  slbor: policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.85),
  borrowed: policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.9),
  'learned borrowing': policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.9),
  'semi-learned borrowing': policy(RELATION_TYPE.BORROWED_FORM, true, false, 0.85),
  inh: policy(RELATION_TYPE.INHERITED_FORM, true, false, 0.95),
  inherited: policy(RELATION_TYPE.INHERITED_FORM, true, false, 0.95),
  'clipping of': policy(RELATION_TYPE.DIRECT_ALLOMORPH, true, false, 0.95),
  'back-form': policy(RELATION_TYPE.DIRECT_DESCENDANT, true, false, 0.9),
  'back-formation': policy(RELATION_TYPE.DIRECT_DESCENDANT, true, false, 0.9),
  'short for': policy(RELATION_TYPE.DIRECT_ALLOMORPH, true, false, 0.95),
  'ellipsis of': policy(RELATION_TYPE.DIRECT_ALLOMORPH, true, false, 0.9),
  compound: policy(RELATION_TYPE.COMPOUND_COMPONENT, false, false, 1),
  confix: policy(RELATION_TYPE.COMPOUND_COMPONENT, false, false, 1),
  blend: policy(RELATION_TYPE.COMPOUND_COMPONENT, false, true, 0.8),
  af: policy(RELATION_TYPE.AFFIX_COMPONENT, false, false, 1),
  affix: policy(RELATION_TYPE.AFFIX_COMPONENT, false, false, 1),
  prefix: policy(RELATION_TYPE.AFFIX_COMPONENT, false, false, 1),
  suffix: policy(RELATION_TYPE.AFFIX_COMPONENT, false, false, 1),
  etymon: policy(RELATION_TYPE.DISTANT_ANCESTOR, false, true, 0.6),
  ety: policy(RELATION_TYPE.DISTANT_ANCESTOR, false, true, 0.6)
});

const own = (value, key) => value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);

export function parseStructuredExpansion(expansion, templateName = 'etymon') {
  let root;
  try { root = typeof expansion === 'string' ? JSON.parse(expansion) : expansion; }
  catch {
    return { relations: [], uncertain: [{ template: templateName, reason: 'malformed_expansion', path: [] }] };
  }
  if (!root || typeof root !== 'object') return { relations: [], uncertain: [{ template: templateName, reason: 'non_structured_expansion', path: [] }] };
  const relations = [], uncertain = [];
  const visit = (value, path, ancestryDepth) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, [...path, index], ancestryDepth)); return; }
    if (!value || typeof value !== 'object') return;
    const hasLang = own(value, 'lang') || own(value, 'lang_code');
    const hasTerm = own(value, 'term') || own(value, 'word');
    let nextDepth = ancestryDepth;
    if (hasLang || hasTerm) {
      if (hasLang && hasTerm) {
        const sourceLang = String(value.lang ?? value.lang_code ?? '').trim();
        const term = String(value.term ?? value.word ?? '').trim();
        const proto = /(?:-pro$|proto)/i.test(sourceLang);
        const relationType = proto ? RELATION_TYPE.PROTO_RELATION : (ancestryDepth === 0 ? RELATION_TYPE.DISTANT_ANCESTOR : RELATION_TYPE.DISTANT_ANCESTOR);
        if (sourceLang && term) relations.push({ sourceLang, term, relationType, mergeAllowed: false, reviewRequired: true, confidence: proto ? 0.5 : 0.6, depth: ancestryDepth + 1, template: templateName, path });
        else uncertain.push({ template: templateName, reason: 'empty_lang_or_term', path });
        nextDepth += 1;
      } else uncertain.push({ template: templateName, reason: hasLang ? 'lang_without_term' : 'term_without_lang', path });
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key], nextDepth);
  };
  visit(root, [], 0);
  return { relations, uncertain };
}

export function templateRelations(template) {
  const name = String(template?.name || '').trim().toLocaleLowerCase('und');
  const relationPolicy = TEMPLATE_RELATION_POLICY[name];
  if (!relationPolicy) return { relations: [], uncertain: [{ template: name || null, reason: 'unknown_template', path: [] }] };
  if (name === 'etymon' || name === 'ety') return parseStructuredExpansion(template.expansion, name);
  const values = Object.entries(template?.args || {})
    .filter(([key]) => /^\d+$/.test(key))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => String(value || ''));
  if (values.length < 2) return { relations: [], uncertain: [{ template: name, reason: 'missing_positional_arguments', path: [] }] };
  const component = relationPolicy.relationType === RELATION_TYPE.COMPOUND_COMPONENT || relationPolicy.relationType === RELATION_TYPE.AFFIX_COMPONENT;
  const sameLanguage = relationPolicy.relationType === RELATION_TYPE.DIRECT_ALLOMORPH;
  const sourceLang = component || sameLanguage ? values[0] : values[1];
  const terms = component ? values.slice(1) : [sameLanguage ? values[1] : values[2]];
  return {
    relations: terms.filter(Boolean).map((term, index) => ({ sourceLang, term, ...relationPolicy, depth: 1, template: name, path: ['args', index + 2] })),
    uncertain: []
  };
}

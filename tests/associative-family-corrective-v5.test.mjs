import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { applyExactControlOverride, buildFamilies, etymologyPairs, etymonKeyDistribution, isMergeEligibleComponent, parseArgs } from '../scripts/build-associative-exhaustive-family-index.mjs';
import { RELATION_TYPE, parseStructuredExpansion, templateRelations } from '../scripts/lib/associative-etymology-policy.mjs';
import { classifyCorpusLemma } from '../scripts/lib/associative-corpus-quality.mjs';

test('corrective build accepts an immutable input-lock artifact', () => {
  const parsed = parseArgs([
    '--candidate-root=/tmp/candidates',
    '--output-root=/tmp/output',
    '--etymology-gzip=/tmp/kaikki.jsonl.gz',
    '--input-lock=/tmp/input-lock.json'
  ]);
  assert.equal(parsed.inputLock, '/tmp/input-lock.json');
});

test('structured expansion never pairs lang and term from adjacent nodes', async () => {
  const fixture = JSON.parse(await readFile('audit/associative-family-v5/parser-fixtures/adjacent-nodes.json', 'utf8'));
  const parsed = parseStructuredExpansion(fixture.expansion);
  assert.deepEqual(parsed.relations, []);
  assert.deepEqual(parsed.uncertain.map(item => item.reason).sort(), ['lang_without_term', 'term_without_lang']);
});

test('malformed and unknown expansion data are review-only', () => {
  assert.equal(parseStructuredExpansion('{broken').uncertain[0].reason, 'malformed_expansion');
  assert.equal(templateRelations({ name: 'future-unknown', args: { 1: 'en', 2: 'x' } }).uncertain[0].reason, 'unknown_template');
});

test('etymon ancestry is typed, depth-aware, and cannot merge', () => {
  const parsed = parseStructuredExpansion({ lang: 'la', term: 'oculus', children: [{ lang: 'ine-pro', term: 'h₃ekʷ-' }] });
  assert.equal(parsed.relations.length, 2);
  assert.equal(parsed.relations[0].relationType, RELATION_TYPE.DISTANT_ANCESTOR);
  assert.equal(parsed.relations[0].mergeAllowed, false);
  assert.equal(parsed.relations[0].depth, 1);
  assert.equal(parsed.relations[1].relationType, RELATION_TYPE.PROTO_RELATION);
  assert.equal(parsed.relations[1].depth, 2);
});

test('direct templates use an explicit typed policy', () => {
  const derived = templateRelations({ name: 'derived from', args: { 1: 'en', 2: 'la', 3: 'oculus' } }).relations[0];
  const borrowed = templateRelations({ name: 'bor', args: { 1: 'en', 2: 'fr', 3: 'oculaire' } }).relations[0];
  const inherited = templateRelations({ name: 'inh', args: { 1: 'fr', 2: 'la', 3: 'oculus' } }).relations[0];
  const compound = templateRelations({ name: 'compound', args: { 1: 'en', 2: 'eye', 3: 'ball' } }).relations;
  assert.deepEqual([derived.relationType, borrowed.relationType, inherited.relationType], [RELATION_TYPE.DIRECT_DESCENDANT, RELATION_TYPE.BORROWED_FORM, RELATION_TYPE.INHERITED_FORM]);
  assert.equal(derived.mergeAllowed, true);
  assert.equal(compound.every(item => item.relationType === RELATION_TYPE.COMPOUND_COMPONENT && item.mergeAllowed === false), true);
});

test('etymologyPairs preserves uncertain evidence instead of inventing equivalence', () => {
  const parsed = etymologyPairs({ etymology_templates: [{ name: 'ety', expansion: JSON.stringify([{ lang: 'la' }, { term: 'valeo' }]) }] });
  assert.equal(parsed.relations.length, 0);
  assert.equal(parsed.uncertain.length, 2);
});

test('exact seed claims do not absorb an automatic family transitively', () => {
  const nonProto = new Map([['de:wasser', { roots: new Set(['en:alter', 'de:wasser']), relationTypes: new Set([RELATION_TYPE.DIRECT_DESCENDANT]), evidence: [] }]]);
  const roots = { en: new Map([['alter', 3]]), de: new Map([['wasser', 5]]) };
  const built = buildFamilies(nonProto, new Map(), roots);
  assert.deepEqual([...built.nodeToFamilies.get('en:alter')], ['family:alter']);
  assert.equal(built.nodeToFamilies.has('de:wasser'), false);
  assert.deepEqual(built.families.get('family:alter').root_nodes, ['en:alter']);
});

test('short accidental prefix cannot anchor valkyrie and walkure equivalence', () => {
  assert.equal(isMergeEligibleComponent('valkyrie', { root: 'val' }), false);
  assert.equal(isMergeEligibleComponent('Walküre', { root: 'walkure' }), true);
  assert.equal(isMergeEligibleComponent('pedal', { root: 'ped' }), true);
});

test('automatic canonical scoring rejects a two-letter accidental anchor', () => {
  const nonProto = new Map([['la:oculus', { roots: new Set(['en:il', 'fr:oculaire']), relationTypes: new Set([RELATION_TYPE.INHERITED_FORM]), evidence: [] }]]);
  const built = buildFamilies(nonProto, new Map(), { en: new Map([['il', 2]]), fr: new Map([['oculaire', 2]]) });
  const automatic = [...built.families.values()].find(family => family.id.startsWith('ety:'));
  assert.equal(automatic.canonical, 'oculaire');
  assert.equal(automatic.canonical_selection.method, 'quality_score_v1');
});

test('known audit noise and generic markup are rejected deterministically', () => {
  assert.deepEqual(classifyCorpusLemma('pediatricianand').status, 'rejected');
  assert.deepEqual(classifyCorpusLemma('https://noise.example').status, 'rejected');
  assert.deepEqual(classifyCorpusLemma('ocular').status, 'accepted');
});

test('etymon-key distribution is deterministic and exposes the long tail', () => {
  const records = new Map([1, 2, 3, 26, 101, 25001].map((size, index) => [`key:${index}`, { roots: new Set(Array.from({ length: size }, (_, i) => `en:r${i}`)) }]));
  const result = etymonKeyDistribution(records);
  assert.equal(result.keys, 6);
  assert.equal(result.maximum, 25001);
  assert.equal(result.histogram['26-50'], 1);
  assert.equal(result.histogram['101-250'], 1);
  assert.equal(result.histogram['25001+'], 1);
});

test('wide etymon keys are review-only and never create automatic families', () => {
  const roots = new Set(Array.from({ length: 11 }, (_, index) => `en:root${index}`));
  const result = buildFamilies(new Map([['la:wide', { roots, relationTypes: new Set(['inherited_form']), evidence: [] }]]), new Map(), { en: new Map([...roots].map(node => [node.slice(3), 1])) });
  assert.equal([...result.families.keys()].some(id => id.startsWith('ety:')), false);
  assert.equal(result.wideReview.length, 1);
  assert.equal(result.wideReview[0].review_status, 'needs_review');
});

test('exact language-aware controls replace stale automatic memberships before materialization', () => {
  const stale = [{ surface: 'manufacture', canonical_candidate: 'fact', family_ids: ['ety:stale-a', 'ety:stale-b'], confidence: 0.8, evidence: [] }];
  const families = new Map([['family:manu', { canonical: 'manu' }]]);
  const result = applyExactControlOverride({ language: 'en', word: 'manufacture', searchForm: 'manufacture', componentRows: stale, families });
  assert.equal(result.familyId, 'family:manu');
  assert.deepEqual(result.componentRows[0].family_ids, ['family:manu']);
  assert.equal(result.componentRows[0].evidence[0].type, 'manual_override');
  assert.equal(applyExactControlOverride({ language: 'de', word: 'manufacture', searchForm: 'manufacture', componentRows: stale, families }).familyId, null);
});

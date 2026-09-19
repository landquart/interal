import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverLexicalComponents } from '../associativvordes/js/morphology/analyzer.js';
import { registerVerifiedLexicalRoots, clearLexicalRootIndexForTests } from '../associativvordes/js/morphology/lexical-root-index.js';
import { FamilyGraph, FAMILY_EDGE, nullDictionary, stableLemmaId } from '../scripts/lib/associative-family-graph.mjs';
import { FamilyIndexLoader, familyBucket } from '../associativvordes/js/family-index-loader.js';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';
import { createCandidateIndexLoader } from '../associativvordes/js/candidate-index-loader.js';
const evidence = type => ({ type, source: 'test', path: ['a','b'], confidence: 1 });
test('discovers every compound component', () => { clearLexicalRootIndexForTests(); registerVerifiedLexicalRoots('en',['pedi','cure']); assert.deepEqual(discoverLexicalComponents('pedicure','en').components.map(x=>x.canonical_candidate).sort(),['cure','pedi']); });
test('surface fallback preserves complete coverage', () => { clearLexicalRootIndexForTests(); assert.equal(discoverLexicalComponents('xyzzy','en').components[0].source,'surface_fallback'); });
test('compound containment never merges families', () => { const g=new FamilyGraph(); g.addBranch({id:'tele',form:'tele'}); g.addBranch({id:'phone',form:'phone'}); g.addEdge('word:telephone','tele',FAMILY_EDGE.CONTAINS_COMPONENT,evidence('compound_morphology')); g.addEdge('word:telephone','phone',FAMILY_EDGE.CONTAINS_COMPONENT,evidence('compound_morphology')); assert.equal(g.materializeFamilies().length,2); });
test('proto relation never merges families', () => { const g=new FamilyGraph(); g.addBranch({id:'a',form:'alpha'}); g.addBranch({id:'b',form:'beta'}); g.addEdge('a','b',FAMILY_EDGE.PROTO_RELATION,evidence('proto_relation')); assert.equal(g.materializeFamilies().length,2); });
test('equivalence requires linguistic evidence', () => { const g=new FamilyGraph(); g.addBranch({id:'alter',form:'alter'}); g.addBranch({id:'altru',form:'altru'}); assert.throws(()=>g.addEdge('alter','altru',FAMILY_EDGE.EQUIVALENT_BRANCH,evidence('string_similarity'))); g.addEdge('alter','altru',FAMILY_EDGE.EQUIVALENT_BRANCH,evidence('derivational_chain')); assert.equal(g.materializeFamilies().length,1); });
test('lemma IDs are stable and language scoped', () => { assert.equal(stableLemmaId('en','liberty'),stableLemmaId('en','liberty')); assert.notEqual(stableLemmaId('en','liberty'),stableLemmaId('fr','liberty')); });
test('lexical aliases cannot collide with JavaScript object prototypes', () => { const lookup=nullDictionary(); for (const alias of ['constructor','prototype','toString']) (lookup[alias] ||= []).push(alias); assert.deepEqual(lookup.constructor,['constructor']); assert.deepEqual(lookup.prototype,['prototype']); assert.deepEqual(lookup.toString,['toString']); });
test('runtime resolves alias to materialized family members', async () => {
  const aliasBucket=familyBucket('ocul'), id='family:ocul', idBucket=familyBucket(id);
  const member = word => ({ lemma_id: word, word, normalized: word, search_form: word, rank: 1, frequency_score: 50, category_breakdown: {}, sources: [{ id: 'test', file: 'test.json', category: 'general', ipm: 1 }], components: [] });
  const data={ 'manifest.json':{version:'4',languages:['en'],sharding:{alias_template:'aliases/{bucket}.json',family_template:'families/{bucket}.json',member_template:'members/{language}/{bucket}.json'}}, [`aliases/${aliasBucket}.json`]:{ocul:[id]}, [`families/${idBucket}.json`]:{[id]:{id,canonical:'ocul',aliases:['ocul'],verified:true}}, [`members/en/${idBucket}.json`]:{[id]:[member('ocular'),member('monocle')]} };
  const loader=new FamilyIndexLoader({baseUrl:'/family-index',fetchJson:async url=>data[url.replace('/family-index/','')]});
  assert.deepEqual(await loader.resolveAlias('ocul'),[id]); assert.equal((await loader.family(id)).canonical,'ocul'); assert.deepEqual((await loader.members(id,'en')).map(x=>x.lemma_id),['ocular','monocle']);
  const entries = await loader.candidateEntries('ocul','en');
  assert.deepEqual(entries.map(x=>x.word), ['ocular','monocle']);
  assert.deepEqual(findCandidatesForRoot({ entries, root: 'ocul', language: 'en', groupModels: false }).candidates.map(x=>x.word), ['monocle','ocular']);
});
test('candidate loader prefers the exhaustive family index over literal static search', async () => {
  const familyEntry = { lemma_id: 'monocle', word: 'monocle', normalized: 'monocle', search_form: 'monocle', rank: 10, frequency_score: 60, category_breakdown: {}, sources: [{ id: 'test', file: 'test.json', category: 'general', ipm: 2 }], components: [{ canonical_candidate: 'ocul' }], family_id: 'family:ocul', family_canonical: 'ocul', family_aliases: ['ocul'], family_verified: true, family_indexed: true };
  let staticFetches = 0;
  const loader = createCandidateIndexLoader({
    fetch: async () => { staticFetches += 1; throw new Error('static index must not be fetched'); },
    familyIndexLoader: { candidateEntries: async () => [familyEntry] }
  });
  const entries = await loader.loadCandidateEntries('en', 'ocul');
  assert.equal(staticFetches, 0);
  assert.equal(entries[0].word, 'monocle');
  assert.equal(loader.getCandidateIndexDiagnostics().familyIndexStatus, 'loaded');
});
test('family runtime fails closed before fetching an excessive alias fan-out', async () => {
  const ids = Array.from({ length: 26 }, (_, index) => `family:${index}`);
  const aliasBucket = familyBucket('act');
  let familyFetches = 0;
  const data = { 'manifest.json': { version: '4', languages: ['en'], sharding: { alias_template: 'aliases/{bucket}.json', family_template: 'families/{bucket}.json', member_template: 'members/{language}/{bucket}.json' } }, [`aliases/${aliasBucket}.json`]: { act: ids } };
  const loader = new FamilyIndexLoader({ baseUrl: '/family-index', fetchJson: async url => { const path = url.replace('/family-index/', ''); if (path.startsWith('families/') || path.startsWith('members/')) familyFetches += 1; return data[path]; } });
  await assert.rejects(loader.candidateEntries('act', 'en'), /fan-out 26 exceeds runtime limit 25/);
  assert.equal(familyFetches, 0);
});
test('manual override is language-aware and never exposes stale non-manual members', async () => {
  const aliasBucket = familyBucket('ocul'), manualId = 'family:ocul', automaticId = 'ety:ocul';
  const ids = [manualId, automaticId].sort();
  const member = (word, manual = false) => ({ lemma_id: word, word, normalized: word, search_form: word, frequency_score: 50, sources: [{ id: 'test' }], components: [{ evidence: manual ? [evidence('manual_override')] : [evidence('inheritance')] }] });
  const familyShards = {}, memberShards = {};
  for (const family of [{ id: manualId, source: 'methodology_seed+manual_override', review_status: 'verified' }, { id: automaticId, source: 'etymology', review_status: 'needs_review' }]) {
    const bucket = familyBucket(family.id);
    (familyShards[`families/${bucket}.json`] ||= {})[family.id] = { ...family, canonical: 'ocul', aliases: ['ocul'] };
    (memberShards[`members/fr/${bucket}.json`] ||= {})[family.id] = family.id === manualId ? [member('oculaire', true), member('dutheillet')] : [member('oeil')];
  }
  const data = { 'manifest.json': { version: '4', languages: ['fr'], sharding: { alias_template: 'aliases/{bucket}.json', family_template: 'families/{bucket}.json', member_template: 'members/{language}/{bucket}.json' } }, [`aliases/${aliasBucket}.json`]: { ocul: ids }, ...familyShards, ...memberShards };
  const loader = new FamilyIndexLoader({ baseUrl: '/family-index', fetchJson: async url => data[url.replace('/family-index/', '')] });
  assert.deepEqual((await loader.candidateEntries('ocul', 'fr')).map(item => item.word), ['oculaire']);
});
test('blocked, rejected, and split-required families never reach runtime candidates', async () => {
  for (const review_status of ['blocked_from_runtime', 'rejected', 'split_required']) {
    const aliasBucket = familyBucket('alter'), id = `family:${review_status}`, idBucket = familyBucket(id);
    const data = { 'manifest.json': { version: '4', languages: ['de'], sharding: { alias_template: 'aliases/{bucket}.json', family_template: 'families/{bucket}.json', member_template: 'members/{language}/{bucket}.json' } }, [`aliases/${aliasBucket}.json`]: { alter: [id] }, [`families/${idBucket}.json`]: { [id]: { id, canonical: 'alter', aliases: ['alter'], source: 'etymology', review_status } } };
    const loader = new FamilyIndexLoader({ baseUrl: '/family-index', fetchJson: async url => data[url.replace('/family-index/', '')] });
    assert.deepEqual(await loader.candidateEntries('alter', 'de'), []);
  }
});

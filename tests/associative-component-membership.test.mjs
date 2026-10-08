import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FamilyIndexLoader } from '../associativvordes/js/family-index-loader.js';
import { isExplicitComponentControl } from '../associativvordes/js/associative-component-controls.js';
import { templateRelations } from '../scripts/lib/associative-etymology-policy.mjs';

const member = (word, evidence, status = 'accepted') => ({ lemma_id: `lemma:${word}`, word, corpus_quality: { status }, components: [{ evidence: [{ type: evidence }] }] });
function loader({ language = 'en', familyId = 'family:inter', status = 'manually_verified', members } = {}) {
  const family = { id: familyId, canonical: 'inter', source: 'methodology_seed+manual_override', aliases: ['inter'], review_status: status };
  return new FamilyIndexLoader({ fetchJson: async path => {
    if (path.endsWith('manifest.json')) return { version: '5', languages: ['en', 'fr'], sharding: { alias_template: 'aliases/{bucket}', family_template: 'families/{bucket}', member_template: 'members/{language}/{bucket}' } };
    if (path.includes('/aliases/')) return { inter: [familyId] };
    if (path.includes('/families/')) return { [familyId]: family };
    if (path.includes(`/members/${language}/`)) return { [familyId]: members };
    return {};
  } });
}

test('reviewed prepositional compounds survive curated precedence without approving substring peers', async () => {
  const members = [member('international', 'manual_override'), ...['interval', 'internet', 'midwinter', 'teleprinter', 'splinter', 'internetthis', 'intervai'].map(w => member(w, 'verified_seed_alias'))];
  const before = JSON.stringify(members);
  const result = await loader({ members }).candidateEntries('inter', 'en');
  assert.deepEqual(result.map(m => m.word), ['international', 'interval', 'internet']);
  assert.equal(JSON.stringify(members), before);
  assert(result.every(m => m.family_id === 'family:inter'));
});
test('component controls cannot cross language, family, or rejected corpus status', async () => {
  assert.equal(isExplicitComponentControl('family:inter', 'fr', 'internet'), false);
  assert.equal(isExplicitComponentControl('family:other', 'en', 'internet'), false);
  assert.equal(isExplicitComponentControl('family:inter', 'en', 'Internet'), false);
  const members = [member('internet', 'verified_seed_alias', 'rejected'), member('interval', 'verified_seed_alias')];
  assert.deepEqual((await loader({ members }).candidateEntries('inter', 'en')).map(m => m.word), ['interval']);
  assert.deepEqual(await loader({ members, status: 'blocked_from_runtime' }).candidateEntries('inter', 'en'), []);
});
test('component templates request membership review while keeping whole-lemma union disabled', () => {
  for (const name of ['compound', 'confix', 'blend', 'af', 'affix', 'prefix', 'suffix']) {
    const { relations } = templateRelations({ name, args: { 1: 'en', 2: 'inter-', 3: 'national' } });
    assert.equal(relations.length, 2);
    assert(relations.every(r => r.mergeAllowed === false && r.reviewRequired === true), name);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const base = 'audit/associative-family-v5/';
const stage = base + 'reflex-continuation-20261002/';
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const inventory = json(stage + 'inventory.json');
const oldBytes = readFileSync(base + 'reflex-checkpoint-20261001/linguistic-decisions.json');
assert.equal(sha(oldBytes), inventory.source_decision_sha256);
const candidateBytes = readFileSync(base + 'reflex-checkpoint-20261001/candidates.json.gz');
assert.equal(sha(candidateBytes), inventory.source_candidate_sha256);
for (const [p, hash] of Object.entries(inventory.artifact_sha256)) {
  assert.equal(sha(readFileSync(stage + p)), hash, p);
}
const old = JSON.parse(oldBytes);
const unresolved = new Map();
const key = m => `${m.language}/${m.canonical_root}/${m.lemma_id}`;
for (const [language, roots] of Object.entries(old.decisions)) {
  for (const [canonical_root, rows] of Object.entries(roots)) {
    for (const m of rows.filter(m => m.status === 'uncertain')) {
      unresolved.set(key({ ...m, language, canonical_root }), m);
    }
  }
}
const reviewed = json(stage + 'decisions.json').decisions;
const pending = json(stage + 'pending-review.json').records;
const all = [...reviewed, ...pending];
assert.equal(all.length, unresolved.size);
assert.equal(new Set(all.map(key)).size, unresolved.size);
for (const m of all) {
  const prior = unresolved.get(key(m));
  assert.ok(prior, key(m));
  assert.equal(m.word, prior.word);
  assert.deepEqual(m.source_family_ids, prior.source_family_ids);
  assert.equal(m.previous_status, 'uncertain');
}
const candidates = JSON.parse(gunzipSync(candidateBytes));
const proof = JSON.parse(gunzipSync(readFileSync(stage + 'source-records.json.gz'))).records;
assert.equal(proof.length, reviewed.length);
for (const { language, canonical_root, member } of proof) {
  assert.deepEqual(member, candidates[language][canonical_root].find(m => m.lemma_id === member.lemma_id));
}
// A spelling-only exclusion would wrongly remove the informative homonym.
for (const word of ['informell', 'informelle', 'informelleren']) {
  const m = reviewed.find(m => m.language === 'de' && m.word === word);
  assert.equal(m.status, 'uncertain');
  assert.ok(m.source_references.includes('https://www.duden.de/rechtschreibung/informell_informierend'));
  assert.equal(m.runtime_applied, false);
}
assert.equal(reviewed.find(m => m.word === 'mathématiques-informatique').status, 'accepted');
assert.equal(reviewed.find(m => m.word === 'inaf-osservatorio').status, 'accepted');
assert.equal(reviewed.find(m => m.word === 'informicoliti').status, 'excluded');
assert.equal(inventory.runtime_changes, false);
assert.equal(inventory.full_family_certification, false);
console.log('Reflex continuation: 762 original IDs conserved, source metadata intact, homonyms withheld.');

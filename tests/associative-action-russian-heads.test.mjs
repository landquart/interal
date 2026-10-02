import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const base = 'audit/associative-family-v5/';
const stage = base + 'action-russian-heads-20261002/';
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const inventory = json(stage + 'inventory.json');
const current = json(stage + 'decisions.json');
for (const [name, hash] of Object.entries(inventory.artifact_sha256)) assert.equal(sha(readFileSync(stage + name)), hash);
const previousBytes = readFileSync(base + 'action-independent-heads-20261002/decisions.json');
assert.equal(sha(previousBytes), current.previous_decision_sha256);
const previous = JSON.parse(previousBytes);
const initial = JSON.parse(gunzipSync(readFileSync(base + 'action-continuation-20261002/linguistic-decisions.json.gz')));
const rows = new Map(initial.decisions.ru.map(m => [m.lemma_id, m]));
const proof = JSON.parse(gunzipSync(readFileSync(stage + 'source-records.json.gz'))).records;
const candidatesBytes = readFileSync(base + 'action-reflex-checkpoint-20261001/ru-candidates.json.gz');
assert.equal(sha(candidatesBytes), current.source_candidate_sha256);
const candidates = JSON.parse(gunzipSync(candidatesBytes)).act;
assert.equal(proof.length, current.decisions.length);
assert.equal(new Set(current.decisions.map(m => m.lemma_id)).size, current.decisions.length);
for (const m of current.decisions) {
  const old = rows.get(m.lemma_id);
  assert.equal(old.status, 'pending_review');
  assert.equal(old.word, m.word);
  assert.deepEqual(old.source_family_ids, m.source_family_ids);
  const record = proof.find(p => p.lemma_id === m.lemma_id);
  assert.deepEqual(record, candidates.find(p => p.lemma_id === m.lemma_id));
  assert.equal(m.status, 'excluded');
  assert.equal(m.runtime_applied, false);
}
const n = current.decisions.length;
for (const [language, counts] of Object.entries(current.counts)) {
  const expected = structuredClone(previous.counts[language]);
  if (language === 'ru') { expected.pending_review -= n; expected.excluded += n; }
  assert.deepEqual(counts, expected);
}
assert.equal(Object.values(current.counts).reduce((sum, counts) => sum + Object.values(counts).reduce((s, n) => s + n, 0), 0), 52277);
// A pure lact branch must not swallow a separately recognizable activist blend.
assert.ok(!current.decisions.some(m => m.word === 'лактивист' || m.word === 'активный' || m.word === 'реактор'));
assert.equal(current.decisions.find(m => m.word === 'пролактин').lexical_head, 'пролактин');
assert.equal(current.counts.ru.accepted, previous.counts.ru.accepted);
assert.equal(current.full_family_certification, false);
console.log('Russian action review: exact source records retained, 40 independent heads excluded, all prior positives conserved.');

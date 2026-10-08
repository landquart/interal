import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const base = 'audit/associative-family-v5/';
const stage = base + 'action-independent-heads-20261002/';
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const inventory = json(stage + 'inventory.json');
for (const [p, hash] of Object.entries(inventory.artifact_sha256)) {
  assert.equal(sha(readFileSync(stage + p)), hash);
}
const initialBytes = readFileSync(base + 'action-continuation-20261002/linguistic-decisions.json.gz');
const initial = JSON.parse(gunzipSync(initialBytes));
const previousBytes = readFileSync(base + 'action-italian-stage-20261002/decisions.json');
assert.equal(sha(previousBytes), inventory.previous_decision_sha256);
const previous = JSON.parse(previousBytes);
const current = json(stage + 'decisions.json');
assert.equal(sha(initialBytes), current.initial_continuation_sha256);
const states = new Map();
const key = m => `${m.language}/${m.lemma_id}`;
for (const [language, rows] of Object.entries(initial.decisions)) {
  for (const m of rows) states.set(key({ ...m, language }), { ...m, language });
}
const positiveBefore = [...states.entries()].filter(([, m]) => m.status === 'accepted');
for (const delta of [previous.decisions, current.decisions]) {
  for (const m of delta) {
    const prior = states.get(key(m));
    assert.ok(prior);
    assert.equal(prior.status, m.previous_status);
    assert.equal(prior.word, m.word);
    assert.deepEqual(prior.source_family_ids, m.source_family_ids);
    states.set(key(m), { ...prior, ...m });
  }
}
assert.equal(states.size, 52277);
const counts = {};
for (const m of states.values()) {
  counts[m.language] ??= {};
  counts[m.language][m.status] = (counts[m.language][m.status] ?? 0) + 1;
}
for (const [language, cs] of Object.entries(current.counts)) {
  for (const [status, n] of Object.entries(cs)) assert.equal(counts[language][status] ?? 0, n);
}
for (const [k, m] of positiveBefore) assert.deepEqual(states.get(k), m);
const proof = JSON.parse(gunzipSync(readFileSync(stage + 'source-records.json.gz'))).records;
assert.equal(proof.length, current.decisions.length);
const candidates = {};
for (const lang of ['en', 'fr']) {
  candidates[lang] = JSON.parse(gunzipSync(readFileSync(base + `action-reflex-checkpoint-20261001/${lang}-candidates.json.gz`))).act;
}
for (const { language, member } of proof) {
  assert.deepEqual(member, candidates[language].find(m => m.lemma_id === member.lemma_id));
}
// 'action' letters inside these heads do not constitute lexical action.
for (const word of ['fraction', 'attraction', 'abstraction', 'exaction', 'satisfaction']) {
  assert.equal(current.decisions.find(m => m.language === 'en' && m.word === word).status, 'excluded');
}
assert.ok(!current.decisions.some(m => m.word === 'transaction' || m.word === 'reaction' || m.word === 'action'));
assert.equal(inventory.membership_changes, 0);
assert.equal(current.runtime_applied_record_count, 2098);
assert.equal(current.full_family_certification, false);
console.log('Action head delta: 52,277 IDs conserved; earlier positives and complete source records preserved.');

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs, stratifiedSelection } from '../scripts/sample-associative-family-memberships.mjs';

test('semantic sample locks its input and requested size', () => {
  const options = parseArgs(['--root=/input', '--output=/output', '--seed=fixed', '--per-language=1600', '--pre-sample=24000']);
  assert.equal(options.root, '/input');
  assert.equal(options.output, '/output');
  assert.equal(options.seed, 'fixed');
  assert.equal(options.perLanguage, 1600);
  assert.equal(options.legacyPreSample, 24000);
});

test('stratified selection is deterministic and visits distinct strata first', () => {
  const base = {
    language: 'en', family_source: 'surface_singleton', family_support: 1,
    alias_fanout: 1, review_status: 'safe_automatic', canonical_length: 5,
    frequency_score: 0.5, evidence_types: ['surface'], relation_types: [],
    word_structure: 'simple', corpus_quality: { status: 'accepted' }
  };
  const values = [
    { ...base, sample_id: 'a', selection_hash: '01' },
    { ...base, sample_id: 'b', selection_hash: '02' },
    { ...base, sample_id: 'c', selection_hash: '03', review_status: 'needs_review' }
  ];
  assert.deepEqual(stratifiedSelection(values, 2).map(item => item.sample_id), ['a', 'c']);
});

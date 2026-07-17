import assert from 'node:assert/strict';
import { renderCandidateEvidenceDetails, summarizeCandidateSources } from '../associativvordes/js/render-results.js';

const sources = [
  { id: 'en:web:1', file: '/absolute/not-shown/web-1.tsv', category: 'web', ipm: 2 },
  { id: 'en:web:2', file: 'relative/web-2.tsv', category: 'web', ipm: 3.25 },
  { id: 'en:norm:1', file: 'normative/<script>.tsv', category: 'normative', ipm: 1.5 }
];

const summary = summarizeCandidateSources(sources);
assert.equal(summary.count, 3);
assert.deepEqual(summary.ipmByCategory, { web: 5.25, normative: 1.5 });
assert.deepEqual(summary.categories, ['web', 'normative']);
assert.deepEqual(summary.warnings, []);

const html = renderCandidateEvidenceDetails({
  word: 'alteration',
  frequency_score: 60,
  sources,
  match: { type: 'exact', fragment: '<alter>', distance: 0, similarity: 1 }
}, {}, 'en', { sourceLimit: 3 });
assert(html.includes('web-1.tsv'));
assert(!html.includes('/absolute/not-shown'));
assert(html.includes('web corpus: 5.250'));
assert(html.includes('normative corpus: 1.500'));
assert(html.includes('IPM 3.250'));
assert(html.includes('&lt;script&gt;.tsv'));
assert(!html.includes('<script>.tsv'));
assert(html.includes('&lt;alter&gt;'));

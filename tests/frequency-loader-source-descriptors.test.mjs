import assert from 'node:assert/strict';
import { LANGUAGE_SOURCES } from '../associativvordes/js/config-frequency-sources.js';
import { getFrequencyProfile } from '../associativvordes/js/frequency-loader.js';
import { normalizeLanguageSource } from '../associativvordes/js/language-source-descriptor.js';

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function makeFetch(routes) {
  const calls = [];
  const fetch = async url => {
    calls.push(String(url));
    return routes[String(url)] ?? jsonResponse({}, 404);
  };
  fetch.calls = calls;
  return fetch;
}

assert.deepEqual(normalizeLanguageSource('subtitles', 'plain.json'), {
  fileName: 'plain.json',
  sourceId: 'subtitles/plain.json',
  category: 'subtitles',
  optional: false
}, 'string source descriptors normalize to a required bare filename');
assert.deepEqual(normalizeLanguageSource('subtitles', { file: 'object.json', optional: true }), {
  fileName: 'object.json',
  sourceId: 'subtitles/object.json',
  category: 'subtitles',
  optional: true
}, 'object source descriptors normalize to an optional bare filename');
assert.throws(() => normalizeLanguageSource('web', 'https://example.test/file.json'), /must not be a URL/);
assert.throws(() => normalizeLanguageSource('web', '../file.json'), /parent traversal|directory separators/);
assert.throws(() => normalizeLanguageSource('web', 'dir/file.json'), /directory separators/);

const originalFetch = globalThis.fetch;
try {
  LANGUAGE_SOURCES.zz = {
    subtitles: [
      'string-source.json',
      { file: 'object-source.json', optional: true }
    ],
    normative: [
      'required-missing.json',
      { file: 'optional-missing.json', optional: true }
    ],
    web: [],
    mixed: []
  };

  const fetch = makeFetch({
    './frequency lists/zz/string-source.json': jsonResponse({ word: 12 }),
    './frequency lists/zz/object-source.json': jsonResponse({ word: 6 }),
    './frequency lists/zz/required-missing.json': jsonResponse({}, 404),
    './frequency lists/zz/optional-missing.json': jsonResponse({}, 404)
  });
  globalThis.fetch = fetch;
  const profile = await getFrequencyProfile('zz', 'word');

  assert.ok(fetch.calls.includes('./frequency lists/zz/string-source.json'), 'string source forms the correct URL');
  assert.ok(fetch.calls.includes('./frequency lists/zz/object-source.json'), 'object source forms the correct URL from file');
  assert.equal(fetch.calls.some(url => url.includes('[object%20Object]') || url.includes('[object Object]')), false, 'no URL contains [object Object]');
  assert.deepEqual(profile.category_breakdown.subtitles.ipm_values, [12, 6], 'subtitles keeps one IPM value per source descriptor');
  assert.deepEqual(profile.category_breakdown.normative.ipm_values, [0, 0], 'missing required and optional sources both contribute zero IPM values at runtime');
  assert.ok(profile.warnings.some(warning => warning.includes('Required frequency file unavailable: zz/normative/required-missing.json (HTTP 404)')), 'required source diagnostics identify required files');
  assert.ok(profile.warnings.some(warning => warning.includes('Optional frequency file unavailable: zz/normative/optional-missing.json (HTTP 404)')), 'optional source diagnostics identify optional files');

  const enFetch = makeFetch({
    './frequency lists/en/hermit_2016_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json': jsonResponse({ manualenglishcandidate: 8 }),
    './frequency lists/en/hermit_2018_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json': jsonResponse({ manualenglishcandidate: 6 }),
    './frequency lists/en/bnc-clean2.lemmatized_spacy_ipm6.json': jsonResponse({ manualenglishcandidate: 4 }),
    './frequency lists/en/sorted.uk.lemma.unigrams.cleaned_recommended_min100_ipm6.json': jsonResponse({ manualenglishcandidate: 2 })
  });
  globalThis.fetch = enFetch;
  const enProfile = await getFrequencyProfile('en', 'manualenglishcandidate');
  assert.deepEqual(enFetch.calls, [
    './frequency lists/en/hermit_2016_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
    './frequency lists/en/hermit_2018_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
    './frequency lists/en/bnc-clean2.lemmatized_spacy_ipm6.json',
    './frequency lists/en/sorted.uk.lemma.unigrams.cleaned_recommended_min100_ipm6.json'
  ], 'manual English candidate fetches all four English frequency files');
  assert.deepEqual(enProfile.category_breakdown.subtitles.ipm_values, [8, 6], 'English subtitles category contains two source values');
  assert.equal(enFetch.calls.some(url => url.includes('[object%20Object]') || url.includes('[object Object]')), false, 'English source URLs never contain [object Object]');
} finally {
  delete LANGUAGE_SOURCES.zz;
  globalThis.fetch = originalFetch;
}

console.log('frequency-loader source descriptor tests passed');

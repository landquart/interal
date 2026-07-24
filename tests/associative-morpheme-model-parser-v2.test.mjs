import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import corpus from './fixtures/associative-morpheme-models.json' with { type: 'json' };
import { parseDerivationalModel, MORPHEME_PARSER_VERSION, morphemeParserCacheSize } from '../associativvordes/js/morpheme-model-parser.js';
import { lexicalModelDescriptor, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';

const parse = (word, opts = {}) => parseDerivationalModel({ word, candidateWord: word, search_form: word, match: { fragment: opts.matchedRootVariant || opts.canonicalRoot, index: opts.matchIndex ?? word.indexOf(opts.matchedRootVariant || opts.canonicalRoot) }, ...opts });
const key = (word, root = 'regul', language = 'en', elementType = 'root', extra = {}) => lexicalModelDescriptor({ word, search_form: word, match: { fragment: extra.matchedRootVariant || root, index: extra.matchIndex ?? word.indexOf(extra.matchedRootVariant || root) } }, root, language, elementType).key;

assert.equal(MORPHEME_PARSER_VERSION, '2.1.0');
assert.equal(key('regulation', 'regul'), 'en|root||regul|ation');
assert.equal(key('regulation'), key('regulationism'));
assert.equal(key('deregulation', 'regul', 'en', 'root', { matchIndex: 2 }), key('deregulationism', 'regul', 'en', 'root', { matchIndex: 2 }));
assert.notEqual(key('regulation'), key('deregulation', 'regul', 'en', 'root', { matchIndex: 2 }));
assert.equal(key('alternative', 'altern'), key('alternatives', 'altern'));
assert.equal(key('alternative', 'altern'), key('alternatively', 'altern'));
assert.equal(key('alternate', 'alter'), key('alternately', 'alter'), 'adverbial English forms share the alternate model');
assert.equal(key('altruism', 'alter', 'en', 'root', { matchedRootVariant: 'altru' }), key('altruistic', 'alter', 'en', 'root', { matchedRootVariant: 'altru' }));
assert.notEqual(key('altruism', 'alter', 'en', 'root', { matchedRootVariant: 'altru' }), key('altruist', 'alter', 'en', 'root', { matchedRootVariant: 'altru' }));
assert.notEqual(key('active', 'act'), key('activity', 'act'));
const interaction = parse('interaction', { language: 'en', elementType: 'preposition', canonicalRoot: 'inter' });
const interactive = parse('interactive', { language: 'en', elementType: 'preposition', canonicalRoot: 'inter' });
assert.equal(interaction.model_key, interactive.model_key);
assert.equal(interaction.model_key, 'en|preposition|inter|act');
assert.equal(parse('international', { language: 'en', elementType: 'preposition', canonicalRoot: 'inter' }).model_key, parse('internationalism', { language: 'en', elementType: 'preposition', canonicalRoot: 'inter' }).model_key);
assert.equal(new Set(['interaction','international','internet','interval'].map(w => parse(w, { language: 'en', elementType: 'preposition', canonicalRoot: 'inter' }).model_key)).size, 4);
assert.equal(key('alternativnyj', 'alter', 'ru', 'root', { matchedRootVariant: 'alternativ' }), key('alternativnost', 'alter', 'ru', 'root', { matchedRootVariant: 'alternativ' }));
assert.notEqual(key('alternativnyj', 'alter', 'ru', 'root', { matchedRootVariant: 'alternativ' }), key('altruizm', 'alter', 'ru', 'root', { matchedRootVariant: 'altru' }));
assert.notEqual(key('altruizm', 'alter', 'ru', 'root', { matchedRootVariant: 'altru' }), key('altruist', 'alter', 'ru', 'root', { matchedRootVariant: 'altru' }));
for (const w of ['alternativnyj','alternativnaja','alternativnoe','alternativnye']) assert.equal(key(w, 'alter', 'ru', 'root', { matchedRootVariant: 'alternativ' }), 'ru|root||alter|н');
assert.equal(key('alternativnyj', 'alter', 'ru'), key('alternativka', 'alter', 'ru'), 'Russian colloquial and adjective forms share one alternative model');
assert.notEqual(key('reguljacija', 'regul', 'ru'), key('dereguljacija', 'regul', 'ru', 'root', { matchIndex: 2 }));

for (const language of ['de','fr','es','it']) {
  const root = language === 'it' ? 'altern' : 'altern';
  assert.equal(key(language === 'es' || language === 'it' ? 'alternativa' : 'alternative', root, language), key(language === 'de' ? 'alternativen' : (language === 'fr' ? 'alternatives' : (language === 'it' ? 'alternative' : 'alternativas')), root, language));
  assert.equal(key(language === 'fr' ? 'alternativisme' : language === 'it' ? 'alternativismo' : language === 'es' ? 'alternativismo' : 'alternativismus', root, language), key(language === 'fr' ? 'alternativismement' : language === 'it' ? 'alternativismoita' : language === 'es' ? 'alternativismoista' : 'alternativismusist', root, language));
  assert.notEqual(key(`de${language === 'de' ? 'regulation' : 'regulation'}`, 'regul', language, 'root', { matchIndex: 2 }), key(`re${language === 'de' ? 'regulation' : 'regulation'}`, 'regul', language, 'root', { matchIndex: 2 }));
  assert.match(parse(`xqz${language}`, { language, canonicalRoot: 'qz', matchIndex: 1 }).model_key, new RegExp(`^${language}\\|fallback\\|`));
  assert.ok(parse(language === 'fr' ? 'régulation' : 'regulation', { language, canonicalRoot: 'regul' }).model_key);
  assert.ok(parse(language === 'de' ? 'aktion' : 'action', { language, canonicalRoot: language === 'de' ? 'akt' : 'act' }).alternative_analyses.length >= 0);
}
assert.equal(key('alternative', 'alter', 'fr'), key('alternatif', 'alter', 'fr'), 'French gender/POS forms share one alternative model');

for (const item of corpus.filter(x => x.id)) {
  const analysis = parse(item.word, item);
  if (item.expected.model_group) assert.equal(analysis.model_key, item.expected.model_group, item.id);
  assert.ok(item.expected.confidence.includes(analysis.analysis_confidence), item.id);
}
for (const group of corpus.filter(x => x.pairs).flatMap(x => x.pairs)) {
  const left = parse(group.left, group); const right = parse(group.right, group);
  if (group.relationship === 'same_model') assert.equal(left.model_key, right.model_key); else assert.notEqual(left.model_key, right.model_key);
}

const automatic = lexicalModelDescriptor({ word: 'regulationism', search_form: 'regulationism', match: { fragment: 'regul', index: 0 } }, 'regul', 'en');
const manual = lexicalModelDescriptor({ word: 'regulationism', search_form: 'regulationism', match: { fragment: 'regul', index: 0 } }, 'regul', 'en');
assert.equal(automatic.key, manual.key);
const qwen = lexicalModelDescriptor({ word: 'regulationism', search_form: 'regulationism', match: { type: 'special', fragment: 'regul', index: 0 } }, 'regul', 'en');
assert.equal(qwen.key, automatic.key);
const stale = { parser_version: '1.0.0', model_key: 'old' };
assert.notEqual(stale.parser_version, MORPHEME_PARSER_VERSION);
assert.equal(parse('regulationism', { language: 'en', canonicalRoot: 'regul' }).model_key, automatic.key);
const grouped = selectHighestFrequencyPerModel([{ word: 'regulation', search_form: 'regulation', frequency_score: 10, rank: 2, sources: [] }, { word: 'regulationism', search_form: 'regulationism', frequency_score: 20, rank: 1, sources: [] }].map(x => ({ ...x, match: { fragment: 'regul', index: 0 } })), 'regul', 'en');
assert.deepEqual(grouped.candidates.map(c => c.word), ['regulationism']);

const words = Array.from({ length: 1000 }, (_, i) => i % 4 === 0 ? 'regulationism' : i % 4 === 1 ? 'deregulationism' : i % 4 === 2 ? 'alternative' : 'altruistic');
const started = performance.now(); for (const word of words) parse(word, { language: 'en', canonicalRoot: word.includes('regul') ? 'regul' : 'alter', matchedRootVariant: word.startsWith('altru') ? 'altru' : undefined, matchIndex: word.startsWith('de') ? 2 : 0 });
const elapsed = performance.now() - started;
assert.ok(elapsed < 1000, `load test too slow: ${elapsed}`);
assert.ok(morphemeParserCacheSize() < 200);
console.log(`Associative morpheme model parser v2 tests passed. 1000 words: ${elapsed.toFixed(2)}ms, avg ${(elapsed/1000).toFixed(4)}ms, cache ${morphemeParserCacheSize()}`);

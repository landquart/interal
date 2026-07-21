import assert from 'node:assert/strict';
import { parseMorphemeModel } from '../associativvordes/js/morpheme-model-parser.js';
import { lexicalModelDescriptor, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';

const match = (fragment, index = 0) => ({ type: 'exact', distance: 0, similarity: 1, fragment, index });
const key = (word, root = 'regul', language = 'en', elementType = 'root') => lexicalModelDescriptor({ word, search_form: word, match: match(root, word.indexOf(root)) }, root, language, elementType).key;

assert.equal(key('regulation'), key('regulationism'), 'regulationism keeps the first derivational suffix model');
assert.equal(key('alternative', 'altern'), key('alternatives', 'altern'));
assert.equal(key('alternative', 'altern'), key('alternatively', 'altern'));

const interAction = parseMorphemeModel({ language: 'en', elementType: 'preposition', candidateWord: 'interaction', search_form: 'interaction', matchedRootVariant: 'inter', rootIndex: 0 });
const interActive = parseMorphemeModel({ language: 'en', elementType: 'preposition', candidateWord: 'interactive', search_form: 'interactive', matchedRootVariant: 'inter', rootIndex: 0 });
assert.equal(interAction.model_key, interActive.model_key);
assert.equal(interAction.first_meaningful_derivational_element, 'act');

const international = parseMorphemeModel({ language: 'en', elementType: 'preposition', candidateWord: 'international', search_form: 'international', matchedRootVariant: 'inter', rootIndex: 0 });
const internationalism = parseMorphemeModel({ language: 'en', elementType: 'preposition', candidateWord: 'internationalism', search_form: 'internationalism', matchedRootVariant: 'inter', rootIndex: 0 });
assert.equal(international.model_key, internationalism.model_key);
assert.notEqual(parseMorphemeModel({ language: 'en', elementType: 'preposition', candidateWord: 'internet', search_form: 'internet', matchedRootVariant: 'inter', rootIndex: 0 }).model_key, parseMorphemeModel({ language: 'en', elementType: 'preposition', candidateWord: 'interval', search_form: 'interval', matchedRootVariant: 'inter', rootIndex: 0 }).model_key);

assert.equal(key('alternativnyj', 'alternativ', 'ru'), key('alternativnost', 'alternativ', 'ru'));
assert.notEqual(key('alternativa', 'altern', 'ru'), key('altruizm', 'altru', 'ru'));
assert.notEqual(key('altruizm', 'altru', 'ru'), key('altruist', 'altru', 'ru'));
assert.notEqual(key('reaction', 'act'), key('interaction', 'act'));

const fallback = parseMorphemeModel({ language: 'en', elementType: 'root', candidateWord: 'xqzblorf', search_form: 'xqzblorf', matchedRootVariant: 'qz', rootIndex: 1 });
assert.match(fallback.diagnostic_reason, /^morpheme_parse_fallback/);

const entries = ['regulation', 'regulationism'].map((word, i) => ({ word, normalized: word, search_form: word, rank: i + 1, frequency_score: 10 - i, category_breakdown: {}, sources: [{ file: 'x', category: 'normative', ipm: 10 - i }] }));
const found = findCandidatesForRoot({ entries, root: 'regul', language: 'en' });
const grouped = selectHighestFrequencyPerModel(entries.map(e => ({ ...e, match: match('regul', 0) })), 'regul', 'en');
assert.equal(found.candidates[0].model_key, grouped.candidates[0].model_key, 'automatic search and duplicate grouping share parser model_key');
const manual = lexicalModelDescriptor({ word: 'regulationism', search_form: 'regulationism', match: match('regul', 0) }, 'regul', 'en');
assert.equal(manual.key, grouped.candidates[0].model_key, 'manual processing uses the same parser model_key');

console.log('Associative morpheme model parser tests passed.');

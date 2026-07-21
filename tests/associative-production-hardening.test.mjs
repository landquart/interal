import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getFrequencyProfile, clearFrequencyCacheForTests } from '../associativvordes/js/frequency-loader.js';
import { getBidirectionalSwow, clearSwowCacheForTests } from '../associativvordes/js/swow-client.js';
import { getQwenCandidateSuggestions } from '../associativvordes/js/qwen-client.js';
import { normalizeForMorphology, mapNormalizedRangeToOriginal } from '../associativvordes/js/morphology/normalizer.js';
import { registerLexicalRootsFromEntries, clearLexicalRootIndexForTests } from '../associativvordes/js/morphology/lexical-root-index.js';
import { getLanguageConfig } from '../associativvordes/js/morphology/languages/index.js';
import { parseDerivationalModel, MORPHEME_PARSER_VERSION } from '../associativvordes/js/morpheme-model-parser.js';
import { compactAssociativeState, restoreAssociativeState, createEmptyAssociativeState } from '../associativvordes/js/associative-state.js';

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalLocation = globalThis.location;
globalThis.document = { documentElement: { lang: 'en' } };
globalThis.location = { hostname: 'localhost' };

try {
  {
    clearFrequencyCacheForTests();
    const controller = new AbortController();
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    });
    const request = getFrequencyProfile('en', 'test', { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, error => error.name === 'AbortError');
  }

  {
    clearSwowCacheForTests();
    const controller = new AbortController();
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    });
    const request = getBidirectionalSwow('en', 'eye', 'ocular', { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, error => error.name === 'AbortError');
  }

  {
    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          ok: true,
          candidates: { en: [{ word: 'altruism', root_variant: 'altru' }], de: [], fr: [], es: [], it: [], ru: [] },
          audit: { status: 'completed_with_fallback', model: null, error: { code: 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE', details: 'offline' } },
          guaranteedCandidates: { en: [{ word: 'altruism', root_variant: 'altru' }] },
          qwenCandidates: { en: [] }
        };
      }
    });
    const result = await getQwenCandidateSuggestions({ root: 'alter', targetMeaning: 'other' });
    assert.equal(result.auditStatus, 'completed_with_fallback');
    assert.equal(result.auditError.code, 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE');
    assert.equal(result.suggestions.en[0].word, 'altruism');
  }

  {
    const normalized = normalizeForMorphology('Régul ation', 'en');
    assert.equal(normalized.normalized, 'regulation');
    const range = mapNormalizedRangeToOriginal(normalized, 0, 5);
    assert.equal('Régul ation'.slice(range.start, range.end).toLowerCase(), 'régul');
    const russian = normalizeForMorphology('Ёлочный', 'ru');
    assert.equal(russian.normalized.startsWith('ел'), true);
  }

  {
    clearLexicalRootIndexForTests();
    const config = getLanguageConfig('en');
    registerLexicalRootsFromEntries('en', [
      { word: 'intercontinental', frequency_score: 70 },
      { word: 'intergovernmental', frequency_score: 65 },
      { word: 'interlinguistic', frequency_score: 60 }
    ], { prefix: 'inter', config });
    const continental = parseDerivationalModel({ language: 'en', elementType: 'preposition', word: 'intercontinental', canonicalRoot: 'inter' });
    const governmental = parseDerivationalModel({ language: 'en', elementType: 'preposition', word: 'intergovernmental', canonicalRoot: 'inter' });
    const linguistic = parseDerivationalModel({ language: 'en', elementType: 'preposition', word: 'interlinguistic', canonicalRoot: 'inter' });
    assert.equal(continental.model_key, 'en|preposition|inter|continent');
    assert.equal(governmental.model_key, 'en|preposition|inter|government');
    assert.equal(linguistic.model_key, 'en|preposition|inter|lingu');
    assert.equal(continental.best_analysis.morphotacticsValid, true);
    assert.ok(Array.isArray(continental.best_analysis.morphotacticViolations));
  }

  {
    const languages = [{ code: 'en', group: 'Germanic' }];
    const state = createEmptyAssociativeState({ languages });
    state.root = 'regul';
    state.checked = true;
    state.globalStatus = 'completed';
    state.languages.en = [{
      word: 'regulation', selected: true, final_score: 40, model: 'regul-ation', model_label: 'regul-ation', model_key: 'en|root||regul|ation', parser_version: MORPHEME_PARSER_VERSION,
      morpheme_analysis: { parser_version: MORPHEME_PARSER_VERSION, language: 'en', element_type: 'root', canonical_root: 'regul', matched_root_variant: 'regul', prefix_chain: [], first_meaningful_derivational_element: 'ation', first_lexical_root_after_preposition: '', model_key: 'en|root||regul|ation', model_label: 'regul-ation', analysis_confidence: 'high', diagnostic_reason: 'exact_morpheme_parse', warnings: [] }
    }];
    const saved = compactAssociativeState(state, { languages });
    assert.equal(saved.version, 2);
    assert.equal(saved.state.languages.en[0].parser_version, MORPHEME_PARSER_VERSION);
    assert.equal(saved.state.languages.en[0].morpheme_analysis.model_key, 'en|root||regul|ation');
    const restored = restoreAssociativeState(saved, { languages });
    assert.equal(restored.state.languages.en[0].parser_version, MORPHEME_PARSER_VERSION);
  }

  const familySource = await readFile('associativvordes/js/candidate-model-family.js', 'utf8');
  assert.doesNotMatch(familySource, /stemRoot === ['"]alternativ['"]/, 'algorithmic special case is removed');
  const analyzerSource = await readFile('associativvordes/js/morphology/analyzer.js', 'utf8');
  assert.doesNotMatch(analyzerSource, /morphotacticsValid:\s*true/, 'morphotactics is calculated rather than hard-coded');
  const segmentationSource = await readFile('associativvordes/js/morphology/segmentation-engine.js', 'utf8');
  assert.match(segmentationSource, /topK\(out, maxAnalyses\)/, 'N-best candidates are ranked before truncation');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
}

console.log('Associative hardening regression tests passed.');

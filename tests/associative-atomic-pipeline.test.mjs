import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineCandidatesWithQwenAudit, finalizeCandidateOrdering } from '../associativvordes/js/qwen-client.js';

const scriptSource = await readFile('associativvordes/script.js', 'utf8');
const clientSource = await readFile('associativvordes/js/qwen-client.js', 'utf8');

assert.doesNotMatch(clientSource, /calculateButton\.addEventListener\('click',[\s\S]*?\{\s*capture:\s*true\s*\}/, 'no capture click handler starts a background supplement after the main calculation');
assert.doesNotMatch(clientSource, /supplementAfterCompletedCalculation/, 'post-completion supplement function is removed');
assert.match(clientSource, /export async function refineCandidatesWithQwenAudit/, 'candidate supplement is an exported async pipeline step');
assert.match(scriptSource, /await refineCandidatesWithQwenAudit/, 'runCalculation directly awaits candidate audit before final selection');
assert.ok(scriptSource.indexOf('await refineCandidatesWithQwenAudit') < scriptSource.indexOf('Selecting final five frequency models'), 'Qwen suggestions are considered before the final five models are selected');
assert.ok(scriptSource.indexOf('Selecting final five frequency models') < scriptSource.indexOf('Qwen3.6: оценка первых'), 'primary Qwen analysis runs only after the final five frequency models are fixed');
assert.ok(scriptSource.indexOf('Расчёт итогового процента') > scriptSource.indexOf('Qwen3.6: оценка первых'), 'FA is calculated after final model evaluation');
assert.ok(scriptSource.indexOf('state.checked = true') > scriptSource.indexOf('await runCalculation'), 'state.checked is set only after the awaited pipeline completes');
assert.ok(scriptSource.indexOf('window.InteralFormDraft?.save?.();', scriptSource.indexOf('state.checked = true')) > scriptSource.indexOf('state.checked = true'), 'form draft is saved only after final checked state');
assert.match(scriptSource, /buttonController\?\.start\([\s\S]*?buttonController\?\.success/, 'button controller keeps the loader-owned button state until final success');
assert.match(scriptSource, /activeRunAbortController\?\.abort\?\.\(\)/, 'new runs and resets abort the previous pipeline');
assert.match(scriptSource, /isCurrentRun\(runId\)/, 'pipeline checks run identity before mutating final state');
assert.match(scriptSource, /QWEN_CANDIDATE_AUDIT_WARNING/, 'candidate audit failures are converted into a completed warning result');

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalLocation = globalThis.location;
globalThis.document = { documentElement: { lang: 'en' } };
globalThis.location = { hostname: 'localhost' };
let fetchCount = 0;
globalThis.fetch = async (_url, options) => {
  fetchCount += 1;
  assert.ok(options.signal, 'candidate audit request receives the shared AbortSignal');
  return {
    ok: true,
    async json() {
      return { candidates: { en: [{ word: 'zeta', root_variant: 'zet' }] } };
    }
  };
};
const loader = {
  async loadCandidateEntries(language, word, { signal } = {}) {
    assert.equal(language, 'en');
    assert.equal(word, 'zeta');
    assert.ok(signal, 'local verification receives the shared AbortSignal');
    return [{ word: 'zeta', normalized: 'zeta', search_form: 'zeta', frequency_score: 99, sources: [{ id: 'test' }] }];
  }
};
const refined = await refineCandidatesWithQwenAudit({
  root: 'zet',
  targetMeaning: 'test',
  candidatesByLanguage: { en: [{ word: 'alpha', model_key: 'a', frequency_score: 10, sources: [{ id: 'base' }], match: {} }] },
  loader,
  languages: ['en'],
  signal: new AbortController().signal
});
assert.equal(fetchCount, 1, 'candidate audit performs exactly one network request inside the awaited stage');
assert.ok(refined.candidatesByLanguage.en.some(candidate => candidate.word === 'zeta'), 'verified Qwen suggestion is added before final ordering');
assert.equal(finalizeCandidateOrdering(refined.candidatesByLanguage.en, 1)[0].word, 'zeta', 'Qwen suggestion participates in frequency-only final selection');

fetchCount = 0;
globalThis.fetch = async () => {
  fetchCount += 1;
  return { ok: false, async json() { return { ok: false, errorCode: 'SIMULATED' }; } };
};
const fallback = await refineCandidatesWithQwenAudit({
  root: 'zet',
  targetMeaning: 'test',
  candidatesByLanguage: { en: [{ word: 'alpha', model_key: 'a', frequency_score: 10 }] },
  loader,
  languages: ['en'],
  signal: new AbortController().signal
});
assert.deepEqual(fallback.candidatesByLanguage.en.map(candidate => candidate.word), ['alpha'], 'candidate audit failure preserves the base result');
assert.deepEqual(fallback.warnings, ['qwen_candidate_audit_unavailable'], 'candidate audit failure reports a warning');
assert.equal(fetchCount, 1, 'failed candidate audit does not schedule retry/background requests');

globalThis.fetch = originalFetch;
globalThis.document = originalDocument;
globalThis.location = originalLocation;

console.log('Associative atomic pipeline tests passed.');

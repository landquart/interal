// Replay already recorded real calculator inputs. No external calls, invented
// scores, or replacement formula. Missing observations remain missing.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runAssociativeCalculation } from '../js/associative-calculation-runner.js';
import { CONTROL_LANGUAGES } from '../../shared/control-language-demographics.mjs';

export async function replay(recording) {
  if (recording.schema !== 'release07-calculator-recording/1') throw Error('unsupported calculator recording');
  const languages = CONTROL_LANGUAGES;
  const { state } = await runAssociativeCalculation({ input: recording.input, dependencies: {
    languages, waitForPaint: async () => {},
    targetTranslator: { translate: async () => recording.translations || {} },
    candidateIndexLoader: { load: async language => recording.languages[language.code] || [] },
    // Recorded analyses are replayed unchanged, with provenance checked by the
    // independent verifier. This does not manufacture missing A/P judgements.
    candidateAnalyzer: { analyze: async (_language, candidate) => candidate }
  }});
  return { state, topFive: Object.fromEntries(languages.map(l => [l.code,
    (state.languages[l.code] || []).filter(x => x.selected !== false).slice(0, 5).map(x => ({
      word: x.word, model_key: x.model_key ?? x.model_family_key ?? x.model ?? null,
      final_score: x.final_score ?? x.analysis?.final_score ?? null,
      sources: x.sources ?? [], head_id: x.head_id ?? null
    }))])),
    missingFrequency: Object.fromEntries(languages.map(l => [l.code,
      (recording.languages[l.code] || []).filter(x => !(x.sources || []).some(s => Number.isFinite(s.ipm))).map(x => x.word)])) };
}

export async function compare(before, after) {
  if (before.input.root !== after.input.root) throw Error('different calculator scope');
  const a = await replay(before), b = await replay(after);
  return { schema: 'release07-calculator-comparison/1', before: a, after: b,
    before_state_sha256: before.state_sha256 ?? null, after_state_sha256: after.state_sha256 ?? null,
    recordings: [before, after].map(x => createHash('sha256').update(JSON.stringify(x)).digest('hex')),
    complete: [a, b].every(x => x.state.checked &&
      x.state.finalAssociationResult?.counts?.verifiedALanguages === CONTROL_LANGUAGES.length &&
      Object.values(x.missingFrequency).every(rows => rows.length === 0)),
    production_writes: 0, api_calls: 0 };
}

if (process.argv[1]?.endsWith('/calculator.mjs')) {
  const [a, b, out] = process.argv.slice(2);
  if (!a || !b || !out) throw Error('usage: node calculator.mjs before.json after.json output.json');
  await writeFile(out, JSON.stringify(await compare(JSON.parse(await readFile(a)), JSON.parse(await readFile(b))), null, 2));
}

// Actual calculator baseline replay only: there are no approved changes yet.
import { readFile, writeFile } from 'node:fs/promises';
import { compare } from './calculator.mjs';
const [capturePath, output] = process.argv.slice(2);
const capture = JSON.parse(await readFile(capturePath));
const rows = [];
for (const file of capture.recordings) {
  const recording = JSON.parse(await readFile(file));
  const r = await compare(recording, recording);
  rows.push({ family: recording.input.root, comparison_scope: 'BASELINE_VS_IDENTICAL_NO_APPROVED_OPERATIONS',
    before_state_sha256: r.before_state_sha256, after_state_sha256: r.after_state_sha256,
    complete: r.complete, top_five_before: r.before.topFive, top_five_after: r.after.topFive,
    represented_languages_before: r.before.state.finalAssociationResult.counts,
    represented_languages_after: r.after.state.finalAssociationResult.counts,
    internationality_before: r.before.state.FA, internationality_after: r.after.state.FA,
    missing_frequency: Object.fromEntries(Object.entries(r.before.missingFrequency).map(([k, v]) => [k, v.length])),
    semantic_scores_available: false });
}
await writeFile(output, JSON.stringify({ schema: 'release07-baseline-calculator/1', families: rows.length,
  rows, approved_changes_tested: 0, impact_certified: false, api_calls: 0 }, null, 2));

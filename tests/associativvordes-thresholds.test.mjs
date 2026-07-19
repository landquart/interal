import assert from 'node:assert/strict';
import { THRESHOLDS, classifyScore, passesWordThreshold, finalAssociationPassesThreshold } from '../associativvordes/js/association-analyzer.js';
import { thresholdStatusForResult, thresholdStatusLabel, semanticWarningLabel } from '../associativvordes/js/render-results.js';

assert.deepEqual(THRESHOLDS, { main: 35 }, 'only the final FA threshold remains');
assert.equal(classifyScore(null), 'unavailable');
assert.equal(classifyScore(0), 'evaluated');
assert.equal(classifyScore(34.9), 'evaluated');
assert.equal(classifyScore(35), 'evaluated');
assert.equal(passesWordThreshold(0), true, 'finite word scores remain eligible for averaging');
assert.equal(passesWordThreshold(34.96), true, 'low word scores are not removed');
assert.equal(passesWordThreshold(100), true);
assert.equal(passesWordThreshold(null), false);
assert.equal(thresholdStatusForResult({ final_score: 40.6, association: { semantic_confirmed: false } }), 'evaluated');
assert.equal(thresholdStatusLabel('evaluated', 'ru'), 'оценено');
assert.equal(thresholdStatusLabel('evaluated', 'en'), 'evaluated');
assert.equal(semanticWarningLabel('en'), 'semantic correspondence is not confirmed');
assert.equal(finalAssociationPassesThreshold(35), true);
assert.equal(finalAssociationPassesThreshold(34.999), false);

const officialScores = [{ selected: true, final_score: 40.6 }, { selected: true, final_score: 34.9 }, { selected: false, final_score: 100 }]
  .filter(x => x.selected && passesWordThreshold(x.final_score))
  .map(x => x.final_score);
assert.deepEqual(officialScores, [40.6, 34.9], 'all manually included finite model scores participate');
assert.equal(officialScores.reduce((a, b) => a + b, 0) / officialScores.length, 37.75);

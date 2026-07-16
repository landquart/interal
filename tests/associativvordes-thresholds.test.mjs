import assert from 'node:assert/strict';
import { THRESHOLDS, classifyScore, passesWordThreshold, finalAssociationPassesThreshold } from '../associativvordes/js/association-analyzer.js';
import { thresholdStatusForResult, thresholdStatusLabel, semanticWarningLabel } from '../associativvordes/js/render-results.js';

assert.equal(THRESHOLDS.word, 35);
assert.equal(classifyScore(null), 'unavailable');
assert.equal(classifyScore(0), 'below_threshold');
assert.equal(classifyScore(34.9), 'below_threshold');
assert.equal(classifyScore(34.999), 'below_threshold');
assert.equal(classifyScore(35), 'passed_threshold');
assert.equal(passesWordThreshold(35.0), true);
assert.equal(passesWordThreshold(40.6), true);
assert.equal(passesWordThreshold(100), true);
assert.equal(passesWordThreshold(34.96), false);
assert.equal(thresholdStatusForResult({ final_score: 40.6, association: { semantic_confirmed: false } }), 'passed_threshold');
assert.equal(thresholdStatusLabel('passed_threshold', 'ru'), 'порог пройден');
assert.equal(thresholdStatusLabel('below_threshold', 'en'), 'below the 35% threshold');
assert.equal(semanticWarningLabel('en'), 'semantic correspondence is not confirmed');
assert.equal(finalAssociationPassesThreshold(35), true);
assert.equal(finalAssociationPassesThreshold(34.999), false);

const officialScores = [{ selected: true, final_score: 40.6 }, { selected: true, final_score: 34.9 }, { selected: false, final_score: 100 }]
  .filter(x => x.selected && passesWordThreshold(x.final_score))
  .map(x => x.final_score);
assert.deepEqual(officialScores, [40.6]);
assert.equal(officialScores.reduce((a, b) => a + b, 0) / officialScores.length, 40.6);

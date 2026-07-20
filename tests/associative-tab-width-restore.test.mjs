import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('associativvordes/script.js', 'utf8');

assert.match(
  source,
  /function renderAll\(\) \{\s*syncCheckedVisibility\(\);\s*applyLocalizedTexts\(\);\s*renderTabs\(\);\s*syncTabWidths\(\);/,
  'renderAll must reveal restored result sections before measuring language tabs'
);

assert.match(
  source,
  /if \(tabs\.closest\('\[hidden\]'\) \|\| tabs\.getClientRects\(\)\.length === 0\) return;/,
  'tab width synchronization must skip hidden containers'
);

assert.match(
  source,
  /if \(!Number\.isFinite\(maxWidth\) \|\| maxWidth <= 0\) return;/,
  'tab width synchronization must never write a zero width'
);

console.log('Associative restored tab-width tests passed');

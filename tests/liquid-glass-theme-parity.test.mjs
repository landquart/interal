import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const material = await readFile('shared/liquid-glass.css', 'utf8');
const fallback = await readFile('shared/ui.css', 'utf8');
const loader = await readFile('shared/ui.js', 'utf8');

assert.match(
  material,
  /rgba\(248,\s*249,\s*252,\s*0\.42\).*rgba\(244,\s*246,\s*250,\s*0\.30\)/s,
  'canonical light material gradient must stay intact'
);
assert.match(
  material,
  /blur\(8px\)\s+saturate\(132%\)\s+contrast\(102%\)/,
  'balanced material filter must match the light website topbar'
);
assert.doesNotMatch(
  material,
  /body\.dark-theme[^,{]*\.top-nav-window/,
  'dark theme must not replace the canonical glass material'
);
assert.doesNotMatch(
  fallback,
  /body\.dark-theme(?:\.nav-scrolled)?\s+\.top-nav-window/,
  'fallback topbar material must also be theme-independent'
);
assert.match(
  loader,
  /liquid-glass\.css\?v=unified-light-material-20260728-1/,
  'the unified material must use a fresh cache key'
);

console.log('liquid glass theme parity tests passed');

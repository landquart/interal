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
assert.match(
  material,
  /body\.dark-theme \.top-nav-window::before\s*\{[^}]*rgba\(35,\s*36,\s*42,\s*0\.55\)[^}]*rgba\(22,\s*24,\s*29,\s*0\.43\)/s,
  'dark theme must preserve its dark material gradient'
);
assert.match(
  fallback,
  /body\.dark-theme \.top-nav-window\s*\{[^}]*rgba\(42,\s*44,\s*51,\s*0\.68\)[^}]*blur\(21px\)\s*saturate\(138%\)/s,
  'fallback keeps dark colours while sharing the light blur settings'
);
assert.match(
  material,
  /data-liquid-glass-tier="balanced"\] body\.dark-theme \.top-nav-window\s*\{[^}]*blur\(8px\)\s+saturate\(132%\)\s+contrast\(102%\)/s,
  'balanced dark theme must copy only the light optical filter'
);
assert.match(
  loader,
  /liquid-glass\.css\?v=unified-blur-20260728-2/,
  'the unified blur settings must use a fresh cache key'
);

console.log('liquid glass theme parity tests passed');

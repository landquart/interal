import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const material = await readFile('shared/liquid-glass.css', 'utf8');
const base = await readFile('shared/ui.css', 'utf8');
const runtime = await readFile('shared/liquid-glass.js', 'utf8');
const core = await readFile('shared/ui-core.js', 'utf8');
const loader = await readFile('shared/ui.js', 'utf8');

assert.match(material, /--glass-blur:\s*18px;/, 'normal glass uses an 18px blur');
assert.match(material, /--glass-saturation:\s*135%;/, 'normal glass uses 135% saturation');
assert.match(
  material,
  /data-liquid-glass-tier="lite"[\s\S]*--glass-blur:\s*12px;[\s\S]*--glass-saturation:\s*125%;/,
  'lite glass uses the reduced optical settings'
);
assert.match(
  material,
  /body\.dark-theme[\s\S]*--glass-bg-top:\s*rgba\(38, 40, 47,[\s\S]*--glass-bg-bottom:\s*rgba\(22, 24, 29,/,
  'dark glass stays graphite instead of using a white fill'
);
assert.match(
  material,
  /@supports\s*\(\s*\(backdrop-filter:[\s\S]*-webkit-backdrop-filter:/,
  'glass has a feature-gated backdrop implementation'
);
assert.match(
  material,
  /@supports not[\s\S]*\.top-nav-window\s*\{[\s\S]*backdrop-filter:\s*none;/,
  'glass has an opaque fallback when backdrop blur is unavailable'
);
assert.match(
  material,
  /body\.nav-scrolled[\s\S]*--glass-bg-top:/,
  'scrolling only strengthens the material tint'
);
assert.doesNotMatch(
  base,
  /body\.dark-theme \.top-nav-window|\.top-nav-window::before|\.top-nav-window::after/,
  'base UI CSS no longer duplicates topbar material rules'
);
const baseTopbar = base.match(/\.top-nav-window\s*\{([^}]*)\}/s)?.[1] || '';
assert.doesNotMatch(
  baseTopbar,
  /background|border:\s*1px|box-shadow|backdrop-filter/,
  'base topbar rule contains geometry only'
);
const glassContentLayer =
  material.match(/\.top-nav-window > \*\s*\{([^}]*)\}/s)?.[1] || '';
assert.doesNotMatch(
  glassContentLayer,
  /position\s*:/,
  'glass layering must not override mobile brand positioning'
);
assert.match(
  base,
  /\.top-brand\{[^}]*position:absolute;[^}]*left:50%;[^}]*transform:translateX\(-50%\)/,
  'mobile logo and name remain an absolutely centered group'
);
assert.match(
  base,
  /@media \(min-width:980px\)[\s\S]*?\.top-brand\{position:relative;left:auto;transform:none;/,
  'desktop logo and name retain their existing inline position'
);
assert.match(
  core,
  /top-brand-logo[\s\S]*top-brand-text/,
  'gold logo stays to the left of the Interal name'
);
assert.doesNotMatch(
  runtime,
  /canvas|feDisplacementMap|requestAnimationFrame|MutationObserver|ResizeObserver|PerformanceObserver|getBattery/i,
  'runtime does not create continuously redrawn or synthetic refraction layers'
);
for (const signal of ['deviceMemory', 'hardwareConcurrency', 'saveData']) {
  assert(runtime.includes(signal), `runtime uses the real ${signal} performance signal`);
}
assert.doesNotMatch(core, /--glass-highlight-x|pointermove/, 'topbar highlight is static');
assert.match(core, /addEventListener\(\s*['"]scroll['"][\s\S]*passive:\s*true/, 'scroll state uses a passive listener');
assert.match(loader, /liquid-glass\.css\?v=mobile-brand-20260804-1/, 'glass CSS cache key is current');
assert.match(loader, /liquid-glass\.js\?v=ayu-material-20260804-1/, 'glass runtime cache key is current');

console.log('liquid glass theme parity tests passed');

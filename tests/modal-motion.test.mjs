import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [motion, motionCss, core, uiCss, runtime, associative, international, registry] = await Promise.all([
  readFile('shared/modal-motion.js', 'utf8'),
  readFile('shared/modal-motion.css', 'utf8'),
  readFile('shared/ui-core.js', 'utf8'),
  readFile('shared/ui.css', 'utf8'),
  readFile('shared/ui.js', 'utf8'),
  readFile('associativvordes/script.js', 'utf8'),
  readFile('indoeuropanvordes/index.html', 'utf8'),
  readFile('registre/index.html', 'utf8')
]);

assert.match(runtime, /modal-motion\.css\?v=modal-motion-20260820-2/, 'the shared runtime loads the modal motion stylesheet');
assert.match(runtime, /modal-motion\.js\?v=modal-motion-20260820-2/, 'the shared runtime loads modal motion before UI core');
assert.match(motion, /FULL:\s*'full'[\s\S]*LITE:\s*'lite'[\s\S]*OFF:\s*'off'/, 'the controller exposes Full, Lite and Off modes');
assert.match(motion, /prefers-reduced-motion: reduce/, 'system reduced-motion is authoritative');
assert.match(motion, /navigator\.deviceMemory/, 'device memory is only a preliminary signal');
assert.match(motion, /navigator\.hardwareConcurrency/, 'hardware concurrency is only a preliminary signal');
assert.match(motion, /navigator\.connection\?\.saveData/, 'data saver contributes to preliminary selection');
assert.doesNotMatch(motion, /userAgent|screen\.width/, 'mode selection does not use model lists or screen width');
assert.match(motion, /requestAnimationFrame\(sample\)/, 'the baseline is measured from real animation frames');
assert.match(motion, /MINIMUM_QUALITY_INTERVAL[\s\S]*1000 \/ 60/, 'high-refresh screens may render motion at a stable 60 fps without a false downgrade');
assert.match(motion, /poorStreak[\s\S]*DOWNGRADE_STREAK/, 'one poor animation cannot permanently downgrade the session');
assert.match(motion, /badRatio[\s\S]*average[\s\S]*maximum/, 'animation quality uses multiple frame metrics');
assert.match(motion, /sessionStorage\.setItem\(SESSION_KEY, next\)/, 'downgrades persist for the current session only');
assert.doesNotMatch(motion, /localStorage/, 'performance classification is never persisted permanently');
assert.match(motion, /fullKeyframes[\s\S]*skew\([\s\S]*translate3d/, 'Full mode contains a directional transform-only Genie deformation');
assert.doesNotMatch(motion, /clipPath|clip-path/, 'modal motion avoids clip-path repaints in Android WebViews');
assert.match(motion, /liteKeyframes[\s\S]*translate3d[\s\S]*scale/, 'Lite mode remains compositor-friendly and directional');
assert.match(motion, /offKeyframes[\s\S]*opacity[\s\S]*translate3d/, 'Off mode remains a visible, low-cost animation');
assert.match(motion, /visualViewport/, 'geometry is clamped to the active visual viewport');
assert.match(motion, /shell\?\.remove\(\)/, 'temporary visual shells are removed after each animation');
assert.match(motion, /removeProperty\('will-change'\)/, 'temporary panel layer hints are cleared');
assert.doesNotMatch(`${motion}\n${motionCss}`, /!important/, 'the modal motion system does not use important overrides');

assert.match(core, /InteralModalMotion\.open\(dialog/, 'confirmation dialogs use the shared opening lifecycle');
assert.match(core, /InteralModalMotion\.close\(dialog/, 'confirmation dialogs use the shared closing lifecycle');
assert.match(core, /InteralModalMotion\.open\(modal,[\s\S]*interal-select-modal-panel/, 'custom select dialogs use shared motion');
assert.match(core, /motion\.open\(list,[\s\S]*menu-lang-modal-content/, 'the language dialog uses shared motion');
assert.match(core, /InteralModalMotion\.open\(m,[\s\S]*modal-inner/, 'shared JSON-card dialogs use shared motion');
assert.doesNotMatch(uiCss, /selectModalCardIn/, 'the old select scale animation is removed');
assert.doesNotMatch(uiCss, /#jsonCardModal\{[^}]*transition:opacity/, 'the old JSON modal fade no longer competes with shared motion');

for (const [name, source] of [
  ['associative tool', associative],
  ['internationality tool', international],
  ['registry', registry]
]) {
  assert.match(source, /InteralModalMotion\.open/, `${name} opens through shared motion`);
  assert.match(source, /InteralModalMotion\.close/, `${name} closes through shared motion`);
}

const entryPoints = [
  'index.html',
  'affixes/index.html',
  'altervordes/index.html',
  'associativvordes/index.html',
  'grammaticebrevivordes/index.html',
  'indoeuropanvordes/index.html',
  'instrumentes/index.html',
  'internationalismes/index.html',
  'logotypenomine/index.html',
  'registre/index.html',
  'vordesofcommunites/index.html'
];

for (const path of entryPoints) {
  const html = await readFile(path, 'utf8');
  assert.match(html, /shared\/ui\.js\?v=/, `${path} uses the new runtime cache key`);
  assert.match(html, /shared\/ui\.css\?v=/, `${path} uses the new stylesheet cache key`);
}

console.log('Modal motion tests passed');

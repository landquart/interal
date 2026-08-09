import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [core, css, runtime, sidebar, loader, buttonStatus] = await Promise.all([
  readFile('shared/ui-core.js', 'utf8'),
  readFile('shared/ui.css', 'utf8'),
  readFile('shared/ui.js', 'utf8'),
  readFile('elements/sidebar_corrected_v2.svg', 'utf8'),
  readFile('elements/material3_expressive_loader.svg', 'utf8'),
  readFile('shared/button-status.js', 'utf8'),
]);

assert.match(loader, /<animateTransform\b/, 'expressive loader keeps its rotating SMIL animation');
assert.match(loader, /<animate\b/, 'expressive loader keeps its morphing SMIL animation');
assert.match(loader, /var\(--loader-color/, 'expressive loader remains themeable');
const morphAnimation = loader.match(/<animate attributeName="d"[\s\S]*?\/>/)?.[0] || '';
assert.equal(morphAnimation.match(/values="([\s\S]*?)"/)?.[1].split(';').length, 8, 'morph animation keeps one non-duplicated seven-shape cycle');
assert.match(morphAnimation, /dur="4550ms"/, 'the optimized morph loop preserves the original 650 ms per-shape timing');
assert.doesNotMatch(loader, /#0B57D0/i, 'the SVG cannot flash the old blue fallback before theme hydration');
assert.match(runtime, /material3_expressive_loader\.svg/, 'shared runtime loads the supplied loader asset');
assert.match(runtime, /querySelectorAll\?\.\('animate, animateTransform'\)/, 'reduced motion retains a static loader shape');
assert.match(runtime, /interal-page-loader/, 'initial page loading uses the expressive indicator');
assert.match(css, /\.interal-page-loader\.is-leaving\{opacity:0;/, 'initial loading fades without affecting layout');
assert.match(css, /\.interal-page-loader\{[^}]*background:transparent/, 'initial loading does not paint an opaque white screen');
assert.match(runtime, /requestAnimationFrame\(finish\)/, 'initial loading leaves after the first ready paint without an artificial two-frame delay');

assert.match(css, /scrollbar-width:thin;scrollbar-color:var\(--scrollbar-thumb\) transparent/, 'Firefox uses the shared thin scrollbar fallback');
assert.match(css, /html::\-webkit-scrollbar,body::\-webkit-scrollbar,\*::\-webkit-scrollbar\{width:9px;height:9px;/, 'WebKit explicitly styles the root viewport scrollbar');
assert.match(css, /html::\-webkit-scrollbar-thumb,body::\-webkit-scrollbar-thumb,\*::\-webkit-scrollbar-thumb\{[^}]*border:2px solid transparent;[^}]*border-radius:999px;/, 'WebKit renders an approximately five-pixel pill thumb');
assert.match(css, /html::\-webkit-scrollbar-thumb:active,body::\-webkit-scrollbar-thumb:active,\*::\-webkit-scrollbar-thumb:active\{background-color:var\(--scrollbar-thumb-active\)/, 'dragging uses the Interal accent');
assert.match(css, /@media \(hover:none\) and \(pointer:coarse\)[\s\S]*width:4px/, 'coarse pointers keep a minimal mobile scrollbar');

assert.match(core, /createElement\('button'\)[\s\S]*interal-back-to-top[\s\S]*aria-label/, 'back-to-top is a labelled native button');
assert.match(core, /addEventListener\(\s*'scroll',[\s\S]*passive:\s*true/, 'back-to-top shares a passive scroll listener');
assert.match(core, /requestAnimationFrame\(syncScrollUiState\)/, 'scroll state is requestAnimationFrame throttled');
assert.match(core, /scrollTo\(\{ top: 0, left: 0, behavior: reduceMotion \? 'auto' : 'smooth' \}\)/, 'back-to-top is smooth and reduced-motion aware');
assert.match(css, /\.interal-back-to-top\{[^}]*safe-area-inset-bottom/, 'mobile back-to-top placement respects the device safe area');
assert.match(css, /body\.menu-open \.interal-back-to-top[\s\S]*interal-confirm-overlay\.show/, 'back-to-top stays below menus and modal overlays');

assert.match(sidebar, /id="sidebar-outline"[\s\S]*<rect x="3" y="4" width="18" height="16" rx="5" fill="none" stroke="currentColor" stroke-width="1\.5"/, 'sidebar source keeps the requested rounded outline unchanged');
assert.match(sidebar, /id="sidebar-divider"[\s\S]*<path d="M9 4V20" fill="none" stroke="currentColor" stroke-width="1\.5" stroke-linecap="round"/, 'sidebar divider is only one thin vertical line joined to both borders');
assert.match(core, /sidebar_corrected_v2\.svg[\s\S]*#sidebar-outline[\s\S]*#sidebar-divider/, 'menu button references the static shell and moving divider from one SVG source');
assert.match(css, /\.sidebar-state-divider\{[^}]*transition:transform 240ms cubic-bezier\(\.2,0,0,1\)/, 'divider movement keeps the requested timing and easing');
assert.match(css, /body\.menu-open \.sidebar-state-divider\{transform:translateX\(6px\)\}/, 'divider alone moves to the symmetric right-hand position');
assert.match(core, /syncMenuButtonState[\s\S]*aria-expanded[\s\S]*closeMenu[\s\S]*openMenu/, 'accessible label and expanded state follow the actual sidebar state');
assert.match(core, /MutationObserver[\s\S]*syncMenuButtonState[\s\S]*menu-open/, 'programmatic sidebar state changes stay synchronized');

assert.match(buttonStatus, /loader_video_fitted_0_1s_triangle_fixed_centered\.svg/, 'compact button loaders remain unchanged');

console.log('UI motion components tests passed');

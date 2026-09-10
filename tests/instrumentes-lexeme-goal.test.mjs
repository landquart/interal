import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('instrumentes/index.html', 'utf8');
const script = await readFile('shared/instrumentes-page.js', 'utf8');
const styles = await readFile('shared/instrumentes.css', 'utf8');
const loader = await readFile('shared/ui.js', 'utf8');
const registry = JSON.parse(await readFile('cards/registry.json', 'utf8'));

const goalPosition = html.indexOf('data-lexeme-goal');
const carouselPosition = html.indexOf('data-instrumentes-carousel');
assert(goalPosition >= 0, 'instruments page contains the lexeme goal');
assert(
  carouselPosition > goalPosition,
  'lexeme goal is placed before the instrument cards carousel'
);
assert.match(
  html,
  /data-goal="1000"[\s\S]*role="progressbar"[\s\S]*aria-valuemax="1000"/,
  'goal exposes an accessible 1000-lexeme progressbar'
);
assert.match(
  html,
  /Наша первая цель — зафиксировать 1000 лексем!/,
  'Russian goal title is present before localization starts'
);
assert.match(
  html,
  /family=Cormorant\+Garamond:ital,wght@1,500/,
  'instruments page loads the existing Garamond italic face'
);
assert.match(
  script,
  /lexemeGoalTitle:\s*'Наша первая цель — зафиксировать 1000 лексем!'/,
  'Russian goal title is localized'
);
assert.match(
  script,
  /lexemeGoalTitle:\s*'Our first goal is to register 1,000 lexemes!'/,
  'English goal title is localized'
);
assert.match(
  script,
  /fetch\(context\.joinUrl\('cards\/registry\.json'\)/,
  'goal reads the generated lexical-card registry'
);
assert.match(
  script,
  /const declaredCount = Number\(registry\?\.count\)/,
  'goal uses the registry count'
);
assert.match(
  script,
  /Array\.isArray\(registry\?\.cards\)/,
  'goal can fall back to the registry card list'
);
assert.doesNotMatch(
  html,
  />3\s*\/\s*1000</,
  'current registry count is not hard-coded into the page'
);
assert.equal(
  registry.count,
  registry.cards.length,
  'generated registry count matches its card list'
);
assert.match(
  styles,
  /\.instrumentes-lexeme-goal-title\{[^}]*font-family:"Cormorant Garamond"[^}]*font-style:italic/,
  'goal title uses Garamond italic'
);
assert.match(
  styles,
  /\.instrumentes-lexeme-goal-fill\{[^}]*var\(--brand-gold-control\)[^}]*var\(--brand-gold\)/,
  'progress fill uses the shared Interal gold palette'
);
assert.match(
  styles,
  /\.instrumentes-lexeme-goal-track\{[^}]*height:30px[^}]*padding:0[^}]*overflow:hidden/,
  'progress fill reaches the full inner edge of the rounded track'
);
assert.match(
  styles,
  /\.instrumentes-lexeme-goal\.has-progress \.instrumentes-lexeme-goal-fill\{min-width:28px\}/,
  'small progress values fill the complete desktop left cap'
);
assert.match(
  styles,
  /max-width:560px[^}]*[\s\S]*\.instrumentes-lexeme-goal\.has-progress \.instrumentes-lexeme-goal-fill\{min-width:24px\}/,
  'small progress values fill the complete mobile left cap'
);
assert.match(
  styles,
  /prefers-reduced-motion:reduce[^}]*instrumentes-lexeme-goal-fill\{transition:none\}/,
  'progress animation respects reduced motion'
);
assert.match(
  styles,
  /\.instrument-card-background\{[^}]*position:absolute[^}]*width:100%[^}]*height:100%[^}]*object-fit:contain/,
  'instrument backgrounds fill the card while preserving image proportions'
);
assert.match(
  html,
  /<img[^>]*class="instrument-card-background"[^>]*src="[^"]+"/,
  'the page renders the current image background'
);
assert.match(
  styles,
  /body\.dark-theme \.instrument-card[^}]*--instrument-card-surface:var\(--surface-elevated\)/,
  'dark cards use the shared elevated surface'
);
assert.doesNotMatch(
  styles,
  /\.instrument-art::before\{[^}]*backdrop-filter/,
  'cubic tiles do not create repeated backdrop-filter layers'
);
assert.match(
  html,
  /instrumentes\.css\?v=[a-z0-9-]+-\d{8}-\d+/,
  'page loads versioned instrument styles'
);
assert.match(
  html,
  /ui\.js\?v=[a-z0-9-]+-\d{8}-\d+/,
  'page loads a versioned shared runtime'
);
assert.match(
  loader,
  /instrumentes-page\.js\?v=[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}-\d+(?=['"])/,
  'shared loader uses the current progress runtime'
);

console.log('instrumentes lexeme goal tests passed');

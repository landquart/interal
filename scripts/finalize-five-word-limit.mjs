import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOne(path, before, after) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOne(
  'associativvordes/script.js',
  `    function calculateFinal() {\n      const languageResults = LANGUAGES.map(l => {\n        const score = calculateLanguage(l.code);\n        const semanticConfirmed = Number.isFinite(Number(score.normalized)) && (state.languages[l.code] || [])\n          .filter(item => item.selected)\n          .some(item => item.analysis?.association?.semantic_confirmed === true);\n        return { ...score, semanticConfirmed };\n      });\n      return calculateFinalAssociation({ languages: LANGUAGES, languageResults, languageStatuses: state.languageStatuses });\n    }`,
  `    function calculateFinal() {\n      const languageResults = LANGUAGES.map(l => {\n        const candidates = scoringCandidates(l.code);\n        const score = calculateLanguageScore(candidates, { maxModels: state.maxModels, scoreGetter: wordWeight });\n        const semanticConfirmed = Number.isFinite(Number(score.normalized))\n          && candidates.some(item => item.analysis?.association?.semantic_confirmed === true);\n        return { ...score, semanticConfirmed };\n      });\n      return calculateFinalAssociation({ languages: LANGUAGES, languageResults, languageStatuses: state.languageStatuses });\n    }`
);

await replaceOne(
  'associativvordes/script.js',
  `      const selectedLanguages = Object.entries(state.languages || {}).flatMap(([code, items]) => (items || [])\n        .filter(item => item.selected)\n        .map(item => ({ code, ...item })));`,
  `      const selectedLanguages = LANGUAGES.flatMap(({ code }) =>\n        scoringCandidates(code).map(item => ({ code, ...item }))\n      );`
);

await replaceOne(
  'tests/associative-model-selection-policy.test.mjs',
  `assert.match(script, /slice\\(0, state\\.maxModels \\|\\| MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE\\)/);`,
  `assert.match(script, /slice\\(0, state\\.maxModels \\|\\| MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE\\)/);\nassert.match(script, /const candidates = scoringCandidates\\(l\\.code\\)/, 'FA evidence uses only the five scoring candidates');\nassert.match(script, /LANGUAGES\\.flatMap\\(\\(\\{ code \\}\\) =>[\\s\\S]*scoringCandidates\\(code\\)/, 'JSON card uses the same five-word evidence set as FA');`
);

await rm('scripts/finalize-five-word-limit.mjs', { force: true });
await rm('.github/workflows/finalize-five-word-limit.yml', { force: true });
console.log('Finalized five-word consistency.');

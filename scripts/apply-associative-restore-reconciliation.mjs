import { readFile, writeFile, rm } from 'node:fs/promises';

const path = 'associativvordes/script.js';
const source = await readFile(path, 'utf8');
const search = `        state = restored.state;\n        activeLang = restored.activeLang;`;
const replacement = `        state = restored.state;\n        for (const lang of LANGUAGES) {\n          state.languages[lang.code] = reconcileModelRepresentatives(state.languages[lang.code], state.root, lang.code);\n        }\n        activeLang = restored.activeLang;`;
const count = source.split(search).length - 1;
if (count !== 1) throw new Error(`Expected one restore assignment, found ${count}`);
await writeFile(path, source.replace(search, replacement));
await rm('scripts/apply-associative-restore-reconciliation.mjs', { force: true });
await rm('.github/workflows/apply-associative-restore-reconciliation.yml', { force: true });
console.log('Applied restored-state model reconciliation.');

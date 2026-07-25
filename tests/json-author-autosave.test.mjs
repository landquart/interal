import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const autosaveSource = await readFile(new URL('../shared/json-author-autosave.js', import.meta.url), 'utf8');
const loaderSource = await readFile(new URL('../shared/ui.js', import.meta.url), 'utf8');
const alterPageSource = await readFile(new URL('../altervordes/index.html', import.meta.url), 'utf8');

assert.match(loaderSource, /json-author-autosave\.js\?v=json-author-autosave-20260725-1/);
assert.match(loaderSource, /ui-core\.js\?v=json-author-autosave-20260725-1/);
assert.match(alterPageSource, /shared\/ui\.js\?v=json-author-autosave-20260725-1/);

assert.match(autosaveSource, /remember\.addEventListener\('change'/);
assert.match(autosaveSource, /field\?\.addEventListener\('input', persistRememberedAuthor\)/);
assert.match(autosaveSource, /contactType\?\.addEventListener\('change', persistRememberedAuthor\)/);
assert.match(autosaveSource, /storage\.saveAuthorData\?\.\(data\)/);
assert.match(autosaveSource, /window\.addEventListener\('pagehide', persistRememberedAuthor\)/);
assert.match(autosaveSource, /document\.visibilityState === 'hidden'/);

console.log('JSON author autosave wiring tests passed.');

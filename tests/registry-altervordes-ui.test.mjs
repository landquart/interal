import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const loader = await readFile('shared/ui.js', 'utf8');
assert.match(loader, /\/\\\/registre\\\/?\$\//);
assert.match(loader, /registry-altervordes-fields\.js/);

const cleanup = await readFile('shared/registry-altervordes-fields.js', 'utf8');
assert.match(cleanup, /ALTER_VORDES_TYPE = 'alter vordes'/);
assert.match(cleanup, /'языковые группы'/);
assert.match(cleanup, /'groups'/);
assert.match(cleanup, /\^pi/);
assert.match(cleanup, /MutationObserver/);
assert.match(cleanup, /\.card-tag--type/);

console.log('Alter vordes registry UI test passed.');

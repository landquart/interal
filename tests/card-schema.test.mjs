import assert from 'node:assert/strict';
import { getCardPiPercent, normalizeCardSchema, validateCardSchema, CardSchemaError, VORD_TYPE_LABELS } from '../shared/card-schema.mjs';

const base = { version: '1.0', card_type: 'vord_card', vord_type: 'iv', interal: { word: 'test' } };
assert.equal(VORD_TYPE_LABELS.iv, 'indoeuropan vordes');
assert.equal(getCardPiPercent({ ...base, result: { pi_percent: 0 } }), 0);
assert.equal(getCardPiPercent({ ...base, calculation: { pi_percent: 12.5 } }), 12.5);
assert.equal(getCardPiPercent({ ...base, pi_percent: 7 }), 7);
assert.equal(getCardPiPercent(base), undefined);
assert.equal(normalizeCardSchema({ ...base, calculation: { pi_percent: 0 } }).result.pi_percent, 0);
assert.doesNotThrow(() => validateCardSchema(base));
assert.doesNotThrow(() => validateCardSchema({ ...base, author: { display_name: 'Landquart' } }));
assert.doesNotThrow(() => validateCardSchema({ ...base, author: { contacts: [{ type: 'telegram', url: 'https://t.me/quinarta' }] } }));
assert.throws(() => validateCardSchema({ ...base, author: {} }), /author: must not be empty/);
assert.throws(() => validateCardSchema({ ...base, vord_type: 'xx' }), (error) => error instanceof CardSchemaError && error.path === 'vord_type');
assert.throws(() => validateCardSchema({ ...base, result: { pi_percent: '0' } }), /result\.pi_percent/);
console.log('card-schema tests passed');

import assert from 'node:assert/strict';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalLocation = globalThis.location;
const originalTextarea = globalThis.HTMLTextAreaElement;

class FakeTextarea {
  constructor() { this._value = ''; }
  get value() { return this._value; }
  set value(value) { this._value = String(value); }
}

try {
  const output = new FakeTextarea();
  const requests = [];
  globalThis.location = { pathname: '/associativvordes/' };
  globalThis.HTMLTextAreaElement = FakeTextarea;
  globalThis.document = {
    readyState: 'complete',
    querySelector: () => null,
    getElementById: id => id === 'jsonCardOutput' ? output : null
  };
  globalThis.window = {
    setTimeout,
    clearTimeout,
    fetch: async (url, init) => {
      requests.push({ url, init });
      return { ok: true };
    }
  };

  await import(`../shared/button-status.js?card-compat=${Date.now()}`);
  const broken = {
    version: '1.0',
    card_type: 'vord_card',
    vord_type: 'av',
    interal: { word: 'alter', type: 'root' },
    supported_groups: [],
    calculation: { represented_languages: null, represented_groups: null },
    language_results: [
      { code: 'en', word: 'alternative' },
      { code: 'de', word: 'Alternative' },
      { code: 'fr', word: 'alternatif' }
    ]
  };

  const normalized = window.InteralAssociativeCardCompat.normalizeAssociativeCard(broken);
  assert.deepEqual(normalized.supported_groups, ['Germanic', 'Romance']);
  assert.equal(normalized.calculation.represented_languages, 3);
  assert.equal(normalized.calculation.represented_groups, 2);
  assert.deepEqual(broken.supported_groups, [], 'compat normalizer does not mutate its input');

  output.value = JSON.stringify(broken);
  const localCard = JSON.parse(output.value);
  assert.deepEqual(localCard.supported_groups, ['Germanic', 'Romance']);
  assert.equal(localCard.calculation.represented_languages, 3);
  assert.equal(localCard.calculation.represented_groups, 2);

  output.value = `/card\n${JSON.stringify(broken)}\n/done`;
  assert.match(output.value, /^\/card\n/);
  assert.match(output.value, /"represented_languages": 3/);
  assert.match(output.value, /\n\/done$/);

  await window.fetch('/api/cards', {
    method: 'POST',
    body: JSON.stringify({ section: 'associativvordes', payload: broken })
  });
  const sent = JSON.parse(requests[0].init.body);
  assert.deepEqual(sent.payload.supported_groups, ['Germanic', 'Romance']);
  assert.equal(sent.payload.calculation.represented_languages, 3);
  assert.equal(sent.payload.calculation.represented_groups, 2);
} finally {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
  globalThis.HTMLTextAreaElement = originalTextarea;
}

console.log('associativvordes browser card compatibility tests passed');

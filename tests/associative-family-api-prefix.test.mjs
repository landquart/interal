import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyIndexPrefix } from '../api/family-index.js';

const V5 = 'associative-family/v5-staging/run-35461412225-68b305f48e4b-576b08b2ba90/';

test('family API rolls back to production v4 while retaining the exact v5 candidate', () => {
  const previous = process.env.ASSOCIATIVE_FAMILY_PREFIX;
  delete process.env.ASSOCIATIVE_FAMILY_PREFIX;
  try {
    assert.equal(familyIndexPrefix(), 'associative-family/v4/');
  } finally {
    if (previous === undefined) delete process.env.ASSOCIATIVE_FAMILY_PREFIX;
    else process.env.ASSOCIATIVE_FAMILY_PREFIX = previous;
  }
  assert.equal(familyIndexPrefix('associative-family/v4/'), 'associative-family/v4/');
  assert.equal(familyIndexPrefix(V5), V5);
  assert.throws(() => familyIndexPrefix('associative-family/v5/'), /Invalid associative family prefix/);
  assert.throws(() => familyIndexPrefix('associative-family/v5-staging/run-unapproved/'), /Invalid associative family prefix/);
  assert.throws(() => familyIndexPrefix('associative-family/v4/../v5/'), /Invalid associative family prefix/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyIndexPrefix } from '../api/family-index.js';

test('family API defaults to production v4 but permits isolated immutable v5 staging', () => {
  assert.equal(familyIndexPrefix('associative-family/v4/'), 'associative-family/v4/');
  assert.equal(familyIndexPrefix('associative-family/v5-staging/run-123-abc/'), 'associative-family/v5-staging/run-123-abc/');
  assert.throws(() => familyIndexPrefix('associative-family/v5/'), /Invalid associative family prefix/);
  assert.throws(() => familyIndexPrefix('associative-family/v4/../v5/'), /Invalid associative family prefix/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blobAuthOptions, readBlobRange } from '../api/family-index.js';

test('private Blob auth keeps static tokens and OIDC credentials distinct', () => {
  assert.deepEqual(blobAuthOptions({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw' }), { token: 'vercel_blob_rw' });
  assert.deepEqual(
    blobAuthOptions({ VERCEL_OIDC_TOKEN: 'oidc-jwt', BLOB_STORE_ID: 'store_123' }),
    { oidcToken: 'oidc-jwt', storeId: 'store_123' },
  );
  assert.equal(blobAuthOptions({}), null);
});

test('private Blob ranges use the SDK with an authenticated Range request', async () => {
  let received;
  const getBlob = async (url, options) => {
    received = { url, options };
    return { statusCode: 206, stream: new Response(Buffer.from('zip')).body };
  };
  const data = await readBlobRange(
    'https://store.private.blob.vercel-storage.com/archive.zip',
    10,
    12,
    getBlob,
    { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw' },
  );
  assert.equal(data.toString(), 'zip');
  assert.equal(received.url, 'https://store.private.blob.vercel-storage.com/archive.zip');
  assert.deepEqual(received.options, {
    access: 'private',
    headers: { Range: 'bytes=10-12' },
    token: 'vercel_blob_rw',
  });
});

test('private Blob ranges reject a full-object response', async () => {
  const getBlob = async () => ({ statusCode: 200, stream: new Response(Buffer.from('too-large')).body });
  await assert.rejects(
    readBlobRange('https://example.invalid/archive.zip', 0, 3, getBlob, { BLOB_READ_WRITE_TOKEN: 'token' }),
    /Blob range failed: 200/,
  );
});

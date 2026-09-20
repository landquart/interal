import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { list, put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required');

const [metadataFile, membersFile, prefix, output = 'staging-blob-manifest.json'] = process.argv.slice(2);
if (!metadataFile || !membersFile || !prefix) throw new Error('Usage: upload-associative-family-staging-blobs.mjs <metadata.zip> <members.zip> <staging-prefix> [output.json]');
if (!/^associative-family\/v5-staging\/[a-z0-9._-]+\/$/.test(prefix)) throw new Error(`Unsafe staging prefix: ${prefix}`);

async function sha256(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

const artifacts = [];
for (const [file, name] of [[metadataFile, 'metadata.zip'], [membersFile, 'members.zip']]) {
  const pathname = `${prefix}${name}`;
  const existing = await list({ prefix: pathname, limit: 10, token });
  if (existing.blobs.some(blob => blob.pathname === pathname)) throw new Error(`Immutable staging object already exists: ${pathname}`);
  const info = await stat(file);
  const digest = await sha256(file);
  const result = await put(pathname, createReadStream(file), { access: 'private', addRandomSuffix: false, allowOverwrite: false, multipart: true, token });
  const response = await fetch(result.url, { headers: { Range: 'bytes=0-3', Authorization: `Bearer ${token}` } });
  if (!(response.ok || response.status === 206)) throw new Error(`Staging Range smoke test failed for ${pathname}: ${response.status}`);
  const signature = Buffer.from(await response.arrayBuffer());
  if (signature.length < 4 || signature.readUInt32LE(0) !== 0x04034b50) throw new Error(`Uploaded object is not a ZIP: ${pathname}`);
  artifacts.push({ name, pathname, url: result.url, size: info.size, sha256: digest, range_status: response.status });
}

const manifest = { schema_version: 1, generated_at: new Date().toISOString(), source_commit: process.env.GITHUB_SHA || null, workflow_run_id: process.env.GITHUB_RUN_ID || null, prefix, immutable: true, artifacts };
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));

import { list } from '@vercel/blob';
import { inflateRawSync } from 'node:zlib';

const PREFIX = 'associative-family/v4/';
const archives = new Map();

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN
    || process.env.VERCEL_OIDC_TOKEN
    || Object.entries(process.env).find(([key, value]) => key.endsWith('_READ_WRITE_TOKEN') && String(value).startsWith('vercel_blob_'))?.[1];
}

function archiveName(path) {
  return path.startsWith('members/') ? 'members.zip' : 'metadata.zip';
}

async function range(url, start, end) {
  const token = blobToken();
  if (!token) throw Object.assign(new Error('Blob read credential unavailable'), { statusCode: 503 });
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, Authorization: `Bearer ${token}` } });
  if (!(response.ok || response.status === 206)) throw new Error(`Blob range failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function locate(name) {
  const pathname = `${PREFIX}${name}`;
  const token = blobToken();
  if (!token) throw Object.assign(new Error('Blob read credential unavailable'), { statusCode: 503 });
  const result = await list({ prefix: pathname, limit: 10, token });
  const blob = result.blobs.find(value => value.pathname === pathname);
  if (!blob) throw Object.assign(new Error(`Archive unavailable: ${name}`), { statusCode: 503 });
  return blob;
}

async function indexArchive(name) {
  const cached = archives.get(name);
  if (cached) return cached;
  const promise = (async () => {
    const blob = await locate(name);
    const size = Number(blob.size);
    const tailStart = Math.max(0, size - 65557);
    const tail = await range(blob.url, tailStart, size - 1);
    let eocd = -1;
    for (let offset = tail.length - 22; offset >= 0; offset--) {
      if (tail.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
    }
    if (eocd < 0) throw new Error(`ZIP directory missing: ${name}`);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    const directory = await range(blob.url, directoryOffset, directoryOffset + directorySize - 1);
    const entries = new Map();
    for (let offset = 0; offset < directory.length;) {
      if (directory.readUInt32LE(offset) !== 0x02014b50) throw new Error(`Invalid ZIP directory: ${name}`);
      const method = directory.readUInt16LE(offset + 10);
      const compressedSize = directory.readUInt32LE(offset + 20);
      const uncompressedSize = directory.readUInt32LE(offset + 24);
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      const localOffset = directory.readUInt32LE(offset + 42);
      const entryName = directory.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
      entries.set(entryName, { method, compressedSize, uncompressedSize, localOffset });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return { url: blob.url, entries };
  })();
  archives.set(name, promise);
  promise.catch(() => { if (archives.get(name) === promise) archives.delete(name); });
  return promise;
}

async function readEntry(path) {
  const archive = await indexArchive(archiveName(path));
  const entry = archive.entries.get(path);
  if (!entry) throw Object.assign(new Error(`Index entry missing: ${path}`), { statusCode: 404 });
  const header = await range(archive.url, entry.localOffset, entry.localOffset + 29);
  if (header.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid ZIP local header');
  const dataOffset = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const compressed = await range(archive.url, dataOffset, dataOffset + entry.compressedSize - 1);
  const data = entry.method === 0 ? compressed : entry.method === 8 ? inflateRawSync(compressed) : null;
  if (!data || data.length !== entry.uncompressedSize) throw new Error(`Unsupported or corrupt ZIP entry: ${path}`);
  return data;
}

export default async function handler(request, response) {
  try {
    const path = String(request.query?.path || '');
    const metadataPath = /^(aliases|families)\/[0-9a-f]{2}\.json$/.test(path);
    const memberPath = /^members\/[a-z]{2}\/[0-9a-f]{2}\.json$/.test(path);
    if (!/^(manifest|report)\.json$/.test(path) && !metadataPath && !memberPath) {
      return response.status(400).json({ error: 'Invalid family-index path' });
    }
    const data = await readEntry(path);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    return response.status(200).send(data);
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message || 'Family index unavailable' });
  }
}

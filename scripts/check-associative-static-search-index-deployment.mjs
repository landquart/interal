#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, sep } from 'node:path';
import { once } from 'node:events';
import { createCandidateIndexLoader } from '../associativvordes/js/candidate-index-loader.js';
import { SEARCH_NORMALIZER_VERSION } from '../associativvordes/js/search-normalizer.js';

const INDEX_ROOT = 'associativvordes/search-index';
const MANIFEST_PATH = `${INDEX_ROOT}/manifest.json`;
const REQUIRED_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const STATIC_MANIFEST_VERSION = '3';
const STATIC_INDEX_FORMAT = 'static-inverted-ngram-v2';

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRelativePath(file) {
  return typeof file === 'string' && file && !file.startsWith('/') && !file.includes('://') && !file.includes('\\') && !file.split('/').includes('..');
}

async function assertFile(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size <= 0) throw new Error(`Required static search file is missing or empty: ${path}`);
}

function contentType(path) {
  if (extname(path) === '.json') return 'application/json; charset=utf-8';
  if (extname(path) === '.js') return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

async function manifestOrSkip() {
  try {
    await access(MANIFEST_PATH);
  } catch {
    console.log('Static associative search index is not published yet; deployment check skipped.');
    return null;
  }
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  if (!isPlainObject(manifest)
    || manifest.version !== STATIC_MANIFEST_VERSION
    || manifest.normalizer_version !== SEARCH_NORMALIZER_VERSION
    || manifest.index_format !== STATIC_INDEX_FORMAT
    || !isPlainObject(manifest.languages)) throw new Error('Static associative search manifest is incompatible.');
  for (const language of REQUIRED_LANGUAGES) {
    const info = manifest.languages[language];
    if (!isPlainObject(info) || !Number.isInteger(info.entries) || info.entries <= 0 || !Array.isArray(info.entry_blocks) || !info.entry_blocks.length || !isPlainObject(info.postings)) throw new Error(`Static associative search manifest is missing ${language}.`);
    const firstBlock = info.entry_blocks[0];
    if (!isSafeRelativePath(firstBlock.file)) throw new Error(`Unsafe entry block path for ${language}.`);
    await assertFile(join(INDEX_ROOT, firstBlock.file));
    for (const length of ['1', '2', '3']) {
      const posting = info.postings[length];
      if (!isPlainObject(posting) || typeof posting.template !== 'string' || !posting.template.includes('{bucket}') || !Array.isArray(posting.buckets) || !posting.buckets.length) throw new Error(`Static postings metadata is missing for ${language}/${length}.`);
      const file = posting.template.replace('{bucket}', posting.buckets[0]);
      if (!isSafeRelativePath(file)) throw new Error(`Unsafe postings path for ${language}/${length}.`);
      await assertFile(join(INDEX_ROOT, file));
    }
  }
  return manifest;
}

async function runBrowserSmokeCheck() {
  const root = process.cwd();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';
      const diskPath = normalize(join(root, pathname));
      const rel = relative(root, diskPath);
      if (rel.startsWith('..') || rel === '..' || rel.startsWith(`..${sep}`)) return response.writeHead(403).end('Forbidden');
      const info = await stat(diskPath);
      if (!info.isFile()) return response.writeHead(404).end('Not found');
      response.writeHead(200, { 'content-type': contentType(diskPath) });
      createReadStream(diskPath).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}/associativvordes/search-index/`;
    const loader = createCandidateIndexLoader({ searchBaseUrl: base, legacyBaseUrl: `${base}missing/`, preferStatic: true, maxCachedResources: 16 });
    const regul = await loader.loadCandidateEntries('en', 'regul');
    if (!regul.length || !regul.some(entry => entry.search_form.includes('regul'))) throw new Error('Browser smoke check did not find an English regul candidate.');
    const middle = regul.find(entry => entry.search_form.indexOf('regul') > 0);
    if (!middle) throw new Error('Browser smoke check did not find a root outside the initial word position.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

const manifest = await manifestOrSkip();
if (manifest) {
  await runBrowserSmokeCheck();
  console.log('Static associative search index deployment check passed.');
}

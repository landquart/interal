#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, relative, sep } from 'node:path';
import { once } from 'node:events';

const REQUIRED_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const INDEX_ROOT = 'associativvordes/candidate-index';
const MANIFEST_PATH = `${INDEX_ROOT}/manifest.json`;
const LOADER_PATH = 'associativvordes/js/candidate-index-loader.js';
const SUPPORTED_VERSION = '1';
const SUPPORTED_NORMALIZER_VERSION = '2';

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRelativePath(file) {
  return typeof file === 'string' && file && !file.startsWith('/') && !file.includes('://') && !file.includes('\\') && !file.split('/').includes('..');
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    error.message = `Unable to read valid JSON from ${path}: ${error.message}`;
    throw error;
  }
}

async function assertFile(path) {
  let info;
  try {
    info = await stat(path);
  } catch {
    fail(`Required file is missing: ${path}`);
  }
  if (!info.isFile()) fail(`Required path is not a file: ${path}`);
  if (info.size <= 0) fail(`Required file is empty: ${path}`);
  return info;
}

function validateManifestShape(manifest) {
  if (!isObject(manifest)) fail('Production candidate-index manifest must be an object.');
  if (manifest.version !== SUPPORTED_VERSION) fail(`Production candidate-index manifest version must be ${SUPPORTED_VERSION}; found ${manifest.version ?? 'missing'}.`);
  if (manifest.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) fail(`Production candidate-index normalizer_version must be ${SUPPORTED_NORMALIZER_VERSION}; found ${manifest.normalizer_version ?? 'missing'}.`);
  if (!isObject(manifest.languages)) fail('Production candidate-index manifest.languages must be an object.');

  const publishedLanguages = Object.keys(manifest.languages);
  if (publishedLanguages.length === 0) fail('Production candidate-index manifest must not be empty.');

  for (const language of REQUIRED_LANGUAGES) {
    const info = manifest.languages[language];
    if (!isObject(info)) fail(`Production candidate-index manifest is missing required language: ${language}.`);
    if (!Number.isInteger(info.entries) || info.entries <= 0) fail(`Production candidate-index language ${language} must publish entries > 0.`);
    if (!Array.isArray(info.shards) || info.shards.length === 0) fail(`Production candidate-index language ${language} must list at least one shard.`);

    for (const shard of info.shards) {
      if (!isObject(shard) || !isSafeRelativePath(shard.file)) fail(`Production candidate-index language ${language} has an invalid shard path: ${shard?.file ?? 'missing'}.`);
      if (!Number.isInteger(shard.entries) || shard.entries <= 0) fail(`Production candidate-index shard ${shard.file} must publish entries > 0.`);
    }
  }
}

async function validateShardFiles(manifest) {
  for (const language of REQUIRED_LANGUAGES) {
    for (const shard of manifest.languages[language].shards) {
      const path = join(INDEX_ROOT, shard.file);
      await assertFile(path);
    }
  }
}

async function validateLoaderCompatibility() {
  const source = await readFile(LOADER_PATH, 'utf8');
  if (!source.includes('manifest.version') || !source.includes('SUPPORTED_MANIFEST_VERSION')) fail(`${LOADER_PATH} must validate manifest.version.`);
  if (!source.includes('manifest.normalizer_version') || !source.includes('SUPPORTED_NORMALIZER_VERSION')) fail(`${LOADER_PATH} must validate manifest.normalizer_version.`);
}

function contentType(path) {
  if (extname(path) === '.json') return 'application/json; charset=utf-8';
  if (extname(path) === '.html') return 'text/html; charset=utf-8';
  if (extname(path) === '.js') return 'text/javascript; charset=utf-8';
  if (extname(path) === '.css') return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

async function runBrowserSmokeCheck() {
  const root = process.cwd();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';
      const diskPath = normalize(join(root, pathname));
      const rel = relative(root, diskPath);
      if (rel.startsWith('..') || rel === '..' || rel.startsWith(`..${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(diskPath);
      if (!info.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
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
    const pageUrl = `http://127.0.0.1:${port}/associativvordes/`;
    const manifestUrl = new URL('./candidate-index/manifest.json', pageUrl);
    // Browser smoke-check equivalent: fetch('./candidate-index/manifest.json') from associativvordes/index.html.
    const response = await fetch(manifestUrl);
    if (response.status !== 200) fail(`Browser smoke-check expected HTTP 200 for ./candidate-index/manifest.json; received ${response.status}.`);
    await response.json();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

await assertFile(MANIFEST_PATH);
const manifest = await readJson(MANIFEST_PATH);
validateManifestShape(manifest);
await validateShardFiles(manifest);
await validateLoaderCompatibility();
await runBrowserSmokeCheck();

console.log('Associative candidate-index deployment check passed.');

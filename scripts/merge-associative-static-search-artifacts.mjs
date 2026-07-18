#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SEARCH_NORMALIZER_VERSION } from '../associativvordes/js/search-normalizer.js';
import { AFFIX_SEARCH_CONFIG_VERSION } from '../associativvordes/js/affix-search-config.js';
import { STATIC_INDEX_FORMAT, STATIC_MANIFEST_VERSION } from '../associativvordes/js/affix-boundary-index.js';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg.startsWith('--input-root=')) options.inputRoot = arg.slice('--input-root='.length);
    else if (arg.startsWith('--output-root=')) options.outputRoot = arg.slice('--output-root='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.inputRoot || !options.outputRoot) throw new Error('--input-root and --output-root are required');
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function mergeStaticSearchArtifacts({ inputRoot, outputRoot }) {
  const mergedRoot = join(outputRoot, 'search-index');
  await rm(mergedRoot, { recursive: true, force: true });
  await mkdir(mergedRoot, { recursive: true });
  let shared = null;
  const languages = {};
  for (const language of LANGUAGES) {
    const artifactRoot = join(inputRoot, `associative-search-index-${language}`);
    const manifest = await readJson(join(artifactRoot, 'manifest.json'));
    if (manifest.version !== STATIC_MANIFEST_VERSION
      || manifest.normalizer_version !== SEARCH_NORMALIZER_VERSION
      || manifest.affix_config_version !== AFFIX_SEARCH_CONFIG_VERSION
      || manifest.index_format !== STATIC_INDEX_FORMAT
      || !manifest.languages?.[language]) throw new Error(`Invalid static search artifact for ${language}`);
    const currentShared = {
      version: manifest.version,
      normalizer_version: manifest.normalizer_version,
      affix_config_version: manifest.affix_config_version,
      index_format: manifest.index_format,
      source_manifest_version: manifest.source_manifest_version,
      source_normalizer_version: manifest.source_normalizer_version,
      global_config_hash: manifest.global_config_hash ?? manifest.config_hash
    };
    if (!shared) shared = currentShared;
    else if (JSON.stringify(shared) !== JSON.stringify(currentShared)) throw new Error(`Static search artifact configuration mismatch for ${language}`);
    languages[language] = manifest.languages[language];
    await cp(join(artifactRoot, language), join(mergedRoot, language), { recursive: true });
  }
  const manifest = { ...shared, generated_at: new Date().toISOString(), languages };
  await writeFile(join(mergedRoot, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  return manifest;
}

export async function main(argv = process.argv.slice(2)) {
  return mergeStaticSearchArtifacts(parseArgs(argv));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}

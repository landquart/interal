import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { main as mergeArtifacts } from '../scripts/merge-associative-index-artifacts.mjs';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const CONFIG_HASH = 'fixture-global-config-hash';

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function entry(language, index = 1, overrides = {}) {
  return {
    word: `${language}-word-${index}`,
    normalized: `${language}-word-${index}`,
    search_form: `${language}-word-${index}`,
    rank: null,
    frequency_score: 42 + index,
    category_breakdown: { normative: { ipm_values: [index], category_ipm: index, category_score: 42 + index } },
    sources: [{ id: `normative/${language}.json`, ipm: index }],
    ...overrides
  };
}

async function makeArtifact(root, language, options = {}) {
  const artifactRoot = join(root, `associative-index-${options.directoryLanguage ?? language}`);
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(join(artifactRoot, language), { recursive: true });
  const shardEntries = options.entriesArray ?? [entry(language, 1), entry(language, 2)];
  const shardFile = `${language}/a.json`;
  if (!options.missingShard) await writeJson(join(artifactRoot, shardFile), shardEntries);
  const entries = options.entries ?? shardEntries.length;
  const manifest = {
    version: options.version ?? '1',
    normalizer_version: options.normalizerVersion ?? '2',
    global_config_hash: options.globalConfigHash ?? options.configHash ?? CONFIG_HASH,
    generated_at: options.generatedAt ?? '2026-01-01T00:00:00.000Z',
    languages: {
      [options.manifestLanguage ?? language]: {
        language_config_hash: options.languageConfigHash ?? `fixture-${language}-language-config-hash`,
        entries,
        source_files: [`normative/${language}.json`],
        shards: [{ file: options.shardFile ?? shardFile, entries: options.shardEntries ?? shardEntries.length }]
      }
    }
  };
  await writeJson(join(artifactRoot, 'manifest.json'), manifest);
  await writeJson(join(artifactRoot, 'build-report.json'), {
    language: options.reportLanguage ?? language,
    entries,
    duplicates_merged: 0,
    invalid_records: 0,
    source_files: [`normative/${language}.json`],
    shards: [{ file: shardFile, entries: shardEntries.length }],
    total_bytes: 0,
    root_samples: { alter: [], regul: [], ocul: [], inter: [] }
  });
}

async function fixtureRoot(mutator) {
  const root = await mkdtemp(join(tmpdir(), 'assoc-merge-'));
  const input = join(root, 'artifacts');
  const output = join(root, 'merged');
  await mkdir(input, { recursive: true });
  for (const language of LANGUAGES) await makeArtifact(input, language);
  if (mutator) await mutator(input, output, root);
  return { root, input, output };
}

async function readManifest(output) {
  return JSON.parse(await readFile(join(output, 'candidate-index', 'manifest.json'), 'utf8'));
}

async function expectReject(mutator, pattern) {
  const { root, input, output } = await fixtureRoot(mutator);
  try {
    await assert.rejects(() => mergeArtifacts([`--input-root=${input}`, `--output-root=${output}`]), pattern);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await test('five valid artifacts merge into one separated candidate-index manifest', async () => {
  const { root, input, output } = await fixtureRoot(async input => {
    await rm(join(input, 'associative-index-fr'), { recursive: true, force: true });
    await makeArtifact(input, 'fr', { generatedAt: '2099-01-01T00:00:00.000Z' });
  });
  try {
    await mergeArtifacts([`--input-root=${input}`, `--output-root=${output}`]);
    const manifest = await readManifest(output);
    assert.deepEqual(Object.keys(manifest.languages), LANGUAGES);
    assert.equal(manifest.global_config_hash, CONFIG_HASH);
    assert.equal(manifest.languages.en.language_config_hash, 'fixture-en-language-config-hash');
    assert.equal(manifest.languages.en.entries, 2);
    assert.ok(manifest.languages.en.shards.every(shard => shard.file.startsWith('en/') && !shard.file.startsWith('/')));
    assert.ok(await readFile(join(output, 'candidate-index', 'de', 'a.json'), 'utf8'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('rejects incompatible version', () => expectReject(input => makeArtifact(input, 'de', { version: '2' }), /unsupported version/));
await test('rejects incompatible normalizer_version', () => expectReject(input => makeArtifact(input, 'de', { normalizerVersion: '1' }), /normalizer_version/));
await test('rejects missing shard', () => expectReject(input => makeArtifact(input, 'de', { missingShard: true }), /missing shard/));
await test('rejects incorrect entries metadata', () => expectReject(input => makeArtifact(input, 'de', { entries: 99 }), /entries metadata mismatch|build-report entries mismatch/));
await test('rejects candidate without sources', () => expectReject(input => makeArtifact(input, 'de', { entriesArray: [entry('de', 1, { sources: [] })] }), /without sources/));
await test('rejects damaged non-finite number value', () => expectReject(input => makeArtifact(input, 'de', { entriesArray: [entry('de', 1, { frequency_score: null })] }), /finite number/));
await test('rejects language mismatch between directory and manifest', () => expectReject(input => makeArtifact(input, 'de', { manifestLanguage: 'en' }), /manifest language must match/));

await test('error keeps existing output and removes temp directory', async () => {
  const { root, input, output } = await fixtureRoot(async (_input, output) => {
    await mkdir(join(output, 'candidate-index'), { recursive: true });
    await writeFile(join(output, 'candidate-index', 'sentinel.txt'), 'keep');
    await makeArtifact(_input, 'de', { missingShard: true });
  });
  try {
    await assert.rejects(() => mergeArtifacts([`--input-root=${input}`, `--output-root=${output}`]), /missing shard/);
    assert.equal(await readFile(join(output, 'candidate-index', 'sentinel.txt'), 'utf8'), 'keep');
    await assert.rejects(() => readFile(`${output}.tmp`), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('rerun is deterministic, does not duplicate, and removes stale shards', async () => {
  const { root, input, output } = await fixtureRoot();
  try {
    await mergeArtifacts([`--input-root=${input}`, `--output-root=${output}`]);
    await writeFile(join(output, 'candidate-index', 'en', 'stale.json'), '[]');
    const first = JSON.stringify(await readManifest(output));
    await mergeArtifacts([`--input-root=${input}`, `--output-root=${output}`]);
    const secondManifest = await readManifest(output);
    assert.equal(JSON.stringify(secondManifest), first);
    assert.equal(Object.keys(secondManifest.languages).length, LANGUAGES.length);
    await assert.rejects(() => readFile(join(output, 'candidate-index', 'en', 'stale.json')), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('input directory order does not change manifest', async () => {
  const one = await fixtureRoot();
  const twoRoot = await mkdtemp(join(tmpdir(), 'assoc-merge-'));
  const two = { root: twoRoot, input: join(twoRoot, 'artifacts'), output: join(twoRoot, 'merged') };
  await mkdir(two.input, { recursive: true });
  for (const language of [...LANGUAGES].reverse()) await makeArtifact(two.input, language);
  try {
    await mergeArtifacts([`--input-root=${one.input}`, `--output-root=${one.output}`]);
    await mergeArtifacts([`--input-root=${two.input}`, `--output-root=${two.output}`]);
    assert.equal(JSON.stringify(await readManifest(one.output)), JSON.stringify(await readManifest(two.output)));
  } finally {
    await rm(one.root, { recursive: true, force: true });
    await rm(two.root, { recursive: true, force: true });
  }
});

await test('one artifact cannot silently overwrite another language', async () => {
  await expectReject(async input => {
    await rm(join(input, 'associative-index-it'), { recursive: true, force: true });
    await cp(join(input, 'associative-index-en'), join(input, 'associative-index-it'), { recursive: true });
  }, /manifest language must match/);
});

await test('rejects incompatible global_config_hash', () => expectReject(input => makeArtifact(input, 'ru', { globalConfigHash: 'other-global-hash' }), /global_config_hash/));

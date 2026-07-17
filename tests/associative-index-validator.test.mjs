import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCandidateIndexLoader } from '../associativvordes/js/candidate-index-loader.js';
import { appendItems } from '../scripts/validate-associative-index.mjs';

const fixture = 'tests/fixtures/associative-index-valid';
const tmp = '.tmp/associative-index-validator';

const builderScript = 'scripts/build-associative-candidate-index.mjs';
const fixtureFrequencyRoot = 'tests/fixtures/associative-frequency';

const entry = (word, search_form, extra = {}) => ({
  word, normalized: extra.normalized ?? word.toLowerCase(), search_form, rank: null, frequency_score: extra.frequency_score ?? 50,
  category_breakdown: { normative: { max_ipm: 1, total_ipm: 1, sources: 1 } },
  sources: extra.sources ?? [{ id: 'normative/source.json', file: 'source.json', category: 'normative', ipm: 1 }]
});

const largeInput = Array.from({ length: 500_000 }, (_, index) => index);
const largeOutput = [];
assert.doesNotThrow(() => appendItems(largeOutput, largeInput), 'validator accumulation must not depend on argument spread limits');
assert.equal(largeOutput.length, largeInput.length, 'validator accumulation preserves every large-shard entry');
assert.equal(largeOutput.at(-1), largeInput.at(-1), 'validator accumulation preserves entry order');

async function writeJson(path, value) { await mkdir(join(path, '..'), { recursive: true }).catch(() => {}); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); }
async function makeValid(root = fixture) {
  await rm(root, { recursive: true, force: true });
  await mkdir(join(root, 'en'), { recursive: true });
  await mkdir(join(root, 'ru'), { recursive: true });
  const en = [entry('alter', 'alter'), entry('altesation', 'altesation'), entry('inter', 'inter')];
  const ru = [entry('альтернативный', 'alternativnyj', { normalized: 'альтернативный' }), entry('альтернатива', 'alternativa', { normalized: 'альтернатива' })];
  en.sort((a,b)=>`${a.search_form}\0${a.normalized}\0${a.word}`.localeCompare(`${b.search_form}\0${b.normalized}\0${b.word}`));
  ru.sort((a,b)=>`${a.search_form}\0${a.normalized}\0${a.word}`.localeCompare(`${b.search_form}\0${b.normalized}\0${b.word}`));
  await writeJson(join(root, 'en/a.json'), en.filter(e => e.search_form[0] === 'a'));
  await writeJson(join(root, 'en/i.json'), en.filter(e => e.search_form[0] === 'i'));
  await writeJson(join(root, 'ru/a.json'), ru);
  await writeJson(join(root, 'manifest.json'), { version: '1', normalizer_version: '2', global_config_hash: 'fixture-global', languages: { en: { language_config_hash: 'fixture-en', entries: 3, shards: [{ file: 'en/a.json', entries: 2 }, { file: 'en/i.json', entries: 1 }] }, ru: { language_config_hash: 'fixture-ru', entries: 2, shards: [{ file: 'ru/a.json', entries: 2 }] } } });
}
async function fresh(name) { const root = join(tmp, name); await rm(root, { recursive: true, force: true }); await cp(fixture, root, { recursive: true }); return root; }
function run(root, args = []) { return spawnSync(process.execPath, ['scripts/validate-associative-index.mjs', `--index-root=${root}`, '--strict', ...args], { encoding: 'utf8' }); }
async function mutate(name, fn) { const root = await fresh(name); await fn(root); return root; }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

await makeValid(); await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true });

assert.equal(run(fixture).status, 0, 'valid fixture-index passes');
assert.equal(run(join(tmp, 'missing')).status, 3, 'missing manifest is rejected');
assert.equal(run(await mutate('bad-version', async r => { const m = await readJson(join(r,'manifest.json')); m.version='0'; await writeJson(join(r,'manifest.json'), m); })).status, 4, 'incompatible version is rejected');
assert.equal(run(await mutate('bad-normalizer', async r => { const m = await readJson(join(r,'manifest.json')); m.normalizer_version='0'; await writeJson(join(r,'manifest.json'), m); })).status, 4, 'incompatible normalizer_version is rejected');
assert.equal(run(await mutate('missing-shard', r => rm(join(r,'en/a.json')))).status, 1, 'missing shard is rejected');
assert.equal(run(await mutate('extra-shard', r => writeJson(join(r,'en/z.json'), []))).status, 1, 'extra shard is detected');
assert.equal(run(await mutate('wrong-entries', async r => { const m=await readJson(join(r,'manifest.json')); m.languages.en.entries=4; await writeJson(join(r,'manifest.json'),m); })).status, 1, 'wrong entries detected');
assert.equal(run(await mutate('no-sources', async r => { const a=await readJson(join(r,'en/a.json')); a[0].sources=[]; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'entry without sources rejected');
assert.equal(run(await mutate('nan-like', async r => { await writeFile(join(r,'en/a.json'), (await readFile(join(r,'en/a.json'),'utf8')).replace('50','NaN')); })).status, 1, 'NaN-like corruption rejected');
assert.equal(run(await mutate('inf-like', async r => { await writeFile(join(r,'en/a.json'), (await readFile(join(r,'en/a.json'),'utf8')).replace('50','Infinity')); })).status, 1, 'Infinity-like corruption rejected');
assert.equal(run(await mutate('negative-ipm', async r => { const a=await readJson(join(r,'en/a.json')); a[0].sources[0].ipm=-1; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'negative IPM rejected');
assert.equal(run(await mutate('missing-source-category', async r => { const a=await readJson(join(r,'en/a.json')); delete a[0].sources[0].category; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'source without category rejected');
assert.equal(run(await mutate('missing-source-ipm', async r => { const a=await readJson(join(r,'en/a.json')); delete a[0].sources[0].ipm; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'source without ipm rejected');
assert.equal(run(await mutate('source-file-path', async r => { const a=await readJson(join(r,'en/a.json')); a[0].sources[0].file='normative/source.json'; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'source file path rejected');
assert.equal(run(await mutate('duplicate-normalized', async r => { const a=await readJson(join(r,'en/a.json')); a[1].normalized=a[0].normalized; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'duplicate normalized detected');
assert.equal(run(await mutate('absolute-source', async r => { const a=await readJson(join(r,'en/a.json')); a[0].sources[0].id='/tmp/source.json'; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'absolute source path detected');
assert.equal(run(await mutate('traversal', async r => { const m=await readJson(join(r,'manifest.json')); m.languages.en.shards[0].file='../x.json'; await writeJson(join(r,'manifest.json'),m); })).status, 1, 'path traversal detected');
assert.equal(run(await mutate('wrong-shard', async r => { const a=await readJson(join(r,'en/a.json')); a[0].search_form='zeta'; await writeJson(join(r,'en/a.json'),a); })).status, 1, 'wrong shard for search_form detected');
assert.equal(run(await mutate('shuffled-shard', async r => { const a=await readJson(join(r,'en/a.json')); a.reverse(); await writeJson(join(r,'en/a.json'),a); })).status, 1, 'truly shuffled shard is rejected');
const builderOut = join(tmp, 'builder-output');
await rm(builderOut, { recursive: true, force: true });
const builderRun = spawnSync(process.execPath, [builderScript, '--languages=en', `--input-root=${fixtureFrequencyRoot}`, `--output-root=${builderOut}`, '--max-records=5000'], { encoding: 'utf8' });
assert.equal(builderRun.status, 0, builderRun.stderr || builderRun.stdout);
assert.equal(run(builderOut).status, 0, 'validator accepts shard produced by builder');

assert.equal(run(await mutate('ru-lost-original', async r => { const a=await readJson(join(r,'ru/a.json')); a[0].normalized='alternativnyj'; await writeJson(join(r,'ru/a.json'),a); })).status, 1, 'Russian original/normalized Cyrillic is preserved');
assert.equal(run(await mutate('ru-collision', async r => { const a=await readJson(join(r,'ru/a.json')); a[1].search_form=a[0].search_form; await writeJson(join(r,'ru/a.json'),a); })).status, 0, 'search_form collisions are not duplicate normalized');
assert.equal(run(await mutate('alter-inter', async r => { const a=await readJson(join(r,'en/a.json')); a.push(entry('inter','alter',{normalized:'inter'})); a.sort((x,y)=>`${x.search_form}\0${x.normalized}\0${x.word}`.localeCompare(`${y.search_form}\0${y.normalized}\0${y.word}`)); await writeJson(join(r,'en/a.json'),a); const m=await readJson(join(r,'manifest.json')); m.languages.en.entries++; m.languages.en.shards[0].entries++; await writeJson(join(r,'manifest.json'),m); })).status, 1, 'alter to inter regression detected');
assert.equal(run(fixture, ['--languages=de']).status, 1, 'empty root sample is not special-cased as an error, missing requested language is');
const reportRoot = await mutate('report-limit', async r => { await writeFile(join(r,'bad.tmp'),'x'); await writeJson(join(r,'en/z.json'), []); });
const reportPath = join(tmp, 'report.json'); assert.equal(run(reportRoot, [`--report=${reportPath}`, '--max-errors=1']).status, 1); assert.equal((await readJson(reportPath)).errors.length, 1, 'report limits errors');
assert.notEqual(spawnSync(process.execPath, ['scripts/validate-associative-index.mjs', `--index-root=${reportRoot}`, '--strict'], { encoding:'utf8' }).status, 0, 'strict returns non-zero');
const before = await readFile(join(fixture,'manifest.json'),'utf8'); assert.equal(run(fixture).status, 0); assert.equal(await readFile(join(fixture,'manifest.json'),'utf8'), before, 'validator does not modify index');
assert.equal(run(await mutate('tmp-file', r => writeFile(join(r,'en','leftover.tmp'),'x'))).status, 1, 'temporary files detected');
assert.equal(run(await mutate('corpus-file', r => writeFile(join(r,'en','frequency-corpus.out.gz.json'),'[]'))).status, 1, 'source frequency corpus detected');
const routes = Object.fromEntries((await Promise.all(['manifest.json','en/a.json'].map(async p => [`./candidate-index/${p}`, JSON.parse(await readFile(join(fixture,p),'utf8'))]))));
const loader = createCandidateIndexLoader({ fetch: async url => ({ ok: Boolean(routes[url]), json: async () => routes[url] }) });
assert.equal((await loader.loadCandidateEntries('en', 'alter'))[0].word, 'alter', 'runtime loader reads valid fixture-index');
assert.ok(existsSync(fixture), 'fixture exists for npm script validation');

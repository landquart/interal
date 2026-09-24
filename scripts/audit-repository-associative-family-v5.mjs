#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const output = process.argv[3] || 'audit/associative-family-v5/repository-static-integrity.json';
const expectedRunId = 35647932153;
const languages = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const noise = new Set(['brokethemouldaftertheymadepeter','pediatricianand','pediatricianwho','helpedallof','eroticizedit','dutheillet','madrillet','ennuyeux']);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const bucket = value => {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
};
const readJson = async path => {
  const data = await readFile(path);
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(data).toString('utf8') : data.toString('utf8'));
};
const shardNames = async path => (await readdir(path)).filter(name => name.endsWith('.json.gz')).sort();

async function files(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await files(path)); else out.push(path);
  }
  return out;
}
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenance = await readJson(join(root, 'repository-provenance.json'));
assert(manifest.version === '5', `manifest version ${manifest.version}`);
assert(JSON.stringify(manifest.languages) === JSON.stringify(languages), 'unexpected language set/order');
assert(Number(manifest.repository_storage?.immutable_source_run_id) === expectedRunId, 'manifest source run mismatch');
assert(manifest.repository_storage?.encoding === 'gzip', 'manifest encoding is not gzip');
assert(Number(report.provenance?.workflow_run_id) === expectedRunId, 'report source run mismatch');
assert(Number(provenance.source_run_id) === expectedRunId, 'repository provenance source run mismatch');
assert(provenance.storage === 'git_repository_static_files', 'repository provenance storage mismatch');
const provenancePath = join(root, 'repository-provenance.json');
const provenanceFiles = (await files(root)).filter(path => path !== provenancePath).sort();
const provenanceHash = createHash('sha256');
let provenanceBytes = 0;
for (const path of provenanceFiles) {
  const data = await readFile(path);
  provenanceBytes += data.length;
  provenanceHash.update(path.slice(root.length + 1)).update('\0').update(data);
}
assert(provenanceFiles.length === provenance.file_count_before_provenance, 'provenance file count mismatch');
assert(provenanceBytes === provenance.total_bytes_before_provenance, 'provenance byte count mismatch');
assert(provenanceHash.digest('hex') === provenance.tree_content_sha256, 'provenance tree hash mismatch');
const repair = provenance.repository_repairs?.find(item => item.repair === 'exclude_known_rejected_corpus_noise_from_runtime');
assert(repair?.removed_memberships === 30 && repair?.removed_lemmas === 9 && repair?.deleted_empty_families === 1, 'repository repair provenance mismatch');
const manualLedgerBytes = await readFile('audit/associative-family-v5/manual-case-decisions.json');
const manualLedger = JSON.parse(manualLedgerBytes);
const manualLedgerSha = createHash('sha256').update(manualLedgerBytes).digest('hex');
const manualRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_individually_reviewed_false_memberships');
assert(manualLedger.source_run_id === expectedRunId && manualLedger.rejected_memberships.length === 22, 'manual case ledger mismatch');
assert(manualRepair?.removed_memberships === 22 && manualRepair?.decision_ledger_sha256 === manualLedgerSha, 'manual case repair provenance mismatch');
assert(JSON.stringify(manualRepair.quarantined_families) === JSON.stringify(manualLedger.quarantined_families.map(item => item.family_id)), 'quarantined family provenance mismatch');
assert(report.repository_materialization?.manual_case_ledger_sha256 === manualLedgerSha, 'report manual case ledger mismatch');
assert(report.repository_materialization?.manually_quarantined_sense_ambiguous_families === 1, 'report quarantine count mismatch');
const surfaceLedgerBytes = await readFile('audit/associative-family-v5/manual-surface-family-decisions.json');
const surfaceLedger = JSON.parse(surfaceLedgerBytes);
const surfaceLedgerSha = createHash('sha256').update(surfaceLedgerBytes).digest('hex');
const surfaceRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_reviewed_surface_families');
const surfaceRemoved = surfaceLedger.decisions.reduce((sum, item) => sum + item.reviewed_words.length, 0);
assert(surfaceLedger.source_run_id === expectedRunId && surfaceLedger.decisions.length === 3, 'surface family ledger mismatch');
assert(surfaceRepair?.removed_memberships === surfaceRemoved && surfaceRepair?.decision_ledger_sha256 === surfaceLedgerSha, 'surface repair provenance mismatch');
assert(JSON.stringify(surfaceRepair.deleted_families) === JSON.stringify(surfaceLedger.decisions.map(item => item.family_id)), 'surface deleted families mismatch');
assert(report.repository_materialization?.surface_case_ledger_sha256 === surfaceLedgerSha, 'report surface ledger mismatch');
const surfaceLedger2Bytes = await readFile('audit/associative-family-v5/manual-surface-family-decisions-2.json');
const surfaceLedger2 = JSON.parse(surfaceLedger2Bytes);
const surfaceLedger2Sha = createHash('sha256').update(surfaceLedger2Bytes).digest('hex');
const surfaceRepair2 = provenance.repository_repairs?.find(item => item.repair === 'remove_reviewed_surface_families_batch_2');
const surfaceRemoved2 = surfaceLedger2.decisions.reduce((sum, item) => sum + item.reviewed_words.length, 0);
assert(surfaceLedger2.source_run_id === expectedRunId && surfaceLedger2.decisions.length === 3, 'surface family second ledger mismatch');
assert(surfaceRepair2?.removed_memberships === surfaceRemoved2 && surfaceRepair2?.decision_ledger_sha256 === surfaceLedger2Sha, 'surface second repair provenance mismatch');
assert(JSON.stringify(surfaceRepair2.deleted_families) === JSON.stringify(surfaceLedger2.decisions.map(item => item.family_id)), 'surface second deleted families mismatch');
assert(report.repository_materialization?.surface_case_ledger_2_sha256 === surfaceLedger2Sha, 'report second surface ledger mismatch');
assert(report.repository_materialization?.reviewed_surface_memberships_removed === surfaceRemoved + surfaceRemoved2, 'report surface removal count mismatch');
const deletedSurfaceFamilies = new Set([...surfaceLedger.decisions, ...surfaceLedger2.decisions].map(item => item.family_id));
const rejectedManualKeys = new Set(manualLedger.rejected_memberships.map(item => `${item.language}\0${item.family_id}\0${item.lemma_id}`));
const preservedManualKeys = new Set(manualLedger.preserved_positive_controls.map(item => `${item.language}\0${item.family_id}\0${item.word}`));
assert(rejectedManualKeys.size === 22, 'duplicate rejected manual memberships');
const quarantinedManualFamilies = new Map(manualLedger.quarantined_families.map(item => [item.family_id, item.new_status]));
const reportFamilySummaries = new Map();
for (const section of ['largest_families', 'highest_suspicion_families']) {
  for (const item of report[section] || []) {
    const summaries = reportFamilySummaries.get(item.id) || [];
    summaries.push({ section, item });
    reportFamilySummaries.set(item.id, summaries);
  }
}
assert(report.controls_ok === true, 'controls_ok=false');
for (const [name, value] of Object.entries(report.invariants || {})) {
  if (typeof value === 'boolean') assert(value, `invariant ${name}=false`);
}
for (const name of ['lemmas_with_zero_family','families_with_zero_members','members_without_evidence','fuzzy_memberships','levenshtein_memberships','untyped_family_edges','untyped_or_illegal_equivalence_edges','compound_edges_used_as_equivalence','unreviewed_high_risk_families']) {
  assert(report.invariants?.[name] === 0, `invariant ${name}=${report.invariants?.[name]}`);
}
assert(manifest.counts.lemmas === report.invariants.source_lemmas, 'manifest/report source lemma mismatch');
assert(manifest.counts.lemmas === report.invariants.classified_unique_lemmas, 'manifest/report classified lemma mismatch');
assert(manifest.counts.components === report.components_discovered, 'manifest/report discovered component mismatch');
assert(report.components_discovered === report.components_assigned, 'discovered/assigned component mismatch');
assert(manifest.sharding?.alias_template === 'aliases/{bucket}.json.gz', 'invalid alias runtime template');
assert(manifest.sharding?.family_template === 'families/{bucket}.json.gz', 'invalid family runtime template');
assert(manifest.sharding?.member_template === 'members/{language}/{bucket}.json.gz', 'invalid member runtime template');

const familyFiles = await shardNames(join(root, 'families'));
const aliasFiles = await shardNames(join(root, 'aliases'));
assert(familyFiles.length === 256, `family shards ${familyFiles.length}`);
assert(aliasFiles.length === 256, `alias shards ${aliasFiles.length}`);
for (const language of languages) {
  const files = await shardNames(join(root, 'members', language));
  assert(files.length === 256, `${language} member shards ${files.length}`);
}

const familyIdsByBucket = Array.from({ length: 256 }, () => new Set());
const requiredAliasPairs = new Map();
let familyCount = 0;
let membershipCount = 0;
const membershipsByLanguage = Object.fromEntries(languages.map(language => [language, 0]));
let materializedFamilyCount = 0;
const liberLanguages = new Set();
const noiseFindings = [];

for (let index = 0; index < 256; index += 1) {
  const shard = index.toString(16).padStart(2, '0');
  const families = await readJson(join(root, 'families', `${shard}.json.gz`));
  const ids = familyIdsByBucket[index];
  const actual = new Map();
  for (const [id, family] of Object.entries(families)) {
    assert(id === family.id, `family key mismatch ${id}`);
    assert(bucket(id) === shard, `family bucket mismatch ${id}`);
    assert(id !== 'family:libert', 'removed family:libert is present');
    assert(!deletedSurfaceFamilies.has(id), `reviewed surface family still present ${id}`);
    assert(!ids.has(id), `duplicate family ${id}`);
    assert(family.support > 0 && family.canonical && Array.isArray(family.aliases) && family.aliases.length, `invalid family ${id}`);
    if (quarantinedManualFamilies.has(id)) {
      assert(family.review_status === quarantinedManualFamilies.get(id), `manual quarantine status mismatch ${id}`);
      quarantinedManualFamilies.delete(id);
    }
    for (const { section, item } of reportFamilySummaries.get(id) || []) {
      assert(item.support === family.support, `${section} support mismatch ${id}`);
      assert(JSON.stringify(item.language_support) === JSON.stringify(family.language_support), `${section} language support mismatch ${id}`);
    }
    ids.add(id);
    actual.set(id, Object.fromEntries(languages.map(language => [language, 0])));
    for (const alias of new Set(family.aliases)) {
      let targets = requiredAliasPairs.get(alias);
      if (!targets) requiredAliasPairs.set(alias, targets = new Set());
      targets.add(id);
    }
    familyCount += 1;
  }
  for (const language of languages) {
    const members = await readJson(join(root, 'members', language, `${shard}.json.gz`));
    for (const [id, values] of Object.entries(members)) {
      assert(bucket(id) === shard, `${language} member bucket mismatch ${id}`);
      assert(ids.has(id), `${language} members reference missing family ${id}`);
      assert(Array.isArray(values) && values.length, `${language} empty member list ${id}`);
      const seen = new Set();
      for (const value of values) {
        assert(value.lemma_id && !seen.has(value.lemma_id), `${language} duplicate/invalid member ${id}`);
        assert(typeof value.word === 'string' && value.word, `${language} missing member word ${id}`);
        assert(typeof value.search_form === 'string' && value.search_form, `${language} missing search form ${id}`);
        assert(Number.isFinite(value.frequency_score) && value.frequency_score >= 0 && value.frequency_score <= 100, `${language} invalid frequency ${id}`);
        assert(Array.isArray(value.sources) && value.sources.length, `${language} missing sources ${id}`);
        assert(Array.isArray(value.components) && value.components.length, `${language} missing components ${id}`);
        for (const component of value.components) assert(component.canonical_candidate && component.evidence?.length, `${language} missing component evidence ${id}`);
        if (noise.has(String(value.word).toLowerCase())) noiseFindings.push({ language, family_id: id, lemma_id: value.lemma_id, word: value.word });
        assert(!rejectedManualKeys.has(`${language}\0${id}\0${value.lemma_id}`), `rejected manual membership still present ${language}/${id}/${value.word}`);
        preservedManualKeys.delete(`${language}\0${id}\0${value.word}`);
        seen.add(value.lemma_id);
      }
      actual.get(id)[language] = values.length;
      membershipCount += values.length;
      membershipsByLanguage[language] += values.length;
      if (id === 'family:liber') liberLanguages.add(language);
    }
  }
  for (const [id, family] of Object.entries(families)) {
    const counts = actual.get(id);
    const support = Object.values(counts).reduce((sum, value) => sum + value, 0);
    assert(support > 0, `family without materialized members ${id}`);
    assert(support === family.support, `support mismatch ${id}: ${support}/${family.support}`);
    for (const language of languages) assert(counts[language] === (family.language_support?.[language] || 0), `language_support mismatch ${id}/${language}`);
    materializedFamilyCount += 1;
  }
}
assert(familyIdsByBucket[parseInt(bucket('family:liber'), 16)].has('family:liber'), 'family:liber missing');
assert(liberLanguages.size === languages.length, `family:liber missing languages: ${languages.filter(x => !liberLanguages.has(x)).join(',')}`);
assert(quarantinedManualFamilies.size === 0, 'quarantined family missing from metadata');
assert(preservedManualKeys.size === 0, `preserved positive controls missing: ${[...preservedManualKeys].join(', ')}`);
assert(membershipCount === 10426047 - manualLedger.rejected_memberships.length - surfaceRemoved - surfaceRemoved2, 'unexpected repository membership count');
assert(familyCount === manifest.counts.families && familyCount === report.total_families, `family count ${familyCount}`);
assert(materializedFamilyCount === familyCount, 'not every family was materialized');

let aliasCount = 0;
for (let index = 0; index < 256; index += 1) {
  const shard = index.toString(16).padStart(2, '0');
  const aliases = await readJson(join(root, 'aliases', `${shard}.json.gz`));
  for (const [alias, targets] of Object.entries(aliases)) {
    assert(bucket(alias) === shard, `alias bucket mismatch ${alias}`);
    assert(Array.isArray(targets) && targets.length && new Set(targets).size === targets.length, `invalid alias targets ${alias}`);
    assert(targets.every((value, i) => i === 0 || targets[i - 1] < value), `unsorted alias targets ${alias}`);
    for (const id of targets) {
      assert(id !== 'family:libert', `alias ${alias} points to family:libert`);
      assert(familyIdsByBucket[parseInt(bucket(id), 16)].has(id), `alias ${alias} points to missing family ${id}`);
    }
    const required = requiredAliasPairs.get(alias) || new Set();
    for (const id of required) assert(targets.includes(id), `missing reverse alias ${alias}->${id}`);
    requiredAliasPairs.delete(alias);
    aliasCount += 1;
  }
}
assert(requiredAliasPairs.size === 0, `missing aliases for ${requiredAliasPairs.size} keys`);
assert(aliasCount === manifest.counts.aliases && aliasCount === report.aliases_in_lookup, `alias count ${aliasCount}`);

const result = {
  schema_version: 1,
  verdict: noiseFindings.length === 0 ? 'pass' : 'fail',
  source_run_id: expectedRunId,
  storage: provenance.storage,
  encoding: manifest.repository_storage.encoding,
  counts: {
    families: familyCount,
    aliases: aliasCount,
    lemmas: manifest.counts.lemmas,
    components: manifest.counts.components,
    memberships: membershipCount,
    memberships_by_language: membershipsByLanguage,
    materialized_families: materializedFamilyCount
  },
  invariants: {
    manifest_report_counts_match: true,
    every_family_has_members: true,
    support_matches_members: true,
    language_support_matches_members: true,
    aliases_reference_existing_families: true,
    family_aliases_have_reverse_lookup: true,
    no_family_libert: true,
    family_liber_all_languages: true,
    rejected_corpus_noise_absent: noiseFindings.length === 0,
    manually_rejected_memberships_absent: true,
    reviewed_surface_families_absent: true,
    preserved_positive_controls_present: true,
    sense_ambiguous_family_quarantined: true,
    provenance_locked: true
  },
  rejected_corpus_noise: noiseFindings,
  provenance
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
assert(noiseFindings.length === 0, `rejected corpus noise entries: ${noiseFindings.length}`);

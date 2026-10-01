#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { repositoryTreeMetadata } from './lib/associative-repository-materialization.mjs';

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

const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenance = await readJson(join(root, 'repository-provenance.json'));
const nitidusLedgerBytes = await readFile('audit/associative-family-v5/nitidus-family-decisions.json');
const nitidusLedger = JSON.parse(nitidusLedgerBytes);
const nitidusRepair = provenance.repository_repairs?.find(item => item.repair === 'consolidate_and_prune_latin_nitidus');
assert(nitidusLedger.source_run_id === expectedRunId && nitidusRepair?.decision_ledger_sha256 === createHash('sha256').update(nitidusLedgerBytes).digest('hex'), 'nitidus decision provenance mismatch');
assert(nitidusRepair.removed_memberships === 9924 && nitidusRepair.added_memberships === 2, 'nitidus membership delta mismatch');
const ruShortLedgerBytes = await readFile('audit/associative-family-v5/surface-ru-two-letter-decisions.json');
const ruShortLedger = JSON.parse(ruShortLedgerBytes);
const ruShortRepair = provenance.repository_repairs?.find(item => item.repair === 'prune_russian_two_letter_surface_buckets');
assert(ruShortLedger.source_run_id === expectedRunId && ruShortLedger.decisions.length === 7 && ruShortRepair?.decision_ledger_sha256 === createHash('sha256').update(ruShortLedgerBytes).digest('hex'), 'Russian short-root provenance mismatch');
assert(ruShortRepair.removed_memberships === 8138, 'Russian short-root membership delta mismatch');
const netLedgerBytes = await readFile('audit/associative-family-v5/net-alias-routing-decision.json');
const netLedger = JSON.parse(netLedgerBytes);
const netRepair = provenance.repository_repairs?.find(item => item.repair === 'quarantine_uncurated_net_reverse_aliases');
assert(netLedger.source_run_id === expectedRunId && netRepair?.decision_ledger_sha256 === createHash('sha256').update(netLedgerBytes).digest('hex'), 'net alias routing provenance mismatch');
const boundedLedgerBytes = await readFile('audit/associative-family-v5/val-and-ru-short-decisions-20260930.json');
const boundedLedger = JSON.parse(boundedLedgerBytes);
const boundedRepair = provenance.repository_repairs?.find(item => item.repair === 'bounded_val_routing_and_russian_short_batch_20260930');
assert(boundedLedger.source_run_id === expectedRunId && boundedRepair?.decision_ledger_sha256 === createHash('sha256').update(boundedLedgerBytes).digest('hex'), 'bounded routing/short batch provenance mismatch');
assert(boundedRepair.removed_memberships === boundedLedger.russian.expected_total_removed && boundedRepair.removed_reverse_alias_targets === 12, 'bounded repair deltas mismatch');
assert(report.repository_materialization.bounded_20260930_ledger_sha256 === boundedRepair.decision_ledger_sha256, 'bounded report ledger mismatch');

const informationLedgerBytes = await readFile('audit/associative-family-v5/information-decisions-20260930.json');
const informationLedger = JSON.parse(informationLedgerBytes);
const informationRepair = provenance.repository_repairs?.find(item => item.repair === 'consolidate_and_prune_latin_informatio_20260930');
const informationSha = createHash('sha256').update(informationLedgerBytes).digest('hex');
assert(informationLedger.source_run_id === expectedRunId && informationRepair?.decision_ledger_sha256 === informationSha, 'information provenance mismatch');
assert(informationRepair.removed_memberships === 7014 && informationRepair.added_memberships === 3 && informationRepair.removed_memberships === informationLedger.expected_removed_memberships, 'information membership delta mismatch');
assert(report.repository_materialization.information_ledger_sha256 === informationSha, 'information report ledger mismatch');
const informationPositive = new Map(informationLedger.decisions.flatMap(d => d.retained.map(m => [`${d.language}\0${m.lemma_id}`, m.word])));
for (const a of informationLedger.added) informationPositive.set(`${a.language}\0${a.member.lemma_id}`, a.member.word);
const informationPreserved = new Map(informationLedger.preserved_families.map(d => [d.family_id,d]));
const informationPreservedSeen = new Set();

assert(manifest.version === '5', `manifest version ${manifest.version}`);
assert(JSON.stringify(manifest.languages) === JSON.stringify(languages), 'unexpected language set/order');
assert(Number(manifest.repository_storage?.immutable_source_run_id) === expectedRunId, 'manifest source run mismatch');
assert(manifest.repository_storage?.encoding === 'gzip', 'manifest encoding is not gzip');
assert(Number(report.provenance?.workflow_run_id) === expectedRunId, 'report source run mismatch');
assert(Number(provenance.source_run_id) === expectedRunId, 'repository provenance source run mismatch');
assert(provenance.storage === 'git_repository_static_files', 'repository provenance storage mismatch');
const treeMetadata = await repositoryTreeMetadata(root);
assert(treeMetadata.file_count_before_provenance === provenance.file_count_before_provenance, 'provenance file count mismatch');
assert(treeMetadata.total_bytes_before_provenance === provenance.total_bytes_before_provenance, 'provenance byte count mismatch');
assert(treeMetadata.tree_content_sha256 === provenance.tree_content_sha256, 'provenance tree hash mismatch');
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
const surfaceLedger3Bytes = await readFile('audit/associative-family-v5/manual-surface-family-decisions-3.json');
const surfaceLedger3 = JSON.parse(surfaceLedger3Bytes);
const surfaceLedger3Sha = createHash('sha256').update(surfaceLedger3Bytes).digest('hex');
const surfaceRepair3 = provenance.repository_repairs?.find(item => item.repair === 'remove_reviewed_surface_families_batch_3');
const surfaceRemoved3 = surfaceLedger3.decisions.reduce((sum, item) => sum + item.reviewed_words.length, 0);
assert(surfaceLedger3.source_run_id === expectedRunId && surfaceLedger3.decisions.length === 3, 'surface family third ledger mismatch');
assert(surfaceRepair3?.removed_memberships === surfaceRemoved3 && surfaceRepair3?.decision_ledger_sha256 === surfaceLedger3Sha, 'surface third repair provenance mismatch');
assert(JSON.stringify(surfaceRepair3.deleted_families) === JSON.stringify(surfaceLedger3.decisions.map(item => item.family_id)), 'surface third deleted families mismatch');
assert(report.repository_materialization?.surface_case_ledger_3_sha256 === surfaceLedger3Sha, 'report third surface ledger mismatch');
const surfaceLedger4Bytes = await readFile('audit/associative-family-v5/manual-surface-family-decisions-4.json');
const surfaceLedger4 = JSON.parse(surfaceLedger4Bytes);
const surfaceLedger4Sha = createHash('sha256').update(surfaceLedger4Bytes).digest('hex');
const surfaceRepair4 = provenance.repository_repairs?.find(item => item.repair === 'remove_reviewed_surface_families_batch_4');
const surfaceRemoved4 = surfaceLedger4.decisions.reduce((sum, item) => sum + item.reviewed_words.length, 0);
assert(surfaceLedger4.source_run_id === expectedRunId && surfaceLedger4.decisions.length === 3, 'surface family fourth ledger mismatch');
assert(surfaceRepair4?.removed_memberships === surfaceRemoved4 && surfaceRepair4?.decision_ledger_sha256 === surfaceLedger4Sha, 'surface fourth repair provenance mismatch');
assert(JSON.stringify(surfaceRepair4.deleted_families) === JSON.stringify(surfaceLedger4.decisions.map(item => item.family_id)), 'surface fourth deleted families mismatch');
assert(report.repository_materialization?.surface_case_ledger_4_sha256 === surfaceLedger4Sha, 'report fourth surface ledger mismatch');
assert(report.repository_materialization?.reviewed_surface_memberships_removed === surfaceRemoved + surfaceRemoved2 + surfaceRemoved3 + surfaceRemoved4, 'report surface removal count mismatch');
const tenLedgerBytes = await readFile('audit/associative-family-v5/surface-ten-decision.json');
const tenLedger = JSON.parse(tenLedgerBytes);
const tenLedgerSha = createHash('sha256').update(tenLedgerBytes).digest('hex');
const tenRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_surface_de_ten');
assert(tenLedger.source_run_id === expectedRunId && tenLedger.family_id === 'surface:de:ten' && tenLedger.expected_members === 17618, 'surface ten ledger mismatch');
assert(tenRepair?.removed_memberships === tenLedger.expected_members && tenRepair?.decision_ledger_sha256 === tenLedgerSha, 'surface ten provenance mismatch');
assert(report.repository_materialization?.surface_ten_ledger_sha256 === tenLedgerSha, 'report ten ledger mismatch');
const inflectionLedgerBytes = await readFile('audit/associative-family-v5/surface-inflection-decisions.json');
const inflectionLedger = JSON.parse(inflectionLedgerBytes);
const inflectionLedgerSha = createHash('sha256').update(inflectionLedgerBytes).digest('hex');
const inflectionRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_inflection_surface_families');
const inflectionRemoved = inflectionLedger.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(inflectionLedger.source_run_id === expectedRunId && inflectionLedger.decisions.length === 5, 'inflection family ledger mismatch');
assert(inflectionRepair?.removed_memberships === inflectionRemoved && inflectionRepair?.decision_ledger_sha256 === inflectionLedgerSha, 'inflection provenance mismatch');
assert(JSON.stringify(inflectionRepair.deleted_families) === JSON.stringify(inflectionLedger.decisions.map(item => item.family_id)), 'inflection deleted families mismatch');
assert(report.repository_materialization?.inflection_family_ledger_sha256 === inflectionLedgerSha, 'report inflection ledger mismatch');
const endingLedgerBytes = await readFile('audit/associative-family-v5/surface-ending-decisions.json');
const endingLedger = JSON.parse(endingLedgerBytes);
const endingLedgerSha = createHash('sha256').update(endingLedgerBytes).digest('hex');
const endingRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_ending_surface_families');
const endingRemoved = endingLedger.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(endingLedger.source_run_id === expectedRunId && endingLedger.decisions.length === 6, 'ending family ledger mismatch');
assert(endingRepair?.removed_memberships === endingRemoved && endingRepair?.decision_ledger_sha256 === endingLedgerSha, 'ending provenance mismatch');
assert(JSON.stringify(endingRepair.deleted_families) === JSON.stringify(endingLedger.decisions.map(item => item.family_id)), 'ending deleted families mismatch');
assert(report.repository_materialization?.ending_family_ledger_sha256 === endingLedgerSha, 'report ending ledger mismatch');
const geneaLedgerBytes = await readFile('audit/associative-family-v5/genea-german-decision.json');
const geneaLedger = JSON.parse(geneaLedgerBytes);
const geneaLedgerSha = createHash('sha256').update(geneaLedgerBytes).digest('hex');
const geneaRepair = provenance.repository_repairs?.find(item => item.repair === 'prune_genea_german_false_memberships');
const geneaRemoved = geneaLedger.expected_members - geneaLedger.keep.length;
assert(geneaLedger.source_run_id === expectedRunId && geneaLedger.family_id === 'ety:cf2897b18b16' && geneaLedger.language === 'de', 'genea ledger mismatch');
assert(geneaRepair?.removed_memberships === geneaRemoved && geneaRepair?.retained_memberships === geneaLedger.keep.length && geneaRepair?.decision_ledger_sha256 === geneaLedgerSha, 'genea repair provenance mismatch');
assert(report.repository_materialization?.genea_german_ledger_sha256 === geneaLedgerSha, 'report genea ledger mismatch');
const geneaRetained = new Map(geneaLedger.keep.map(item => [item.lemma_id, item.word]));
assert(geneaRetained.size === geneaLedger.keep.length, 'duplicate genea retention');
const geneaOtherLedgerBytes = await readFile('audit/associative-family-v5/genea-other-languages-decision.json');
const geneaOtherLedger = JSON.parse(geneaOtherLedgerBytes);
const geneaOtherLedgerSha = createHash('sha256').update(geneaOtherLedgerBytes).digest('hex');
const geneaOtherRepair = provenance.repository_repairs?.find(item => item.repair === 'prune_genea_other_language_false_memberships');
const geneaOtherRemoved = geneaOtherLedger.decisions.reduce((sum, item) => sum + item.expected_members - item.keep.length, 0);
assert(geneaOtherLedger.source_run_id === expectedRunId && geneaOtherLedger.family_id === geneaLedger.family_id, 'genea other ledger mismatch');
assert(geneaOtherRepair?.removed_memberships === geneaOtherRemoved && geneaOtherRepair?.decision_ledger_sha256 === geneaOtherLedgerSha, 'genea other repair mismatch');
assert(report.repository_materialization?.genea_other_ledger_sha256 === geneaOtherLedgerSha, 'report genea other ledger mismatch');
const geneaOtherKept = new Map(geneaOtherLedger.decisions.map(item => [item.language, new Map(item.keep.map(value => [value.lemma_id, value.word]))]));
const sonusLedgerBytes = await readFile('audit/associative-family-v5/sonus-language-decisions.json');
const sonusLedger = JSON.parse(sonusLedgerBytes);
const sonusLedgerSha = createHash('sha256').update(sonusLedgerBytes).digest('hex');
const sonusRepair = provenance.repository_repairs?.find(item => item.repair === 'prune_sonus_false_memberships');
const sonusRemoved = sonusLedger.decisions.reduce((sum, item) => sum + item.expected_members - item.keep.length, 0);
assert(sonusLedger.source_run_id === expectedRunId && sonusLedger.family_id === 'ety:1e7afcab5044', 'sonus ledger mismatch');
assert(sonusRepair?.removed_memberships === sonusRemoved && sonusRepair?.retained_memberships === 9 && sonusRepair?.decision_ledger_sha256 === sonusLedgerSha, 'sonus repair mismatch');
assert(report.repository_materialization?.sonus_ledger_sha256 === sonusLedgerSha, 'report sonus ledger mismatch');
const sonusKept = new Map(sonusLedger.decisions.map(item => [item.language, new Map(item.keep.map(value => [value.lemma_id, value.word]))]));
const kaLedgerBytes = await readFile('audit/associative-family-v5/surface-ru-ka-decision.json');
const kaLedger = JSON.parse(kaLedgerBytes);
const kaLedgerSha = createHash('sha256').update(kaLedgerBytes).digest('hex');
const kaRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_surface_ru_ka');
assert(kaLedger.source_run_id === expectedRunId && kaLedger.decisions.length === 1 && kaLedger.decisions[0].family_id === 'surface:ru:ka', 'ka ledger mismatch');
const kaRemoved = kaLedger.decisions[0].expected_members;
assert(kaRepair?.removed_memberships === kaRemoved && kaRepair?.decision_ledger_sha256 === kaLedgerSha, 'ka repair mismatch');
assert(report.repository_materialization?.surface_ru_ka_ledger_sha256 === kaLedgerSha, 'report ka ledger mismatch');
const suffixLedgerBytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-5.json');
const suffixLedger = JSON.parse(suffixLedgerBytes);
const suffixLedgerSha = createHash('sha256').update(suffixLedgerBytes).digest('hex');
const suffixRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_5');
assert(suffixLedger.source_run_id === expectedRunId && JSON.stringify(suffixLedger.decisions.map(item => item.family_id)) === JSON.stringify(['surface:ru:ija', 'surface:es:elo', 'surface:it:ato']), 'suffix batch ledger mismatch');
const suffixRemoved = suffixLedger.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRepair?.removed_memberships === suffixRemoved && suffixRepair?.decision_ledger_sha256 === suffixLedgerSha, 'suffix batch repair mismatch');
assert(JSON.stringify(suffixRepair.deleted_families) === JSON.stringify(suffixLedger.decisions.map(item => item.family_id)), 'suffix batch family list mismatch');
assert(report.repository_materialization?.suffix_batch_5_ledger_sha256 === suffixLedgerSha, 'report suffix batch ledger mismatch');
const suffixLedger6Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-6.json');
const suffixLedger6 = JSON.parse(suffixLedger6Bytes);
const suffixLedger6Sha = createHash('sha256').update(suffixLedger6Bytes).digest('hex');
const suffixRepair6 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_6');
assert(suffixLedger6.source_run_id === expectedRunId && JSON.stringify(suffixLedger6.decisions.map(item => item.family_id)) === JSON.stringify(['surface:de:chen', 'surface:en:ted', 'surface:es:ela']), 'suffix batch 6 ledger mismatch');
const suffixRemoved6 = suffixLedger6.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRepair6?.removed_memberships === suffixRemoved6 && suffixRepair6?.decision_ledger_sha256 === suffixLedger6Sha, 'suffix batch 6 repair mismatch');
assert(JSON.stringify(suffixRepair6.deleted_families) === JSON.stringify(suffixLedger6.decisions.map(item => item.family_id)), 'suffix batch 6 family list mismatch');
assert(report.repository_materialization?.suffix_batch_6_ledger_sha256 === suffixLedger6Sha, 'report suffix batch 6 ledger mismatch');
const suffixLedger7Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-7.json');
const suffixLedger7 = JSON.parse(suffixLedger7Bytes);
const suffixLedger7Sha = createHash('sha256').update(suffixLedger7Bytes).digest('hex');
const suffixRepair7 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_7');
assert(suffixLedger7.source_run_id === expectedRunId && JSON.stringify(suffixLedger7.decisions.map(item => item.family_id)) === JSON.stringify(['surface:de:schen', 'surface:de:ers', 'surface:de:ons', 'surface:it:elo']), 'suffix batch 7 ledger mismatch');
const suffixRemoved7 = suffixLedger7.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRepair7?.removed_memberships === suffixRemoved7 && suffixRepair7?.decision_ledger_sha256 === suffixLedger7Sha, 'suffix batch 7 repair mismatch');
assert(JSON.stringify(suffixRepair7.deleted_families) === JSON.stringify(suffixLedger7.decisions.map(item => item.family_id)), 'suffix batch 7 family list mismatch');
assert(report.repository_materialization?.suffix_batch_7_ledger_sha256 === suffixLedger7Sha, 'report suffix batch 7 ledger mismatch');
const suffixLedger8Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-8.json');
const suffixLedger8 = JSON.parse(suffixLedger8Bytes);
const suffixLedger8Sha = createHash('sha256').update(suffixLedger8Bytes).digest('hex');
const suffixRepair8 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_8');
assert(suffixLedger8.source_run_id === expectedRunId && JSON.stringify(suffixLedger8.decisions.map(item => item.family_id)) === JSON.stringify(['surface:fr:ons', 'surface:it:mente', 'surface:de:tes', 'surface:es:ose', 'surface:es:ando', 'surface:en:ers', 'surface:ru:vatsja']), 'suffix batch 8 ledger mismatch');
const suffixRemoved8 = suffixLedger8.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRepair8?.removed_memberships === suffixRemoved8 && suffixRepair8?.deleted_aliases === 1 && suffixRepair8?.decision_ledger_sha256 === suffixLedger8Sha, 'suffix batch 8 repair mismatch');
assert(JSON.stringify(suffixRepair8.deleted_families) === JSON.stringify(suffixLedger8.decisions.map(item => item.family_id)), 'suffix batch 8 family list mismatch');
assert(report.repository_materialization?.suffix_batch_8_ledger_sha256 === suffixLedger8Sha, 'report suffix batch 8 ledger mismatch');
const suffixLedger9Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-9.json');
const suffixLedger9 = JSON.parse(suffixLedger9Bytes);
const suffixLedger9Sha = createHash('sha256').update(suffixLedger9Bytes).digest('hex');
const suffixRepair9 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_9');
assert(suffixLedger9.source_run_id === expectedRunId && JSON.stringify(suffixLedger9.decisions.map(item => item.family_id)) === JSON.stringify(['surface:es:arte', 'surface:es:ias', 'surface:es:ome', 'surface:it:ico', 'surface:de:ken', 'surface:es:rio', 'surface:es:nes', 'surface:es:ito', 'surface:de:zen', 'surface:ru:tyj', 'surface:es:ita', 'surface:de:sen']), 'suffix batch 9 ledger mismatch');
const suffixRemoved9 = suffixLedger9.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRepair9?.removed_memberships === suffixRemoved9 && suffixRepair9?.decision_ledger_sha256 === suffixLedger9Sha, 'suffix batch 9 repair mismatch');
assert(JSON.stringify(suffixRepair9.deleted_families) === JSON.stringify(suffixLedger9.decisions.map(item => item.family_id)), 'suffix batch 9 family list mismatch');
assert(report.repository_materialization?.suffix_batch_9_ledger_sha256 === suffixLedger9Sha, 'report suffix batch 9 ledger mismatch');
const suffixLedger10Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-10.json');
const suffixLedger10 = JSON.parse(suffixLedger10Bytes);
const suffixLedger10Sha = createHash('sha256').update(suffixLedger10Bytes).digest('hex');
const suffixRepair10 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_10');
assert(suffixLedger10.source_run_id === expectedRunId && JSON.stringify(suffixLedger10.decisions.map(item => item.family_id)) === JSON.stringify(['surface:es:ote', 'surface:ru:nut', 'surface:fr:tes', 'surface:de:eln', 'surface:ru:nost', 'surface:de:eren', 'surface:es:ento', 'surface:ru:cheskij', 'surface:es:amos', 'surface:es:ras']), 'suffix batch 10 ledger mismatch');
const suffixRemoved10 = suffixLedger10.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRepair10?.removed_memberships === suffixRemoved10 && suffixRepair10?.decision_ledger_sha256 === suffixLedger10Sha, 'suffix batch 10 repair mismatch');
assert(JSON.stringify(suffixRepair10.deleted_families) === JSON.stringify(suffixLedger10.decisions.map(item => item.family_id)), 'suffix batch 10 family list mismatch');
assert(report.repository_materialization?.suffix_batch_10_ledger_sha256 === suffixLedger10Sha, 'report suffix batch 10 ledger mismatch');
const suffixLedger11Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-11.json');
const suffixLedger11 = JSON.parse(suffixLedger11Bytes);
const suffixLedger11Sha = createHash('sha256').update(suffixLedger11Bytes).digest('hex');
const suffixRepair11 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_11');
assert(suffixLedger11.source_run_id === expectedRunId && JSON.stringify(suffixLedger11.decisions.map(item => item.family_id)) === JSON.stringify(['surface:ru:tnyj', 'surface:es:ido', 'surface:en:ons', 'surface:ru:stvo', 'surface:it:armi', 'surface:en:ans']), 'suffix batch 11 ledger mismatch');
const suffixRemoved11 = suffixLedger11.decisions.reduce((sum, item) => sum + item.expected_members, 0);
assert(suffixRemoved11 === 14711 && suffixRepair11?.removed_memberships === suffixRemoved11 && suffixRepair11?.decision_ledger_sha256 === suffixLedger11Sha, 'suffix batch 11 repair mismatch');
assert(JSON.stringify(suffixRepair11.deleted_families) === JSON.stringify(suffixLedger11.decisions.map(item => item.family_id)), 'suffix batch 11 family list mismatch');
assert(report.repository_materialization?.suffix_batch_11_ledger_sha256 === suffixLedger11Sha, 'report suffix batch 11 ledger mismatch');
const suffixLedger12Bytes = await readFile('audit/associative-family-v5/surface-suffix-decisions-12.json');
const suffixLedger12 = JSON.parse(suffixLedger12Bytes);
const suffixLedger12Sha = createHash('sha256').update(suffixLedger12Bytes).digest('hex');
const suffixRepair12 = provenance.repository_repairs?.find(item => item.repair === 'remove_incoherent_suffix_surface_families_batch_12');
const suffixRemoved12 = suffixLedger12.decisions.reduce((sum, item) => sum + item.expected_members - (item.retained?.length || 0), 0);
assert(suffixLedger12.source_run_id === expectedRunId && JSON.stringify(suffixLedger12.decisions.map(item => item.family_id)) === JSON.stringify(['surface:en:sky','surface:it:ina','surface:es:cia','surface:en:tes','surface:en:ngs']), 'suffix batch 12 ledger mismatch');
assert(suffixRemoved12 === 11782 && suffixRemoved12 === suffixLedger12.expected_total_removed_memberships && suffixRepair12?.removed_memberships === suffixRemoved12 && suffixRepair12?.decision_ledger_sha256 === suffixLedger12Sha, 'suffix batch 12 repair mismatch');
assert(JSON.stringify(suffixRepair12.deleted_families) === JSON.stringify(suffixLedger12.decisions.filter(item => !item.retained?.length).map(item => item.family_id)), 'suffix batch 12 deletion list mismatch');
assert(report.repository_materialization?.suffix_batch_12_ledger_sha256 === suffixLedger12Sha, 'report suffix batch 12 ledger mismatch');
const retainedSky = new Map(suffixLedger12.decisions[0].retained.map(item => [item.lemma_id, item.word]));
const actusLedgerBytes = await readFile('audit/associative-family-v5/actus-false-memberships.json');
const actusLedger = JSON.parse(actusLedgerBytes);
const actusLedgerSha = createHash('sha256').update(actusLedgerBytes).digest('hex');
const actusRepair = provenance.repository_repairs?.find(item => item.repair === 'remove_verified_actus_false_memberships');
assert(actusLedger.source_run_id === expectedRunId && actusLedger.family_id === 'ety:5bed7c192e10' && actusLedger.rejected_memberships.length === 10, 'actus ledger mismatch');
assert(actusRepair?.removed_memberships === 10 && actusRepair?.decision_ledger_sha256 === actusLedgerSha, 'actus repair mismatch');
assert(report.repository_materialization?.actus_case_ledger_sha256 === actusLedgerSha, 'report actus ledger mismatch');
const illasLedgerBytes = await readFile('audit/associative-family-v5/illas-family-decision.json');
const illasLedger = JSON.parse(illasLedgerBytes);
const illasLedgerSha = createHash('sha256').update(illasLedgerBytes).digest('hex');
const illasRepair = provenance.repository_repairs?.find(item => item.repair === 'prune_candidate_only_illas_memberships');
assert(illasLedger.source_run_id === expectedRunId && illasLedger.family_id === 'ety:1e9cc0c12192' && illasLedger.expected_removed_memberships === 7734, 'illas ledger mismatch');
assert(illasRepair?.removed_memberships === illasLedger.expected_removed_memberships && illasRepair?.decision_ledger_sha256 === illasLedgerSha, 'illas repair mismatch');
assert(report.repository_materialization?.illas_family_decision_sha256 === illasLedgerSha, 'report illas ledger mismatch');
const retainedIllasKeys = new Set(illasLedger.retained.map(item => `${item.language}\0${illasLedger.family_id}\0${item.lemma_id}`));
const pronounLedgerBytes = await readFile('audit/associative-family-v5/illos-illis-family-decisions.json');
const pronounLedger = JSON.parse(pronounLedgerBytes);
const pronounLedgerSha = createHash('sha256').update(pronounLedgerBytes).digest('hex');
const pronounRepair = provenance.repository_repairs?.find(item => item.repair === 'prune_candidate_only_illos_illis_memberships');
assert(pronounLedger.source_run_id === expectedRunId && pronounLedger.decisions.length === 2 && pronounLedger.expected_total_removed_memberships === 14129, 'pronoun ledger mismatch');
assert(pronounRepair?.removed_memberships === pronounLedger.expected_total_removed_memberships && pronounRepair?.decision_ledger_sha256 === pronounLedgerSha, 'pronoun repair mismatch');
assert(report.repository_materialization?.illos_illis_family_decisions_sha256 === pronounLedgerSha, 'report pronoun ledger mismatch');
const retainedPronounKeys = new Set(pronounLedger.decisions.flatMap(item => item.retained.map(control => `${control.language}\0${item.family_id}\0${control.lemma_id}`)));
const reviewedPronounIds = new Set(pronounLedger.decisions.map(item => item.family_id));
const rejectedActusKeys = new Set(actusLedger.rejected_memberships.map(item => `${item.language}\0${actusLedger.family_id}\0${item.lemma_id}`));
const componentBytes = await readFile('audit/associative-family-v5/component-review-20261001.json');
const componentLedger = JSON.parse(componentBytes);
const componentSha = createHash('sha256').update(componentBytes).digest('hex');
const componentRepair = provenance.repository_repairs.find(r => r.repair === 'remove_reviewed_inter_false_memberships_and_nat_acronym_alias_20261001');
assert(componentRepair?.decision_ledger_sha256 === componentSha && componentRepair.removed_memberships === 11, 'component repair provenance mismatch');
assert(report.repository_materialization.component_review_ledger_sha256 === componentSha, 'component report ledger mismatch');
const rejectedComponentKeys = new Set(componentLedger.decisions.filter(d => d.verdict === 'remove_membership').map(d => `${d.language}\0${d.family_id}\0${d.lemma_id}`));
const positiveComponentKeys = new Set(componentLedger.decisions.filter(d => d.verdict === 'retain').map(d => `${d.language}\0${d.family_id}\0${d.lemma_id}`));
assert(rejectedComponentKeys.size === 11 && positiveComponentKeys.size === 3, 'component decision count mismatch');
const preservedActusKeys = new Set(actusLedger.preserved_positive_controls.map(item => `${item.language}\0${actusLedger.family_id}\0${item.word}`));
assert(rejectedActusKeys.size === 10, 'duplicate actus rejection');
const deletedSurfaceFamilies = new Set([...surfaceLedger.decisions, ...surfaceLedger2.decisions, ...surfaceLedger3.decisions, ...surfaceLedger4.decisions].map(item => item.family_id));
deletedSurfaceFamilies.add(kaLedger.decisions[0].family_id);
for (const item of suffixLedger.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger6.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger7.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger8.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger9.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger10.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger11.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of suffixLedger12.decisions.filter(item => !item.retained?.length)) deletedSurfaceFamilies.add(item.family_id);
deletedSurfaceFamilies.add(tenLedger.family_id);
for (const item of inflectionLedger.decisions) deletedSurfaceFamilies.add(item.family_id);
for (const item of endingLedger.decisions) deletedSurfaceFamilies.add(item.family_id);
const exactComponentBytes = await readFile('audit/associative-family-v5/exact-components-20261001.json');
const exactComponentLedger = JSON.parse(exactComponentBytes);
const exactComponentRepair = provenance.repository_repairs.find(r => r.repair === exactComponentLedger.repair);
assert(exactComponentRepair?.decision_ledger_sha256 === createHash('sha256').update(exactComponentBytes).digest('hex'), 'exact component provenance mismatch');
assert(exactComponentRepair.removed_memberships === exactComponentLedger.expected_removed_memberships && exactComponentRepair.added_memberships === exactComponentLedger.expected_added_memberships && exactComponentRepair.added_families === 2, 'exact component deltas mismatch');
const exactComponentPositive = new Map();
for (const [key, byLanguage] of Object.entries(exactComponentLedger.accepted)) for (const [language, members] of Object.entries(byLanguage)) for (const member of members) exactComponentPositive.set(`${language}\0family:${key}\0${member.lemma_id}`, member.word);
for (const item of exactComponentLedger.preservation) {
  const shard = await readJson(join(root, item.part, item.bucket + '.json.gz'));
  const unrelated = Object.fromEntries(Object.entries(shard).filter(([id]) => item.part === 'aliases' ? !['nat','loc','inter'].includes(id) : !['family:nat','family:loc','family:inter'].includes(id)));
  assert(createHash('sha256').update(JSON.stringify(unrelated)).digest('hex') === item.unrelated_sha256, `unrelated component shard changed ${item.part}/${item.bucket}`);
}

const rejectedManualKeys = new Set(manualLedger.rejected_memberships.map(item => `${item.language}\0${item.family_id}\0${item.lemma_id}`));
const nitidusPositive = new Set([...nitidusLedger.retained, ...nitidusLedger.added].map(item => `${item.language}\0${item.lemma_id}`));
const ruShortPositive = new Set([...ruShortLedger.decisions, ...boundedLedger.russian.decisions].flatMap(item => item.retained.map(kept => `ru\0${item.family_id}\0${kept.lemma_id}`)));
const preservedManualKeys = new Set(manualLedger.preserved_positive_controls.map(item => `${item.language}\0${item.family_id === nitidusLedger.deleted_duplicate_family_id ? nitidusLedger.canonical_family_id : item.family_id}\0${item.word}`));
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
for (const name of ['families_with_zero_members','members_without_evidence','fuzzy_memberships','levenshtein_memberships','untyped_family_edges','untyped_or_illegal_equivalence_edges','compound_edges_used_as_equivalence','unreviewed_high_risk_families']) {
  assert(report.invariants?.[name] === 0, `invariant ${name}=${report.invariants?.[name]}`);
}
assert(manifest.counts.lemmas === report.invariants.source_lemmas, 'manifest/report source lemma mismatch');
assert(manifest.counts.lemmas === report.invariants.classified_unique_lemmas + report.invariants.lemmas_with_zero_family, 'manifest/report materialized lemma mismatch');
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
const reportCounts = { merged: 0, singleton: 0, multiBranch: 0, nonProto: 0, verifiedSeed: 0, reviewRequired: 0, unreviewedHighRisk: 0 };
const reportStatuses = new Set(['needs_review', 'blocked_from_runtime', 'rejected', 'split_required']);
const topLargest = [];
const topSuspicious = [];
const keepTop = (array, family, compare) => { array.push({ id: family.id, support: family.support, suspicion_score: family.suspicion_score }); array.sort(compare); if (array.length > 50) array.length = 50; };
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
    assert(id !== informationLedger.deleted_duplicate_family_id, 'information duplicate family remains');
    if (id === informationLedger.canonical_family_id) {
      assert(family.canonical === 'informatio' && family.runtime_curated === true && !family.verified && family.review_status === 'needs_review', 'information metadata mismatch');
      assert(JSON.stringify(family.aliases) === JSON.stringify(informationLedger.aliases), 'information aliases mismatch');
      assert(family.support === 185 && family.language_support.de === 154 && family.language_support.ru === 1, 'information support or size exception mismatch');
      assert(JSON.stringify(family.relation_evidence) === JSON.stringify(informationLedger.original_families[0].relation_evidence), 'information extraction evidence changed');
    }
    if (informationPreserved.has(id)) {
      assert(createHash('sha256').update(JSON.stringify(family)).digest('hex') === informationPreserved.get(id).family_sha256, `information neighbour changed ${id}`);
      informationPreservedSeen.add(id);
    }
    if (['family:nat','family:loc','family:inter'].includes(id)) {
      const key = id.slice(7), accepted = exactComponentLedger.accepted[key];
      assert(family.exact_component === true && family.runtime_curated === true && !family.verified && family.review_status === 'needs_review', `exact component metadata mismatch ${id}`);
      assert(JSON.stringify(family.aliases) === JSON.stringify([key]), `exact component aliases mismatch ${id}`);
      for (const language of languages) assert(family.language_support[language] === accepted[language].length, `exact component support mismatch ${id}/${language}`);
    }
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
    if (family.source !== 'surface_singleton') reportCounts.merged += 1;
    if (family.support === 1) reportCounts.singleton += 1;
    if (family.aliases.length > 1) reportCounts.multiBranch += 1;
    if (family.source === 'wiktionary_non_proto_etymology') reportCounts.nonProto += 1;
    if (family.verified) reportCounts.verifiedSeed += 1;
    if (reportStatuses.has(family.review_status)) reportCounts.reviewRequired += 1;
    if (family.suspicion_score >= 35 && !reportStatuses.has(family.review_status)) reportCounts.unreviewedHighRisk += 1;
    keepTop(topLargest, family, (a, b) => b.support - a.support || a.id.localeCompare(b.id));
    keepTop(topSuspicious, family, (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
    familyCount += 1;
  }
  for (const language of languages) {
    const members = await readJson(join(root, 'members', language, `${shard}.json.gz`));
    for (const [id, values] of Object.entries(members)) {
      assert(bucket(id) === shard, `${language} member bucket mismatch ${id}`);
      assert(ids.has(id), `${language} members reference missing family ${id}`);
      assert(Array.isArray(values) && values.length, `${language} empty member list ${id}`);
      if (language === geneaLedger.language && id === geneaLedger.family_id) {
        assert(values.length === geneaRetained.size && values.every(value => geneaRetained.get(value.lemma_id) === value.word), 'genea German members mismatch');
      }
      if (geneaOtherKept.has(language) && id === geneaLedger.family_id) {
        const kept = geneaOtherKept.get(language);
        assert(values.length === kept.size && values.every(value => kept.get(value.lemma_id) === value.word), `genea ${language} members mismatch`);
      }
      if (sonusKept.has(language) && id === sonusLedger.family_id) {
        const kept = sonusKept.get(language);
        assert(values.length === kept.size && values.every(value => kept.get(value.lemma_id) === value.word), `sonus ${language} members mismatch`);
      }
      if (id === 'surface:en:sky') assert(language === 'en' && values.length === retainedSky.size && values.every(value => retainedSky.get(value.lemma_id) === value.word), 'sky retained list mismatch');
      if (informationPreserved.has(id)) assert(createHash('sha256').update(JSON.stringify(values)).digest('hex') === informationPreserved.get(id).members[language].ordered_member_sha256, `information neighbour members changed ${id}/${language}`);
      const seen = new Set();
      for (const value of values) {
        if (id === informationLedger.canonical_family_id) {
          const key = `${language}\0${value.lemma_id}`;
          assert(informationPositive.get(key) === value.word && informationPositive.delete(key), `unreviewed information member ${language}/${value.word}`);
          assert(value.components.every(c => c.canonical_candidate === 'informatio' && c.evidence.every(e => e.type === 'manual_override' && e.relation_type)), 'information manual evidence mismatch');
        }
        if (['family:nat','family:loc','family:inter'].includes(id)) {
          const key = `${language}\0${id}\0${value.lemma_id}`;
          assert(exactComponentPositive.get(key) === value.word && exactComponentPositive.delete(key), `unreviewed exact component member ${id}/${language}/${value.word}`);
          assert(value.components.every(c => c.canonical_candidate === id.slice(7) && c.evidence.every(e => e.type === 'manual_override' && e.exact_fragment === true && e.relation_type)), 'missing reviewed exact component evidence');
        }
        if (id === nitidusLedger.canonical_family_id) assert(nitidusPositive.delete(`${language}\0${value.lemma_id}`), `unreviewed nitidus member ${language}/${value.word}`);
        if (id.startsWith('surface:ru:') && [...ruShortLedger.decisions, ...boundedLedger.russian.decisions].some(item => item.family_id === id)) assert(ruShortPositive.delete(`${language}\0${id}\0${value.lemma_id}`), `unreviewed Russian short-root member ${id}/${value.word}`);
        assert(value.lemma_id && !seen.has(value.lemma_id), `${language} duplicate/invalid member ${id}`);
        assert(typeof value.word === 'string' && value.word, `${language} missing member word ${id}`);
        assert(typeof value.search_form === 'string' && value.search_form, `${language} missing search form ${id}`);
        assert(Number.isFinite(value.frequency_score) && value.frequency_score >= 0 && value.frequency_score <= 100, `${language} invalid frequency ${id}`);
        assert(Array.isArray(value.sources) && value.sources.length, `${language} missing sources ${id}`);
        assert(Array.isArray(value.components) && value.components.length, `${language} missing components ${id}`);
        for (const component of value.components) assert(component.canonical_candidate && component.evidence?.length, `${language} missing component evidence ${id}`);
        if (noise.has(String(value.word).toLowerCase())) noiseFindings.push({ language, family_id: id, lemma_id: value.lemma_id, word: value.word });
        assert(!rejectedComponentKeys.has(`${language}\0${id}\0${value.lemma_id}`), `rejected component membership ${value.word}`);
        positiveComponentKeys.delete(`${language}\0${id}\0${value.lemma_id}`);
        assert(!rejectedManualKeys.has(`${language}\0${id}\0${value.lemma_id}`), `rejected manual membership still present ${language}/${id}/${value.word}`);
        assert(!rejectedActusKeys.has(`${language}\0${id}\0${value.lemma_id}`), `rejected actus membership still present ${language}/${id}/${value.word}`);
        if (id === illasLedger.family_id) assert(retainedIllasKeys.delete(`${language}\0${id}\0${value.lemma_id}`), `unreviewed illas membership ${language}/${value.word}`);
        if (reviewedPronounIds.has(id)) assert(retainedPronounKeys.delete(`${language}\0${id}\0${value.lemma_id}`), `unreviewed pronoun membership ${language}/${id}/${value.word}`);
        preservedManualKeys.delete(`${language}\0${id}\0${value.word}`);
        preservedActusKeys.delete(`${language}\0${id}\0${value.word}`);
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
assert(preservedActusKeys.size === 0, `preserved actus controls missing: ${[...preservedActusKeys].join(', ')}`);
assert(retainedIllasKeys.size === 0, 'retained illas headwords missing');
assert(retainedPronounKeys.size === 0, 'retained illos/illis headwords missing');
assert(informationPositive.size === 0 && informationPreservedSeen.size === informationPreserved.size, 'information positive or neighbour controls missing');
assert(nitidusPositive.size === 0 && ruShortPositive.size === 0, 'new retained positive controls missing');
for (const id of [nitidusLedger.deleted_duplicate_family_id, 'surface:es:nitid', ...ruShortLedger.decisions.filter(item => !item.retained.length).map(item => item.family_id)]) assert(!familyIdsByBucket[parseInt(bucket(id), 16)].has(id), `deleted family still present ${id}`);
assert(familyIdsByBucket[parseInt(bucket('surface:en:sky'),16)].has('surface:en:sky'), 'retained sky family missing');
// Recount distinct materialized lemmas. The source-build report cannot prove
// that later family pruning preserved every lemma's last membership.
let materializedUniqueLemmas = 0;
let materializedMultiFamilyLemmas = 0;
const uniqueLemmasByLanguage = {};
for (const language of languages) {
  const unique = new Map();
  for (let index = 0; index < 256; index += 1) {
    const shard = index.toString(16).padStart(2, '0');
    const members = await readJson(join(root, 'members', language, `${shard}.json.gz`));
    for (const values of Object.values(members)) for (const value of values) unique.set(value.lemma_id, (unique.get(value.lemma_id) || 0) + 1);
  }
  uniqueLemmasByLanguage[language] = unique.size;
  materializedUniqueLemmas += unique.size;
  for (const count of unique.values()) if (count > 1) materializedMultiFamilyLemmas += 1;
}
assert(materializedUniqueLemmas === report.invariants.classified_unique_lemmas, 'report classified unique lemmas mismatch');
assert(manifest.counts.lemmas - materializedUniqueLemmas === report.invariants.lemmas_with_zero_family, 'report unassigned lemmas mismatch');
assert(materializedUniqueLemmas === report.repository_materialization.materialized_unique_lemmas, 'repository materialized lemma count mismatch');
assert(materializedMultiFamilyLemmas === report.multi_family_lemmas, 'report multi-family lemma count mismatch');
assert(JSON.stringify(uniqueLemmasByLanguage) === JSON.stringify(report.repository_materialization.unique_lemmas_by_language), 'report unique lemmas by language mismatch');
assert(JSON.stringify(membershipsByLanguage) === JSON.stringify(report.repository_materialization.memberships_by_language), 'report memberships by language mismatch');
assert(membershipCount === report.repository_materialization.memberships, 'report materialized memberships mismatch');
assert(manifest.counts.lemmas - materializedUniqueLemmas === report.repository_materialization.lemmas_without_materialized_family, 'repository unassigned lemma count mismatch');
assert(membershipCount === 10426047 - manualLedger.rejected_memberships.length - surfaceRemoved - surfaceRemoved2 - surfaceRemoved3 - surfaceRemoved4 - tenLedger.expected_members - inflectionRemoved - endingRemoved - geneaRemoved - geneaOtherRemoved - sonusRemoved - kaRemoved - suffixRemoved - suffixRemoved6 - suffixRemoved7 - suffixRemoved8 - suffixRemoved9 - suffixRemoved10 - suffixRemoved11 - suffixRemoved12 - actusLedger.rejected_memberships.length - illasLedger.expected_removed_memberships - pronounLedger.expected_total_removed_memberships - nitidusRepair.removed_memberships + nitidusRepair.added_memberships - ruShortRepair.removed_memberships - boundedRepair.removed_memberships - informationRepair.removed_memberships + informationRepair.added_memberships - componentRepair.removed_memberships - exactComponentRepair.removed_memberships + exactComponentRepair.added_memberships, 'unexpected repository membership count');
assert(familyCount === manifest.counts.families && familyCount === report.total_families, `family count ${familyCount}`);
assert(materializedFamilyCount === familyCount, 'not every family was materialized');
for (const [field, counted] of [
  ['merged_families', reportCounts.merged],
  ['singleton_families', reportCounts.singleton],
  ['multi_branch_families', reportCounts.multiBranch],
  ['generated_non_proto_families', reportCounts.nonProto],
  ['verified_seed_families', reportCounts.verifiedSeed],
  ['review_required_families', reportCounts.reviewRequired]
]) assert(report[field] === counted, `report ${field} mismatch`);
assert(report.invariants.unreviewed_high_risk_families === reportCounts.unreviewedHighRisk, 'report high risk count mismatch');
for (const [field, expected] of [['largest_families', topLargest], ['highest_suspicion_families', topSuspicious]]) {
  assert(JSON.stringify(report[field].map(item => ({ id: item.id, support: item.support, suspicion_score: item.suspicion_score }))) === JSON.stringify(expected), `report ${field} mismatch`);
}

let aliasCount = 0;
for (let index = 0; index < 256; index += 1) {
  const shard = index.toString(16).padStart(2, '0');
  const aliases = await readJson(join(root, 'aliases', `${shard}.json.gz`));
  for (const [alias, targets] of Object.entries(aliases)) {
    assert(!targets.includes(informationLedger.deleted_duplicate_family_id), 'alias points to deleted information duplicate');
    if (alias === 'azion') assert(!targets.includes(informationLedger.canonical_family_id), 'suffix routes to lexical information family');
    if (informationLedger.aliases.includes(alias)) assert(targets.includes(informationLedger.canonical_family_id), `information reverse alias missing ${alias}`);
    if (alias === 'net') assert(JSON.stringify(targets) === JSON.stringify(netLedger.retained_targets.slice().sort()), 'net reverse alias routing mismatch');
    if (alias === 'val') assert(JSON.stringify(targets) === JSON.stringify(boundedLedger.val.retained_targets.slice().sort()) && targets.length <= 25, 'val reverse alias routing mismatch');
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
assert(positiveComponentKeys.size === 0, 'missing retained inter controls');
assert(exactComponentPositive.size === 0, 'missing exact component decisions');
const natTargets = (await readJson(join(root, 'aliases', `${bucket('nat')}.json.gz`))).nat;
assert(!natTargets.includes('ety:496b7cec5a43'), 'nat still routes to NATO');
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
    materialized_unique_lemmas: materializedUniqueLemmas,
    multi_family_lemmas: materializedMultiFamilyLemmas,
    lemmas_without_materialized_family: manifest.counts.lemmas - materializedUniqueLemmas,
    unique_lemmas_by_language: uniqueLemmasByLanguage,
    memberships_by_language: membershipsByLanguage,
    materialized_families: materializedFamilyCount
  },
  invariants: {
    manifest_report_counts_match: true,
    multi_family_lemmas_match: true,
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
    information_exact_reviewed_members_and_neighbours_preserved: true,
    provenance_locked: true
  },
  rejected_corpus_noise: noiseFindings,
  provenance
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
assert(noiseFindings.length === 0, `rejected corpus noise entries: ${noiseFindings.length}`);

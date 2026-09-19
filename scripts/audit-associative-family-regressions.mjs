#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const FALSE_MERGES = [
  { old_family_id: 'ety:0f6061e49232', aliases: ['val', 'remove', 'remover'] },
  { old_family_id: 'ety:a9f83219c8f4', aliases: ['net', 'geomagnetic'] },
  { old_family_id: 'ety:eb0c0f2dde53', aliases: ['alter', 'wasser'] },
  { old_family_id: 'ety:e40fb0a23141', aliases: ['banc', 'alter'] },
  { old_family_id: 'ety:2696567cd2f7', aliases: ['val', 'walkure'] }
];
const ALTER_FORBIDDEN = ['bank', 'wasser', 'zeit', 'hund', 'gruppe', 'president', 'nation'];
const CORPUS_NOISE = ['brokethemouldaftertheymadepeter', 'pediatricianand', 'pediatricianwho', 'helpedallof', 'eroticizedit', 'dutheillet', 'madrillet', 'ennuyeux'];
const MANUAL_CONTROLS = {
  manual: 'family:manu', manufacture: 'family:manu',
  pedal: 'family:pede', pedicure: 'family:pede',
  ocular: 'family:ocul', monocle: 'family:ocul', monocular: 'family:ocul'
};

const normalize = value => String(value || '').normalize('NFC').toLocaleLowerCase('und').trim();
const intersection = arrays => arrays.length
  ? [...arrays.slice(1).reduce((set, values) => new Set(values.filter(value => set.has(value))), new Set(arrays[0]))].sort()
  : [];

async function main() {
  const root = process.argv[2];
  const output = process.argv[3];
  if (!root) throw new Error('Usage: audit-associative-family-regressions.mjs <artifact-root> [output.json]');

  const targets = new Set([
    ...FALSE_MERGES.flatMap(item => item.aliases), ...ALTER_FORBIDDEN,
    ...CORPUS_NOISE, ...Object.keys(MANUAL_CONTROLS)
  ]);
  const rowsByAlias = new Map([...targets].map(alias => [alias, []]));
  const staleOldFamilyIds = Object.fromEntries(FALSE_MERGES.map(item => [item.old_family_id, []]));

  for (const language of LANGUAGES) {
    const file = join(root, 'assignments', `${language}.jsonl.gz`);
    const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
    let rowNumber = 0;
    for await (const line of lines) {
      rowNumber += 1;
      const row = JSON.parse(line);
      const alias = normalize(row.normalized || row.word);
      for (const familyId of row.family_ids || []) {
        if (staleOldFamilyIds[familyId] && staleOldFamilyIds[familyId].length < 25) {
          staleOldFamilyIds[familyId].push({ language, shard: `assignments/${language}.jsonl.gz`, row: rowNumber, lemma_id: row.lemma_id, alias, evidence_path: row.components?.flatMap(component => component.evidence || []).map(evidence => evidence.path) || [] });
        }
      }
      if (targets.has(alias)) rowsByAlias.get(alias).push({
        language, shard: `assignments/${language}.jsonl.gz`, row: rowNumber,
        lemma_id: row.lemma_id, word: row.word, family_ids: [...(row.family_ids || [])].sort(),
        corpus_quality: row.corpus_quality,
        evidence: (row.components || []).flatMap(component => (component.evidence || []).map(evidence => ({ family_ids: component.family_ids, type: evidence.type, source: evidence.source, path: evidence.path })))
      });
    }
  }

  const familyAliasHits = Object.fromEntries([...targets].map(alias => [alias, []]));
  for (const file of (await readdir(join(root, 'families'))).filter(name => name.endsWith('.json')).sort()) {
    const families = JSON.parse(await readFile(join(root, 'families', file), 'utf8'));
    for (const family of Object.values(families)) {
      const aliases = new Set((family.aliases || []).map(normalize));
      for (const alias of targets) if (aliases.has(alias)) familyAliasHits[alias].push({ family_id: family.id, shard: `families/${file}`, review_status: family.review_status, relation_types: family.relation_types });
    }
  }

  const falseMerges = FALSE_MERGES.map(item => {
    const assignmentFamilies = intersection(item.aliases.map(alias => [...new Set(rowsByAlias.get(alias).flatMap(row => row.family_ids))]));
    const metadataFamilies = intersection(item.aliases.map(alias => familyAliasHits[alias].map(hit => hit.family_id)));
    return { ...item, assignment_intersection: assignmentFamilies, metadata_intersection: metadataFamilies, ok: assignmentFamilies.length === 0 && metadataFamilies.length === 0 && staleOldFamilyIds[item.old_family_id].length === 0 };
  });
  const alterForbidden = ALTER_FORBIDDEN.map(alias => {
    const assignment_hits = rowsByAlias.get(alias).filter(row => row.family_ids.includes('family:alter'));
    const metadata_hits = familyAliasHits[alias].filter(hit => hit.family_id === 'family:alter');
    return { alias, assignment_hits, metadata_hits, ok: assignment_hits.length === 0 && metadata_hits.length === 0 };
  });
  const corpusNoise = CORPUS_NOISE.map(alias => {
    const rows = rowsByAlias.get(alias);
    return { alias, occurrences: rows, ok: rows.length > 0 && rows.every(row => row.corpus_quality?.status === 'rejected') };
  });
  const manualControls = Object.entries(MANUAL_CONTROLS).map(([alias, requiredFamily]) => {
    const rows = rowsByAlias.get(alias).filter(row => row.language === 'en');
    return { alias, language: 'en', required_family_id: requiredFamily, occurrences: rows, ok: rows.length === 1 && rows[0].family_ids.length === 1 && rows[0].family_ids[0] === requiredFamily && rows[0].evidence.some(evidence => evidence.type === 'manual_override') };
  });
  const report = {
    version: 1,
    artifact_root: root,
    languages: LANGUAGES,
    false_merges: falseMerges,
    family_alter_forbidden: alterForbidden,
    corpus_noise: corpusNoise,
    manual_controls: manualControls,
    stale_old_family_ids: staleOldFamilyIds,
    gates: {
      known_false_merges: falseMerges.every(item => item.ok),
      family_alter_absorption: alterForbidden.every(item => item.ok),
      known_corpus_noise_rejected: corpusNoise.every(item => item.ok),
      manual_controls_exact: manualControls.every(item => item.ok),
      stale_old_family_ids: Object.values(staleOldFamilyIds).every(rows => rows.length === 0)
    }
  };
  report.valid = Object.values(report.gates).every(Boolean);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output) await writeFile(output, serialized);
  process.stdout.write(serialized);
  if (!report.valid) process.exitCode = 2;
}

main().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });

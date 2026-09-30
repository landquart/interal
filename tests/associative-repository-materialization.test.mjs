import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { recountMaterializedMembers, repositoryTreeMetadata } from '../scripts/lib/associative-repository-materialization.mjs';

test('recount observes last-membership loss and multi-family to single-family transitions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'family-recount-'));
  try {
    await mkdir(join(root, 'members/en'), {recursive:true});
    await mkdir(join(root, 'members/ru'), {recursive:true});
    const path = join(root, 'members/en/00.json.gz');
    const member = lemma_id => ({lemma_id});
    await writeFile(path, gzipSync(JSON.stringify({a:[member('a'),member('b')],b:[member('b'),member('c')]})));
    await writeFile(join(root, 'members/ru/00.json.gz'), gzipSync(JSON.stringify({a:[member('a')]})));
    const report = {invariants:{}, repository_materialization:{}};
    const manifest = {languages:['en','ru'],counts:{lemmas:4}};
    let counted = await recountMaterializedMembers(root,manifest,report);
    assert.deepEqual([counted.uniqueTotal,counted.multiTotal,counted.unassigned,counted.membershipTotal], [4,1,0,5]);
    counted = await recountMaterializedMembers(root,manifest,report,new Map([[path,{a:[member('a'),member('b')]}]]));
    assert.deepEqual([counted.uniqueTotal,counted.multiTotal,counted.unassigned,counted.membershipTotal], [3,0,1,3]);
    assert.deepEqual(report.repository_materialization.unique_lemmas_by_language, {en:2,ru:1});
    assert.deepEqual(report.repository_materialization.memberships_by_language, {en:2,ru:1});
    assert.equal(report.invariants.lemmas_with_zero_family,1);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('provenance excludes itself, survives root relocation and detects content changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'family-tree-'));
  const other = await mkdtemp(join(tmpdir(), 'family-tree-copy-'));
  try {
    await mkdir(join(root,'nested'));
    await writeFile(join(root,'nested/a'), 'abc');
    await writeFile(join(root,'report.json'), '{}');
    const before = await repositoryTreeMetadata(root);
    await writeFile(join(root,'repository-provenance.json'), JSON.stringify(before));
    assert.deepEqual(await repositoryTreeMetadata(root),before);
    await mkdir(join(other,'nested'));
    await writeFile(join(other,'nested/a'), 'abc');
    await writeFile(join(other,'report.json'), '{}');
    assert.deepEqual(await repositoryTreeMetadata(other),before);
    await writeFile(join(root,'nested/a'), 'xyz');
    const changed = await repositoryTreeMetadata(root);
    assert.equal(changed.total_bytes_before_provenance,before.total_bytes_before_provenance);
    assert.notEqual(changed.tree_content_sha256,before.tree_content_sha256);
    await writeFile(join(root,'extra'), 'x');
    assert.equal((await repositoryTreeMetadata(root)).file_count_before_provenance,before.file_count_before_provenance+1);
  } finally { await rm(root,{recursive:true,force:true}); await rm(other,{recursive:true,force:true}); }
});

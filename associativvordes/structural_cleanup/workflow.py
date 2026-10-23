"""End-to-end offline shadow certification, including real restoration and inverse."""
import argparse, collections, hashlib, pathlib, resource, shutil, sqlite3, subprocess, sys, time
from common import *
from capture import capture
from shadow import apply, rollback
from verify import validate

def checked(cmd, logfile, expected=0):
    with open(logfile, 'ab') as out:
        code = subprocess.call([str(x) for x in cmd], stdout=out, stderr=subprocess.STDOUT)
    if code != expected: raise RuntimeError('command failed (' + str(code) + '): ' + str(logfile))
    return code

def run(repo, work):
    repo = pathlib.Path(repo).resolve(); work = outside_repo(repo, work); started = time.monotonic()
    code = {p.name:sha_file(p) for p in sorted(pathlib.Path(__file__).parent.glob('*.py'))}
    identity = dict(schema='v5-structural-run/1', code=code, main=MAIN, baseline=BASELINE, diagnostics=DIAGNOSTICS)
    if (work / 'IDENTITY.json').exists() and load(work/'IDENTITY.json') != identity:
        raise ValueError('changed code/source dependency; use new external work directory')
    save(work/'IDENTITY.json', identity)
    capture(repo, work)
    tool = pinned_baseline(repo, work); script = work/'pinned-tool/census.py'
    if not (work/'before-census/FULL-CENSUS.json').exists():
        checked([sys.executable,script,'census','--snapshot',work/'before','--work',work/'before-census'], work/'before-census.log')
    if not (work/'scan/SCAN.json').exists():
        checked([sys.executable,pathlib.Path(__file__).with_name('scan.py'),'--repo',repo,'--snapshot',work/'before','--output',work/'scan'],work/'scan.log')
    scan = load(work/'scan/SCAN.json'); plan = work/'scan/SAFE-FIXES.ndjson'
    if sha_file(plan) != scan['files']['safe_fixes_sha256']: raise ValueError('plan changed')
    result = apply(work/'before', plan, work/'after', repo)
    save(work/'APPLY-RECEIPT.json', result)
    save(work/'IDEMPOTENCE.json', apply(work/'before', plan, work/'after', repo))
    if not (work/'INDEPENDENT-VALIDATION.json').exists():
        validate(work/'before',work/'after',plan,work/'INDEPENDENT-VALIDATION.json')
    if not (work/'RESTART-RECEIPT.json').exists():
        checked([sys.executable,script,'census','--snapshot',work/'after','--work',work/'after-census','--crash-after','2'],work/'after-census.log',75)
        with sqlite3.connect(work/'after-census/census.sqlite') as db:
            committed = db.execute('SELECT count(*) FROM checkpoints').fetchone()[0]
            integrity = db.execute('PRAGMA integrity_check').fetchone()[0]
        if committed != 1 or integrity != 'ok': raise ValueError('interruption recovery differs')
        save(work/'RESTART-RECEIPT.json',dict(exit_code=75,committed_bucket_tasks=committed,sqlite_integrity=integrity,uncommitted_bucket_rolled_back=True))
    if not (work/'after-census/FULL-CENSUS.json').exists():
        checked([sys.executable,script,'census','--snapshot',work/'after','--work',work/'after-census'],work/'after-census.log')
    before = load(work/'before-census/FULL-CENSUS.json'); after = load(work/'after-census/FULL-CENSUS.json')
    # Snapshot hash necessarily changes; all actual count/set distributions must agree.
    ignore = {'snapshot_inventory_sha256'}
    if {k:v for k,v in before.items() if k not in ignore} != {k:v for k,v in after.items() if k not in ignore}:
        raise ValueError('independent full before/after census differs')
    for name in ('before-census','after-census'):
        integrity = load(work/name/'INTEGRITY-REPORT.json')
        if integrity['structural_findings'] or any(integrity['cross_reference_checks'].values()):
            raise ValueError('structural discrepancy requires review')
        if not load(work/name/'FULL-CENSUS.json')['source_equation']['holds']: raise ValueError('source lemma loss')
    if sha_file(work/'before-census/UNASSIGNED-LEMMAS.jsonl.gz') == sha_file(work/'after-census/UNASSIGNED-LEMMAS.jsonl.gz'):
        unassigned_equal = True
    else:
        import gzip
        unassigned_equal = gzip.decompress((work/'before-census/UNASSIGNED-LEMMAS.jsonl.gz').read_bytes()) == gzip.decompress((work/'after-census/UNASSIGNED-LEMMAS.jsonl.gz').read_bytes())
    if not unassigned_equal: raise ValueError('unassigned lemma changes')
    if not (work/'replay').exists(): apply(work/'before',plan,work/'replay',repo)
    if load(work/'replay/SNAPSHOT.json') != load(work/'after/SNAPSHOT.json'): raise ValueError('independent shadow replay differs')
    verify(work/'replay',load(work/'after/SNAPSHOT.json'))
    if not (work/'rollback').exists(): save(work/'ROLLBACK-RECEIPT.json',rollback(work/'before',work/'after',work/'rollback',repo))
    archive = work/'v5-structural-shadow.tar'
    if not archive.exists(): receipt = tool.backup(work/'after',archive); save(work/'BACKUP.json',receipt)
    receipt = load(work/'BACKUP.json')
    if not (work/'restored').exists():
        restored = tool.restore(archive,work/'restored',receipt['archive_sha256']); save(work/'RESTORE.json',restored)
    verify(work/'restored',load(work/'after/SNAPSHOT.json'))
    # Baseline source SHA pins and actual finite unassigned set survive independently of old caches.
    baseline_census = json.loads(git(repo,'show',BASELINE+':audit/associative-family-v5-baseline/FULL-CENSUS.json'))
    if before['counts'] != baseline_census['counts']: raise ValueError('baseline counts differ; review rather than normalize')
    audit_script=work/'pinned-tool/audit_ids.py'
    atomic(audit_script,git(repo,'show',BASELINE+':associativvordes/v5_baseline/audit_ids.py'))
    if not (work/'STABLE-ID-AUDIT.json').exists():
        checked([sys.executable,audit_script,'--database',work/'after-census/census.sqlite','--output',work/'STABLE-ID-AUDIT.json'],work/'stable-id-audit.log')
    if load(work/'STABLE-ID-AUDIT.json')['verdict']!='PASS': raise ValueError('stable ID disagreement requires review')
    from audit_metadata import audit
    metadata=audit(work/'after',work/'after-census/FULL-CENSUS.json',work/'METADATA-CHECK.json')
    if metadata['status']!='PASS': raise ValueError('materialized report counters require review')
    meta = load(work/'after/current'/PREFIX/'manifest.json'); report=load(work/'after/current'/PREFIX/'report.json')
    expected = dict(families=before['counts']['canonical_families'], aliases=before['counts']['aliases'])
    if any(meta['counts'][k] != v for k,v in expected.items()): raise ValueError('manifest current count mismatch')
    if report['total_families'] != expected['families'] or report['aliases_in_lookup'] != expected['aliases']:
        raise ValueError('report current count mismatch')
    material = report['repository_materialization']
    if material['memberships'] != before['counts']['memberships'] or material['materialized_unique_lemmas'] != before['counts']['materialized_lemmas']:
        raise ValueError('report materialization count mismatch')
    root=work/'after/current'/PREFIX; paths=sorted(p for p in root.rglob('*') if p.is_file() and p.name!='repository-provenance.json')
    tree=hashlib.sha256()
    for path in paths:
        tree.update(path.relative_to(root).as_posix().encode()+b'\0')
        with open(path,'rb') as f:
            for chunk in iter(lambda:f.read(1048576),b''):tree.update(chunk)
    provenance=load(root/'repository-provenance.json')
    if (len(paths),sum(p.stat().st_size for p in paths),tree.hexdigest()) != (provenance['file_count_before_provenance'],provenance['total_bytes_before_provenance'],provenance['tree_content_sha256']):
        raise ValueError('repository provenance tree mismatch; no automatic rewriting of history')
    if code != {p.name:sha_file(p) for p in sorted(pathlib.Path(__file__).parent.glob('*.py'))}:
        raise ValueError('implementation changed during run')
    result=dict(schema='v5-structural-certification/1',status='PASS_STRUCTURAL_SHADOW_ONLY',
        safe_fixes=scan['safe_fixes'],counts=before['counts'],source_equation=before['source_equation'],
        exact_unassigned_records_preserved=unassigned_equal,before_after_full_census_equal=True,
        replay_manifest_equal=True,rollback_exact_bytes=True,backup_real_restore=True,
        original_assignments_available=False,history_semantic_coverage_complete=False,
        provenance_tree_checksum=tree.hexdigest(),production_writes=0,linguistic_decisions=0,
        code=code,seconds_this_workflow_segment=time.monotonic()-started)
    save(work/'RUN.json',result);print(canonical(result).decode(),flush=True);return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--work',required=True)
    a=p.parse_args();run(a.repo,a.work)

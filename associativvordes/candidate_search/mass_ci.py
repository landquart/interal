#!/usr/bin/env python3
"""Reproduce full mass-discovery measurements on a disposable, disk-budgeted runner."""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import time
from types import SimpleNamespace
from mass_registry import prepare, LANGUAGES
from mass_source import readonly
from mass_benchmark import benchmark
from mass_store import Store
from mass_recover import rollback
from morphology_import import hash_file, validate_lock
from certify_corpus import atomic_json, audit_catalog
from audit_scale_index import audit
from fetch_sources import fetch
from fetch_glemm_git import export as export_glemm
from glemm_cache import LOCK as GLEMM_LOCK

REPO = Path(__file__).resolve().parents[2]
LOCK = REPO/'data/morphology-evidence/sources/source-lock.json'
LEGACY = '0c167fcd8a17cfaf433c37f68e89ba7f2ee0ceae'


def command(work, name, arguments):
    path=work/'logs'/(name+'.log');path.parent.mkdir(exist_ok=True,parents=True)
    with path.open('w') as stream:
        result=subprocess.run([sys.executable,*map(str,arguments)],cwd=REPO,stdout=stream,stderr=subprocess.STDOUT)
    if result.returncode:
        print(path.read_text()[-18000:],flush=True)
        raise RuntimeError(name+' exited '+str(result.returncode))
    return path


def inputs(work):
    lock=json.loads(LOCK.read_text())
    groups=[[a] for a in lock['artifacts'] if not a.get('container')]
    groups.append([a for a in lock['artifacts'] if a.get('container')])
    temporary=work/'acquisition';temporary.mkdir(parents=True,exist_ok=True)
    def get(pair):
        number,artifacts=pair
        subset=temporary/(str(number)+'.json')
        subset.write_text(json.dumps(dict(lock,artifacts=artifacts)))
        try:
            fetch(subset,work/'raw')
        except OSError as error:
            if not all(a['source']=='GLeMM' for a in artifacts):raise
            return str(error)
    with ThreadPoolExecutor(max_workers=6) as pool:failures=[v for v in pool.map(get,enumerate(groups)) if v]
    if failures:
        # Transport fallback only; checksum/size failures are ValueError and never bypassed.
        pinned=json.loads(GLEMM_LOCK.read_text())
        signature=lambda values:sorted((a['id'],a['revision'],a['sha256'],a['bytes']) for a in values)
        if signature(pinned['artifacts'])!=signature(a for a in lock['artifacts'] if a['source']=='GLeMM'):
            raise ValueError('GLeMM Git/full-lock disagreement')
        receipt=export_glemm(GLEMM_LOCK,work/'raw')
        atomic_json(work/'receipts/GLEMM-GIT.json',dict(receipt,http_transport_failures=len(failures)))
    validate_lock(lock,work/'raw')
    atomic_json(work/'receipts/ACQUISITION.json',dict(status='PASS',files=len(lock['artifacts']),
        lock_sha256=hash_file(LOCK),artifacts=[dict(id=a['id'],sha256=a['sha256'],revision=a['revision'],url=a['url']) for a in lock['artifacts']],
        synthetic_files=0))


def build(work):
    prepare(REPO,work/'registry',LEGACY)
    programs=[
        ('certify',['associativvordes/importers/certify_corpus.py','--raw-root',work/'raw','--release',work/'release','--workers','2']),
        ('index',['associativvordes/importers/index_watch.py','--release',work/'release','--registry',LOCK,'--destination',work/'index','--cache-kib','65536','--follow']),
        ('project',['associativvordes/candidate_search/project_store.py','--repo',REPO,'--revision',LEGACY,'--destination',work/'project'])]
    running=[];streams=[]
    try:
        for name,args in programs:
            if name == 'index':
                # The source index follows a checkpoint written by certification.
                # Do not start it before that first atomic publication exists.
                deadline=time.monotonic()+120
                certification=next(p for n,p in running if n=='certify')
                while not (work/'release/CHECKPOINT.json').exists():
                    status=certification.poll()
                    if status is not None:
                        raise RuntimeError('certify exited before publishing a checkpoint: '+str(status))
                    if time.monotonic()>=deadline:
                        raise TimeoutError('certification checkpoint not published within 120 seconds')
                    time.sleep(0.1)
            stream=(work/'logs'/(name+'.log')).open('w');streams.append(stream)
            running.append((name,subprocess.Popen([sys.executable,*map(str,args)],cwd=REPO,stdout=stream,stderr=subprocess.STDOUT)))
        while running:
            for name,process in list(running):
                status=process.poll()
                if status is not None:
                    if status:raise RuntimeError(name+' exited '+str(status))
                    running.remove((name,process));print('Completed '+name,flush=True)
            if running:time.sleep(2)
    finally:
        for name,process in running:
            if process.poll() is None:process.terminate()
        for stream in streams:stream.close()


def verify(work):
    state=json.loads((work/'release/CHECKPOINT.json').read_text())
    prior=json.loads((REPO/'audit/associative-external-preparation/certification01/CATALOG.json').read_text())
    for key in ['build_id','identity','outputs','unique_normalized_views','evidence_occurrences']:
        if prior[key]!=state['catalog'][key]:raise ValueError('independent catalog mismatch: '+key)
    result=audit_catalog(work/'release',REPO/'data/morphology-evidence/sources/BUILD-PARTITIONS.json')
    atomic_json(work/'receipts/CATALOG-REPLAY.json',dict(status='PASS',independent_prior_catalog_equal=True,
        counts=state['counts'],catalog_build_id=state['catalog']['build_id'],audit=result))
    audit(work/'index/index.sqlite',work/'release',work/'receipts/INDEX-AUDIT.json')
    command(work,'auxiliary',['associativvordes/candidate_search/mass_source.py',
        '--index',work/'index/index.sqlite','--release',work/'release','--registry',work/'registry/registry.sqlite',
        '--source-lock',LOCK,'--destination',work/'aux'])
    arguments=SimpleNamespace(index=work/'index/index.sqlite',registry=work/'registry/registry.sqlite',
        aux=work/'aux/aux.sqlite',project=work/'project/project.sqlite',source_lock=LOCK,output=work/'benchmark')
    benchmark(arguments)
    full=work/'benchmark/full'
    original=full/'preview.sqlite';before=hash_file(original);review=work/'history-probe.sqlite'
    src=readonly(original);dst=sqlite3.connect(review);src.backup(dst);dst.close();src.close()
    q=Store(review);cid=q.db.execute("SELECT id FROM questions WHERE state='open' ORDER BY id LIMIT 1").fetchone()[0]
    q.decide(cid,'rejected','TEST ONLY replay probe; not a linguistic verdict','regression_probe');q.close()
    log=command(work,'history-replay',['associativvordes/candidate_search/mass_run.py',
        '--index',arguments.index,'--registry',arguments.registry,'--aux',arguments.aux,'--project',arguments.project,
        '--source-lock',LOCK,'--output',work/'history-probe','--all','--changed-only','--write-queue','--queue',review])
    repeated=json.loads(log.read_text())
    q=Store(review);state=q.db.execute('SELECT state FROM questions WHERE id=?',(cid,)).fetchone()[0]
    history=q.db.execute('SELECT COUNT(*) FROM history WHERE candidate=?',(cid,)).fetchone()[0];q.close()
    if state!='rejected' or not history or repeated['processed'] or repeated['reused']!=114 or hash_file(original)!=before:
        raise ValueError('full-data refusal replay failed')
    atomic_json(work/'receipts/REAL-HISTORY-REPLAY.json',dict(status='PASS',isolated_regression_copy=True,
        question_id=cid,review_state=state,history_retained=True,original_queue_unchanged=True,
        processed=0,reused=114,membership_writes=0))
    pointer=full/'CURRENT.json';previous=pointer.read_bytes()
    pointer.write_text('injected interrupted pointer')
    recovered=rollback(full)
    if pointer.read_bytes()!=previous:raise ValueError('damaged pointer recovery failed')
    atomic_json(work/'receipts/REAL-RECOVERY.json',dict(recovered,pointer_recovered_after_corruption=True))
    atomic_json(work/'receipts/VALIDATION.json',dict(status='PASS',membership_writes=0,code_commit=None,
        independent_export_identical=True,resumed_export_identical=True,real_history_replay=True))


def collect(work):
    out=work/'receipts';out.mkdir(exist_ok=True,parents=True)
    paths={
        'REGISTRY.json':work/'registry/REGISTRY.json','SOURCE-CHECKPOINT.json':work/'release/CHECKPOINT.json',
        'SOURCE-RUN.json':work/'release/LAST-RUN.json','INDEX.json':work/'index/INDEX.json',
        'INDEX-WATCH.json':work/'index/WATCH.json','PROJECT.json':work/'project/PROJECT.json',
        'AUX.json':work/'aux/AUX.json','BENCHMARK.json':work/'benchmark/BENCHMARK.json'}
    for name,path in paths.items():
        if path.exists():shutil.copyfile(path,out/name)
    for path in sorted((work/'benchmark/receipts').glob('*.json')):shutil.copyfile(path,out/('SEARCH-'+path.name))
    full=work/'benchmark/full'
    if (work/'receipts/VALIDATION.json').exists():
        receipt=json.loads((work/'benchmark/receipts/full.json').read_text())
        pointer=json.loads((full/'CURRENT.json').read_text());release=Path(pointer['path'])
        per_language={lang:Counter() for lang in LANGUAGES};reasons=Counter();identifiers=set();duplicates=0
        for raw in (release/'questions.ndjson').open():
            row=json.loads(raw);lang=row['language'];duplicates+=int(row['id'] in identifiers);identifiers.add(row['id'])
            if row['establishes_membership'] or row['creates_canonical_root']:raise ValueError('unsafe proposal')
            per_language[lang]['questions']+=1
            for category in row['categories']:per_language[lang][category]+=1
            per_language[lang]['frequency_unknown']+=int(row['frequency']['status']=='unknown')
            per_language[lang]['pos_unknown']+=int(row['pos'] is None)
        for unit,values in receipt['units'].items():
            lang=unit.split('|')[1]
            for name in ['available_seeds','selected_seeds','native_matches','arcs_available','arcs_examined','candidate_observations','grouped_duplicate_observations']:
                per_language[lang][name]+=values.get(name,0)
        for raw in (release/'discovery.ndjson').open():
            event=json.loads(raw);reasons[event['reason']]+=event.get('count',1)
        if duplicates:raise ValueError('duplicate question IDs')
        coverage=dict(status='PASS',families=len(receipt['identity']['families']),units=receipt['selected_units'],
            unique_questions=len(identifiers),duplicate_question_ids=duplicates,by_language=per_language,
            discovery_reason_counts=reasons,category_counts_overlap=True,bounded_recall=True,membership_writes=0)
        atomic_json(out/'COVERAGE.json',coverage)
        benchmark_result=json.loads((work/'benchmark/BENCHMARK.json').read_text())
        manifest=json.loads((release/'MANIFEST.json').read_text())
        atomic_json(out/'EXPORT-MANIFEST.json',manifest)
        rows=['# Full-registry candidate discovery validation','',
            'All results below come from the full pinned sources and actual 19-family v6 registry.',
            'This is bounded proposal discovery; no memberships, confirmed annotations or production formulas were changed.','',
            '| Language | Questions | Selected seeds | Available seeds | Unknown frequency | Grouped duplicate observations |',
            '| --- | ---: | ---: | ---: | ---: | ---: |']
        for lang,v in per_language.items():
            rows.append('| '+lang+' | '+' | '.join(str(v.get(k,0)) for k in ['questions','selected_seeds','available_seeds','frequency_unknown','grouped_duplicate_observations'])+' |')
        rows.extend(['','All 114 family/language units were selected. Category counts overlap. Question IDs are unique.',
            'Native analyses, paths and raw source locators remain in the proposal artifact. Source independence and sense identity remain unresolved.',
            'Detailed omissions, family statistics and bounded-search limits are in COVERAGE.json, SEARCH-full.json and MASS-RUNBOOK.md.','',
            '| Stage | Processed units | Reused units | Seconds | Peak RSS KiB |',
            '| --- | ---: | ---: | ---: | ---: |'])
        for name,v in benchmark_result['stages'].items():
            rows.append('| '+name+' | '+' | '.join(str(v.get(k)) for k in ['processed','reused','elapsed_seconds','max_rss_kib'])+' |')
        rows.extend(['','Independent fresh exports and interrupted/resumed exports have identical versions and NDJSON hashes.',
            'The full-data refusal probe used a separate test copy: the original proposal queue was unchanged.',
            'A deliberately damaged CURRENT pointer was restored after verifying the prior manifest and every exported file.',
            'Unchanged runs still read full input checksums and reconcile review history; zero rediscovered units does not mean zero I/O.',
            'Registry owner-word changes require a fresh auxiliary inflection projection. The native graph stays on disk.',
            'No raw corpora are uploaded. Proposal artifacts retain source metadata and original license/attribution records.',
            'Temporary runner databases are reproducible products; durable small receipts accompany this report.',''])
        (out/'MASS-CANDIDATE-DISCOVERY.md').write_text('\n'.join(rows))
    for path in sorted(out.iterdir()):
        if not path.is_file():continue
        value=path.read_text();size=12000;total=max(1,(len(value)+size-1)//size)
        for number in range(total):
            print('MASS02_PACKET '+json.dumps(dict(path=path.name,part=number,total=total,
                sha256=hash_file(path),text=value[number*size:(number+1)*size]),ensure_ascii=False),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--work',required=True,type=Path)
    parser.add_argument('--phase',required=True,choices=['inputs','build','verify','collect'])
    args=parser.parse_args();work=args.work.resolve()
    if work.is_relative_to(REPO):raise ValueError('external runner storage required')
    work.mkdir(parents=True,exist_ok=True);(work/'receipts').mkdir(exist_ok=True);(work/'logs').mkdir(exist_ok=True)
    if args.phase=='inputs' and shutil.disk_usage(work).free < 32*1024**3:
        raise ValueError('at least 32 GiB free disk required for full source/project indexes and staging')
    globals()[args.phase](work)

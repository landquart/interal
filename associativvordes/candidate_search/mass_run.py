#!/usr/bin/env python3
"""Mass review proposals for all actual v6 families. Dry-run is the default."""
import argparse
from collections import Counter
import fcntl
import json
import os
from pathlib import Path
import resource
import shutil
import tempfile
import time
from mass_discovery import Discovery, DEFAULTS
from mass_registry import LANGUAGES, local_content
from mass_source import checked, readonly, owner_key
from mass_store import Store
from morphology_import import digest, hash_file
from certify_corpus import atomic_json


def resolve(registry, families):
    if not families: return [r[0] for r in registry.execute('SELECT family FROM family_fingerprints ORDER BY family')]
    from graph import lookup
    result = set()
    for name in families:
        rows = [r[0] for r in registry.execute('SELECT DISTINCT family FROM aliases WHERE alias=? ORDER BY family', (lookup(name.removeprefix('family:')),))]
        if len(rows) != 1: raise ValueError('unknown/ambiguous actual family: ' + name)
        result.add(rows[0])
    return sorted(result)


def dependency(registry, family, language, words):
    values = []
    for word in sorted(set(words)):
        known = list(registry.execute('SELECT family,lemma,head,proof FROM known WHERE language=? AND word=? ORDER BY family,lemma,head', (language, word)))
        decisions = list(registry.execute('SELECT family,status,proof,reason FROM decisions WHERE language=? AND word=? ORDER BY family,id', (language, word)))
        values.append([word, known, decisions])
    own = registry.execute('SELECT value FROM family_fingerprints WHERE family=?', (family,)).fetchone()[0]
    return digest(local_content([own, language, values]))


def run(a):
    repo = Path(__file__).resolve().parents[2]
    output = Path(a.output).resolve()
    queue_path = Path(a.queue).resolve() if a.write_queue and a.queue else output / ('review.sqlite' if a.write_queue else 'preview.sqlite')
    if output.is_relative_to(repo) or queue_path.is_relative_to(repo): raise ValueError('all mass outputs must be outside Git checkout')
    if a.queue and not a.write_queue: raise ValueError('--queue requires --write-queue; use --prior-queue for read-only history in dry-run')
    if a.prior_queue and Path(a.prior_queue).resolve() == queue_path: raise ValueError('prior queue must differ from working queue')
    if a.batch_size < 1 or a.stop_after is not None and a.stop_after < 1: raise ValueError('positive batch/checkpoint bounds required')
    output.mkdir(parents=True, exist_ok=True); queue_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output / '.run-lock', 'a') as output_lock, open(str(queue_path)+'.lock', 'a') as queue_lock:
        fcntl.flock(output_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(queue_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return _run(a, output, queue_path)


def _run(a, output, queue_path):
    started = time.monotonic()
    registry_path, aux_path, index_path, project_path = map(Path, (a.registry,a.aux,a.index,a.project))
    registry_receipt = checked(registry_path,registry_path.parent/'REGISTRY.json')
    aux_receipt = checked(aux_path,aux_path.parent/'AUX.json')
    source_receipt = checked(index_path,index_path.parent/'INDEX.json')
    project_receipt = checked(project_path,project_path.parent/'PROJECT.json')
    lock = json.loads(Path(a.source_lock).read_text())
    reg = readonly(registry_path)
    try:
        ai = aux_receipt['identity']
        if ai['owners'] != owner_key(reg) or ai['source'] != source_receipt['database_sha256'] or ai['source_lock'] != hash_file(a.source_lock):
            raise ValueError('auxiliary source/owner/lock dependency mismatch')
        if ai['catalog'] != source_receipt['catalog_build_id']: raise ValueError('auxiliary certified catalog mismatch')
        families = resolve(reg,(a.families or [])+(a.family or []))
        languages = sorted(set((a.languages or [])+(a.language or []) or LANGUAGES))
        if not set(languages) <= set(LANGUAGES): raise ValueError('unsupported language')
    finally: reg.close()
    limits = dict(DEFAULTS,**(json.loads(a.limits) if a.limits else {}))
    code = {p.name: hash_file(p) for p in sorted(Path(__file__).parent.glob('mass_*.py'))}
    for relative in ['candidate_search/search.py','evidence_graph/graph.py','importers/scale_index.py']:
        code[relative] = hash_file(Path(__file__).resolve().parents[1]/relative)
    common = dict(code=code,source=source_receipt['database_sha256'],catalog=source_receipt['catalog_build_id'],
                  lock=hash_file(a.source_lock),project=project_receipt['database_sha256'],limits=limits,
                  aux_policy=ai['policy'])
    identity = dict(common,registry=registry_receipt['database_sha256'],aux=aux_receipt['database_sha256'],families=families,languages=languages)
    engine = Discovery(index_path,registry_path,aux_path,project_path,lock,limits,verify=False)
    queue = Store(queue_path)
    units = [f+'|'+lang for f in families for lang in languages]
    processed = reused = 0; statistics = {}
    try:
        if a.prior_queue: queue.import_history(a.prior_queue)
        for unit in units:
            family, language = unit.split('|'); t = time.monotonic()
            previous = queue.db.execute('SELECT fingerprint,stats FROM units WHERE id=?',(unit,)).fetchone()
            old_stats = json.loads(previous[1]) if previous else {}
            fp = digest([common, dependency(engine.registry,family,language,old_stats.get('dependency_words',[]))])
            if (a.resume or a.changed_only) and previous and previous[0] == fp:
                reused += 1; statistics[unit] = dict(old_stats,reused=True); continue
            questions, events, stats = engine.unit(family,language)
            words = sorted({q['lemma'].casefold() for q in questions})
            fp = digest([common, dependency(engine.registry,family,language,words)])
            stats.update(dependency_words=words,elapsed_seconds=round(time.monotonic()-t,6))
            queue.save_unit(unit,fp,questions,events,stats)
            processed += 1;statistics[unit] = dict(stats,reused=False)
            if processed % a.batch_size == 0:
                atomic_json(output/'CHECKPOINT.json',dict(identity=identity,processed=processed,reused=reused,last_unit=unit))
            if a.stop_after and processed >= a.stop_after:
                receipt=dict(status='CHECKPOINT',processed=processed,reused=reused,selected_units=len(units),
                             elapsed_seconds=round(time.monotonic()-started,3),membership_writes=0)
                atomic_json(output/'LAST-RUN.json',receipt);return receipt
        stage=Path(tempfile.mkdtemp(prefix='.export-',dir=output))
        try:
            counts=queue.export_selected(stage,units)
            outputs={p.name:hash_file(p) for p in sorted(stage.iterdir())}
            manifest=dict(schema='mass-candidate-release/1',identity=identity,units=units,counts=counts,outputs=outputs,
                          membership_writes=0,creates_canonical_root=False,mode='review_queue' if a.write_queue else 'dry_run',
                          limitations=['bounded search is not exhaustive','native identity only; no cross-source spelling chains',
                                       'unknown direction not traversed','unknown source independence; rank is not probability',
                                       'finite v6 registry at pinned revision; not the v5 million-family inventory'])
            version=digest(manifest);manifest['version']=version
            atomic_json(stage/'MANIFEST.json',manifest)
            versions=output/'releases';versions.mkdir(exist_ok=True);final=versions/version
            if final.exists():
                saved=json.loads((final/'MANIFEST.json').read_text())
                if saved != manifest: raise ValueError('immutable release collision')
                for name,h in outputs.items():
                    if hash_file(final/name)!=h: raise ValueError('corrupted prior export')
                shutil.rmtree(stage)
            else:
                stage.rename(final)
                fd=os.open(versions,os.O_RDONLY)
                try:os.fsync(fd)
                finally:os.close(fd)
            current=output/'CURRENT.json'
            if current.exists(): atomic_json(output/'PREVIOUS.json',json.loads(current.read_text()))
            atomic_json(current,dict(version=version,path=str(final),manifest_sha256=hash_file(final/'MANIFEST.json')))
        finally:
            if stage.exists():shutil.rmtree(stage)
        by_language={lang:dict(units=sum(u.endswith('|'+lang) for u in units),
             questions=sum(s.get('questions',0) for u,s in statistics.items() if u.endswith('|'+lang)),
             events=sum(s.get('discovery_events',0) for u,s in statistics.items() if u.endswith('|'+lang))) for lang in languages}
        receipt=dict(status='PASS',identity=identity,version=version,mode=manifest['mode'],processed=processed,reused=reused,
                     selected_units=len(units),counts=counts,by_language=by_language,units=statistics,
                     elapsed_seconds=round(time.monotonic()-started,3),
                     max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                     export_bytes=sum(p.stat().st_size for p in final.iterdir()),queue_bytes=queue_path.stat().st_size,
                     membership_writes=0,creates_canonical_root=False)
        atomic_json(output/'LAST-RUN.json',receipt);return receipt
    finally:engine.close();queue.close()


def parser():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['index','registry','aux','project','source-lock','output']:p.add_argument('--'+name,required=True)
    p.add_argument('--family',action='append');p.add_argument('--families',nargs='+')
    p.add_argument('--language',action='append');p.add_argument('--languages',nargs='+')
    p.add_argument('--all',action='store_true',help='default when no family selection is supplied')
    p.add_argument('--changed-only',action='store_true');p.add_argument('--resume',action='store_true')
    p.add_argument('--batch-size',type=int,default=6);p.add_argument('--stop-after',type=int)
    p.add_argument('--limits',help='JSON bounded per-role/source/class limits')
    p.add_argument('--write-queue',action='store_true');p.add_argument('--queue');p.add_argument('--prior-queue')
    return p


if __name__=='__main__': print(json.dumps(run(parser().parse_args()),ensure_ascii=False,sort_keys=True))

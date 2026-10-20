#!/usr/bin/env python3
"""Read-only staged workload; v5 inventory is NOT reviewed morphological gold.

SQL counts cover the full inventory. Expensive path payloads and queue writes
use an explicit bounded sample. Reports distinguish those scopes.
"""
import argparse
import hashlib
import json
from pathlib import Path
import resource
import sqlite3
import sys
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'importers'))
from certify_corpus import atomic_json
from morphology_import import dumps, hash_file
from scale_index import Index
from search import Queue
from project_store import verified_project


def payload_stages(index, output):
    """Exercise real bounded traversal, frequency reads and queue writes per family.

    Keep up to one source-local query per family. This measures increasing
    family batches without pretending to expand every possible lexical analysis.
    """
    db=index.db; measurements=[]
    for size in [10,100,1000]:
        directory=output/('payload-'+str(size)); directory.mkdir(exist_ok=True)
        queue=Queue(directory/'queue.sqlite'); started=time.monotonic()
        scanned=queries=paths=expanded=truncated=frequency_reads=upserts=0
        try:
            for family, in db.execute('SELECT id FROM project.families ORDER BY id LIMIT ?',(size,)).fetchall():
                scanned+=1
                seed=db.execute('''SELECT s.language,s.word,l.id,s.frequency FROM project.seeds s
                  JOIN lexemes l ON l.language=s.language AND l.search=s.word
                  WHERE s.family=? AND EXISTS(SELECT 1 FROM arcs a WHERE a.src=l.id
                    AND a.direction='directed' AND a.type IN ('direct_derivation','conversion','compounding'))
                  ORDER BY s.language,s.word,l.id LIMIT 1''',(family,)).fetchone()
                if not seed: continue
                language,word,lid,fid=seed; queries+=1
                # Read the actual preserved frequency payload, including missing fields.
                import zlib
                body=db.execute('SELECT body FROM project.frequencies WHERE id=?',(fid,)).fetchone()
                if body is None: raise ValueError('dangling frequency observation')
                json.loads(zlib.decompress(body[0])); frequency_reads+=1
                result=index.paths('lexeme:'+lid.hex()); paths+=len(result['paths'])
                expanded+=result['expanded']; truncated+=int(result['truncated'])
                grouped={}
                for path in result['paths']:
                    target=path['nodes'][-1]
                    # Source-local identity is part of the group; spelling is not identity.
                    grouped.setdefault(target,[]).append(path)
                for target,discovery in grouped.items():
                    lang,lemma,pos=db.execute('SELECT language,search,pos FROM lexemes WHERE id=?',
                                             (bytes.fromhex(target.split(':')[1]),)).fetchone()
                    queue.upsert(dict(family=family,language=lang,lemma=lemma,pos=pos,
                        native_lexeme=target,discovery_paths=discovery,benchmark_only=True,
                        family_guard_status='not_eligible_for_operational_queue',
                        uncertainty_reasons=['v5_seed_not_reviewed_gold','sense_unresolved','family_guard_not_run']),
                        'benchmark:'+family); upserts+=1
            queue.db.commit()
            count=queue.db.execute('SELECT COUNT(*) FROM questions').fetchone()[0]
            queue.export(directory/'questions.ndjson')
        finally: queue.close()
        measurements.append(dict(families=scanned,real_seed_queries=queries,
            families_without_productive_seed=scanned-queries,frequency_payloads_read=frequency_reads,
            paths=paths,expanded_arcs=expanded,truncated_queries=truncated,upserts=upserts,
            grouped_questions=count,elapsed_seconds=round(time.monotonic()-started,3),
            queue_sha256=hash_file(directory/'questions.ndjson'),operational_queue_writes=0,
            scope='one bounded real seed query per eligible inventory family'))
        atomic_json(output/'PAYLOAD-STAGES.json',measurements)
        print(dumps(measurements[-1]),flush=True)
    return measurements


def benchmark(index_path,project_path,output):
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    verified_project(project_path)
    index=Index(index_path); db=index.db
    db.execute('ATTACH DATABASE ? AS project',(str(Path(project_path).resolve()),))
    db.execute('CREATE TEMP TABLE selected(id TEXT PRIMARY KEY)')
    setup=time.monotonic()
    # Lookup multiplicities are arithmetic summaries, never identity merges.
    db.executescript('''CREATE TEMP TABLE hit_counts AS SELECT language,search,COUNT(*) AS n FROM lexemes GROUP BY language,search;
      CREATE UNIQUE INDEX hit_lookup ON hit_counts(language,search);
      CREATE TEMP TABLE arc_counts AS SELECT s.language,s.search,COUNT(*) AS n FROM arcs a
        JOIN lexemes s ON s.id=a.src JOIN lexemes t ON t.id=a.dst AND t.language=s.language
        WHERE a.direction='directed' AND a.type IN ('direct_derivation','conversion','compounding') GROUP BY s.language,s.search;
      CREATE UNIQUE INDEX arc_lookup ON arc_counts(language,search);
      CREATE TEMP TABLE weighted_seeds(language TEXT,word TEXT,n INTEGER);''')
    summary_setup_seconds=round(time.monotonic()-setup,3)
    total=db.execute('SELECT COUNT(*) FROM project.families').fetchone()[0]
    stages=[]
    for size in [10,100,1000,total]:
        start=time.monotonic(); db.execute('DELETE FROM selected')
        db.execute('INSERT INTO selected SELECT id FROM project.families ORDER BY id LIMIT ?',(size,))
        seeds=db.execute('SELECT COUNT(*) FROM project.seeds s JOIN selected f ON f.id=s.family').fetchone()[0]
        db.execute('DELETE FROM weighted_seeds')
        db.execute('''INSERT INTO weighted_seeds SELECT s.language,s.word,COUNT(*) FROM selected f
                      JOIN project.seeds s ON s.family=f.id GROUP BY s.language,s.word''')
        hits=db.execute('SELECT COALESCE(SUM(s.n*h.n),0) FROM weighted_seeds s JOIN hit_counts h ON h.language=s.language AND h.search=s.word').fetchone()[0]
        arcs=db.execute('SELECT COALESCE(SUM(s.n*a.n),0) FROM weighted_seeds s JOIN arc_counts a ON a.language=s.language AND a.search=s.word').fetchone()[0]
        if size<=1000:
            naive=db.execute('''SELECT COUNT(*) FROM selected f JOIN project.seeds s ON s.family=f.id
                 JOIN lexemes l ON l.language=s.language AND l.search=s.word''').fetchone()[0]
            if hits!=naive: raise ValueError('weighted lookup count differs from native identity join')
        stages.append(dict(families=size,seed_observations=seeds,exact_lexeme_hits=hits,productive_arc_occurrences=arcs,
                           elapsed_seconds=round(time.monotonic()-start,3),membership_writes=0,
                           lookup_count_checked_against_native_join=size<=1000))
        atomic_json(output/'STAGES.json',stages); print(dumps(stages[-1]),flush=True)
    measured_payloads=payload_stages(index,output)
    # Real national words and lexemes; no generated roots or invented derivatives.
    sample=db.execute('''SELECT s.family,s.language,s.word,l.id FROM project.seeds s
       JOIN lexemes l ON l.language=s.language AND l.search=s.word
       WHERE EXISTS(SELECT 1 FROM arcs a WHERE a.src=l.id AND a.direction='directed')
       ORDER BY s.family,s.language,s.word,l.id LIMIT 100''').fetchall()
    queue=Queue(output/'benchmark-queue.sqlite'); start=time.monotonic(); paths=expanded=truncated=questions=0
    fingerprints=hashlib.sha256(); sample_rows=[]
    try:
        for family,language,word,lid in sample:
            result=index.paths('lexeme:'+lid.hex()); fingerprints.update(dumps(result).encode())
            paths+=len(result['paths']); expanded+=result['expanded']; truncated+=int(result['truncated'])
            groups={}
            for path in result['paths']:
                target=path['nodes'][-1]; native=db.execute('SELECT language,search,pos FROM lexemes WHERE id=?',(bytes.fromhex(target.split(':')[1]),)).fetchone()
                groups.setdefault(native,[]).append(path)
            for (lang,lemma,pos),discovery in groups.items():
                body=dict(family=family,language=lang,lemma=lemma,pos=pos,discovery_paths=discovery,
                    benchmark_only=True,family_guard_status='not_eligible_for_operational_queue',
                    uncertainty_reasons=['v5_seed_not_reviewed_gold','sense_unresolved','family_guard_not_run'])
                queue.upsert(body,'benchmark:'+family); questions+=1
            if len(sample_rows)<10: sample_rows.append(dict(family=family,language=language,seed=word,paths=result['paths'][:1]))
        queue.db.commit()
        before=list(queue.rows()); history_test=None
        if before:
            cid=before[0]['id']; queue.decide(cid,'rejected','Recovery benchmark only; not a linguistic decision','performance_probe')
            body={k:v for k,v in before[0].items() if k not in {'review_state','evidence_changed_since_review','active_scopes','previous_decisions','input_fingerprint','establishes_membership'}}
            queue.upsert(body,'benchmark:'+body['family']); queue.db.commit()
            state=queue.db.execute('SELECT state FROM questions WHERE id=?',(cid,)).fetchone()[0]
            if state!='rejected': raise ValueError('queue decision lost')
            history_test='PASS'
        queue.export(output/'benchmark-queue.ndjson')
        sample_result=dict(real_seed_queries=len(sample),paths=paths,expanded_arcs=expanded,truncated_queries=truncated,
            grouped_questions=queue.db.execute('SELECT COUNT(*) FROM questions').fetchone()[0],upserts=questions,
            elapsed_seconds=round(time.monotonic()-start,3),result_sha256=fingerprints.hexdigest(),
            history_retained=history_test,scope='bounded 100 real seed queries; not full-family queue materialization')
    finally: queue.close(); index.close()
    result=dict(status='PASS',full_inventory_families=total,stages=stages,payload_stages=measured_payloads,bounded_paths_and_queue=sample_result,
        source_summary_setup_seconds=summary_setup_seconds,
        max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        source_index_bytes=Path(index_path).stat().st_size,project_index_bytes=Path(project_path).stat().st_size,
        operational_queue_writes=0,membership_writes=0,limitations=['full operational queue expansion not certified by bounded payload benchmark'])
    atomic_json(output/'BENCHMARK.json',result); atomic_json(output/'REAL-SAMPLE.json',sample_rows); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['index','project','output']: p.add_argument('--'+name,required=True,type=Path)
    a=p.parse_args(); print(dumps(benchmark(a.index,a.project,a.output)))

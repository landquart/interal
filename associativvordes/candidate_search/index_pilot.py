#!/usr/bin/env python3
"""Materialize a finite guarded graph from the full source index, then review queue.

The existing seven-family bound and manual decision guards remain authoritative.
No new spelling join is inserted into the morphological graph.
"""
import argparse
from functools import lru_cache
import gzip
import json
import resource
from pathlib import Path
import sqlite3
import sys
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'importers'))
from scale_index import Index, bid
from certify_corpus import atomic_json
from morphology_import import hash_file, digest
from search import Graph, Queue, build, sha
from build_graph import load_registry, ingest, align
from project_store import verified_project

FAMILIES=['family:ocul','family:ped','family:alter','family:regul','family:creat','family:nat','family:inter']


def pilot(index_path,projection,projection_lock,registry_path,project_path,repo,output):
    output=Path(output).resolve(); repo=Path(repo).resolve()
    if output.is_relative_to(repo): raise ValueError('external pilot storage required')
    output.mkdir(parents=True,exist_ok=True); started=time.monotonic()
    verified_project(project_path)
    lock=json.loads(Path(projection_lock).read_text())
    if hash_file(projection)!=lock['snapshot_sha256']: raise ValueError('v6 projection checksum mismatch')
    snapshot=json.loads(Path(projection).read_text()); registry=json.loads(Path(registry_path).read_text())
    g=Graph(output/'graph.sqlite'); load_registry(g,snapshot)
    source=Index(index_path); seqs=set(); queries=truncated=0
    bound_events=dict(native_lookup=0,per_language_selection=0,family_selection=0,path_traversal=0,frequency_lookup=0)
    try:
        for family in FAMILIES:
            per_language={}
            for lang,word,head in g.db.execute('SELECT language,word,head FROM known WHERE family=? ORDER BY language,word,head',(family,)):
                if g.guard(family,lang,word)['status'] in {'blocked','hold'}: continue
                matches=source.db.execute('''SELECT l.id,l.seq FROM lexemes l WHERE l.language=? AND l.search=?
                  AND EXISTS(SELECT 1 FROM arcs a WHERE a.src=l.id AND a.direction='directed'
                    AND a.type IN ('direct_derivation','conversion','compounding')) ORDER BY l.id LIMIT 3''',(lang,word)).fetchall()
                per_language.setdefault(lang,[]).extend(matches[:2]); truncated+=int(len(matches)>2)
                bound_events['native_lookup']+=int(len(matches)>2)
            chosen=[]
            for lang in sorted(per_language):
                unique=sorted(set(per_language[lang])); chosen.extend(unique[:2])
                bound_events['per_language_selection']+=int(len(unique)>2)
            bound_events['family_selection']+=int(len(chosen)>12)
            for identifier,seq in chosen[:12]:
                seqs.add(seq); result=source.paths('lexeme:'+identifier.hex()); queries+=1; truncated+=int(result['truncated'])
                bound_events['path_traversal']+=int(result['truncated'])
                for path in result['paths']:
                    for name in path['nodes']:
                        seqs.add(source.db.execute('SELECT seq FROM lexemes WHERE id=?',(bid(name),)).fetchone()[0])
                    for step in path['steps']:
                        seqs.add(source.db.execute('SELECT seq FROM records WHERE eid=?',(bid(step['evidence_id']),)).fetchone()[0])
        records=output/'records.ndjson'
        with open(records,'w',encoding='utf-8') as stream:
            for seq in sorted(seqs): stream.write(json.dumps(source.record(seq),ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
    finally: source.close()
    graph_counts=ingest(g,records,registry); graph_counts.update(align(g,snapshot))
    project=sqlite3.connect(project_path); frequencies={}
    @lru_cache(maxsize=1)
    def shard(name,expected):
        path=repo/'associativvordes/family-index-v5'/name
        if hash_file(path)!=expected: raise ValueError('frequency source checksum mismatch')
        with gzip.open(path,'rt') as stream: return json.load(stream)
    try:
        words=g.db.execute('SELECT DISTINCT language,search FROM lexemes ORDER BY language,search').fetchall()
        for lang,word in words:
            rows=project.execute('''SELECT s.family,s.ordinal,s.raw_sha,f.path,f.sha FROM seeds s JOIN files f ON f.id=s.file
                 WHERE s.language=? AND s.word=? ORDER BY s.family,f.path,s.ordinal LIMIT 101''',(lang,word)).fetchall()
            if len(rows)>100:
                truncated+=1; bound_events['frequency_lookup']+=1
            for family,ordinal,checksum,name,file_sha in rows[:100]:
                row=shard(name,file_sha)[family][ordinal]
                if bytes.fromhex(digest(row))!=checksum: raise ValueError('frequency row checksum mismatch')
                raw=json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(',',':'))
                key=sha([lang,raw]); entry=frequencies.setdefault(key,dict(language=lang,record_json=raw,record_sha256=sha(raw),locators=[]))
                entry['locators'].append(dict(file='associativvordes/family-index-v5/'+name,sha256=file_sha,
                    commit='a3afb7dad56ba951cc9044591f0236731d35dbbe',family_key=family,ordinal=ordinal,lemma_id=row['lemma_id']))
    finally: project.close(); shard.cache_clear()
    queue=Queue(output/'queue.sqlite')
    try:
        first=build(g,queue,FAMILIES,list(frequencies.values())); queue.export(output/'queue-first.ndjson')
        second=build(g,queue,FAMILIES,list(frequencies.values())); queue.export(output/'queue-replay.ndjson')
        if hash_file(output/'queue-first.ndjson')!=hash_file(output/'queue-replay.ndjson'): raise ValueError('unchanged queue replay differs')
        questions=queue.db.execute('SELECT COUNT(*) FROM questions').fetchone()[0]
        if any(s['changed'] for s in second.values()): raise ValueError('unchanged queue re-review')
    finally: queue.close(); g.close()
    result=dict(status='PASS',families=FAMILIES,real_records=len(seqs),source_queries=queries,truncated_queries=truncated,
        bound_events=bound_events,
        limits=dict(native_matches_per_word=2,source_queries_per_language_per_family=2,
                    source_queries_per_family=12,path_depth=2,paths_per_query=20,expansions_per_query=300,
                    frequency_observations_per_word=100),
        bound_event_semantics='events at separate limits; overlapping events, not an exact count of skipped lexical analyses; legacy truncated_queries excludes per-language/family selection caps',
        graph=graph_counts,frequency_observations=len(frequencies),questions=questions,first=first,replay=second,
        elapsed_seconds=round(time.monotonic()-started,3),queue_sha256=hash_file(output/'queue-first.ndjson'),
        max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        membership_writes=0,mode='guarded_seven_family_pilot_not_mass_annotation')
    atomic_json(output/'PILOT.json',result); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['index','projection','projection-lock','registry','project','repo','output']: p.add_argument('--'+n,required=True,type=Path)
    a=p.parse_args(); print(json.dumps(pilot(a.index,a.projection,a.projection_lock,a.registry,a.project,a.repo,a.output),sort_keys=True))

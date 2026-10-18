#!/usr/bin/env python3
"""Merge only normalized claim views; preserve every evidence occurrence."""
import argparse
import errno
import heapq
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
from morphology_import import digest,dumps,hash_file


def rows(path,key):
    previous=None
    with open(path,encoding='utf-8') as f:
        for line in f:
            row=json.loads(line);current=key(row)
            if previous is not None and current<previous:raise ValueError('unsorted input: '+str(path))
            previous=current
            yield row


def make_catalog(registry_path,plan_path,snapshot_root,output_root):
    registry=json.loads(Path(registry_path).read_text())
    expected={a['id']:a for a in registry['artifacts']}
    plan_path=Path(plan_path);plan=json.loads(plan_path.read_text())
    root=Path(snapshot_root).resolve();out=Path(output_root).resolve()
    if out.is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('catalog output must be outside repository')
    inputs=[];seen=set();policies=[]
    for part in sorted(plan['partitions'],key=lambda x:x['name']):
        lock=plan_path.parent/part['lock'];data=json.loads(lock.read_text())
        for a in data['artifacts']:
            if a['id'] in seen:raise ValueError('duplicate artifact across partitions')
            if expected.get(a['id'])!=a:raise ValueError('partition differs from registry')
            seen.add(a['id'])
        path=(root/part['name']/part['build_id']).resolve()
        if not path.is_relative_to(root):raise ValueError('snapshot path escapes root')
        m=json.loads((path/'manifest.json').read_text())
        if m['build_id']!=part['build_id'] or m['source_lock_sha256']!=hash_file(lock):raise ValueError('input manifest mismatch')
        for name,h in m['outputs'].items():
            if hash_file(path/name)!=h:raise ValueError('input output checksum mismatch')
        inputs.append((part,path,m));policies.append(m['policy'])
    if seen!=set(expected):raise ValueError('missing artifacts in partitions')
    if any(p!=policies[0] for p in policies):raise ValueError('mixed importer policies')
    identity={'catalog_version':'normalized-claim-catalog/1','code_sha256':hash_file(__file__),
              'registry_sha256':hash_file(registry_path),'plan_sha256':hash_file(plan_path),
              'builds':sorted(m['build_id'] for _,_,m in inputs)}
    build_id=digest(identity);out.mkdir(parents=True,exist_ok=True);final=out/build_id
    if final.exists():
        m=json.loads((final/'CATALOG.json').read_text())
        for name,h in m['outputs'].items():
            if hash_file(final/name)!=h:raise ValueError('existing catalog corrupted')
        return final
    tmp=Path(tempfile.mkdtemp(prefix='morphology-catalog-'));db=sqlite3.connect(tmp/'work.sqlite')
    db.executescript('PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; CREATE TABLE analyses(pair TEXT,type TEXT,viewkey TEXT); CREATE INDEX pair_idx ON analyses(pair);')
    unique=duplicates=evidence=0
    try:
        lastkey=None;lastbody=None
        with open(tmp/'normalized-relations.ndjson','w',encoding='utf-8') as f:
            streams=[rows(path/'normalized-relations.ndjson',lambda r:r['key']) for _,path,_ in inputs]
            for row in heapq.merge(*streams,key=lambda r:r['key']):
                if digest(row['view'])!=row['key']:raise ValueError('view checksum mismatch')
                body=dumps(row)
                if row['key']==lastkey:
                    if body!=lastbody:raise ValueError('same view key with different content')
                    duplicates+=1;continue
                lastkey,lastbody=row['key'],body;unique+=1;f.write(body+'\n')
                v=row['view'];endpoints=v['endpoints']
                # Lookup-only pair canonicalization; never lexical identity.
                if len(endpoints)==2 and all(isinstance(x,list) for x in endpoints):endpoints=sorted(endpoints,key=dumps)
                pair=digest([v['language'],endpoints])
                db.execute('INSERT INTO analyses VALUES(?,?,?)',(pair,v['type'],row['key']))
                if unique%10000==0:db.commit()
        db.commit()
        last=None
        with open(tmp/'relation-evidence.ndjson','w',encoding='utf-8') as f:
            streams=[rows(path/'relation-evidence.ndjson',lambda r:(r['key'],r['evidence'])) for _,path,_ in inputs]
            for row in heapq.merge(*streams,key=lambda r:(r['key'],r['evidence'])):
                key=(row['key'],row['evidence'])
                if key==last:raise ValueError('duplicate evidence occurrence across partitions')
                last=key;evidence+=1;f.write(dumps(row)+'\n')
        differences=0
        with open(tmp/'analysis-differences.ndjson','w',encoding='utf-8') as f:
            query='''SELECT a.pair,a.type,a.viewkey FROM analyses a JOIN
              (SELECT pair FROM analyses GROUP BY pair HAVING COUNT(DISTINCT type)>1) c
              ON a.pair=c.pair ORDER BY a.pair,a.type,a.viewkey'''
            for pair,kind,key in db.execute(query):
                differences+=1;f.write(dumps({'pair_key':pair,'type':kind,'view_key':key,'status':'needs_review','contradiction_established':False})+'\n')
        db.close();(tmp/'work.sqlite').unlink()
        outputs={p.name:hash_file(p) for p in sorted(tmp.iterdir())}
        m={'build_id':build_id,'identity':identity,'mode':'ingest_shadow','establishes_membership':False,
           'artifacts':len(seen),'partitions':len(inputs),'unique_normalized_views':unique,
           'duplicate_view_occurrences':duplicates,'evidence_occurrences':evidence,
           'analysis_difference_rows':differences,'outputs':outputs,
           'inputs':[{'partition':part['name'],'build_id':part['build_id'],'manifest_sha256':hash_file(path/'manifest.json')} for part,path,_ in inputs]}
        (tmp/'CATALOG.json').write_text(dumps(m)+'\n',encoding='utf-8')
        try:os.rename(tmp,final)
        except OSError as exc:
            if exc.errno!=errno.EXDEV:raise
            stage=Path(tempfile.mkdtemp(prefix='.publish-',dir=out))
            try:shutil.copytree(tmp,stage,dirs_exist_ok=True);os.rename(stage,final);shutil.rmtree(tmp)
            finally:shutil.rmtree(stage,ignore_errors=True)
        return final
    except BaseException:
        db.close();shutil.rmtree(tmp,ignore_errors=True);raise


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for arg in ['registry','plan','snapshot-root','output-root']:p.add_argument('--'+arg,required=True)
    a=p.parse_args();print(make_catalog(a.registry,a.plan,a.snapshot_root,a.output_root))

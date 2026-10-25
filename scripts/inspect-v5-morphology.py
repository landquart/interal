#!/usr/bin/env python3
"""Export every native alternative for one exact frozen v5 row; no confirmation."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import argparse,gzip,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'associativvordes/morphology_cleanup'))
from native import records_all
from common import read,filehash,canonical,atomic,qid
p=argparse.ArgumentParser()
for name in ('snapshot','external','lock','bucket','family','language','lemma-id','output'):p.add_argument('--'+name,required=True)
p.add_argument('--ordinal',required=True,type=int);a=p.parse_args()
root=pathlib.Path(a.snapshot);lock=read(root/'SNAPSHOT.json');prefix='current/associativvordes/family-index-v5/'
if a.language not in ('en','de','fr','es','it','ru') or len(a.bucket)!=2 or any(c not in '0123456789abcdef' for c in a.bucket):raise ValueError('invalid partition')
paths=[prefix+'families/'+a.bucket+'.json.gz',prefix+'members/'+a.language+'/'+a.bucket+'.json.gz']
expected={x['path']:x for x in lock['files']}
for path in paths:
 if filehash(root/path)!=expected[path]['sha256']:raise ValueError('frozen source checksum')
family=json.load(gzip.open(root/paths[0]))[a.family];rows=json.load(gzip.open(root/paths[1]))[a.family]
if a.ordinal<0:raise ValueError('negative ordinal')
row=rows[a.ordinal]
if row['lemma_id']!=a.lemma_id:raise ValueError('exact lemma identity mismatch')
out=pathlib.Path(a.output).resolve()
if out.is_relative_to(ROOT) or out.is_relative_to(root) or out.is_relative_to(pathlib.Path(a.external).resolve()):raise ValueError('separate research output required')
out.mkdir(parents=True,exist_ok=True)
registry=read(a.lock);artifacts={x['id']:x for x in registry['artifacts']};count=0
with open(out/'ALTERNATIVES.ndjson.partial','xb') as stream:
 for r in records_all(a.external,a.lock,a.language,row['word']):
  artifact=artifacts[r['body']['artifact']]
  export=dict(record=r,source_context=dict(license=artifact['license'],lineage=artifact.get('lineage',dict(status='independence_unknown')),revision=artifact['revision']),lexical_binding='UNRESOLVED',sense_binding='UNRESOLVED',component_roles='UNKNOWN_UNLESS_EXPLICIT_IN_SOURCE',component_meaning='UNRESOLVED')
  stream.write(canonical(export)+b'\n');count+=1
(out/'ALTERNATIVES.ndjson.partial').rename(out/'ALTERNATIVES.ndjson')
atomic(out/'MEMBERSHIP.json',canonical(dict(question_id=qid(a.family,a.language,a.lemma_id),family=family,original_membership=row,ordinal=a.ordinal,source_files=[expected[x] for x in paths],source_inventory_sha256=lock['inventory_sha256'],source_lock_sha256=filehash(a.lock),alternatives=count,alternatives_sha256=filehash(out/'ALTERNATIVES.ndjson'),membership_operation='NONE'))+b'\n')
print(json.dumps(dict(alternatives=count,membership_operation='NONE')))

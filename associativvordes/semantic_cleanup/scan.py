"""Full read-only v5 scan; finite semantic-priority scope, no semantic guesses."""
import argparse
from collections import Counter
import gzip
import io
import json
import os
from pathlib import Path
import resource
import sys
import time
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from associativvordes.national_correspondences.registry import canonical,filehash,read
from associativvordes.national_correspondences.audit import atomic

def compressed(rows):
    buffer=io.BytesIO()
    with gzip.GzipFile(fileobj=buffer,mode='wb',mtime=0,filename='') as stream:
        for row in rows:stream.write(canonical(row)+b'\n')
    return buffer.getvalue()

def scan(repo,output,stop_after=None):
    repo=Path(repo).resolve();output=Path(output).resolve()
    if output.is_relative_to(repo):raise ValueError('research scan output must be outside repository')
    output.mkdir(parents=True,exist_ok=True);start=time.perf_counter()
    baseline=repo/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json'
    lock=read(baseline);prefix='current/';files=[f for f in lock['files'] if f['path'].startswith(prefix)]
    inputs={f['path'][len(prefix):]:f for f in files}
    policy=repo/'audit/associative-v5-semantic-cleanup/SCOPE-POLICY.json';wanted=set(read(policy)['family_ids'])
    identity=dict(baseline_sha256=filehash(baseline),production_commit=lock['production_commit'],scope_policy_sha256=filehash(policy),code_sha256=filehash(__file__))
    if (output/'IDENTITY.json').exists() and read(output/'IDENTITY.json')!=identity:raise ValueError('stale checkpoint')
    atomic(output/'IDENTITY.json',canonical(identity)+b'\n')
    # Every current physical input is checked, including all aliases and metadata.
    for rel,f in inputs.items():
        path=repo/rel
        if path.stat().st_size!=f['bytes'] or filehash(path)!=f['sha256']:raise ValueError('baseline checksum: '+rel)
    root=repo/'associativvordes/family-index-v5';parts=[];processed=0
    for b in range(256):
        bucket=f'{b:02x}';data=output/(bucket+'.ndjson.gz');receipt=output/(bucket+'.json')
        if receipt.exists():
            item=read(receipt)
            if item['identity']!=identity or filehash(data)!=item['sha256']:raise ValueError('corrupt checkpoint')
            parts.append(item);continue
        fs=json.load(gzip.open(root/'families'/f'{bucket}.json.gz'));family_count=len(fs)
        selected={fid:fs[fid] for fid in sorted(wanted&fs.keys())};del fs
        members=[];all_members=0;languages=Counter();family_counts=Counter()
        for language in ('en','de','fr','es','it','ru'):
            rows=json.load(gzip.open(root/'members'/language/f'{bucket}.json.gz'))
            for fid,values in rows.items():
                all_members+=len(values)
                if fid not in selected:continue
                family_counts[fid]+=len(values);languages[language]+=len(values)
                for ordinal,row in enumerate(values):
                    import hashlib
                    members.append(dict(family_id=fid,language=language,lemma_id=row['lemma_id'],word=row['word'],bucket=bucket,ordinal=ordinal,record_sha256=hashlib.sha256(canonical(row)).hexdigest(),original_record=row,pos=None,sense_id=None,identity_status='LEGACY_SENSE_AND_POS_UNRESOLVED',status='INSUFFICIENT_EVIDENCE',semantic_gold=False))
            del rows
        atomic(data,compressed(members))
        item=dict(bucket=bucket,identity=identity,sha256=filehash(data),bytes=data.stat().st_size,all_families=family_count,all_memberships=all_members,selected_memberships=len(members),languages=dict(languages),family_counts=dict(family_counts),families=selected)
        atomic(receipt,canonical(item)+b'\n');parts.append(item);processed+=1
        if b%32==31:print('buckets',b+1,flush=True)
        if stop_after is not None and processed>=stop_after:return dict(status='INTERRUPTED_AFTER_ATOMIC_BUCKET',new_buckets=processed)
    all_families=sum(p['all_families'] for p in parts);all_members=sum(p['all_memberships'] for p in parts)
    if all_families!=2456543 or all_members!=10078319:raise ValueError('baseline full recount differs')
    families={fid:body for part in parts for fid,body in part['families'].items()};languages=Counter();family_counts=Counter()
    for part in parts:languages.update(part['languages']);family_counts.update(part['family_counts'])
    # Verify source hashes again before committing the release receipt.
    for rel,f in inputs.items():
        if filehash(repo/rel)!=f['sha256']:raise ValueError('input changed during scan')
    manifest=dict(schema='interal-semantic-scope/1',identity=identity,production_files=len(files),full_families=all_families,full_memberships=all_members,selected_families=len(families),selected_memberships=sum(p['selected_memberships'] for p in parts),selected_by_language=dict(languages),family_counts=dict(family_counts),missing_requested_ids=sorted(wanted-families.keys()),families=families,parts=[{k:p[k] for k in ('bucket','sha256','bytes','selected_memberships','all_families','all_memberships')} for p in parts],production_writes=0)
    atomic(output/'MANIFEST.json',canonical(manifest)+b'\n')
    atomic(output/'RESOURCE.json',canonical(dict(elapsed_seconds=round(time.perf_counter()-start,3),peak_rss_mib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,3),disk_bytes=sum(p.stat().st_size for p in output.iterdir() if p.is_file()),new_buckets=processed))+b'\n')
    return {k:manifest[k] for k in ('full_families','full_memberships','selected_families','selected_memberships')}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',default=ROOT);p.add_argument('--output',required=True);p.add_argument('--stop-after',type=int);a=p.parse_args();print(json.dumps(scan(a.repo,a.output,a.stop_after)))

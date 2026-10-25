#!/usr/bin/env python3
"""Hash all frozen production files and inspect finite carriers in all 256 buckets."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import sys
import time
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from associativvordes.national_correspondences.registry import Registry, canonical, filehash, read
from associativvordes.national_correspondences.audit import atomic
p=argparse.ArgumentParser(__doc__)
p.add_argument('--snapshot',required=True);p.add_argument('--output',required=True)
a=p.parse_args();start=time.perf_counter();snapshot=Path(a.snapshot);out=Path(a.output)
if out.resolve().is_relative_to((ROOT/'associativvordes/family-index-v5').resolve()):raise ValueError('production output forbidden')
out.mkdir(parents=True,exist_ok=True)
lock=read(snapshot/'SNAPSHOT.json');prefix='current/';files=[x for x in lock['files'] if x['path'].startswith(prefix)]
errors=[];size=0
for i,f in enumerate(files,1):
 path=ROOT/f['path'][len(prefix):]
 if path.stat().st_size!=f['bytes'] or filehash(path)!=f['sha256']:errors.append(f['path'])
 size+=path.stat().st_size
 if i%256==0:print('hashed',i,flush=True)
# Ignore unrelated untracked temporary residues; flag any added tracked production file.
tracked=subprocess.check_output(['git','ls-files','associativvordes/family-index-v5'],cwd=ROOT,text=True).splitlines()
expected={f['path'][len(prefix):] for f in files}
if set(tracked)!=expected:errors.append('tracked production inventory differs')
r=Registry(ROOT/'audit/associative-national-correspondences');wanted={fid for fid in r.mappings};counts=Counter();found=[];metadata=[]
root=ROOT/'associativvordes/family-index-v5';total=0;families=0
entries={(fid,e['language'],e['lexeme']['lemma']):e['id'] for fid,canonical_id in r.mappings.items() for e in r.registry['entries'] if e['canonical_root_id']==canonical_id}
for b in range(256):
 bucket=f'{b:02x}';fs=json.load(gzip.open(root/'families'/f'{bucket}.json.gz'));families+=len(fs)
 for fid in sorted(wanted & fs.keys()):metadata.append(dict(bucket=bucket,family_id=fid,canonical=fs[fid]['canonical'],source=fs[fid].get('source'),old_verified_flag_is_not_gold=fs[fid].get('verified'),target_sense_status='UNRESOLVED_UNLESS_INDEPENDENTLY_BOUND'))
 del fs
 for lang in ('en','de','fr','es','it','ru'):
  ms=json.load(gzip.open(root/'members'/lang/f'{bucket}.json.gz'))
  for fid,rows in ms.items():
   total+=len(rows)
   if fid in wanted:
    counts[fid]+=len(rows)
    for ordinal,row in enumerate(rows):
     entry=entries.get((fid,lang,row['word']))
     if entry:found.append(dict(entry_id=entry,family_id=fid,language=lang,lemma_id=row['lemma_id'],word=row['word'],bucket=bucket,ordinal=ordinal,record_sha256=hashlib.sha256(canonical(row)).hexdigest(),binding_status='SPELLING_MATCH_ONLY_SENSE_UNRESOLVED',membership_operation='NONE'))
  del ms
 if b%32==31:print('buckets',b+1,'memberships',total,flush=True)
if families!=2456543 or total!=10078319:errors.append('full recount differs from locked baseline')
# This scan is not a new structural/linguistic census: full counts and immutable
# hashes are checked; finite lexical carriers are located without sense invention.
report=dict(schema='interal-correspondence-production-integrity/1',status='PASS' if not errors else 'BLOCKED',errors=errors,source_commit=r.registry['production_source_commit'],snapshot_inventory_sha256=lock['inventory_sha256'],production_files=len(files),production_bytes=size,all_256_buckets_read=True,families=families,memberships=total,root_family_counts=dict(counts),family_metadata=metadata,exact_spelling_carriers=found,corpus_sense_bindings_confirmed=0,production_writes=0,source_lemma_removals=0)
atomic(out/'PRODUCTION-INTEGRITY.json',canonical(report)+b'\n')
atomic(out/'SCAN-RESOURCE-BENCHMARK.json',canonical(dict(elapsed_seconds=round(time.perf_counter()-start,3),peak_rss_mib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,3),production_bytes_read=size,algorithm='one compressed family/member bucket at a time; finite lexical carrier selection',extra_corpus_copy_bytes=0))+b'\n')
print(json.dumps(dict(status=report['status'],files=len(files),families=families,memberships=total,carriers=len(found))))
if errors:sys.exit(1)

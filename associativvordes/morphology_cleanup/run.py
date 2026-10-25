"""Read-only full-v5 morphology triage. No unbound source match becomes a verdict."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,collections,gzip,hashlib,json,os,pathlib,resource,shutil,sqlite3,sys,time
from associativvordes.morphology_cleanup.native import Profiles
from associativvordes.morphology_cleanup.policy import *
ROOT=pathlib.Path(__file__).resolve().parents[2]
pass
from associativvordes.research_integrity import code_lock
pass
pass
from associativvordes.structural_cleanup.common import load,save,atomic,sha_file,verify,PREFIX,LANGS,outside_repo
from associativvordes.structural_cleanup.shadow import decode
pass
from associativvordes.v5_diagnostics.classify import member

def scan(snapshot,profiles,history,out,crash=None):
 start=time.monotonic();out=outside_repo(ROOT,out);out.mkdir(parents=True,exist_ok=True);snapshot=pathlib.Path(snapshot)
 lock=load(snapshot/'SNAPSHOT.json');verify(snapshot,lock);pr=Profiles(profiles);history=pathlib.Path(history)
 expected=load(ROOT/'audit/associative-v5-surface-cleanup/HISTORY-INDEX.json')
 if sha_file(history)!=expected['sha256']:raise ValueError('history index checksum')
 pointer=load(ROOT/'audit/associative-history-registry/CURRENT.json')
 identity=dict(schema='v5-morphology-review/1',source_inventory_sha256=lock['inventory_sha256'],profiles_sha256=sha_file(pathlib.Path(profiles)/'MANIFEST.json'),history_sha256=sha_file(history),history_pointer=pointer,code=code_lock())
 if (out/'IDENTITY.json').exists() and load(out/'IDENTITY.json')!=identity:raise ValueError('stale resume')
 save(out/'IDENTITY.json',identity);digest=hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()
 db=sqlite3.connect(history.resolve().as_uri()+'?mode=ro',uri=True);totals=collections.Counter();receipts=[];root=snapshot/'current'/PREFIX
 for bi in range(256):
  b=f'{bi:02x}';dest=out/'buckets'/b;receipt=dest/'RECEIPT.json'
  if receipt.exists():
   r=load(receipt)
   if r['identity']!=digest or sha_file(dest/'UNRESOLVED.ndjson.gz')!=r['sha256']:raise ValueError('corrupt checkpoint')
  else:
   stage=dest.with_name(b+'.partial');stage.parent.mkdir(exist_ok=True,parents=True)
   if stage.exists():shutil.rmtree(stage)
   stage.mkdir();stats=collections.Counter();families=decode(root/'families'/(b+'.json.gz'));stats['families']=len(families);selected_families=set();cache={}
   with open(stage/'UNRESOLVED.ndjson.gz','xb') as raw,gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as sink:
    for lang in LANGS:
     groups=decode(root/'members'/lang/(b+'.json.gz'))
     for fid,rows in groups.items():
      if fid not in families:raise ValueError('orphan family')
      constraints=collections.defaultdict(list)
      for lid,did in db.execute('SELECT lemma,decision FROM ids WHERE family=? AND language=?',(fid,lang)):constraints[lid].append(did)
      for ordinal,row in enumerate(rows):
       stats['memberships']+=1;stats['language:'+lang+':memberships']+=1
       flags=member(row)['flags']
       if not flags:stats['not_selected']+=1;continue
       stats['selected']+=1;stats['language:'+lang+':selected']+=1;selected_families.add(fid)
       key=(lang,row['word'])
       if key not in cache:
        if len(cache)>=50000:cache.clear()
        cache[key]=pr.lookup(*key)
       mask,n=cache[key];status=classify(mask);stats['status:'+status]+=1;stats['language:'+lang+':'+status]+=1
       if n:stats['spelling_matched']+=1
       else:stats['source_rows_missing']+=1
       for kind,bit in BITS.items():
        if mask&bit:stats['candidate_type:'+kind]+=1;stats['language:'+lang+':candidate_type:'+kind]+=1
       hist=sorted(constraints[row['lemma_id']]);stats['exact_history_overlap']+=bool(hist)
       # Exact source pointer + complete retrievable alternatives; no native/sense binding invented.
       record=[fid,lang,row['lemma_id'],ordinal,row['word'],status,mask,n,hist,flags]
       sink.write(json.dumps(record,ensure_ascii=False,separators=(',',':')).encode()+b'\n')
     del groups
   stats['selected_families']=len(selected_families)
   if crash==b:os._exit(75)
   r=dict(bucket=b,identity=digest,stats=dict(stats),sha256=sha_file(stage/'UNRESOLVED.ndjson.gz'))
   save(stage/'RECEIPT.json',r);os.replace(stage,dest)
  totals.update(r['stats']);receipts.append(r)
  if bi%16==15:print(b,totals['memberships'],totals['selected'],flush=True)
 db.close();pr.close();verify(snapshot,lock)
 if identity['code']!=code_lock():raise ValueError('code changed during scan')
 for name in ('VERIFIED-RELATION-CORRECTIONS.ndjson','PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson'):atomic(out/name,b'')
 summary=dict(schema='v5-morphology-review/1',totals=dict(totals),confirmed_relations=0,confirmed_wrong_relations=0,verified_type_corrections=0,proposed_membership_exclusions=0,history_application='BLOCKED_INCOMPLETE_HISTORY',lexical_identity='UNBOUND_SPELLING_CANDIDATES',sense_status='UNRESOLVED',production_writes=0,source_lemma_delta=0,type_counts_overlap=True,source_row_counts_are_not_independent_evidence=True)
 save(out/'SUMMARY.json',summary);save(out/'MANIFEST.json',dict(identity=identity,buckets=receipts,summary_sha256=sha_file(out/'SUMMARY.json')))
 save(out/'RESOURCE-BENCHMARK.json',dict(seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,disk_bytes=sum(p.stat().st_size for p in out.rglob('*') if p.is_file()),bound='One bucket, 50000 lookup entries, disk native/history indexes'))
 return summary
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--snapshot',required=True);p.add_argument('--profiles',required=True);p.add_argument('--history',required=True);p.add_argument('--output',required=True);p.add_argument('--crash-bucket');a=p.parse_args();print(json.dumps(scan(a.snapshot,a.profiles,a.history,a.output,a.crash_bucket),sort_keys=True))

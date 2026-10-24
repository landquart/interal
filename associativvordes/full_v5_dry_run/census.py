"""Pinned census core with strict bounded-bucket decoder; separately locked adapter."""
import argparse,gzip,sqlite3,time,resource
from .core import *
def strict_object(items):
 out={}
 for k,v in items:
  if k in out:raise ValueError('duplicate JSON object key '+k)
  out[k]=v
 return out
def pairs(path):
 # At most one existing gzip shard, not the global registry. Exact same objects
 # reach the pinned census core; avoid repeated decoding of incomplete families.
 with gzip.open(path,'rt',encoding='utf-8') as f:
  data=json.load(f,object_pairs_hook=strict_object,parse_constant=lambda s:(_ for _ in ()).throw(ValueError('nonfinite JSON')))
 if not isinstance(data,dict):raise ValueError('object shard required')
 yield from data.items()
def run(work,snapshot,output,crash_after=None):
 work=outside(work);output=outside(output);snapshot=Path(snapshot).resolve();tool=pinned(work);output.mkdir(parents=True,exist_ok=True)
 ident=dict(core_sha256=TOOL_SHA,adapter_sha256=sha(__file__),snapshot_sha256=sha(snapshot/'SNAPSHOT.json'),decoder='strict_one_gzip_bucket')
 p=output/'ADAPTER-IDENTITY.json'
 if p.exists() and load(p)!=ident:raise ValueError('census adapter/source changed')
 save(p,ident);tool.pairs=pairs;start=time.monotonic();cpu=time.process_time()
 tool.run(snapshot,output,crash_after=crash_after)
 save(output/'ADAPTER-RESOURCE.json',dict(wall_seconds=time.monotonic()-start,cpu_seconds=time.process_time()-cpu,peak_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,disk_bytes=sum(p.stat().st_size for p in output.rglob('*') if p.is_file()),implementation=ident))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--work',required=True);p.add_argument('--snapshot',required=True);p.add_argument('--output',required=True);p.add_argument('--crash-after',type=int);a=p.parse_args();run(a.work,a.snapshot,a.output,a.crash_after)

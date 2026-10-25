"""Full-scope v2 semantic status pass over the certified v1 census (no source edits)."""

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
import argparse,collections,gzip,hashlib,json,os,pathlib,resource,shutil,sys,time
from associativvordes.morphology_review.policy import canonical,digest,unresolved_reasons
ROOT=pathlib.Path(__file__).resolve().parents[2]
pass
from associativvordes.structural_cleanup.common import load,save,atomic,sha_file,outside_repo

def run(source,output,crash=None):
    start=time.monotonic();source=pathlib.Path(source);out=outside_repo(ROOT,output);out.mkdir(parents=True,exist_ok=True)
    from associativvordes.v5_contract.versions import require_directory
    installed_input=require_directory(source,'morphology')
    input_sha=sha_file(source/'MANIFEST.json')
    manifest=load(source/'MANIFEST.json');identity=dict(schema='v5-morphology-semantic-review/2',input_manifest_sha256=input_sha,version_contract=installed_input['version_contract'],code={p.name:sha_file(p) for p in pathlib.Path(__file__).parent.glob('*.py')},source_identity=manifest['identity'])
    if (out/'IDENTITY.json').exists() and load(out/'IDENTITY.json')!=identity:raise ValueError('stale resume')
    save(out/'IDENTITY.json',identity);receipts=[];totals=collections.Counter();languages={};reasons=collections.Counter()
    for part in manifest['buckets']:
        b=part['bucket'];src=source/'buckets'/b/'UNRESOLVED.ndjson.gz'
        if sha_file(src)!=part['sha256']:raise ValueError('input partition checksum')
        dest=out/'buckets'/b
        if (dest/'RECEIPT.json').exists():
            r=load(dest/'RECEIPT.json')
            if r['identity']!=digest(identity) or sha_file(dest/'UNRESOLVED.ndjson.gz')!=r['sha256']:raise ValueError('invalid complete checkpoint')
        else:
            stage=dest.with_name(b+'.partial');stage.parent.mkdir(parents=True,exist_ok=True)
            if stage.exists():shutil.rmtree(stage)
            stage.mkdir();counts=collections.Counter();lc={};rc=collections.Counter()
            with gzip.open(src,'rt') as f,open(stage/'UNRESOLVED.ndjson.gz','xb') as raw,gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as g:
                for line in f:
                    row=json.loads(line)
                    if len(row)!=10 or row[5] not in ('INSUFFICIENT_EVIDENCE','COMPETING_ANALYSES'):raise ValueError('unexpected input schema')
                    counts['selected_memberships']+=1;lc[row[1]]=lc.get(row[1],0)+1
                    rr=unresolved_reasons(row[6],row[7],row[8],row[9]);rc.update(rr)
                    counts['legacy_multiple_type_labels_reclassified']+=row[5]=='COMPETING_ANALYSES'
                    row[5]='INSUFFICIENT_EVIDENCE';row.append(rr);g.write(canonical(row)+b'\n')
            if counts['selected_memberships']!=part['stats']['selected']:raise ValueError('lost scope')
            if crash==b:os._exit(75)
            r=dict(bucket=b,identity=digest(identity),stats=dict(counts),languages=lc,reasons=dict(rc),sha256=sha_file(stage/'UNRESOLVED.ndjson.gz'),bytes=(stage/'UNRESOLVED.ndjson.gz').stat().st_size)
            save(stage/'RECEIPT.json',r);os.replace(stage,dest)
        totals.update(r['stats']);reasons.update(r['reasons']);receipts.append(r)
        for lang,n in r['languages'].items():languages[lang]=languages.get(lang,0)+n
        if len(receipts)%32==0:print(b,totals['selected_memberships'],flush=True)
    original=load(source/'SUMMARY.json')
    if sha_file(source/'SUMMARY.json')!=manifest['summary_sha256']:raise ValueError('input summary checksum')
    if totals['selected_memberships']!=original['totals']['selected']:raise ValueError('incomplete census')
    for name in ['VERIFIED-RELATION-CORRECTIONS.ndjson','PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson']:atomic(out/name,b'')
    statuses={s:0 for s in ['CONFIRMED_RELATION','CONFIRMED_WRONG_RELATION','WRONG_RELATION_TYPE','COMPETING_ANALYSES','INSUFFICIENT_EVIDENCE']};statuses['INSUFFICIENT_EVIDENCE']=totals['selected_memberships']
    summary=dict(schema=identity['schema'],families=original['totals']['families'],memberships=original['totals']['memberships'],selected_families=original['totals']['selected_families'],statuses=statuses,totals=dict(totals),languages={l:dict(statuses,INSUFFICIENT_EVIDENCE=n) for l,n in languages.items()},reasons=dict(reasons),flags_overlap=True,semantic_proofs_available=0,production_writes=0,application_status='BLOCKED_INCOMPLETE_HISTORY',supersedes='v1 semantic labels only; exact scope, source claims and alternatives unchanged')
    if identity['code']!={p.name:sha_file(p) for p in pathlib.Path(__file__).parent.glob('*.py')}:raise ValueError('code changed')
    save(out/'SUMMARY.json',summary);save(out/'MANIFEST.json',dict(identity=identity,buckets=receipts,summary_sha256=sha_file(out/'SUMMARY.json')))
    save(out/'RESOURCE-BENCHMARK.json',dict(seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,output_bytes=sum(p.stat().st_size for p in out.rglob('*') if p.is_file()),memory_bound='One streamed NDJSON row and 256 compact receipts; no graph in RAM'))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--crash-bucket');a=p.parse_args();run(a.input,a.output,a.crash_bucket)

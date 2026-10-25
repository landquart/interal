"""Complete frozen-v5 hypothesis scan; deterministic bucket receipts and finite IDs."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,collections,gzip,hashlib,io,json,os,pathlib,resource,shutil,sqlite3,sys,time
from associativvordes.surface_cleanup.policy import *
ROOT=pathlib.Path(__file__).resolve().parents[2]
pass
from associativvordes.research_integrity import code_lock
pass
from associativvordes.structural_cleanup.common import load,save,atomic,sha_file,verify,MAIN,PREFIX,LANGS,outside_repo
from associativvordes.structural_cleanup.shadow import decode
from associativvordes.surface_cleanup.history import collect,build_scope_index

def gz(path):
    raw=open(path,'xb');stream=gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0,compresslevel=6)
    return raw,stream

def scan(repo,snapshot,output,crash_bucket=None):
    started=time.monotonic();repo=pathlib.Path(repo).resolve();snapshot=pathlib.Path(snapshot);output=outside_repo(repo,output)
    snapshot=snapshot.resolve()
    if output==snapshot or output.is_relative_to(snapshot) or snapshot.is_relative_to(output):raise ValueError('output must not overlap immutable snapshot')
    output.mkdir(parents=True,exist_ok=True);lock=load(snapshot/'SNAPSHOT.json');verify(snapshot,lock)
    h,catalog=collect(repo);identity=dict(schema=VERSION,source_inventory_sha256=lock['inventory_sha256'],source_commit=lock['production_commit'],
       history_sha256=h.digest,code=code_lock(),
       catalog_sha256=hashlib.sha256(canonical(catalog)).hexdigest(),suffix_exposure_sha256=sha_file(repo/'audit/associative-v5-diagnostics/SUFFIX-EXPOSURE.json'))
    if (output/'IDENTITY.json').exists() and load(output/'IDENTITY.json')!=identity:raise ValueError('changed source/code/history; stale resume refused')
    save(output/'IDENTITY.json',identity);save(output/'HISTORICAL-SCHEMES.json',catalog)
    configured={r['family_id'] for r in load(repo/'audit/associative-v5-diagnostics/SUFFIX-EXPOSURE.json')['records']}
    if not (output/'HISTORY-INDEX.json').exists():
        partial=output/'history.partial.sqlite'
        if partial.exists():partial.unlink()
        n=build_scope_index(h,partial);os.replace(partial,output/'history.sqlite')
        save(output/'HISTORY-INDEX.json',dict(finite_scope_ids=n,sha256=sha_file(output/'history.sqlite'),snapshot=h.digest))
    hi=load(output/'HISTORY-INDEX.json')
    if sha_file(output/'history.sqlite')!=hi['sha256']:raise ValueError('history finite index corruption')
    db=sqlite3.connect((output/'history.sqlite').resolve().as_uri()+'?mode=ro',uri=True)
    root=snapshot/'current'/PREFIX;receipts=[];all_totals=collections.Counter();all_groups={}
    for bi in range(256):
        b=f'{bi:02x}';dest=output/'buckets'/b;receipt=dest/'RECEIPT.json'
        if receipt.exists():
            r=load(receipt)
            if r['identity']!=hashlib.sha256(canonical(identity)).hexdigest():raise ValueError('stale bucket receipt')
            for name,d in r['files'].items():
                if sha_file(dest/name)!=d['sha256']:raise ValueError('corrupt complete bucket')
        else:
            stage=dest.with_name(b+'.partial');stage.parent.mkdir(parents=True,exist_ok=True)
            if stage.exists():shutil.rmtree(stage) # Unpublished research output only; original inputs never removed.
            stage.mkdir();stats=collections.Counter();families=decode(root/'families'/(b+'.json.gz'))
            scopes={fid:[] for fid in families};types={fid:collections.Counter() for fid in families};langs={fid:collections.Counter() for fid in families}
            history={fid:[] for fid in families};member_flags={fid:collections.Counter() for fid in families};flags={fid:signals(f,configured) for fid,f in families.items()}
            ef,edges=gz(stage/'AFFECTED-IDS.ndjson.gz')
            for lang in LANGS:
                groups=decode(root/'members'/lang/(b+'.json.gz'))
                for fid,rows in groups.items():
                    if fid not in families:raise ValueError('unknown family')
                    constraints=collections.defaultdict(list)
                    for lid,did in db.execute('SELECT lemma,decision FROM ids WHERE family=? AND language=?',(fid,lang)):constraints[lid].append(did)
                    for ordinal,row in enumerate(rows):
                        lid=row['lemma_id'];stats['memberships']+=1;langs[fid][lang]+=1
                        evidence=[e for c in row.get('components',[]) for e in c.get('evidence',[])]
                        types[fid].update(e.get('type','UNKNOWN')+':'+e.get('source','UNKNOWN') for e in evidence)
                        if constraints[lid]:history[fid].extend(constraints[lid]);member_flags[fid]['history_overlap']+=1
                        if row.get('normalized','')!=row.get('search_form',row.get('normalized','')):member_flags[fid]['normalization_changed']+=1
                        if any(e.get('type')=='compound_morphology' for e in evidence):member_flags[fid]['compound_claim']+=1
                        if flags[fid]:
                            scopes[fid].append([lang,lid]);stats['candidate_memberships']+=1
                            edges.write(canonical([fid,lang,lid,ordinal])+b'\n')
                del groups
            edges.close();ef.close();ff,out=gz(stage/'FAMILIES.ndjson.gz');groupsummary={}
            retained={(x['family_id'],x.get('language'),x['raw'].get('lemma_id')) for x in catalog['retained_exceptions'] if isinstance(x['raw'],dict)}
            for fid,f in families.items():
                n=sum(langs[fid].values())
                if n!=f['support']:raise ValueError('support mismatch')
                claim_types={x.split(':',1)[0] for x in types[fid]}
                decision=decide(f,flags[fid],claim_types,set(history[fid]))
                stats['families']+=1;stats['disposition:'+decision['operation']]+=1
                if flags[fid]:
                    stats['candidate_families']+=1;stats['candidate:'+decision['operation']]+=1
                    kept=sum((fid,l,i) in retained for l,i in scopes[fid]);stats['retained_exception_memberships']+=kept
                else:kept=0
                key='|'.join([f.get('source','UNKNOWN'),decision['operation'],','.join(sorted(flags[fid])) or 'NO_SURFACE_SIGNAL'])
                v=groupsummary.setdefault(key,dict(families=0,memberships=0));v['families']+=1;v['memberships']+=n
                record=dict(family_id=fid,canonical=f['canonical'],formation_source=f.get('source'),memberships=n,languages=dict(langs[fid]),
                   observed_evidence_counts=dict(types[fid]),full_scope_sha256=scope_hash(scopes[fid]) if flags[fid] else None,
                   full_scope_memberships=len(scopes[fid]) if flags[fid] else None,member_flags=dict(member_flags[fid]),
                   retained_exception_memberships=kept,**decision)
                out.write(canonical(record)+b'\n')
            out.close();ff.close()
            if crash_bucket==b:os._exit(75)
            r=dict(bucket=b,identity=hashlib.sha256(canonical(identity)).hexdigest(),stats=dict(stats),groups=groupsummary,
                 files={p.name:dict(sha256=sha_file(p),bytes=p.stat().st_size) for p in sorted(stage.glob('*.gz'))})
            save(stage/'RECEIPT.json',r);os.replace(stage,dest)
        receipts.append(r);all_totals.update(r['stats'])
        for key,v in r['groups'].items():
            agg=all_groups.setdefault(key,dict(families=0,memberships=0));agg['families']+=v['families'];agg['memberships']+=v['memberships']
        if bi%16==15:print(canonical(dict(bucket=b,totals=dict(all_totals))).decode(),flush=True)
    db.close();verify(snapshot,lock)
    if identity['code']!=code_lock():raise ValueError('code changed during scan')
    atomic(output/'PROPOSED-EXCLUSIONS.ndjson',b'')
    summary=dict(schema=VERSION,status='FULL_DRY_RUN_COMPLETE_NO_AUTHORIZED_EXCLUSIONS',totals=dict(all_totals),groups=all_groups,
      confirmed_current_erroneous_schemes=0,proposed_exclusions=0,full_scope_proofs_for_new_exclusions=0,scope_ids='buckets/*/AFFECTED-IDS.ndjson.gz',
      history_scope_ids=hi['finite_scope_ids'],history_coverage_complete=h.snapshot['coverage_complete'],
      input_inventory_sha256=lock['inventory_sha256'],production_writes=0,source_lemma_delta=0,
      unknown_native_identity_and_historical_paths_not_treated_as_absent=True)
    save(output/'SUMMARY.json',summary)
    save(output/'MANIFEST.json',dict(schema=VERSION,identity=identity,buckets=receipts,summary_sha256=sha_file(output/'SUMMARY.json'),
         exclusion_manifest_sha256=sha_file(output/'PROPOSED-EXCLUSIONS.ndjson')))
    save(output/'RESOURCE-BENCHMARK.json',dict(seconds=time.monotonic()-started,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
         disk_bytes=sum(p.stat().st_size for p in output.rglob('*') if p.is_file()),streaming_bound='One gzip bucket; disk history index; no full graph in RAM'))
    print(canonical(summary).decode(),flush=True);return summary

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--snapshot',required=True);p.add_argument('--output',required=True);p.add_argument('--crash-bucket')
    a=p.parse_args();scan(a.repo,a.snapshot,a.output,a.crash_bucket)

"""Reconstruct immutable history from pinned Git objects, without touching v5 data.

Materialized deltas are engineering constraints, not independent linguistic gold.
Uninterpreted sources are explicitly coverage blockers.
"""
import argparse
from collections import Counter
import gzip
import json
from pathlib import Path
import re
import zlib
from registry import SCHEMA, atomic, canonical, document, git, import_decisions, sha

MAIN = '47723611112610945cb09b34e18588b7bd151911'
V6 = '9fff76431a86a06df6db69b64d7f2ca4c871f1b7'
ORIGINAL = 'ee6637b266f4bbb4acd77cccf597ed75b2b44aef'
PROVENANCE = 'associativvordes/family-index-v5/repository-provenance.json'
PREFIX = 'associativvordes/family-index-v5/'


def wanted(path):
    if path.startswith(('audit/associative-family-v5/', 'audit/associative-family-v6/',
                        'audit/associative-external-preparation/')): return True
    if path.startswith('scripts/'):
        return 'associative' in path and path.endswith(('.mjs', '.py', '.json'))
    if path.startswith('associativvordes/family-index-v6/'):
        return any(x in path for x in ('review', 'decision', 'correction', 'authorization', 'journal', 'snapshot'))
    return path.startswith(('associativvordes/review/', 'associativvordes/release_control/'))


def walk(x, pointer=''):
    if isinstance(x, dict):
        yield pointer, x
        for k, v in x.items(): yield from walk(v, pointer+'/'+str(k).replace('~','~0').replace('/','~1'))
    elif isinstance(x, list):
        for i,v in enumerate(x): yield from walk(v, pointer+'/'+str(i))


def build(repo, out):
    sources = {}; observations = []; decisions = []; conflicts = []; revisions = []
    def lock(blob, path, commit):
        if not blob or set(blob) == {'0'}: return None
        if blob not in sources:
            b = git(repo, 'cat-file', 'blob', blob)
            sources[blob] = dict(blob=blob, sha256=sha(b), bytes=len(b), path=path, commit=commit)
        return blob
    def obj(commit, path):
        return git(repo, 'rev-parse', commit+':'+path).decode().strip()
    def source(blob, commit, path, pointer=''):
        return dict(commit=commit, path=path, blob=blob, sha256=sources[blob]['sha256'], pointer=pointer)
    def decision(scope, verdict, operation, src, date, explanation, authority='ENGINEERING_CHECK', previous='unknown'):
        d=dict(source=src,date=date,operation=operation,scope=scope,previous_status=previous,
            decision=verdict if authority!='ENGINEERING_CHECK' else 'UNRESOLVED',
            historical_outcome=verdict,explanation=explanation,evidence_refs=[src],authority=authority,
            data_version=src['commit'],supersedes=[],evidence_status='historical_source_locked',
            lexical_identity_status='legacy_row_not_independent_lexeme',sense_status='unknown',
            relation_status='historical_operation_only',association_status='not_evaluated')
        d['id']='history:'+sha(canonical(d)); decisions.append(d)

    # All unique reachable source blobs, including versions no longer present at tips.
    roots=['audit/associative-family-v5','audit/associative-family-v6',
           'audit/associative-external-preparation','scripts','associativvordes/family-index-v6',
           'associativvordes/review','associativvordes/release_control']
    origins = {}
    event_commit = event_date = None
    for line in git(repo,'log','--format=@%H|%cI','--raw','--no-abbrev',MAIN,V6,'--',*roots).decode().splitlines():
        if line.startswith('@'): event_commit,event_date=line[1:].split('|',1)
        elif line.startswith(':') and '\t' in line:
            meta,path=line.split('\t',1); bits=meta.split()
            if len(bits)>=5 and bits[3] not in origins:
                origins[bits[3]]=(event_commit,event_date,path)
    objects = git(repo,'rev-list','--objects',MAIN,V6,'--',*roots).decode().splitlines()
    candidates=[]
    for row in objects:
        parts=row.split(' ',1)
        if len(parts)==2 and wanted(parts[1]): candidates.append(parts)
    # batch-check excludes trees and gives deterministic bounded source selection.
    batch=subprocess_check(repo, [b for b,p in candidates])
    for (blob,path),typ in zip(candidates,batch):
        if typ != 'blob': continue
        origin=origins.get(blob)
        if not origin: raise ValueError('unresolved source origin: '+blob)
        lock(blob,path,origin[0]); sources[blob]['date']=origin[1]
    # Preserve exact parsed observations; no promotion from confidence or filename.
    for blob,s in list(sources.items()):
        path=s['path']
        if not path.endswith(('.json','.json.gz','.jsonl','.jsonl.gz','.ndjson')): continue
        try: data=document(git(repo,'cat-file','blob',blob),path)
        except (ValueError,OSError,UnicodeError,zlib.error) as e:
            conflicts.append(dict(type='HISTORY_CONFLICT',source=blob,path=path,reason='UNPARSED_SOURCE',detail=str(e)));continue
        count=0; entries=[]
        for pointer,x in walk(data):
            if not any(k in x for k in ('decision','verdict','status','rejected_memberships','retained','keep','quarantined_families','supersedes')):continue
            if not any(k in x for k in ('family_id','canonical_family_id','head_id','lemma_id','lemma_ids','affected_lemma_ids','records','decisions','rejected_memberships','retained','keep','alias','scope')):continue
            entries.append(dict(id='observation:'+sha(canonical([blob,pointer])),source_blob=blob,
                                     pointer=pointer,payload_sha256=sha(canonical(x)),
                                     classification='UNINTERPRETED_SOURCE_OBSERVATION'))
            count+=1
        if count:
            observations.append(dict(source_blob=blob,count=count,entries_sha256=sha(canonical(entries))))
            conflicts.append(dict(type='HISTORY_CONFLICT',source=blob,path=path,
                                  reason='SOURCE_SCOPE_OR_AUTHORITY_REQUIRES_ADAPTER',observations=count))

    # Recover exact finite operation sets from actual Git deltas. Commit descriptions
    # and PR titles never determine the verdict or its affected lexical set.
    commits=git(repo,'log','--reverse','--format=%H',MAIN,'--',PROVENANCE).decode().splitlines()
    commits=commits[commits.index(ORIGINAL)+1:]
    removed=added=alias_removed=alias_added=0
    for commit in commits:
        parent=git(repo,'rev-parse',commit+'^').decode().strip()
        date=git(repo,'show','-s','--format=%cI',commit).decode().strip()
        provblob=lock(obj(commit,PROVENANCE),PROVENANCE,commit)
        before=json.loads(git(repo,'show',parent+':'+PROVENANCE))
        after=json.loads(git(repo,'show',commit+':'+PROVENANCE))
        changes=git(repo,'diff-tree','--no-commit-id','--raw','--no-abbrev','-r',parent,commit,'--',PREFIX+'members',PREFIX+'aliases').decode().splitlines()
        nremove=nadd=nra=naa=0
        for line in changes:
            meta,path=line.split('\t'); fields=meta.split(); old,new=fields[2:4]
            old=lock(old,path,parent);new=lock(new,path,commit)
            a=document(git(repo,'cat-file','blob',old),path) if old else {}
            b=document(git(repo,'cat-file','blob',new),path) if new else {}
            if '/members/' in path:
                language=path.split('/members/')[1].split('/')[0]
                for family in sorted(set(a)|set(b)):
                    aa={r['lemma_id'] for r in a.get(family,[])};bb={r['lemma_id'] for r in b.get(family,[])}
                    for direction,ids,verdict in [('removed',aa-bb,'CONFIRMED_NONMEMBER'),('added',bb-aa,'CONFIRMED_MEMBER')]:
                        if not ids:continue
                        if direction=='removed':nremove+=len(ids)
                        else:nadd+=len(ids)
                        scope=dict(domain='membership',family_id=family,language=language,pos=None,sense_id=None,
                            selector=dict(before=old,after=new,direction=direction,count=len(ids),
                                          ids_sha256=sha(canonical(sorted(ids)))))
                        decision(scope,verdict,direction,source(provblob,commit,PROVENANCE),date,
                                 'Exact materialized Git delta. Engineering safeguard; consult locked ledgers for linguistic authority.',
                                 previous='materialized_member' if direction=='removed' else 'not_materialized')
            else:
                for alias in sorted(set(a)|set(b)):
                    aa=set(a.get(alias,[]));bb=set(b.get(alias,[]))
                    for direction,ids,verdict in [('removed',aa-bb,'CONFIRMED_NONMEMBER'),('added',bb-aa,'CONFIRMED_MEMBER')]:
                        for family in sorted(ids):
                            if direction=='removed':nra+=1
                            else:naa+=1
                            decision(dict(domain='alias',alias=alias,family_id=family,language=None,pos=None,sense_id=None),
                                verdict,'alias_'+direction,source(provblob,commit,PROVENANCE),date,
                                'Exact reverse-alias routing delta; no membership or etymological verdict implied.')
        revisions.append(dict(commit=commit,parent=parent,date=date,source_blob=provblob,
            previous_repairs=len(before.get('repository_repairs',[])),repairs=len(after.get('repository_repairs',[])),
            memberships_removed=nremove,memberships_added=nadd,alias_pairs_removed=nra,alias_pairs_added=naa))
        removed+=nremove;added+=nadd;alias_removed+=nra;alias_added+=naa
    # Pin existing v6 correction dossier scopes, including uncertainty. They remain
    # research restrictions; their accepted authority is not reclassified as gold.
    for path in ['audit/associative-family-v6/regul-20261008/decisions/regul-baseline-excluded.json',
                 'audit/associative-family-v6/regul-20261008/decisions/regul-baseline-uncertain.json']:
        blob=lock(obj(V6,path),path,V6);x=json.loads(git(repo,'cat-file','blob',blob))
        date=git(repo,'show','-s','--format=%cI',V6).decode().strip()
        for i,row in enumerate(x['records']):
            decision(dict(domain='membership',family_id=row['family_id'],language=row['language'],
                lemma_ids=[row['lemma_id']],pos=row.get('pos'),sense_id=row.get('sense_id')),
                'CONFIRMED_NONMEMBER' if x['status']=='excluded' else 'UNRESOLVED',
                'research_baseline_'+x['status'],source(blob,V6,path,'/records/'+str(i)),date,
                row.get('reason',x.get('reason','Historical research baseline restriction')),'RESEARCH_HYPOTHESIS',row.get('previous_status','unknown'))
    decisions=import_decisions(decisions)
    snapshot=dict(schema=SCHEMA,roots=dict(main=MAIN,v6=V6,first_materialization=ORIGINAL),
        coverage_complete=False,sources=sorted(sources.values(),key=lambda x:x['blob']),
        decisions=decisions,observations=sorted(observations,key=lambda x:x['source_blob']),conflicts=conflicts,
        revisions=revisions)
    payload=canonical(snapshot)+b'\n';digest=sha(payload)
    out=Path(out);atomic(out/'snapshots'/('sha256-'+digest+'.json'),payload)
    atomic(out/'CURRENT.json',canonical(dict(schema=SCHEMA,snapshot='snapshots/sha256-'+digest+'.json',sha256=digest))+b'\n')
    report=dict(schema=SCHEMA,status='BLOCKED',reason='All observations preserved; adapters/authority adjudication incomplete. No operation permitted.',
        roots=snapshot['roots'],source_blobs=len(sources),source_bytes=sum(s['bytes'] for s in sources.values()),
        exact_delta_decisions=len(decisions),uninterpreted_observations=sum(x['count'] for x in observations),observation_documents=len(observations),
        history_conflicts=len(conflicts),operation_commits=len(revisions),memberships_removed=removed,
        memberships_added=added,alias_pairs_removed=alias_removed,alias_pairs_added=alias_added,
        original_journals_modified=False,production_modified=False,snapshot_sha256=digest,
        authority_counts=dict(Counter(d['authority'] for d in decisions)))
    atomic(out/'COVERAGE.json',canonical(report)+b'\n');atomic(out/'HISTORY_CONFLICT.json',canonical(conflicts)+b'\n')
    print(json.dumps(report,ensure_ascii=False))


def subprocess_check(repo,ids):
    import subprocess
    p=subprocess.run(['git','-C',str(repo),'cat-file','--batch-check=%(objecttype)'],input='\n'.join(ids)+'\n',text=True,capture_output=True,check=True)
    return p.stdout.splitlines()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',default='.');p.add_argument('--output',required=True)
    a=p.parse_args();build(a.repo,a.output)

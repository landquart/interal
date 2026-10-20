#!/usr/bin/env python3
"""Stream every staging identifier, independently of source adapter parsing."""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import gzip
import json
from pathlib import Path
import resource
import time
from morphology_import import digest, VERSION, SCHEMA, LANGUAGES
from certify_corpus import atomic_json, verified


def partition(snapshot,artifacts):
    started=time.monotonic(); m=verified(snapshot,'manifest.json'); previous=None; records=lexemes=0
    with gzip.open(Path(snapshot)/'records.ndjson.gz','rt',encoding='utf-8') as stream:
        for line in stream:
            row=json.loads(line); body=row['body']; a=artifacts[body['artifact']]; locator=body['raw_locator']
            position=(a['id'],locator['line'])
            if previous is not None and position<=previous: raise ValueError('duplicate or unordered source locator')
            previous=position
            if row['schema_version']!=SCHEMA or body['establishes_membership'] or body['review_status']!='unreviewed': raise ValueError('unsafe record status')
            if [body[k] for k in ['source','resource','revision','language']] != [a['source'],a['resource'],a['revision'],LANGUAGES[a['language']]]:
                raise ValueError('record namespace differs from lock')
            if locator['artifact_sha256']!=a['sha256']: raise ValueError('record source checksum differs')
            expected='evidence:'+digest([a['id'],a['revision'],a['sha256'],a.get('member_sha256'),locator['line'],locator['raw_sha256'],VERSION])
            if row['id']!=expected: raise ValueError('invalid evidence identifier')
            for lex in body['normalized']['lexemes']:
                expected='lexeme:'+digest([a['source'],a['resource'],a['revision'],lex['language'],lex['native_key']])
                if lex['id']!=expected or lex['language']!=body['language']: raise ValueError('invalid lexical identifier/namespace')
                lexemes+=1
            records+=1
    if records!=sum(r['accepted'] for r in m['reports']): raise ValueError('record count mismatch')
    return dict(status='PASS',records=records,lexical_observations=lexemes,
        elapsed_seconds=round(time.monotonic()-started,3),max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)


def audit(release,registry_path,receipt):
    release=Path(release); state=json.loads((release/'CHECKPOINT.json').read_text())
    registry=json.loads(Path(registry_path).read_text()); artifacts={a['id']:a for a in registry['artifacts']}
    results={}; started=time.monotonic()
    with ProcessPoolExecutor(max_workers=2,max_tasks_per_child=1) as pool:
        jobs={pool.submit(partition,release/'snapshots'/name/p['build_id'],artifacts):name for name,p in state['partitions'].items()}
        for future in as_completed(jobs):
            name=jobs[future]; results[name]=future.result(); atomic_json(receipt,dict(status='running',partitions=results))
    if len(results)!=13 or sum(r['records'] for r in results.values())!=9404044: raise ValueError('incomplete full identity audit')
    result=dict(status='PASS',partitions=results,records=sum(r['records'] for r in results.values()),
        lexical_observations=sum(r['lexical_observations'] for r in results.values()),elapsed_seconds=round(time.monotonic()-started,3),
        uniqueness_basis='disjoint artifact namespaces + strictly unique physical locators + recomputed SHA-256 identifiers; lexical duplicates retain the same native identity')
    atomic_json(receipt,result); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['release','registry','receipt']: p.add_argument('--'+n,required=True,type=Path)
    a=p.parse_args(); print(json.dumps(audit(a.release,a.registry,a.receipt),sort_keys=True))

"""Read-only full audit of materialized report counters; historical units stay distinct."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,collections,pathlib
from associativvordes.structural_cleanup.common import *
from associativvordes.structural_cleanup.shadow import decode

def audit(snapshot, census, output):
    root=pathlib.Path(snapshot)/'current'/PREFIX; counts=collections.Counter()
    statuses={'needs_review','blocked_from_runtime','rejected','split_required'}
    for bi in range(256):
        for family in decode(root/'families'/f'{bi:02x}.json.gz').values():
            counts['total_families']+=1
            counts['merged_families']+=family['source']!='surface_singleton'
            counts['singleton_families']+=family['support']==1
            counts['multi_branch_families']+=len(family['aliases'])>1
            counts['generated_non_proto_families']+=family['source']=='wiktionary_non_proto_etymology'
            counts['verified_seed_families']+=bool(family.get('verified'))
            counts['review_required_families']+=family['review_status'] in statuses
            counts['unreviewed_high_risk_families']+=family['suspicion_score']>=35 and family['review_status'] not in statuses
    report=decode(root/'report.json');manifest=decode(root/'manifest.json');c=load(census)
    checks={key:dict(actual=value,declared=report['invariants'][key] if key=='unreviewed_high_risk_families' else report[key]) for key,value in counts.items()}
    for key,value in [('multi_family_lemmas',c['counts']['multi_family_lemmas']),('aliases_in_lookup',c['counts']['aliases'])]:
        checks[key]=dict(actual=value,declared=report[key])
    for key,value in [('families',counts['total_families']),('aliases',c['counts']['aliases']),('lemmas',c['counts']['source_lemma_records_recovered'])]:
        checks['manifest:'+key]=dict(actual=value,declared=manifest['counts'][key])
    for key,value in [('classified_unique_lemmas',c['counts']['materialized_lemmas']),('lemmas_with_zero_family',c['counts']['unassigned_lemmas']),('source_lemmas',c['counts']['source_lemma_records_recovered'])]:
        checks['invariants:'+key]=dict(actual=value,declared=report['invariants'][key])
    differences={k:v for k,v in checks.items() if v['actual']!=v['declared']}
    result=dict(schema='v5-structural-metadata-audit/1',status='PASS' if not differences else 'REVIEW_REQUIRED',buckets=256,checks=checks,differences=differences,
        historical_associativity_or_review_labels_not_endorsed=True,components_not_reinterpreted_as_memberships=True,production_writes=0)
    save(output,result);return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--snapshot',required=True);p.add_argument('--census',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    print(canonical(audit(a.snapshot,a.census,a.output)).decode())

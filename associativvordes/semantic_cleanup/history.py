"""Resolve all imported finite historical scopes applicable to the priority families."""
import argparse
from collections import Counter
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2];pass
from associativvordes.history_registry.registry import History
from associativvordes.national_correspondences.registry import read,canonical,filehash,digest
from associativvordes.national_correspondences.audit import atomic

def load(repo=ROOT):
    root=Path(repo)/'audit/associative-history-registry';p=read(root/'CURRENT.json')
    return History(repo,root/p['snapshot'],p['sha256'])

def audit(output):
    h=load();wanted=set(read(ROOT/'audit/associative-v5-semantic-cleanup/SCOPE-POLICY.json')['family_ids']);rows=[]
    for d in h.decisions:
        if d['scope'].get('family_id') not in wanted:continue
        if d['scope']['domain']=='membership':
            ids=h.ids(d);row=dict(decision_id=d['id'],family_id=d['scope']['family_id'],language=d['scope']['language'],finite_ids=len(ids),ids_sha256=digest(sorted(ids)),authority=d['authority'],decision=d['decision'],sense_scope=d['scope'].get('sense_id'),source=d['source'])
        else:row=dict(decision_id=d['id'],family_id=d['scope']['family_id'],domain=d['scope']['domain'],authority=d['authority'],source=d['source'])
        rows.append(row)
    report=dict(schema='interal-semantic-history-scope/1',snapshot_sha256=h.digest,coverage_complete=h.snapshot['coverage_complete'],applicable_decisions=len(rows),decisions=rows,new_human_decisions=0,policy='Historical null sense is an unresolved legacy scope hold, not rejection of every sense; no last-write-wins or authority promotion')
    atomic(Path(output),canonical(report)+b'\n');return report
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();print(audit(a.output)['applicable_decisions'])

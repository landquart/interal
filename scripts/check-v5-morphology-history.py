#!/usr/bin/env python3
"""Verify every imported exact historical negative without promoting its authority."""
import argparse,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'associativvordes/history_registry'))
from registry import History,canonical,check
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
root=ROOT/'audit/associative-history-registry';pointer=json.loads((root/'CURRENT.json').read_text());h=History(ROOT,root/pointer['snapshot'],pointer['sha256']);rows=[]
for d in h.decisions:
 if d['decision']!='CONFIRMED_NONMEMBER':continue
 s=d['scope'];proposal=dict(operation='restore',family_id=s['family_id'],language=s['language'],lemma_ids=sorted(h.ids(d)))
 result=h.check(proposal)
 if result['allowed'] or d['id'] not in result.get('decision_ids',[]):raise ValueError('negative scope lost')
 neighbor=h.check(dict(proposal,family_id='unrelated:explicit-scope-control'))
 if neighbor.get('decision_ids'):raise ValueError('scope broadened')
 rows.append(dict(decision_id=d['id'],scope=s,authority=d['authority'],result=result['status'],allowed=result['allowed'],neighbor_scope_decision_ids=neighbor.get('decision_ids',[])))
missing=check(ROOT,root/'missing-snapshot.json',pointer['sha256'],dict(operation='restore',family_id='x',language='en',lemma_ids=['x']))
if missing['allowed']:raise ValueError('missing history did not fail closed')
# Reasons may include host-local paths; publish only stable status and permission.
receipt=dict(status='PASS',snapshot_sha256=pointer['sha256'],exact_historical_nonmember_checks=rows,missing_history=dict(status=missing['status'],allowed=missing['allowed']),coverage_complete=h.snapshot['coverage_complete'],automatic_history_promotion=False)
pathlib.Path(a.output).write_bytes(canonical(receipt)+b'\n')

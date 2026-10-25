"""Regenerate repair-ledger bindings from the captured current provenance."""
import argparse,hashlib,json,pathlib
from census import verify_snapshot,load,atomic_json,PREFIX,sha_file

def audit(snapshot,output):
 root=pathlib.Path(snapshot);verify_snapshot(root)
 provenance=load(root/'current'/PREFIX/'repository-provenance.json')
 ledgers={}
 for p in sorted((root/'current/audit/associative-family-v5').glob('*.json')):
  ledgers.setdefault(sha_file(p),[]).append(p.relative_to(root/'current').as_posix())
 rows=[]
 for repair in provenance['repository_repairs']:
  declared=repair.get('decision_ledger_sha256');matches=ledgers.get(declared,[]) if declared else []
  rows.append(dict(repair=repair['repair'],declared_decision_sha256=declared,
   matching_frozen_ledger=matches[0] if len(matches)==1 else None,
   ledger_hash_match=len(matches)==1 if declared else None))
 atomic_json(output,rows);return rows
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--snapshot',required=True);p.add_argument('--output',required=True);a=p.parse_args();audit(a.snapshot,a.output)

#!/usr/bin/env python3
"""Export published dry-run snapshot to fresh human queues, never an existing decision ledger."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import copy
import json
from pathlib import Path
import shutil
import sys
ROOT=Path(__file__).resolve().parents[2]
None
from associativvordes.auto_annotation.contract import canonical,sha,file_hash
from associativvordes.auto_annotation.storage import atomic

def export_snapshot(path,output,ledger_path=None,expected_sha256=None):
    path=Path(path);output=Path(output).resolve()
    if expected_sha256 and file_hash(path)!=expected_sha256:raise ValueError('snapshot checksum')
    snap=json.loads(path.read_text())
    if snap.get('schema')!='mass-proposed-annotation-snapshot/1' or snap.get('production_writes')!=0:
        raise ValueError('research snapshot required')
    if output.is_relative_to(ROOT) or output.exists():raise ValueError('fresh external output required')
    if ledger_path:
        ledger_path=Path(ledger_path).resolve()
        if ledger_path.is_relative_to(ROOT) or ledger_path.exists():raise ValueError('fresh external research ledger required')
    qs={q['id']:copy.deepcopy(q) for q in snap['questions']}
    if len(qs)!=len(snap['questions']):raise ValueError('duplicate question')
    seen=set()
    for p in snap['proposals']:
        if p['candidate_id'] in seen or p['question_id'] not in qs:raise ValueError('proposal scope/duplicate')
        seen.add(p['candidate_id']);q=qs[p['question_id']]
        if p['family_id']!=q['family'] or p['language']!=q['language']:raise ValueError('family/language scope')
        if not p['needs_human_review'] or p['production_writes']:raise ValueError('only manual research proposals allowed')
        q.setdefault('automated_proposals',[]).append(p)
    output.mkdir(parents=True,mode=0o700)
    payload=''.join(canonical(qs[k])+'\n' for k in sorted(qs)).encode()
    atomic(output/'questions.ndjson',payload)
    manifest=dict(schema='mass06-review-export/1',snapshot_sha256=file_hash(path),
      counts={'questions':len(qs),'proposals':len(seen)},outputs={'questions.ndjson':sha(payload)},
      production_writes=0,human_decision_events=0)
    atomic(output/'MANIFEST.json',canonical(manifest).encode())
    source_rows=snap.get('raw_source_rows',{})
    atomic(output/'SOURCE-ROWS.json',canonical(source_rows).encode())
    if ledger_path:
        None
        from associativvordes.review.store import Ledger
        ledger=Ledger(ledger_path);ledger.import_queue(output)
        folder=ledger.root/'source-rows';folder.mkdir(exist_ok=True)
        raw=canonical(source_rows).encode();atomic(folder/(sha(raw)+'.json'),raw)
        if ledger.events:raise ValueError('export must not create human decisions')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--snapshot',required=True);p.add_argument('--output',required=True)
    p.add_argument('--ledger');p.add_argument('--expected-sha256');a=p.parse_args()
    print(canonical(export_snapshot(a.snapshot,a.output,a.ledger,a.expected_sha256)))

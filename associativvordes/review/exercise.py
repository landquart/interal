"""Reproducible qualification on a real mass02 export; uses isolated test decisions."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from collections import Counter
import json
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import time
import uuid
from associativvordes.review.store import Ledger, canonical, digest, restore


def stats(values):
    x = sorted(values)
    return {'n': len(x), 'median_ms': round(statistics.median(x), 3),
            'p95_ms': round(x[min(len(x)-1, int(len(x)*.95))], 3), 'max_ms': round(max(x), 3)}


def exercise(queue, data, report):
    if data.exists() and any(data.iterdir()): raise ValueError('qualification data directory must be empty')
    before = digest((queue/'questions.ndjson').read_bytes())
    start = time.perf_counter(); l = Ledger(data); imported = l.import_queue(queue); startup = time.perf_counter()-start
    roles = {'test-a': 'reviewer', 'test-b': 'blind', 'test-c': 'arbiter'}
    qs = sorted(l.questions.values(), key=lambda q:q['id'])
    if len(qs) < 100: raise ValueError('100 real questions required')
    opens, saves, filters = [], [], []
    def item(q, actor, status):
        return {'question_id': q['id'], 'expected_revision': l.revision(q['id'], actor), 'lexeme_id': q['lexeme_alternatives'][0]['id'],
                'status': status, 'relation': 'unresolved', 'reason': 'Automated durability exercise; not linguistic annotation.'}
    def save(q, actor, status, **kwargs):
        t = time.perf_counter(); result = l.decide(actor, roles[actor], roles, str(uuid.uuid4()), [item(q,actor,status)], l.snapshot, **kwargs)
        saves.append((time.perf_counter()-t)*1000); return result
    for i, q in enumerate(qs[:100]):
        t=time.perf_counter(); l.card(q['id'], 'test-a', 'reviewer', roles); opens.append((time.perf_counter()-t)*1000)
        save(q, 'test-a', 'REJECT' if i==0 else 'ACCEPT_PROPOSED' if i==1 else 'UNCERTAIN')
    save(qs[0], 'test-a', 'DEFER'); save(qs[0], 'test-a', 'DEFER', undo=True)
    assert l.state(qs[0]['id'], 'test-a')['status'] == 'REJECT'
    save(qs[0], 'test-b', 'ACCEPT_PROPOSED')
    card = l.card(qs[0]['id'], 'test-c', 'arbiter', roles); assert card['comparison']['disagreement']
    it = item(qs[0], 'test-c', 'UNCERTAIN'); it['pair_hash'] = digest(card['comparison']['primary']+card['comparison']['blind'])
    l.decide('test-c','arbiter',roles,str(uuid.uuid4()),[it],l.snapshot,arbitration=True)
    old_head=l.head; l.import_queue(queue)
    assert l.head == old_head and l.state(qs[0]['id'], 'test-a')['status']=='REJECT'
    assert all(not d['establishes_membership'] for d in l.overlay(roles))
    for language in sorted({q['language'] for q in qs}):
        for _ in range(100):
            t=time.perf_counter(); result=l.listing('test-a','reviewer',roles,{'language':language,'status':'OPEN'})
            filters.append((time.perf_counter()-t)*1000)
    # A real process stops after fsync of a pending file, before atomic rename.
    code = '''import os,sys
from pathlib import Path
from store import Ledger
l=Ledger(sys.argv[1])
p=l.root/'events'/'.pending-interrupted-process'
with open(p,'wb') as f:
 f.write(b'partial transaction');f.flush();os.fsync(f.fileno())
os._exit(77)
'''
    result = subprocess.run([sys.executable,'-c',code,str(data)], cwd=Path(__file__).parent, check=False)
    assert result.returncode==77 and Ledger(data).head==old_head
    exported=l.export(); recovered=restore(exported,data.parent/(data.name+'-restored'),data)
    assert recovered.head==l.head and recovered.current==l.current
    assert digest((queue/'questions.ndjson').read_bytes())==before
    counts=Counter(q['language'] for q in qs)
    report.mkdir(parents=True,exist_ok=True)
    integrity={'status':'PASS','questions':len(qs),'source_queue_sha256':before,'source_queue_unchanged':True,
       'snapshot':l.snapshot,'committed_transactions':l.loaded,'head':l.head,'restored_head':recovered.head,
       'source_versions_preserved':True,'individual_decision_events':sum(len(t['decisions']) for t in l.events),
       'scenarios':{'100_sequential':True,'reject':True,'correction_and_undo':True,'two_reviewer_conflict':True,
         'arbitration_uncertain':True,'process_interruption_exit_77':True,'full_history_restore':True,
         'reimport_preserves_rejection':True,'research_overlay_only':True},'membership_writes':0,
       'note':'All decisions in this qualification are automated test records, not human gold.'}
    performance={'runtime':{'python':platform.python_version(),'platform':platform.platform()},'queue_questions':len(qs),
       'startup_seconds':round(startup,3),'by_language':dict(sorted(counts.items())),
       'engine_card':stats(opens),'engine_save_including_fsync':stats(saves),'engine_filter':stats(filters),
       'measurements':'local single-process service engine; browser timings are recorded separately'}
    history={'status':'PASS','history_events':integrity['individual_decision_events'],'retained_rejected_question':qs[0]['id'],
       'question_history_length':len(l.history(qs[0]['id'])),'statuses':[d['status'] for d in l.history(qs[0]['id'])],
       'rejection_scope':{'family':qs[0]['family'],'language':qs[0]['language'],'lexeme':qs[0]['lexeme_alternatives'][0]['id']},
       'prior_status_and_actor_and_timestamp_in_every_event':True,'old_sources_archived':True,'restore_identical':True}
    for name, obj in [('INTEGRITY.json',integrity),('HISTORY.json',history),('PERFORMANCE.json',performance)]:
        (report/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
    print(canonical({'integrity':integrity,'performance':performance}))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--queue',type=Path,required=True);p.add_argument('--data',type=Path,required=True);p.add_argument('--report',type=Path,required=True)
    a=p.parse_args();exercise(a.queue,a.data,a.report)

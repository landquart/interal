"""Real six-language research windows through existing review/graph/dry-run APIs."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,json,os,subprocess,sys,time
from pathlib import Path
from associativvordes.v5_adapter.common import *
from associativvordes.v5_adapter.adapter import Adapter
from associativvordes.v5_adapter.external import External
from associativvordes.v5_adapter.bridge import export,history_reader,review_import

def exercise(projection,external,output):
 output=Path(output).resolve()
 if output.exists() or output.is_relative_to(ROOT):raise ValueError('fresh external exercise required')
 output.mkdir(parents=True);start=time.monotonic();history,_=history_reader();a=Adapter(projection,history=history.check)
 ext=External(external,ROOT/'data/morphology-evidence/sources/source-lock.json');selected=[];notes=[]
 preferred=dict(en='manicure',de='maniküre',fr='manucure',es='manicura',it='manicure',ru='маникюр')
 try:
  for fid in ['family:manu','family:regul','family:ocul','family:inter']:
   for lang in LANGS:
    rows=a.rows(fid,lang);first=next(rows,None)
    if first is None:continue
    chosen=first
    for row in a.rows(fid,lang):
     target=preferred[lang] if fid=='family:manu' else dict(en='regolith',es='régulo',ru='регламент').get(lang,'') if fid=='family:regul' else ''
     if target and lookup(row[-1]['word'])==lookup(target):chosen=row;break
    selected.append(list(chosen[:3]))
  # Preserve the separate creat alias targets instead of inventing a v6 root.
  creat=a.aliases('creat');notes.append(dict(alias='creat',targets=creat,automatically_equated=False))
  for fid in creat:
   row=next(a.rows(fid),None)
   if row:selected.append(list(row[:3]))
  # A monolingual singleton and a long-base family are ordinary research cases.
  db=a.db('00')
  singleton=db.execute('SELECT family,language,MIN(lemma) FROM members GROUP BY family,language HAVING COUNT(*)=1 LIMIT 1').fetchone()
  if singleton:selected.append(list(singleton))
  import zlib
  for fid,packed in db.execute('SELECT id,body FROM families'):
   if len(json.loads(zlib.decompress(packed)).get('canonical',''))>20:
    row=next(a.rows(fid),None)
    if row:selected.append(list(row[:3]));break
  selected=list(dict.fromkeys(tuple(x) for x in selected));selected=[list(x) for x in selected]
  queue=output/'queue';manifest=export(a,queue,limit=10000,external=ext,selections=selected)
  questions=[json.loads(l) for l in (queue/'questions.ndjson').read_bytes().splitlines()]
  if len(questions)!=len(selected):raise ValueError('explicit selection scope not fully exported')
  review=review_import(queue,output/'review');graph=ext.graph(questions,output/'graph.sqlite')
  # Existing standalone mass-dry-run worker; no providers, generation or paid calls.
  command=[sys.executable,str(ROOT/'associativvordes/mass_dry_run/worker.py'),'--input',str(queue),
   '--registry',str(projection),'--v5-external',str(external),'--store',str(output/'annotation'),
   '--config',str(ROOT/'associativvordes/auto_annotation/config.offline.json')]
  killed=subprocess.run(command+['--kill-after','1'],capture_output=True,text=True)
  if killed.returncode!=-9:raise ValueError('expected hard interruption: '+killed.stderr)
  resumed=subprocess.run(command+['--resume'],capture_output=True,text=True,check=True)
  result=json.loads(resumed.stdout.strip().splitlines()[-1]);atomic(output/'ANNOTATION.json',canonical(result)+b'\n')
  # Verify recovery/reimport is idempotent with the same actual dependency locks.
  repeat=subprocess.run(command+['--resume'],capture_output=True,text=True,check=True)
  repeated=json.loads(repeat.stdout.strip().splitlines()[-1])
  if repeated['counts'].get('processed',0):raise ValueError('unchanged questions were regenerated')
  if result['accounting'].get('requests',0) or result['production_writes']:raise ValueError('unexpected paid/generative/production action')
  pass;from associativvordes.auto_annotation.storage import Store
  store=Store(output/'annotation')
  with store.lease():proposals=[store.get(refs[-1]) for refs in store.proposal_index.values()]
  if len(proposals)!=len(questions) or any(p['proposed_decision']!='ABSTAIN' or p['production_writes'] for p in proposals):raise ValueError('legacy observations became semantic decisions')
  # Reuse the existing mass-dry-run handoff on this explicitly finite window.
  snapshot=dict(schema='mass-proposed-annotation-snapshot/1',questions=questions,proposals=proposals,
   raw_source_rows=read(queue/'source-rows.json'),scope_kind='finite_v5_window',full_v5_annotation_complete=False,production_writes=0)
  atomic(output/'PROPOSALS.json',canonical(snapshot)+b'\n')
  pass
  from associativvordes.mass_dry_run.export_snapshot import export_snapshot
  handoff=export_snapshot(output/'PROPOSALS.json',output/'mass-review',output/'mass-review-ledger')
  # Guard a known deleted membership without restoring it into the projection.
  ledger=read(ROOT/'audit/associative-family-v5/actus-false-memberships.json');negative=ledger['rejected_memberships'][0]
  fid=negative.get('family_id',ledger['family_id']);request=dict(operation='restore',family_id=fid,language=negative['language'],lemma_ids=[negative['lemma_id']])
  veto=history.check(request)
  if veto['allowed'] or not veto.get('decision_ids'):raise ValueError('historical scoped negative lost')
  other=history.check(dict(request,family_id='family:manu'))
  if set(veto['decision_ids'])&set(other.get('decision_ids',[])):raise ValueError('negative scope leaked into another family')
  report=dict(schema='v5-modern-bridge-exercise/1',status='PASS',questions=len(questions),languages=sorted({q['language'] for q in questions}),
   selected=[dict(id=q['id'],source_family=q['source_family_id'],language=q['language'],lemma=q['lemma'],categories=q['categories'],source_records=len(q.get('external_rows',[]))) for q in questions],
   queue_manifest_sha256=filehash(queue/'MANIFEST.json'),review=review,graph=graph,
   annotation=result,repeated_annotation=repeated,mass_dry_run_handoff=handoff,hard_interruption_exit=killed.returncode,
   preserved_negative=dict(family_id=fid,lemma_id=negative['lemma_id'],decision_ids=veto['decision_ids']),
   negative_did_not_spread_to_another_family=True,notes=notes,accepted_memberships=0,lexical_heads_created=0,
   human_decision_events=0,production_writes=0,seconds=time.monotonic()-start)
  atomic(output/'EXERCISE.json',canonical(report)+b'\n');return report
 finally:a.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--adapter',required=True);p.add_argument('--external',required=True);p.add_argument('--output',required=True);a=p.parse_args();r=exercise(a.adapter,a.external,a.output);print(json.dumps({k:r[k] for k in ['status','questions','languages','seconds']}))

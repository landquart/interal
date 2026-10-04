#!/usr/bin/env python3
"""Independent exact differential against the frozen Prompt 04 snapshot."""
import gzip,json,hashlib,subprocess,sys
from pathlib import Path
BASE='2351a07722d88faa82dc05049144c567d43923c8'
R=Path('audit/associative-family-v6/oper-relat-continuation-20261004');G=Path('associativvordes/family-index-v6/generated')
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *args:subprocess.check_output(['git',*args])
def read(p,old=False):
 b=git('show',BASE+':'+str(p)) if old else Path(p).read_bytes()
 return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
def key(r):return (r['language'],r['family_id'],r['lemma_id'])
def index(rs,k):
 d={k(r):r for r in rs};assert len(d)==len(rs),'Duplicate identity';return d
stage,research=read(R/'decision.json'),read(R/'research.json')
assert sha((R/'research.json').read_bytes())==stage['source_queue_sha256']
assert stage['binding_authorized'] is stage['accepted_membership_authorized'] is True
assert research['binding_authorized'] is research['accepted_membership_authorized'] is False
oldreview=read('associativvordes/family-index-v6/lexical-head-review.json.gz',True)
assert oldreview['version']==stage['predecessor_review_version']
assert sha(git('show',BASE+':associativvordes/family-index-v6/lexical-head-review.json.gz'))==stage['predecessor_review_sha256']
expected={(r['language'],'family:'+g['root'],r['lemma_id']) for g in stage['groups'] for r in g['records']}
assert len(expected)==6 and len(stage['groups'])==3 and len(research['records'])==32 and len(stage['withheld_lemma_ids'])==26
for r in research['records']:
 p=r['source_locator'];assert sha(Path(p['path']).read_bytes())==r['input_sha256']
 actual=next(x for x in read(p['path'])[p['family_id']] if x['lemma_id']==r['lemma_id'])
 assert actual==r['source_record'] and actual['word']==r['word']
 assert sha(json.dumps(actual,ensure_ascii=False,separators=(',',':')).encode())==p['record_sha256']
for p,h in {**research['historical_dossiers'],**research['historical_source_frames']}.items():assert sha(Path(p).read_bytes())==h
before=index(read(G/'memberships.json.gz',True),key);after=index(read(G/'memberships.json.gz'),key)
assert len(before)==21555 and len(after)==21561 and set(after)-set(before)==expected
assert all(after.get(k)==r for k,r in before.items())
lk=lambda r:(*key(r),r['head_id'])
oldlinks=index(read(G/'lemma-head-links.json.gz',True),lk);links=index(read(G/'lemma-head-links.json.gz'),lk)
assert len(links)==len(oldlinks)+6 and all(links.get(k)==r for k,r in oldlinks.items())
assert {key(links[k]) for k in links.keys()-oldlinks.keys()}==expected
for n,k in [('heads.json.gz',lambda r:r['id']),('edges.json.gz',lambda r:(r['head_id'],r['family_id']))]:
 a=index(read(G/n,True),k);b=index(read(G/n),k);assert len(b)==len(a)+3 and all(b.get(k)==r for k,r in a.items())
review=read('associativvordes/family-index-v6/lexical-head-review.json.gz')
for field,delta in [('lexical_facts',3),('evidence_cache',3),('finite_bindings',6),('head_reviews',3)]:assert review[field][:len(oldreview[field])]==oldreview[field] and len(review[field])==len(oldreview[field])+delta
assert review['version']==oldreview['version']+1
active=lambda old:{(r['language'],'family:'+r['canonical_root'],r['lemma_id']):r for u in read(G/'review-backlog.json.gz',old) for r in u['source_records']}
a,b=active(True),active(False);assert set(a)-set(b)==expected and not set(b)-set(a);assert all(a[k]==r for k,r in b.items())
assert all((r['language'],'family:'+r['root'],r['lemma_id']) in b for r in research['records'] if not r['attestation'])
protected={}
for p in ['associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5','audit/associative-family-v6/queue-organization-20261004']:
 assert not git('diff','--name-only',BASE,'--',p).strip(),p
 protected[p]=git('rev-parse',BASE+':'+p).decode().strip()
metrics=read(G/'head-review-metrics.json');assert (metrics['current_active_records'],metrics['records_reviewed'],metrics['new_records_resolved'],metrics['new_head_decisions'])==(23234,1971,1968,39)
assert len(read(G/'review-backlog.json.gz'))==23232
result={'schema_version':6,'verdict':'pass','baseline_sha':BASE,'exact_differential':{'additions':[after[k] for k in sorted(expected)],'removals':[],'changed_memberships':[]},'old_links_identical':len(oldlinks),'old_heads_and_edges_identical':True,'new_heads':3,'new_edges':3,'withheld_unchanged':26,'protected_trees':protected,'current_metrics':metrics,'production_enabled':False,'full_dictionary_complete':False}
def replay(source,target):
 names=lambda p:{str(x.relative_to(p)) for x in p.rglob('*') if x.is_file()}
 assert names(source)==names(target)
 for n in names(source):assert (source/n).read_bytes()==(target/n).read_bytes(),n
 return len(names(source))
if len(sys.argv)>1:result['migration_replay_artifacts']=replay(G,Path(sys.argv[1]))
P=Path(read('associativvordes/family-index-v6/queue-planning.json')['output']);H=Path('audit/associative-family-v6/queue-organization-20261004/generated')
if P.exists():
 oldc,newc=read(H/'conservation.json.gz'),read(P/'conservation.json.gz')
 for scope in ['corpus_ids','membership_candidates','packet_route_occurrences']:assert oldc['before'][scope]==newc['before'][scope]
 def rows(p):return [r for s in read(p/'cross-frame-reference-index.json.gz')['shards'].values() for r in read(p/s['path'])]
 oldrows,newrows=rows(H),rows(P);assert {r['corpus_id'] for r in oldrows}=={r['corpus_id'] for r in newrows}
 oldocc={o['occurrence_id']:o for r in oldrows for o in r['occurrences']};newocc={o['occurrence_id']:o for r in newrows for o in r['occurrences']}
 assert all(oldocc[k]==newocc[k] for k in oldocc.keys()&newocc.keys()),'Reused task ID for a changed occurrence'
 task=lambda o:(o['frame'],o['language'],o['root'],o['lemma_id'],tuple(o['head_ids']))
 oldtasks={task(o) for o in oldocc.values()};newtasks={task(o) for o in newocc.values()}
 assert {(lang,'family:'+root,id) for frame,lang,root,id,heads in oldtasks-newtasks}==expected
 assert all(t[0]=='current' for t in oldtasks-newtasks)
 assert {(lang,'family:'+root,id) for frame,lang,root,id,heads in newtasks-oldtasks}==expected
 assert all(t[0] in ['materialized','completed_review'] for t in newtasks-oldtasks)
 q=lambda p:index(read(p/'membership-questions.json.gz'),lambda r:r['candidate_id'])
 assert q(H).keys()==q(P).keys()
 report=read(P/'report.json');assert report['new_memberships']==report['new_verdicts']==0
 occurrence={'schema_version':6,'removed':sorted(oldocc.keys()-newocc.keys()),'added':sorted(newocc.keys()-oldocc.keys()),'reused_for_different_task':[],'semantic_tasks_removed':sorted(oldtasks-newtasks),'semantic_tasks_added':sorted(newtasks-oldtasks),'historical_snapshot':str(H),'historical_locators_remain_addressable':True}
 (R/'validation').mkdir(exist_ok=True);(R/'validation/planning-occurrence-differential.json.gz').write_bytes(gzip.compress((json.dumps(occurrence,ensure_ascii=False)+'\n').encode(),mtime=0))
 result['planning']={'corpus_ids_conserved':len(newrows),'membership_questions_conserved':len(q(P)),'old_metrics':read(H/'report.json')['metrics'],'new_metrics':report['metrics'],'exact_current_question_removals':sorted(expected),'semantic_task_additions':12,'semantic_task_removals':6,'historical_outputs_unchanged':True,'new_proven_grouping_reduction':report['new_proven_unit_reduction'],'exact_occurrence_differential':'planning-occurrence-differential.json.gz'}
 if len(sys.argv)>2:result['planning']['replay_artifacts']=replay(P,Path(sys.argv[2]))
(R/'validation').mkdir(exist_ok=True);(R/'validation/exact-differential.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verdict':'pass','memberships_added':6,'removed':0,'changed':0,'old_links_identical':len(oldlinks),'withheld':26,'migration_replay':result.get('migration_replay_artifacts'),'planning_replay':result.get('planning',{}).get('replay_artifacts')}))

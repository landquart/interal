#!/usr/bin/env python3
"""Independent exact-set verification of current history and certification."""
import gzip,json,hashlib,subprocess,sys
from pathlib import Path
R=Path('audit/associative-family-v6/prompt06-history-20261005');G=Path('associativvordes/family-index-v6/generated');BASE='a29a3184336b981f2ca1c5cea019ad43e4b42729'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 b=Path(p).read_bytes();return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
def frozen(p):
 b=subprocess.check_output(['git','show',BASE+':'+str(p)]);return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
key=lambda r:(r['language'],r.get('family_id','family:'+r.get('root',r.get('canonical_root',''))),r['lemma_id'])
index=lambda rs:{key(r):r for r in rs}
C=R/'generated';m=read(C/'manifest.json')
for p,h in m['input_sha256'].items():assert sha(Path(p).read_bytes())==h,'changed certification input '+p
for p,h in m['artifacts'].items():assert sha((C/p).read_bytes())==h,'changed certification artifact '+p
catalog=read('associativvordes/family-index-v6/catalog.json');cert=read(C/'family-certification.json');assert {f['family_id'] for f in cert}=={f['id'] for f in catalog['families']};assert len(cert)==18
old,current=index(frozen(G/'memberships.json.gz')),index(read(G/'memberships.json.gz'));v=read(G/'correction-verdicts.json.gz');vk={key(r) for r in v}
assert set(old)-set(current)==vk,'unapproved baseline loss';assert not set(current)-set(old),'unexpected new membership in Prompt06';assert all(current[k]==old[k] for k in current),'unexpected changed membership'
baseline=read(G/'baseline-memberships.json.gz');assert len(baseline)==19967 and len(index(baseline))==19967
for name in ['heads.json.gz','edges.json.gz','lemma-head-links.json.gz','head-review-ledger.json','family-promotion-ledger.json','head-lifecycle-ledger.json','review-backlog.json.gz','head-review-metrics.json']:
 assert read(G/name)==frozen(G/name),'unexpected mutation '+name
historical=read('audit/associative-family-v6/historical-overlay-20261003/records.json.gz');mapped=read(C/'historical-reconciliation.json.gz');assert len(mapped)==len(historical)==55686
representatives=read(R/'representative-decisions.json');rp=index(representatives['rows']);assert len(rp)==19
source=read('audit/associative-family-v5/component-checkpoint-20261001/candidate-records.json.gz')
for k,r in rp.items():
 actual=next(x for x in source[r['root']][r['language']] if x['lemma_id']==r['lemma_id']);assert actual==r['source_record'];assert sha(json.dumps(actual,ensure_ascii=False,separators=(',',':')).encode())==r['source_record_sha256'];assert r['creates_head_or_membership'] is False
for a,b in zip(historical,mapped):
 assert all(b[k]==val for k,val in a.items()),'historical decision rewritten';assert b['retrieval_screen_is_linguistic_verdict'] is False;assert b['current_membership']==(key(a) in current)
 if key(a) in rp:assert b['current_linguistic_status']==rp[key(a)]['new_review_status']
for word in ['naive','lieu','lieutenant','winter','printer']:
 root='nat' if word=='naive' else 'loc' if word in ['lieu','lieutenant'] else 'inter';r=next(r for r in rp.values() if r['word']==word);assert r['new_review_status']=='excluded';assert key(r) not in current
for word in ['international','interval','internet']:assert key(next(r for r in rp.values() if r['word']==word)) in current
for word in ['nacer','nacimiento','nascere','entre']:assert next(r for r in rp.values() if r['word']==word)['new_review_status']=='uncertain'
sets=read(C/'root-bound-overlap-sets.json.gz');h={key(r) for r in historical if r['current_disposition']=='unresolved_historical_without_current_decision'};a={key(r) for u in read(G/'review-backlog.json.gz') for r in u['source_records']}
convert=lambda k:'\0'.join(k)
assert sets['root_bound_overlap']==sorted(map(convert,h&a));assert sets['root_bound_union']==sorted(map(convert,h|a));assert len(h)==46390 and len(a)==23234
all_h={key(r) for r in historical};eligible={key(r) for r in mapped if r['current_linguistic_status'] in ['unreviewed','uncertain']}
assert sets['all_historical_root_bound']==sorted(map(convert,all_h));assert sets['all_historical_current_overlap']==sorted(map(convert,all_h&a))
assert sets['effective_review_eligible_historical']==sorted(map(convert,eligible));assert sets['effective_review_eligible_current_overlap']==sorted(map(convert,eligible&a));assert sets['effective_review_eligible_union']==sorted(map(convert,eligible|a))
assert len(all_h&a)==827 and len(eligible)==47723 and len(eligible&a)==827 and len(eligible|a)==70130
for f in cert:
 assert f['full_linguistic_certification'] is False;assert f['inherited_proofs']['new_linguistic_review'] is False;assert f['inherited_proofs']['memberships']==sum(r['family_id']==f['family_id'] for r in baseline)
 if f['canonical'] in ['alter','ocul','ped','manu','regul','liber']:assert f['open_queue_coverage']['current_questions']==0 and f['open_queue_coverage']['coverage']=='no_current_active_queue_full_coverage_not_established'
protected={}
for p in ['associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5','audit/associative-family-v6/historical-overlay-20261003','audit/associative-family-v6/queue-organization-20261004','audit/associative-family-v6/oper-relat-continuation-20261004']:
 assert not subprocess.check_output(['git','diff','--name-only',BASE,'--',p]).strip(),p;protected[p]=subprocess.check_output(['git','rev-parse',BASE+':'+p]).decode().strip()
P=Path(read('associativvordes/family-index-v6/queue-planning.json')['output']);previous=Path('audit/associative-family-v6/oper-relat-continuation-20261004/planning');
for name in ['corpus_ids','membership_candidates','route_occurrences','source_route_references','packet_route_occurrences']:assert read(P/'conservation.json.gz')['before'][name]==read(previous/'conservation.json.gz')['before'][name]
questions=read(P/'membership-questions.json.gz');q={r['candidate_id']:r for r in questions}
for k,r in rp.items():
 rkey=r['language']+'\0'+r['lemma_id']+'\0'+r['root'];assert q[rkey]['effective_verdict']['status']==r['new_review_status'];assert bool(q[rkey]['open_frames'])==(r['new_review_status']=='uncertain')
result={'schema_version':6,'verdict':'pass','baseline_sha':BASE,'current_memberships':len(current),'historical_baseline_memberships':len(baseline),'exact_differential':{'additions':[],'removals':[old[k] for k in sorted(vk)],'changed_memberships':[]},'protected_trees':protected,'certified_scope_families':len(cert),'full_dictionary_complete':False,'representative_rechecks':len(rp),'root_bound_overlap':len(h&a),'root_bound_union':len(h|a),'all_historical_current_overlap':len(all_h&a),'effective_review_eligible_historical':len(eligible),'effective_historical_current_overlap':len(eligible&a),'effective_review_eligible_union':len(eligible|a),'planning_source_sets_conserved':True}
if len(sys.argv)>1:
 target=Path(sys.argv[1]);assert {p.name for p in C.iterdir()}=={p.name for p in target.iterdir()}
 for p in C.iterdir():assert p.read_bytes()==(target/p.name).read_bytes(),p.name
 result['certification_replay_artifacts']=len(list(C.iterdir()))
if len(sys.argv)>2:
 t=Path(sys.argv[2]);assert {p.name for p in P.iterdir()}=={p.name for p in t.iterdir()}
 for p in P.iterdir():assert p.read_bytes()==(t/p.name).read_bytes(),p.name
 result['planning_replay_artifacts']=len(list(P.iterdir()))
(R/'validation').mkdir(exist_ok=True);(R/'validation/exact-differential.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result))

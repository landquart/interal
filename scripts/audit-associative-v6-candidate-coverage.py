#!/usr/bin/env python3
"""Independent exact conservation audit; no linguistic recall claim."""
import gzip,json,hashlib,subprocess
from pathlib import Path
R=Path('audit/associative-family-v6/prompt08-coverage-20261005');G=Path('associativvordes/family-index-v6/generated');BASE='39703c50459d4accfd032af8c3fb1f16cffb3e9a'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 b=Path(p).read_bytes();return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
def frozen(p):
 b=subprocess.check_output(['git','show',BASE+':'+str(p)]);return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
key=lambda r:(r['language'],r['family_id'],r['lemma_id'])
for name in ['research-coverage','packet-lifecycle']:
 m=read(R/name/'manifest.json')
 for p,h in m['artifacts'].items():assert sha((R/name/p).read_bytes())==h,p
 for p,h in m.get('input_sha256',{}).items():assert sha(Path(p).read_bytes())==h,p
 if 'script_sha256' in m:assert sha(Path('scripts/measure-associative-v6-candidate-coverage.py').read_bytes())==m['script_sha256']
for p,h in read(R/'research-coverage/input-lock.json').items():assert sha(Path(p).read_bytes())==h,p
report=read(R/'research-coverage/coverage-report.json');assert not report['linguistic_recall_measured'];assert report['source_ids']==4924980 and report['surface_only_unique_ids']==3999388
packets=read('audit/associative-family-v6/candidate-root-clusters-20261003/clusters.json.gz');states=read(R/'packet-lifecycle/packet-states.json.gz');assert len(states)==len(packets)==16055
scopes={r['packet_id']:r for r in read(R/'research-coverage/selected-packet-scopes.json.gz')}
for row,p in zip(states,packets):
 assert row['packet_id']==p['candidate_cluster_id'] and row['source_routes']==p['evidence_cluster_ids']
 assert row['source_ids_deleted']==[] and not row['membership_authorized'] and not row['family_identity_from_packet']
 if row['measured_scope']:
  all_ids={k for r in scopes[row['packet_id']]['routes'] for k in r['corpus_keys']};reviewed={k for b in row['branches'] for k in b['corpus_keys']}
  assert reviewed|set(row['unassigned_corpus_keys'])==all_ids and row['unique_source_ids']==len(all_ids)
  assert set(row['promoted_finite_keys'])<=reviewed<=all_ids
  if row['state']=='promoted_finite_frame':assert set(row['promoted_finite_keys'])==all_ids
 else:assert row['state']=='unreviewed' and not row['branches']
questions={}
for r in read(R/'research-coverage/surface-only-rank-sample.json.gz')+read(R/'research-coverage/selected-exact-routes.json.gz'):questions.setdefault(r['source_locator']['path'],[]).append(r)
for p,rs in sorted(questions.items()):
 source=read(p)
 for r in rs:
  loc=r['source_locator'];actual=next(x for x in source[loc['family_id']] if x['lemma_id']==r['lemma_id']);assert actual==r['source_record'] and actual['word']==r['word']
  assert sha(json.dumps(actual,ensure_ascii=False,separators=(',',':')).encode())==loc['snapshot_sha256_python_compact']
 del source
zero=read(R/'research-coverage/zero-v5-triage.json.gz');original=read('audit/associative-family-v6/corpus-enumeration.json')['zero_membership_source_records'];assert {(r['language'],r['lemma_id']) for r in zero}=={(r['language'],r['lemma_id']) for r in original} and len(zero)==829
assert all(not r['membership_authorized'] and r['low_priority_is_not_exclusion'] for r in zero)
old={key(r):r for r in frozen(G/'memberships.json.gz')};current={key(r):r for r in read(G/'memberships.json.gz')};added=set(current)-set(old)
assert not set(old)-set(current);assert all(current[k]==r for k,r in old.items());assert len(added)==5 and all(current[k]['family_id']=='family:atom' for k in added)
expected=set()
for name in ['atom-promotion-decision.json','atom-extension-decision.json']:
 d=read(R/name);assert d['binding_authorized'] and d['accepted_membership_authorized'] and not d['synthetic_fixture']
 for p,h in d['input_sha256'].items():assert sha(Path(p).read_bytes())==h,p
 records=[r for g in d['groups'] for r in g['records']] if 'groups' in d else d['records']
 for r in records:expected.add((r['language'],'family:atom',r['lemma_id']))
assert added==expected
heads={r['id']:r for r in read(G/'heads.json.gz')};assert all(heads[r['id']]==r for r in frozen(G/'heads.json.gz'));assert len(heads)-len(frozen(G/'heads.json.gz'))==3
for p in ['associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5','audit/associative-family-v6/prompt06-history-20261005','audit/associative-family-v6/prompt07-contamination-20261005']:
 assert not subprocess.check_output(['git','diff','--name-only',BASE,'--',p]).strip(),p
result={'schema_version':6,'verdict':'pass','baseline_sha':BASE,'memberships_before':len(old),'memberships_after':len(current),'additions':[current[k] for k in sorted(added)],'removed':[],'changed_existing':[],'new_heads':3,'surface_only_unique_ids':3999388,'linguistic_recall_measured':False,'surface_sample':600,'zero_v5_preserved':829,'full_dictionary_complete':False}
(R/'validation').mkdir(exist_ok=True);(R/'validation/coverage-exact-differential.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='additions'}))

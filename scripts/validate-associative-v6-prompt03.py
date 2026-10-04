#!/usr/bin/env python3
"""Independent stage differential against frozen Prompt 02, plus byte replay."""
import json,gzip,hashlib,subprocess,sys
from pathlib import Path
baseline='6330df5c8d182f5418c18d5f87b454d4d36c3cfb' # published tree identical to local a1604e3
base=Path('associativvordes/family-index-v6/generated');out=Path('audit/associative-family-v6/prompt03-final-validation-20261004');out.mkdir(exist_ok=True)
def load(name,old=False):
 b=subprocess.check_output(['git','show',f'{baseline}:{base}/{name}']) if old else (base/name).read_bytes()
 return json.loads(gzip.decompress(b) if name.endswith('.gz') else b)
def key(r):return (r['language'],r['family_id'],r['lemma_id'])
a,b=load('memberships.json.gz',True),load('memberships.json.gz');before={key(r):r for r in a};after={key(r):r for r in b}
added=[r for k,r in after.items() if k not in before];removed=[r for k,r in before.items() if k not in after];changed=[{'before':r,'after':after[k]} for k,r in before.items() if k in after and r!=after[k]]
assert len(a)==21554 and len(b)==21555 and not removed and len(added)==1
assert key(added[0])==('de','family:system','lemma:e0e390279d7daf67fbc3') and added[0]['word']=='systeme'
assert len(changed)==2
for pair in changed:
 x,y=pair['before'],pair['after'];assert x['language']=='de' and x['family_id']=='family:system' and x['edge_version']==1 and y['edge_version']==2
 assert {k:v for k,v in x.items() if k!='edge_version'}=={k:v for k,v in y.items() if k!='edge_version'}
oldlinks,newlinks=load('lemma-head-links.json.gz',True),load('lemma-head-links.json.gz');assert len(newlinks)==len(oldlinks)+1 and newlinks[:-1]==oldlinks
new=newlinks[-1];assert new['lemma_id']==added[0]['lemma_id'] and new['frequency_status']=='aggregate_only_not_sense_frequency' and new['token_senses_established'] is False
oldheads,newheads=load('heads.json.gz',True),load('heads.json.gz');assert len(oldheads)==len(newheads) and [h['id'] for h in oldheads]==[h['id'] for h in newheads]
head_changes=[(x,y) for x,y in zip(oldheads,newheads) if x!=y];assert len(head_changes)==1
x,y=head_changes[0];assert x['language']=='de' and x['normalized_head']=='system' and y['version']==2 and x['version']==1 and y['evidence'][:len(x['evidence'])]==x['evidence']
for k in ['id','language','normalized_head','sense']:assert x[k]==y[k]
oldedges,newedges=load('edges.json.gz',True),load('edges.json.gz');assert len(oldedges)==len(newedges);edge_changes=[(x,y) for x,y in zip(oldedges,newedges) if x!=y];assert len(edge_changes)==1
ledger=load('head-lifecycle-ledger.json');assert ledger['decisions'][0]['predecessor']['head']==x and ledger['decisions'][0]['predecessor']['edge']==edge_changes[0][0]
assert ledger['differential']=={'additions':added,'removals':removed,'version_changes':changed}
protected={}
for path in ['associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5']:
 tree=lambda rev:subprocess.check_output(['git','rev-parse',rev+':'+path],text=True).strip()
 protected[path]={'baseline':tree(baseline),'current':tree('HEAD')};assert protected[path]['baseline']==protected[path]['current'];assert not subprocess.check_output(['git','diff','--name-only',baseline,'--',path],text=True).strip()
metrics=load('head-review-metrics.json');assert metrics['current_active_records']==23240 and metrics['new_records_resolved']==1962 and metrics['records_reviewed']==1965
assert load('migration-report.json')['lexical_heads']==216
replay={}
if len(sys.argv)>1:
 root=Path(sys.argv[1]);files={str(p.relative_to(base)):p for p in base.rglob('*') if p.is_file()};other={str(p.relative_to(root)):p for p in root.rglob('*') if p.is_file()};assert files.keys()==other.keys()
 for name,p in files.items():assert p.read_bytes()==other[name].read_bytes(),name
 replay={'verdict':'pass','artifacts':len(files),'sha256':{n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in sorted(files.items())}}
result={'verdict':'pass','baseline':baseline,'exact_differential':{'additions':added,'removals':removed,'version_changes':changed},'old_links_identical':len(oldlinks),'unchanged_head_identities':len(oldheads),'changed_heads':len(head_changes),'changed_edges':len(edge_changes),'protected_trees':protected,'lifecycle_metrics':ledger['metrics'],'known_queue_metrics':metrics,'replay':replay,'production_enabled':False,'full_dictionary_complete':False}
(out/'exact-differential.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'verdict':'pass','added':len(added),'removed':len(removed),'version_changes':len(changed),'replay_artifacts':replay.get('artifacts')}))

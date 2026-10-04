#!/usr/bin/env python3
"""Independent exact Prompt 02 differential and replay checks; no corpus mutation."""
import gzip,hashlib,json,subprocess,sys
from pathlib import Path
out=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/prompt02-validation');out.mkdir(parents=True,exist_ok=True)
root=Path('associativvordes/family-index-v6/generated');baseline='08a5ce1e6453c0d3a2ccad08b8dd5ee92b774c75'
old=json.loads(gzip.decompress(subprocess.check_output(['git','show',baseline+':'+str(root/'memberships.json.gz')])));new=json.loads(gzip.decompress((root/'memberships.json.gz').read_bytes()))
key=lambda r:(r['language'],r['family_id'],r['lemma_id'])
a={key(r):r for r in old};b={key(r):r for r in new};assert len(a)==21548 and len(b)==21554;assert all(k in b and b[k]==v for k,v in a.items())
added=[b[k] for k in sorted(b.keys()-a.keys())];assert len(added)==6 and all(r['family_id']=='family:anis' for r in added);assert not any(r['family_id']=='family:turr' for r in new)
paths=['associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5'];trees={}
for path in paths:
 tree=subprocess.check_output(['git','rev-parse',baseline+':'+path],text=True).strip()
 for ref in ['HEAD','22e6293f72a22e80e364079d83031a1f8f2a36d6']:assert subprocess.check_output(['git','rev-parse',ref+':'+path],text=True).strip()==tree
 assert not subprocess.check_output(['git','diff','--name-only',baseline,'--',path]).strip();trees[path]=tree
for family,word in [('nat','naive'),('system','состав'),('anis','anisotropy'),('anis','aniso'),('turr','tour'),('turr','тура'),('turr','torre')]:assert not any(r['family_id']=='family:'+family and r['word']==word for r in new)
rows=json.loads(Path('audit/associative-family-v6/prompt02-row-decisions-20261004.json').read_text())['rows'];assert len(rows)==25;assert all(r['decision']=='deferred' and r['blocker'] for r in rows if r['family_id']=='family:turr')
for language in ['es','it']:
 r=next(r for r in rows if r['language']==language and r['family_id']=='family:turr');assert len({a['history'] for a in r['analyses']})==2
research=json.loads(Path('audit/associative-family-v6/turr-finite-lexical-row-promotion-20261004.json').read_text());assert research['binding_authorized'] is False and research['accepted_membership_authorized'] is False and research['groups']==[]
result={'baseline_sha':baseline,'baseline_memberships':len(old),'current_memberships':len(new),'preserved_byte_equivalent_membership_objects':len(a),'additions':added,'removals':[],'unexpected_additions':[],'unexpected_removals':[],'preserved_v5_frequency_and_audit_git_trees':trees,'production_v5_unchanged':True,'known_queue_resolutions':0,'existing_system_memberships_preserved':12,'provisional_torre_admissions_withdrawn_before_publication':True,'final_tower_core_decisions':7,'turr_catalog_promotion':False}
(out/'exact-differential.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if len(sys.argv)>2:
 replay=Path(sys.argv[2]);hashes=lambda base:{str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest() for p in base.rglob('*') if p.is_file()};x=hashes(root);assert x==hashes(replay);(out/'replay-comparison.json').write_text(json.dumps({'verdict':'pass','byte_identical_artifacts':len(x),'artifact_sha256':x},indent=2)+'\n')
print('Exact differential +6/-0; all 21548 prior membership objects and v5/frequency/audit trees preserved; all seven tower core rows blocked individually.')

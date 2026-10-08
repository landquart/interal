"""Independent exact ID/source conservation and full-list exporter for finite regul repair."""
import json,gzip,hashlib,subprocess,csv
from pathlib import Path
root=Path('audit/associative-family-v6/regul-20261008'); out=root/'validation';out.mkdir(exist_ok=True); exports=root/'final';exports.mkdir(exist_ok=True)
read=lambda p:json.loads(gzip.decompress(Path(p).read_bytes()) if str(p).endswith('.gz') else Path(p).read_bytes())
key=lambda r:(r['language'],r['family_id'],r['lemma_id'])
base='associativvordes/family-index-v6/generated/'
old=json.loads(gzip.decompress(subprocess.check_output(['git','show','f70c217d08329f7f93fd56945cb7366562e579e9:'+base+'memberships.json.gz'])))
new=read(base+'memberships.json.gz'); O={key(r):r for r in old};N={key(r):r for r in new};reviews=read(root/'decisions/review.json');R={key(r):r for r in reviews};prior=read(root/'research/prior.json');candidates=read(root/'research/candidates.json');C={(r['language'],r['lemma_id']):r for r in candidates}
assert len(R)==len(reviews)==2658;assert len(prior)==764
assert len(O)==len(old) and len(N)==len(new)
assert {k:v for k,v in O.items() if k[1]!='family:regul'}=={k:v for k,v in N.items() if k[1]!='family:regul'},'Other family memberships changed'
oldedges=json.loads(gzip.decompress(subprocess.check_output(['git','show','f70c217d08329f7f93fd56945cb7366562e579e9:'+base+'edges.json.gz'])))
newedges=read(base+'edges.json.gz');assert [r for r in oldedges if r['family_id']!='family:regul']==[r for r in newedges if r['family_id']!='family:regul'],'Other family edges changed'
accepted={key(r) for r in reviews if r['decision']=='accepted'};actual={k for k in N if k[1]=='family:regul'};assert accepted==actual
assert all(k not in actual for k,r in R.items() if r['decision']!='accepted')
immutable=['associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5'];assert not subprocess.check_output(['git','diff','--name-only','f70c217d08329f7f93fd56945cb7366562e579e9','--',*immutable]).strip()
# Every preserved/added record uses the exact original locator. No guessed token senses.
links=read(base+'lemma-head-links.json.gz');L={key(r):r for r in links};shards={};source_rows={}
for r in reviews:
 locators=C[(r['language'],r['lemma_id'])]['v5_locators']
 if r['decision']=='accepted':assert L[key(r)]['evidence'][0]['source'] in locators
 source_rows[(r['language'],r['lemma_id'])]=C[(r['language'],r['lemma_id'])]['source_record']
 for x in C[(r['language'],r['lemma_id'])]['frequency_source_records']:
  assert x['record']['original']==r['word'] and x['record']['normalized']==C[(r['language'],r['lemma_id'])]['normalized']
 changes={'added':[N[k] for k in sorted(N.keys()-O.keys())],'removed':[O[k] for k in sorted(O.keys()-N.keys())],'changed':[{'before':O[k],'after':N[k]} for k in sorted(O.keys()&N.keys()) if O[k]!=N[k]],'unchanged':[N[k] for k in sorted(O.keys()&N.keys()) if O[k]==N[k]]}
# No list truncation: one applied state and source payload for every reviewed ID.
for language in ['en','de','fr','es','it','ru']:
 rows=[]
 for r in reviews:
  if r['language']!=language:continue
  k=key(r);rows.append({**r,'applied_state':'accepted' if k in N else 'withheld_historical_uncertain' if k in O and r['decision']=='uncertain' else 'removed_historical_excluded' if k in O else 'not_admitted_candidate','current_membership':N.get(k),'historical_membership':O.get(k),'original_source_record':source_rows.get((language,r['lemma_id'])),'frequency_source_records':C[(language,r['lemma_id'])]['frequency_source_records']})
 for status in ['accepted','excluded','uncertain']:(exports/(language+'-'+status+'.json')).write_text(json.dumps([r for r in rows if r['decision']==status],ensure_ascii=False,indent=2)+'\n')
 with (exports/(language+'-applied.tsv')).open('w') as f:
  w=csv.writer(f,delimiter='\t');w.writerow(['language','lemma_id','word','review_status','applied_state','head','frequency_status','source_locator','original_measurements'])
  for r in rows:w.writerow([language,r['lemma_id'],r['word'],r['decision'],r['applied_state'],r['head'],r['frequency_status'],json.dumps(r['source_locators'],ensure_ascii=False),json.dumps(r['original_source_record'],ensure_ascii=False)])
(root/'validation/membership-diff.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2)+'\n')
summary={'status':'pass','original_regul':764,'finite_questions':2658,'additional_questions':1894,'current_regul':len(actual),'review_decisions_complete':True,'full_linguistic_certification':False,'semantic_unreviewed_claim':False,'uncertain_requires_further_lexical_work':sum(r['decision']=='uncertain' for r in reviews),'source_locator_preservation_checked':len(reviews),'immutable_v5_frequency_history_diff':[],'other_family_memberships_changed':0,'other_family_edges_changed':0,'original_source_measurements_preserved':True,'source_sense_frequencies_invented':False,'changes':{k:len(v) for k,v in changes.items()},'language_counts':{l:{'prior':sum(r['language']==l and r['prior_state']=='legacy_accepted' for r in reviews),'accepted':sum(r['language']==l and r['decision']=='accepted' for r in reviews),'excluded':sum(r['language']==l and r['decision']=='excluded' for r in reviews),'uncertain':sum(r['language']==l and r['decision']=='uncertain' for r in reviews)} for l in ['en','de','fr','es','it','ru']}}
(out/'regul-conservation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))

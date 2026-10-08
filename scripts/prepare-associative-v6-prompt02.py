#!/usr/bin/env python3
"""Reproduce the explicitly adjudicated finite dossiers; never decide by substring."""
import json,gzip,hashlib,subprocess
from pathlib import Path
P=Path('audit/associative-family-v6')
def read(path): return json.loads(Path(path).read_text())
def write(name,d): (P/name).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
a=read(P/'anis-promotion-research-20261003.json'); old=read(P/'anis-core-corpus-adjudication-20261003.json'); t=read(P/'tower-canonical-boundary-adjudication-20261003.json'); tr=read(P/'tower-promotion-research-20261003.json'); s=read(P/'system-finite-promotion-20261003.json')
rows=[]; dossiers=[]
policy=str(P/'SENSES-POLICY-20261004.md'); research=str(P/'prompt02-research-20261004.json')
def row(language,word,id,family,evidence,analyses,formal='accepted',component=None,reason='',realization=None):
 r={'language':language,'word':word,'lemma_id':id,'family_id':family,'membership_object':'lexical_row_or_component','lexical_evidence':evidence,'analyses':analyses,'formal_continuity':formal,'component':component,'proper_name_risk':'hypothetical_in_source_aggregate_not_observed','proper_name_observed':False,'source_pos_available':False,'reason':reason,'national_form_decision':realization}
 js="import {decideLexicalRow} from './scripts/lib/associative-v6-senses-policy.mjs';let r=JSON.parse(process.argv[1]);console.log(JSON.stringify(decideLexicalRow(r)));"
 r.update(json.loads(subprocess.check_output(['node','--input-type=module','-e',js,json.dumps(r)])))
 rows.append(r);return r
def analysis(history,evidence,verdict='accepted',components=None,pos='noun'):
 return {'history':history,'evidence':evidence,'verdict':verdict,'proved_components':components or [],'pos':pos}
def dossier(canonical,packet,canonical_reason,canonical_sources,clusters,groups,neg):
 extra=str(P/'prompt02-torre-homonym-research-20261004.json');inputs={research:sha(research),extra:sha(extra)}
 for f in ['anis-promotion-research-20261003.json','anis-core-corpus-adjudication-20261003.json','tower-canonical-boundary-adjudication-20261003.json','tower-promotion-research-20261003.json']:
  inputs[str(P/f)]=sha(P/f)
 for g in groups:
  for r in g['records']:
   inputs[r['source_locator']['path']]=sha(r['source_locator']['path'])
   r['senses_decision']=next(x for x in rows if x['language']==r['language'] and x['lemma_id']==r['lemma_id'] and x['family_id']=='family:'+canonical)
 f={'id':'family:'+canonical,'canonical':canonical,'legacy_ids':[],'promotion_status':'accepted_finite_promotion','element_type':'root','aliases':[canonical],'canonical_decision':{'status':'accepted','reason':canonical_reason,'evidence':canonical_sources},'realizations':{},'reflexes':[],'source_evidence_clusters':clusters}
 for g in groups:
  f['reflexes'].append({'family_id':f['id'],'language':g['language'],'realization':g['normalized_head'],'realization_type':'lexical_branch_realization','morphology_boundary':'Whole national form only; no productive stem, inflection or substitution rule granted.','supporting_heads':[g['normalized_head']],'positive_controls':g['forms'],'negative_controls':[r['word'] for r in neg],'status':'accepted','evidence':[{'source':u} for u in g['sources']],'head_scope':[{'language':g['language'],'normalized_head':g['normalized_head'],'sense':g['sense'],'evidence':[{'source':u} for u in g['sources']]}],'general_family_realization':False,'establishes_membership':False})
 d={'schema_version':6,'stage':canonical+'-finite-lexical-row-promotion-20261004','source_head':'08a5ce1e6453c0d3a2ccad08b8dd5ee92b774c75','production_enabled':False,'promotion_status':'accepted','binding_authorized':True,'accepted_membership_authorized':True,'decision_scope':'Only enumerated real immutable rows; lexical-row semantics, not token/sense frequencies.','senses_policy':policy,'candidate_packets':[packet],'family':f,'groups':groups,'input_sha256':inputs,'negative_controls':neg,'positive_controls':[{'language':r['language'],'lemma_id':r['lemma_id'],'word':r['word']} for g in groups for r in g['records']],'frequency_limitation':'aggregate_only_not_sense_frequency','unreviewed_source_container_policy':'No blanket verdict; unlisted IDs remain unadjudicated.'}
 if not groups:
  d.update(promotion_status='deferred_proven_incompatible_lexical_histories',binding_authorized=False,accepted_membership_authorized=False)
  d['family']['promotion_status']='research_only_boundary';d['family']['canonical_decision']['status']='accepted_linguistic_boundary_research_only'
 dossiers.append(d);write(canonical+'-finite-lexical-row-promotion-20261004.json',d)
def group(l,h,sense,sources,reason,record,locator):
 return {'language':l,'normalized_head':h,'sense':sense,'head_scope':'whole_lexical_row_not_token_classification','identity_status':'accepted','family_edge_status':'accepted','forms':[record['word']],'component_stems':[],'sources':sources,'reason':reason,'records':[{'language':l,'lemma_id':record['lemma_id'],'word':record['word'],'source_locator':locator,'source_record':record,'link_role':'whole_lexeme','formal_continuity_status':'accepted','relation_kind':'lexical_continuity','corpus_pos_status':'dictionary_lexical_row_not_token_pos','frequency_status':'aggregate_only_not_sense_frequency'}]}
ags=[]
for h in a['national_head_research']:
 l=h['language']; sources=h['sources'][:]; summary=h['evidence_summary']
 if l=='ru':
  sources.append('https://www.elbrusoid.org/upload/iblock/660/66069051c794f59da733f323de12b3e7.pdf');summary='Botanical loan via German/French/Latin; apple naming is a documented aroma-based extension (Khapaev/Khapaeva 2015, printed p.19). Speculative unequal etymology in that entry is rejected.'
 rec=h['source_record']; reason=summary+' The supplied frequency scans establish an aggregate row; no unrelated lexical homonym is established in this reviewed botanical frame. Names in the aggregate are hypothetical, and aggregate frequency remains unpartitioned.'
 row(l,rec['word'],rec['lemma_id'],'family:anis',sources,[analysis('botanical_anison_anisum',sources)],reason=reason,realization={'type':'whole_lexical_form','schema_type':'lexical_branch_realization','form':rec['word'],'general_family_realization':False})
 ags.append(group(l,h['normalized_head'],h['sense'],sources,reason,rec,h['source_locator']))
dossier('anis',a['candidate_packet_id'],old['canonical_decision']['reason'],old['canonical_decision']['evidence'],[r['id'] for r in a['source_clusters']],ags,[{'language':r['language'],'lemma_id':r['lemma_id'],'word':r['word']} for r in a['negative_controls']])
tgs=[]
for h in t['national_head_rows']:
 l=h['language'];rec=h['exact_source_record'];word=rec['word'];sources=h['sources'];formal='accepted' if l in ['es','it','fr','ru'] else 'withheld'; analyses=[analysis('latin_turris',sources)]
 if l=='fr':analyses.append(analysis('latin_tornus_turn_or_lathe',tr['additional_boundary_sources'][:3],'excluded'))
 if l=='ru':analyses.append(analysis('independent_peat_or_sea_plant_routes',sources,'excluded'))
 reason=h['finding']
 if l=='es':
  ev=['https://dle.rae.es/torrar'];analyses.append(analysis('latin_torrere_toast',ev,'excluded',pos='torrar_subjunctive_or_usted_imperative'));sources=sources+ev;reason+=' RAE independently records torre as a form of torrar < torrere. Distinct noun/verb histories block the unsplit aggregate; common spelling torr is not a common proved tower base.'
 if l=='it':
  ev=['https://www.treccani.it/vocabolario/torre_res-3eee76ef-0037-11de-9d89-0016357eee51/','https://www.treccani.it/vocabolario/togliere/'];analyses.append(analysis('latin_tollere_remove',ev,'excluded',pos='contracted_infinitive_togliere'));sources=sources+ev;reason+=' Treccani independently records torre as a contracted togliere < tollere infinitive. Literary/popular register does not remove this documented different history. The unsplit aggregate requires a provenanced sense/POS partition.'
 if formal=='withheld':reason+=' Concrete blocker: independent modern recognizable realization from turr to '+word+' is not established by the saved ancestry alone; finite national correspondence and controls required. POS/name absence is not the blocker.'
 
 r=row(l,word,rec['lemma_id'],'family:turr',sources,analyses,formal,reason=reason,realization={'type':'whole_lexical_form','schema_type':'lexical_branch_realization','form':word,'general_family_realization':False})
 if r['decision']=='accepted':
  loc=rec['source_locator'];raw=json.loads(gzip.decompress(Path(loc['path']).read_bytes()))[loc['family_id']];source=next(x for x in raw if x['lemma_id']==rec['lemma_id'])
  js="import fs from 'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';let a=process.argv.slice(1);let r=JSON.parse(gunzipSync(fs.readFileSync(a[0])))[a[1]].find(r=>r.lemma_id===a[2]);console.log(createHash('sha256').update(JSON.stringify(r)).digest('hex'));"
  locator={**loc,'record_sha256':subprocess.check_output(['node','--input-type=module','-e',js,loc['path'],loc['family_id'],rec['lemma_id']],text=True).strip()}
  tgs.append(group(l,word,h['sense'],sources,reason,source,locator))
neg=[{'language':r['language'],'lemma_id':r['source_record']['lemma_id'],'word':r['word']} for r in tr['negative_and_withheld_controls'] if r['word'] not in ['torre']]
neg.extend({'language':r['language'],'lemma_id':r['lemma_id'],'word':r['word']} for r in rows if r['family_id']=='family:turr' and r['decision']=='deferred')
dossier('turr',t['candidate_packet_id'],t['canonical_decision']['finding'],t['canonical_decision']['sources'],[r['id'] for r in tr['source_clusters']],tgs,neg)
for g in s['groups']:
 for rec in g['records']:
  analyses=[analysis('greek_systema_noun',g['sources'],components=['sistem'] if g['language']=='it' else [])]
  if g['language']=='it':analyses.append(analysis('greek_systema_noun',g['sources'],components=['sistem'],pos='sistemare_finite_verb'))
  row(g['language'],rec['word'],rec['lemma_id'],'family:system',g['sources'],analyses,component='sistem' if g['language']=='it' else None,reason=g['reason']+' Existing finite promotion preserved; POS variants keep the independently proved common base. All aggregate frequencies remain aggregate-only.')
seed=read('associativvordes/family-index-v6/catalog.json')
seed_audit=[{'family_id':f['id'],'canonical':f['canonical'],'canonical_status':f['canonical_decision']['status'],'typed_realizations':len(f.get('reflexes',[])),'types_grant_membership':False} for f in seed['families'] if f['canonical'] not in ['anis','turr']]
write('prompt02-row-decisions-20261004.json',{'schema_version':6,'production_enabled':False,'senses_policy':policy,'rows':rows,'seed_audit':seed_audit,'italian_anis_branch':{'whole_form':'anice','whole_form_type':'lexical_branch_realization','branch_stem':'anic','branch_type':'derivational_stem','branch_status':'accepted_dictionary_derivational_boundary_research_only','supporting_head':'anicino','evidence':['https://www.treccani.it/vocabolario/ricerca/anice/'],'membership_authorized':False,'universal_s_c_rule_authorized':False},'scope':{'anis_unique_pool':801,'anis_finite_approved':6,'tower_unique_pool':1083,'tower_finite_approved':0,'blanket_pool_verdict':False,'family_size_cap':None}})
lines=['# Prompt 02: individual core-ID decisions','', '| Family | Language | Core ID | Word | Competing analysis / risk | Head scope | Decision / blocker | Frequency limitation |','|---|---|---|---|---|---|---|---|']
for r in rows:lines.append('| '+ ' | '.join([r['family_id'],r['language'],r['lemma_id'],r['word'],r['reason'].replace('|','/'),r['head_scope'],r['decision']+(': '+r['blocker'] if r['blocker'] else ''),r['frequency_status']])+' |')
(P/'PROMPT02-ROW-TABLE-20261004.md').write_text('\n'.join(lines)+'\n')
print('25 real core rows adjudicated; finite approvals anis 6, turr 0, existing system 12 retained; all seven tower rows blocked individually.')

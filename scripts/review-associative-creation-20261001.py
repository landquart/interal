"""Reproducible explicit creation review; broad retrieval never confers membership."""
import json,gzip,hashlib,unicodedata,re
from pathlib import Path
base=Path('audit/associative-family-v5');source=base/'next-roots-reflex-checkpoint-20261001';out=base/'creation-checkpoint-20261001';out.mkdir(exist_ok=True)
selection=json.loads((base/'creation-review-selections-20261001.json').read_text());positive={l:set(ws) for l,ws in selection['explicit_positive_wordlists'].items()}
# Duden independently confirms the obsolete lexical head Kreator (Schöpfer),
# including a standard plural; shared name senses are not frequency-separated.
selection['german_reviewed_productive_heads'].append('kreator');selection['german_withheld_words']=[w for w in selection['german_withheld_words'] if w!='kreator']
fold=lambda w: ''.join(c for c in unicodedata.normalize('NFKD',w.lower()) if not unicodedata.combining(c))
forms={'en':['creat'],'de':['kreat','kreier'],'fr':['creat','crea','cree','creon','crei'],'es':['crea','cree','crei','creo'],'it':['crea','cree','crei','creo'],'ru':['креат','креац']}
original_all=json.load(gzip.open(base/'latin-pairs-checkpoint-20261001/original-families.json.gz','rt'));retired=['ety:a3b640366c27','ety:ab1eaa1c14b6']
original={'families':{i:original_all['families'][i] for i in retired},'members':{l:{i:original_all['members'][l][i] for i in retired} for l in forms}}
candidates={};decisions={};counts={};german_accepted=[]
for language in forms:
 records=json.load(gzip.open(source/(language+'-candidates.json.gz'),'rt'))['creat'];by_id={m['lemma_id']:m for m in records}
 for i in retired:
  for m in original['members'][language][i]:
   if m['lemma_id'] not in by_id:by_id[m['lemma_id']]={**m,'source_family_ids':[i]}
   elif i not in by_id[m['lemma_id']]['source_family_ids']:by_id[m['lemma_id']]['source_family_ids'].append(i)
 records=sorted(by_id.values(),key=lambda m:(m['word'],m['lemma_id']));candidates[language]=records;ds=[]
 for m in records:
  w=m['word'];f=fold(w);status='uncertain';reason=f'No confirmed lexical, inflectional or compound analysis for {w} in {language}. Possible foreign quotation, proper name, phrase fusion or spelling artifact; withheld pending context or lexical evidence.'
  german_ok=language=='de' and any(h in f for h in selection['german_reviewed_productive_heads']) and w not in selection['german_withheld_words'] and not f.startswith(('creative-commons','kreativitatcards'))
  if w in positive.get(language,set()) or german_ok:
   status='accepted';reason=f'Explicitly reviewed {language} lexical head, inflection or transparent compound of Latin creare/creation element; source word {w} retains its declared national form.'
   if german_ok:german_accepted.append(w);reason=f'Reviewed German head/inflection/compound {w} around intact Kreativ/Kreation/Kreatur/Kreator/kreieren; creation or created-entity meaning and Latin origin remain transparent.'
  elif (('pancrea' in f or 'pankrea' in f or 'панкреа' in f) or re.search(r'(?:creatin(?!g)|kreatin|креатин|creatorr|kreatorr)',f)) and f not in ['creatin','procreatin']:
   status='excluded';reason=f'Identified biochemical/medical Greek kreas (flesh) branch in {w}, not Latin creare. Keep independent medical memberships intact; creating verb forms are expressly not chemical creatine.'
  elif language=='fr' and any(s in f for s in ['creance','creancier','mecrean']):
   status='excluded';reason=f'{w} belongs to the croire/credere belief, credit or disbelief branch, not creer/creare creation.'
  elif language=='es' and (f.startswith(('creer','creid','creib','creenc','creey')) or re.match(r'^crei(?:a|amos|an|as|ste|mos|s)',f)):
   status='excluded';reason=f'{w} is an identifiable creer/credere belief inflection/derivative, not crear/creare creation; homographic creo/cree forms are withheld separately.'
  elif language in ['en','de','fr','es','it'] and ('creol' in f or 'kreol' in f):
   status='uncertain';reason=f'Creole/criollo raising/birth branch in {w} requires a separate modern-associative-recognizability decision. Historical ancestry alone does not grant creation membership.'
  elif any(s in f for s in ['cream','scream','screech','creek','creep','increase','decrease']):
   status='excluded';reason=f'{w} belongs to a separate cream/cry/creek/creep or increase/decrease lexeme, not the reviewed create/creation element; broad retrieval overlap is incidental.'
  elif language=='de' and any(s in f for s in ['kreaktion','kreaktor','werkreal']):
   status='excluded';reason=f'{w} crosses independent compound boundaries (for example Panik+Reaktion, Kalk+Reaktor, Werk+Real), not a creation root.'
  elif language=='ru' and w in ['соцреализм','соцреалистический','спецреагирование']:
   status='excluded';reason=f'{w} contains an independent real/reaction stem after a modifier; transliteration overlap does not represent the creation element.'
  elif any(i in m['source_family_ids'] for i in retired) and not any(fold(s) in f for s in forms[language]):
   status='excluded';reason=f'Legacy suffix-expanded route for {w}: an independent lexical stem shares the action suffix, without the reviewed creation element. Suffix overlap does not identify creat.'
  ds.append({'lemma_id':m['lemma_id'],'word':w,'status':status,'reason':reason,'source_family_ids':m['source_family_ids']})
 decisions[language]={'creat':ds};counts[language]={s:sum(d['status']==s for d in ds) for s in ['accepted','excluded','uncertain']}
artifacts={}
for filename,value in [('candidates.json.gz',{l:{'creat':ms} for l,ms in candidates.items()}),('original-families.json.gz',original)]:
 raw=gzip.compress(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);(out/filename).write_bytes(raw);artifacts[filename]=hashlib.sha256(raw).hexdigest()
summary={'source_run_id':35647932153,'canonical_roots':['creat'],'surface_forms':{'creat':forms},'decisions':decisions,'counts':counts,'source_artifacts':artifacts,'sources':[{'url':'https://www.duden.de/rechtschreibung/kreieren','supports':'German national verb reflex from French creer/Latin creare.'},{'url':'https://www.duden.de/rechtschreibung/Kreator','supports':'Obsolete lexical creator head, not solely a band name.'},{'url':'https://www.treccani.it/vocabolario/creare_res-f5c71957-0016-11de-9d89-0016357eee51/','supports':'Latin creare and Italian inflectional variants.'},{'url':'https://dle.rae.es/crear','supports':'Spanish creation verb from Latin creare.'},{'url':'https://www.treccani.it/vocabolario/creatina/','supports':'Greek kreas medical homonym.'},{'url':'https://www.treccani.it/vocabolario/creatorrea/','supports':'Greek flesh plus medical discharge element, not creator.'},{'url':'https://www.dictionnaire-academie.fr/article/A9C4844','supports':'Creance derives from croire belief.'},{'url':'https://www.merriam-webster.com/dictionary/creatrix','supports':'Rare creator noun attestation.'},{'url':'https://gramota.ru/meta/kreatura','supports':'Russian creatura created-entity extension.'}], 'limitations':['Every candidate has a disposition, but uncertain tokens are not certified lexical entries.','Head dictionary evidence plus reviewed transparent grammar/compounding supports productive forms; not every compound has its own dictionary article.','Corpus measurements aggregate word forms and are not split into invented sense frequencies.','Only available source records are selectable; missing approved forms are not synthesized.']}
(out/'linguistic-decisions.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');(out/'inventory.json').write_text(json.dumps({'source_run_id':35647932153,'artifacts':artifacts,'retired_families':retired,'counts':counts},indent=2)+'\n');(out/'german-reviewed-positive-words.json').write_text(json.dumps(german_accepted,ensure_ascii=False,indent=2)+'\n');print(json.dumps(counts))

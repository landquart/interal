import json,gzip,re,hashlib
from pathlib import Path
r=Path('audit/associative-family-v5/reflex-checkpoint-20261001')
c=json.load(gzip.open(r/'candidates.json.gz'));original=json.load(gzip.open(r/'original-families.json.gz'));selection=json.load(open(r/'review-selections.json'))
# This explicit selection artifact is authoritative. Productive German compounds
# are inspected as Information/Informatik/Informant/etc., not arbitrary inform substrings.
forms={'observ':{'en':['observ'],'de':['observ'],'fr':['observ'],'es':['observ'],'it':['osserv'],'ru':['обсерв']},'inform':{l:['информ' if l=='ru' else 'inform'] for l in c}}
oldinfo=json.load(open('audit/associative-family-v5/information-decisions-20260930.json'))
oldinfoids={d['language']:{m['lemma_id'] for m in d['retained']} for d in oldinfo['decisions']}
for a in oldinfo['added']:oldinfoids[a['language']].add(a['member']['lemma_id'])
negative_de=set('berusinformationstag fürinformation informations informationendie informationenen informationenverbandsmitglieder informationweek informationweek-studien faischinformationen hintergruninformationen iinformationen informationstafel-schematische informationsdienstlebensmittel informationsmangei informationsqueiie informationsqueiien informationszeitalte informationschrift millitärinformationen weitereinformationen teilinformnationen kontaktinformationendes umweltinformationsysteme informationsponsor informationenschleuse'.split())
# All suffix matches and phonologically unrelated spellings remain separate.
incidental_de=re.compile(r'(?:steinformation|kleinform|muffinform|zahlscheinformular|optionscheinform)|^einform|^jugendlateinformation$')
decisions={};summary={}
for lang,by in c.items():
 decisions[lang]={};summary[lang]={}
 for key,ms in by.items():
  chosen=set(selection[key].get(lang,'').split());available={m['word'] for m in ms};assert chosen<=available,(lang,key,chosen-available)
  if key=='observ' and lang=='fr':chosen.discard('observat')
  if key=='inform' and lang=='de':
   for m in ms:
    w=m['word'];sf=m['search_form']
    if re.search(r'information|informatik|informant|informier|informativ|informatisch',sf) and w not in negative_de and not incidental_de.search(sf):chosen.add(w)
  rows=[]
  for m in ms:
   w=m['word'];sf=m['search_form'];status='uncertain';reason='Corpus token has no confirmed lexical/inflectional analysis in the reviewed language model; possible foreign quotation, name, fused phrase, spelling artifact or unattested derivative. No membership is inferred.'
   if w in chosen or (key=='inform' and m['lemma_id'] in oldinfoids[lang]):
    status='accepted';reason=('Previously reviewed information membership retained in broader inform associative component.' if key=='inform' and m['lemma_id'] in oldinfoids[lang] else ('Reviewed German lexical component analysis: '+re.sub(r'(information|informatik|informant|informier|informativ|informatisch)',r'[\1]',sf,count=1)+'; productive compound/inflection, not substring equivalence.' if lang=='de' and key=='inform' else 'Explicitly reviewed lexical head, derivative, compound or grammatical inflection of '+key+' in '+lang+'.'))
   elif key=='observ' and lang=='it' and not re.search(r'osserv|observ',sf):
    status='excluded';reason='Suffix-only Italian peer in old observatio/observati expansion: no osserv reflex or observ learned stem; -azione does not encode observation. Distinct lexical stem: '+re.sub(r'azione$','',w)
   elif key=='observ' and lang=='de' and w in ['flößerverein','schlösserverwaltung','dvbs-jobservice']:
    status='excluded';reason='Incidental os+serv across German lexical components; Italian osserv is not a German reflex rule.'
   elif key=='inform' and lang=='de' and incidental_de.search(sf):
    status='excluded';reason='Incidental boundary: Stein+Formation, ein+Form, klein+Format, Muffin+Form or Schein+Formular; not Information/informieren.'
   elif key=='inform' and lang=='en' and (sf.startswith('informal') or w=='brainformation'):
    status='excluded';reason='Different segmentation: in+formal or brain+formation, not the information/inform lexical element.'
   elif (key=='observ' and w in ['euobserver','netobserver',"l'osservatore"]) or (key=='inform' and ('informix' in sf or w in ['cominform','sovinformbyuro','sovinformburo','комиинформ','казинформ','татар-информ','informationweek','informationweek-studien'])):
    status='excluded';reason='Named publication, organization or product token; not approved as a lexical derivative of this associative element.'
   rows.append({'lemma_id':m['lemma_id'],'word':w,'status':status,'reason':reason,'source_family_ids':m['source_family_ids']})
  decisions[lang][key]=rows;summary[lang][key]={s:sum(d['status']==s for d in rows) for s in ['accepted','excluded','uncertain']}
# Preserve specific limitations, not a claim that every possible rare reflex was found.
v={'schema_version':1,'source_run_id':35647932153,'canonical_roots':['observ','inform'],'surface_forms':forms,'decisions':decisions,'counts':summary,'source_artifacts':json.load(open(r/'inventory.json'))['artifacts'],'review_method':'Complete retrieved arrays classified; explicit lexical selections and productive German component analyses. Unresolved token readings have per-record uncertain reasons and are withheld. Italian suffix-only peers are excluded by distinct lexical stem after checking osserv/observ, not by canonical substring alone.','limitations':['Uncertain entries remain unassigned to these reviewed families; no false dictionary certification.','Corpus spelling variants and inflections are kept with original IDs and frequencies, not normalized into invented records.','Original Information subset remains accepted; broader inform does not make informal or German Stein+Formation information derivatives.'],'sources':[
 {'url':'https://www.treccani.it/vocabolario/osservare/','use':'Italian osservare from Latin observare; root-specific assimilation ob+s to oss'},
 {'url':'https://www.treccani.it/vocabolario/osservazione/','use':'osservazione and diminutives from Latin observatio'},
 {'url':'https://www.cnrtl.fr/etymologie/observable','use':'French observable from observer/observabilis'},
 {'url':'https://www.duden.de/rechtschreibung/observieren','use':'German observieren lexical head and morphology'},
 {'url':'https://dle.rae.es/observar','use':'Spanish observar and clitic/inflection model'},
 {'url':'https://gramota.ru/storage/public/normdicts/slovar_inostr_slov.pdf','use':'Russian observatory/observation loan vocabulary'},
 {'url':'https://www.bibliomania.com/2/3/257/1206/23487/2.html','use':'Webster historical lexical observative/observator/observingly'},
 {'url':'https://www.treccani.it/vocabolario/informare/','use':'Italian informare and grammatical model; multiple senses recorded'},
 {'url':'https://www.treccani.it/vocabolario/informatica/','use':'Information processing branch of Informatica'},
 {'url':'https://www.duden.de/rechtschreibung/informieren','use':'German information/informing stem'},
 {'url':'https://www.duden.de/rechtschreibung/informatisch','use':'German computer-science derivative'},
 {'url':'https://www.duden.de/rechtschreibung/informell_formlos','use':'Distinguish formal/informal homonymic segmentation; ambiguous informell withheld'}]}
(r/'linguistic-decisions.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False));print('Totals', {s:sum(v[s] for lang in summary.values() for v in lang.values()) for s in ['accepted','excluded','uncertain']})

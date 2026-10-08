#!/usr/bin/env python3
"""Freeze finite Prompt 05 research from existing queues; no membership mutation."""
import gzip,json,hashlib,subprocess
from pathlib import Path
R=Path('audit/associative-family-v6/prompt05-recovery-20261004');G=Path('associativvordes/family-index-v6/generated')
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 b=Path(p).read_bytes();return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
def write(p,x):
 b=(json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode();Path(p).write_bytes(gzip.compress(b,mtime=0) if str(p).endswith('.gz') else b)
base='26ed0861fad8768f70ed2a1831e4bc8e52dc0c78'
assert sha((G/'review-backlog.json.gz').read_bytes())==sha(subprocess.check_output(['git','show',base+':'+str(G/'review-backlog.json.gz')]))
rows=[r for u in read(G/'review-backlog.json.gz') for r in u['source_records']]
D='https://www.duden.de/rechtschreibung/'
C='https://www.spektrum.de/lexikon/'
crusca='https://new.lessicografia.it/Controller/?EdCrusca5=1&edizione=5&page=19&ricerca=lettura_voci&sezione=Dizionario&vol=11'
reaction_bases={'kettenreaktion':'Kettenreaktion','gegenreaktion':'Gegenreaktion','überreaktion':'Ueberreaktion','kernreaktion':'Kernreaktion','hautreaktion':'Hautreaktion','stressreaktion':'Stressreaktion','immunreaktion':'Immunreaktion','kurzschlussreaktion':'Kurzschlussreaktion','panikreaktion':'Panikreaktion','fluchtreaktion':'Fluchtreaktion'}
reasons={}
for w,n in reaction_bases.items():
 for f in [w,w+'en']:
  reasons[f]=(D+n,'Dictionary division and response/transformation definition prove the complete Reaktion component; finite nominal -en where present.')
for f in ['streßreaktion','streßreaktionen','kurzschlußreaktion']:
 reasons[f]=(D+('Stressreaktion' if f.startswith('streß') else 'Kurzschlussreaktion'),'Historical ss/ß spelling outside the unchanged Reaktion component; finite nominal -en where present. No spelling correction of the corpus record.')
chemical={
 'farbreaktion':(C+'chemie/indikatoren/4426','Publisher chemistry dictionary explicitly uses Farbreaktion for a concentration-indicating chemical process; Farb + Reaktion.'),
 'nachweisreaktion':(C+'chemie/ninhydrinreaktion/6313','Publisher chemistry dictionary describes a Nachweisreaktion detecting amino compounds; Nachweis + Reaktion.'),
 'kernfusionsreaktion':('https://www.spektrum.de/news/wie-gross-ist-die-expansion-des-universums/1778340','Publisher scientific article independently uses Kernfusionsreaktion for nuclear fusion combustion; Kernfusion + s + Reaktion.'),
 'neutronenreaktion':('https://www.spektrum.de/magazin/lise-meitner-und-die-kernspaltung/824545','Publisher historical scientific article independently attests Neutronenreaktion for a nuclear process; Neutronen + Reaktion.'),
 'thermitreaktion':('https://static.klett.de/software/html5/elemente/ec02df315/ec02df315.html','Educational publisher explicitly identifies the aluminium/iron-oxide redox process as Thermitreaktion; Thermit + Reaktion.'),
 'fusionsreaktionen':('https://scilogs.spektrum.de/relativ-einfach/berichterstattung-ueber-kernfusion-vor-einem-jahr-die-verflixte-energiebilanz/2/','Scientific author explicitly uses Fusionsreaktionen for fusion processes; Fusion + s + Reaktion + en.'),
 'enzymreaktion':(C+'biochemie/enzyme/1972','Publisher biochemistry dictionary explicitly discusses Enzymreaktion and catalysis mechanisms; Enzym + Reaktion.')}
reasons.update(chemical)
oper={'barockoper':(D+'Barockoper','Dictionary establishes an opera from the Baroque period; Barock + Oper.'),'hofoper':('https://www.semperoper.de/die-semperoper/semperoper-dresden/geschichte-der-semperoper','Producing institution documents Dresdner Hofoper and opera productions; Hof + Oper institutional sense.'),'mozartoper':('https://www.salzburgerfestspiele.at/magazin/mozart-begegnet-seinen-figuren-mit-viel-liebe','Producing festival explicitly uses Mozartoper for an opera production; Mozart + Oper. Composer modifier stays outside the lexical component.'),'nationaloper':('https://www.staatsoper.de/biographien/berinde-maria-michaela','Producing institution independently names the Griechische Nationaloper as an opera institution; National + Oper. No whole-name or token-sense claim.')}
def spec(name,lang,root,term,head,sense,status,forms,stems,selected,sources,reason):
 frame=[r for r in rows if r['language']==lang and r['canonical_root']==root and term in r['word']]
 chosen=[]
 for r in frame:
  if r['word'] not in selected:continue
  s=selected[r['word']];r=dict(r)
  if r['word']!=head:
   if head=='reaktion':start=r['word'].index('reaktion');comp='reaktion'
   elif head=='perlmutt':start=0;comp='perlmutt'
   elif head=='oper':start=len(r['word'])-4;comp='oper'
   else:raise AssertionError(head)
   r['component_segmentation']={'before':r['word'][:start],'component':comp,'after':r['word'][start+len(comp):],'head':head,'boundary_proof':s[1],'source_references':[s[0]]}
  chosen.append(r)
 return {'schema_version':6,'production_enabled':False,'binding_authorized':False,'accepted_membership_authorized':False,'stage':name+'-prompt05-recovery-20261004','source_head':base,'source_backlog_sha256':sha((G/'review-backlog.json.gz').read_bytes()),'frame':frame,'groups':[{'language':lang,'root':root,'normalized_head':head,'sense':sense,'status':status,'forms':forms,'component_stems':stems,'sources':sources,'reason':reason,'records':chosen}],'withheld_records':[{'record':r,'blocker':'Individual lexical identity/boundary not established in this finite stage; substring retrieval alone does not authorize an edge.'} for r in frame if r['lemma_id'] not in {x['lemma_id'] for x in chosen}],'research_authorizes_membership':False}
reaction=spec('reaktion','de','act','reaktion','reaktion','response_or_transformation_nominal_lexical_base','accepted',['reaktion','reaktionen'],['reaktion'],reasons,[D+'Reaktion',D+'Aktion']+sorted({s[0] for s in reasons.values()}),'Reaktion is documented as re- plus Aktion (Latin actio). Everyday response, chemical transformations and metaphorical chain-response share formal lexical history; component only, no whole-compound POS or token-sense frequency. Exactly individually checked dictionary and scientific uses; no reaktionär, invented SF processes, OCR, wildcard or automatic branch propagation.')
assert len(reaction['groups'][0]['records'])==29
words=['perlmutteinlage','perlmuttflecken','perlmuttwiege','perlmuttlackierung','perlmuttknöpfen','perlmuttkästchen','perlmutt-eigenschaften','perlmuttgriff','perlmuttfurnier','perlmuttbesetzte','perlmuttgriffe','zweiton-perlmutt-konzentrate','perlmuttknopf','perlmuttbesetzten','perlmuttbeschichtet','perlmuttgriffen','perlmuttfarbenen','perlmuttlack','perlmutt','perlmuttknöpfe']
# Two-tone prefix is separately frozen; no rule searching arbitrary substrings.
selected={w:(D+'Perlmutter','Individually reviewed material/color Perlmutt component and transparent finite German compound/inflection. Mater perlarum lineage, not mutare; remaining material modifier/inflection stays outside component.') for w in words}
pearl=spec('perlmutt','de','mut','perlmutt','perlmutt','mother_of_pearl_material_and_color_base','excluded',['perlmutt'],['perlmutt'],selected,[D+'Perlmutt',D+'Perlmutter',D+'Perlmuttgriff',D+'Perlmuttknopf',D+'perlmuttfarben'],'Perlmutt/Perlmutter is the material/color base documented through mater perlarum; the lexical Mutter history is independent of mutare. Twenty finite material/colour components are excluded only from family:mut. Not corpus deletion, not an exclusion from unrelated edges; no verdict on ambiguous Perlmutter homonyms or malformed perlmutther.')
for r in pearl['groups'][0]['records']:
 if r['word']=='zweiton-perlmutt-konzentrate':r['component_segmentation'].update(before='zweiton-',after='-konzentrate')
obs=spec('osservator','it','observ','osserv','osservator','historical_apocopated_observer_and_observant_agent','accepted',['osservator'],[],{'osservator':(crusca,'Crusca observer entry attests the exact apocopated osservator form in Car. Apol. 30; Treccani derives osservatore from Latin observator. Finite Italian historical form, no generic observ/osserv replacement rule.')},[crusca,'https://www.treccani.it/vocabolario/osservatore/'],'Exact historical Italian apocope of osservatore, supported by Crusca attestation and Treccani observator lineage. This real lexical row preserves observ/osserv continuity. Other spelling/fragments remain withheld; historical or regional usage is not rejected for absence from a contemporary headword list.')
op=spec('oper-extension','de','oper','oper','oper','musical_work_performance_institution_common_nominal_base','accepted',['oper'],['oper'],oper,[D+'Oper']+[x[0] for x in oper.values()],'Reuse established Oper lexical identity; each new exact component independently attested as musical work or institution, with fresh family:oper edge review. Existing four Oper bindings stay in the versioned finite scope; remaining proposals withheld.')
for name,doc in [('reaktion',reaction),('perlmutt',pearl),('osservator',obs),('oper-extension',op)]:write(R/(name+'-research.json.gz'),doc)
# Freeze actual corpus locators from existing v5 shards, never regenerate IDs or corpus.
wanted={(r['language'],r['lemma_id']):r for doc in [reaction,pearl,obs,op] for g in doc['groups'] for r in g['records']};found={}
for lang in sorted({k[0] for k in wanted}):
 for p in sorted(Path('associativvordes/family-index-v5/members',lang).glob('*.json.gz')):
  b=p.read_bytes()
  for family,rs in json.loads(gzip.decompress(b)).items():
   for r in rs:
    k=(lang,r['lemma_id'])
    if k not in wanted or k in found or family not in wanted[k]['source_family_ids']:continue
    assert r['word']==wanted[k]['word'];found[k]={'language':lang,'lemma_id':r['lemma_id'],'word':r['word'],'source_locator':{'path':str(p),'family_id':family,'record_sha256':sha(json.dumps(r,ensure_ascii=False,separators=(',',':')).encode())},'source_record':r,'input_sha256':sha(b)}
assert set(found)==set(wanted),(set(wanted)-set(found))
write(R/'source-records.json.gz',list(found.values()))
write(R/'research-summary.json',{'schema_version':6,'baseline':base,'production_enabled':False,'binding_authorized':False,'stages':[{'name':name,'frame':len(doc['frame']),'selected':len(doc['groups'][0]['records']),'withheld':len(doc['withheld_records']),'source_sha256':sha((R/(name+'-research.json.gz')).read_bytes())} for name,doc in [('reaktion',reaction),('perlmutt',pearl),('osservator',obs),('oper-extension',op)]],'scope_policy':'Substring retrieval defines research frames only. Every selected finite boundary is independently assessed. Frame sizes are not family-size caps. Existing source IDs/frequencies/routes are retained; no corpus reclustering.'})
print(json.dumps(read(R/'research-summary.json'),ensure_ascii=False))

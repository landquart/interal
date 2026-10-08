"""Finite continuation over immutable creation/mutation source frames."""
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

B=Path('audit/associative-family-v5')
OUT=B/'relation-phrase-boundaries-20261002'
GROUPS=[]
SEGMENTATIONS={}
def phrases(language,lines,url):
    for phrase in lines.strip().splitlines():
        word=phrase.replace(' ','');SEGMENTATIONS[(language,word)]=phrase
        GROUPS.append(('relat',language,'syntactic phrase',word,url,
                      'Finite reviewer segmentation: '+phrase+'. Exact saved token is a fused syntactic phrase, not a lexical compound or word inflection. Its legitimate constituent head is not excluded; no corpus spelling or measured source record is changed.'))
phrases('en','''about our relationship
almost related
and had bad relationships
any relation
any relationship
any relative
any relatives
are late today
completely unrelated
correlation between
did relate
have many relations
have relation
have relationships
her relationship
his relatives will
it relates
my relationship
my relatives
of relation
of relations
of relationship
of relatives
of relatives are here
our relationship
our relatives
real relationship
related to
related warrants
relates to the
relate to
relating to
relations and
relationship can
relationship has
relationship is
relationship or
relationships are
relationships are forever
relationships on
relationships turned
relationships with
relationship that
relationship to
relationship was
relationship were
relationship will
relationship with
relationship you
relations with
relation to
relatively junior
relative of the
relatives at
some relationship
something related
talking about relations
their relation
their relationship
their relatives died
the relation
the relationship
the relationships
to see relationships
was related
way related to
your relationship''','https://www.merriam-webster.com/dictionary/relationship')
phrases('de','''ist relativ
relativ jung''','https://www.duden.de/rechtschreibung/relativ')
phrases('fr','''aucune relation
aux événements relatés ici
relation amoureuse
relativement juste
une relation''','https://www.dictionnaire-academie.fr/article/A9R1460')
phrases('es','''estar relacionada
estar relacionados
objetivos de una relación
relacionadas con
relacionan con
relaciones el
relaciones últimamente
tener relación
tu relación
una relación''','https://dle.rae.es/relación')

sha=lambda b:hashlib.sha256(b).hexdigest()
def enc(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()

def build(out):
 delta=[];proof=[];pending=[];counts={};inputs={}
 for root,folder,previous in [('relat','relation','creation-relation')]:
  old=B/(folder+'-checkpoint-20261001');prior=B/(previous+'-independent-heads-20261002')
  source_bytes=(old/'candidates.json.gz').read_bytes();prior_bytes=(prior/'pending-review.json.gz').read_bytes()
  inv=json.loads((prior/'inventory.json').read_text());assert sha(prior_bytes)==inv['artifacts']['pending-review.json.gz']
  assert sha(source_bytes)==inv['historical_artifacts'][root][str(old/'candidates.json.gz')]
  inputs[root]={'candidate_path':str(old/'candidates.json.gz'),'candidate_sha256':sha(source_bytes),
                'previous_pending_path':str(prior/'pending-review.json.gz'),'previous_pending_sha256':sha(prior_bytes),
                'inventory_path':str(prior/'inventory.json'),'inventory_sha256':sha((prior/'inventory.json').read_bytes())}
  rows=[r for r in json.loads(gzip.decompress(prior_bytes)) if r['root']==root]
  by_word={(r['language'],r['word']):r for r in rows};source=json.loads(gzip.decompress(source_bytes));selected=set()
  for rt,language,head,words,url,reason in GROUPS:
   if rt!=root:continue
   for word in words.split():
    r=by_word[(language,word)];assert r['status']=='pending_review'
    k=(language,r['lemma_id']);assert k not in selected;selected.add(k)
    member=next(m for m in source[language][root] if m['lemma_id']==r['lemma_id'])
    assert member['word']==word and member['source_family_ids']==r['source_family_ids']
    delta.append({**r,'previous_status':'pending_review','status':'excluded','lexical_head':head,'segmentation':SEGMENTATIONS[(language,word)],'reason':reason,
                  'source_references':[url],'runtime_applied':False})
    proof.append({'root':root,'language':language,'member':member,'previous_pending_record':r})
  counts[root]={}
  for language,cs in inv['counts'][root].items():
   n=sum(l==language for l,_ in selected)
   counts[root][language]={**cs,'excluded':cs['excluded']+n,'pending_review':cs['pending_review']-n,
                           'reviewed_exclusions':cs['reviewed_exclusions']+n,'new_exclusions':n}
  pending.extend(r for r in rows if (r['language'],r['lemma_id']) not in selected)
 out.mkdir(parents=True,exist_ok=True)
 ledger={'source_run_id':35647932153,'inputs':inputs,'decisions':delta,'counts':counts,'runtime_changes':False,
         'full_family_certification':False,'limitations':['Only the explicitly segmented saved whole forms are newly adjudicated.',
         'No source spelling, sense frequency, component or corpus measurement is changed.']}
 files={'decisions.json':enc(ledger),'pending-review.json.gz':gzip.compress(enc(pending),mtime=0),
        'source-records.json.gz':gzip.compress(enc(proof),mtime=0)}
 for name,raw in files.items():(out/name).write_bytes(raw)
 inventory={'source_run_id':35647932153,'inputs':inputs,'artifact_sha256':{p:sha(raw) for p,raw in files.items()},
            'new_exclusions':len(delta),'pending_review':len(pending),'counts':counts,'runtime_changes':False}
 assert len(delta)==len(GROUPS)
 (out/'inventory.json').write_bytes(enc(inventory));print(json.dumps({'new_exclusions':len(delta),'remaining_pending':len(pending)}))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=OUT);build(p.parse_args().output)

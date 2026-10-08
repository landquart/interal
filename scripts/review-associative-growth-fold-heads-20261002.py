"""Finite continuation over immutable creation/mutation source frames."""
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

B=Path('audit/associative-family-v5')
OUT=B/'growth-fold-heads-review-20261002'
GROUPS=[
 ('creat','en','increase','increasable increasing increasingly aboutincreasing byincreasing increasingat increasinglyjumpy increasinglyrave ofincreasing','https://www.merriam-webster.com/dictionary/increase',
  'Independent increase/growth head from Latin increscere/crescere, not the recognizable creat/create element. Explicit derivatives or fused phrases; per-token analysis is a reviewer inference.'),
 ('creat','en','encrease','encrease','https://www.oxfordlearnersdictionaries.com/definition/english/increase_1',
  'Historical encrease spelling of increase documented by Oxford; growth lexical head, not the creat/create element.'),
 ('creat','en','decrease','decreasing decreasingly ever-decreasing','https://www.merriam-webster.com/dictionary/decrease',
  'Independent decrease/diminution head from decrescere, not creat/create. Finite -ing and -ly morphology and ever-compound preserve this head.'),
 ('creat','en','crease','creaseless creaser creasers creasy uncreased creaseon creasewhen','https://www.merriam-webster.com/dictionary/crease',
  'Independent crease/fold head, not creat/create. Merriam-Webster qualifies its proposed creste/crest history as probable. Finite morphology and phrase segmentation are reviewer inferences; proper names and opaque lookalikes are left pending.'),
]
SEGMENTATIONS={'aboutincreasing':'about increasing','byincreasing':'by increasing','increasingat':'increasing at','increasinglyjumpy':'increasingly jumpy','increasinglyrave':'increasingly rave','ofincreasing':'of increasing','creaseon':'crease on','creasewhen':'crease when'}

sha=lambda b:hashlib.sha256(b).hexdigest()
def enc(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()

def build(out):
 delta=[];proof=[];pending=[];counts={};inputs={}
 for root,folder,previous in [('creat','creation','credit-mute')]:
  old=B/(folder+'-checkpoint-20261001');prior=B/'credit-mute-heads-review-20261002'
  source_bytes=(old/'candidates.json.gz').read_bytes();prior_bytes=(prior/'pending-review.json.gz').read_bytes()
  inv=json.loads((prior/'inventory.json').read_text());assert sha(prior_bytes)==inv['artifact_sha256']['pending-review.json.gz']
  assert sha(source_bytes)==inv['inputs'][root]['candidate_sha256']
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
    delta.append({**r,'previous_status':'pending_review','status':'excluded','lexical_head':head,'reason':reason,
                  'source_references':[url],'segmentation':SEGMENTATIONS.get(word,word),'runtime_applied':False})
    proof.append({'root':root,'language':language,'member':member,'previous_pending_record':r})
  counts[root]={}
  for language,cs in inv['counts'][root].items():
   n=sum(l==language for l,_ in selected)
   counts[root][language]={**cs,'excluded':cs['excluded']+n,'pending_review':cs['pending_review']-n,
                           'reviewed_exclusions':cs['reviewed_exclusions']+n,'new_exclusions':n}
  pending.extend(r for r in rows if (r['language'],r['lemma_id']) not in selected)
 pending.extend(r for r in json.loads(gzip.decompress(prior_bytes)) if r['root']!='creat')
 out.mkdir(parents=True,exist_ok=True)
 ledger={'source_run_id':35647932153,'inputs':inputs,'decisions':delta,'counts':counts,'runtime_changes':False,
         'full_family_certification':False,'limitations':['Only the explicit 20 saved growth/fold forms are newly adjudicated; no global substring rule. Other roots in the previous pending file are conserved verbatim.',
         'No source spelling, sense frequency, component or corpus measurement is changed.']}
 files={'decisions.json':enc(ledger),'pending-review.json.gz':gzip.compress(enc(pending),mtime=0),
        'source-records.json.gz':gzip.compress(enc(proof),mtime=0)}
 for name,raw in files.items():(out/name).write_bytes(raw)
 inventory={'source_run_id':35647932153,'inputs':inputs,'artifact_sha256':{p:sha(raw) for p,raw in files.items()},
            'new_exclusions':len(delta),'pending_review':len(pending),'counts':counts,'runtime_changes':False}
 assert len(delta)==20
 (out/'inventory.json').write_bytes(enc(inventory));print(json.dumps({'new_exclusions':len(delta),'remaining_pending':len(pending)}))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=OUT);build(p.parse_args().output)

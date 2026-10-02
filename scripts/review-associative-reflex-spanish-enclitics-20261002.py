"""Finite additional contextual foreign forms and syntactic boundaries.

Input is the saved pending queue. No retrieval, spelling repair, runtime write,
or default verdict is performed for records outside these explicit selections.
"""
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

BASE=Path('audit/associative-family-v5')
PRIOR=BASE/'reflex-attested-heads-review-20261002'
OUT=BASE/'reflex-spanish-enclitics-review-20261002'
GROUPS=[]
RAE='https://www.rae.es/dpd/tilde'
PRON='https://www.rae.es/dpd/pronombres%20personales%20%C3%A1tonos'
for word,clitic in [('observala','la'),('observale','le'),('observalo','lo'),('observalos','los'),('observame','me'),('observanos','nos'),('observate','te')]:
    GROUPS.append(('es','observ',word,'accepted','regular_voseo_enclitic','observá + '+clitic,
                   ['https://dle.rae.es/observar',RAE,PRON],
                   'RAE attests the voseo imperative observá. Adding the displayed single enclitic shifts the orthographic word to a plain word ending in a vowel or s, so the exact saved unaccented spelling is valid. Finite regular-inflection inference from the documented paradigm and accent rule; this realizes Spanish observ directly, without a spelling repair.'))
for root,word,analysis in [('observ','obsérvenla','observen + la'),('observ','obsérvenos','observe + nos'),('inform','infórmennos','informen + nos')]:
    GROUPS.append(('es',root,word,'accepted','regular_imperative_enclitic',analysis,
                   ['https://dle.rae.es/'+('observar' if root=='observ' else 'informar'),RAE,PRON],
                   'Exact affirmative imperative with the displayed enclitic, inferred finitely from the documented regular paradigm. The resulting antepenultimate stress requires the saved written accent. In infórmennos the two n letters belong to informen + nos and are retained by the RAE rule. No accent normalization, spelling repair or component replacement.'))
GROUPS.append(('es','observ','observádote','accepted','historical_participle_enclitic','observado + te',
               ['https://dle.rae.es/observar',RAE,PRON],
               'Finite historical participle plus enclitic analysis: observado + te has antepenultimate stress and is spelled observádote. RAE documents archaic attachment to participles in historical/coordinated compound verbal uses. This licenses a possible historical Spanish inflection of the same observation head, not a modern productive participle rule. Membership approval concerns the head; the corpus record is retained exactly and is not reinterpreted as a modern imperative.'))
GROUPS.append(('es','observ','observatea','excluded','phrase_fusion','observate a',
               ['https://dle.rae.es/observar',RAE,PRON],
               'Exact boundary observate + a: the first word is the legitimate voseo imperative with te, followed by a separate preposition. The fused corpus token is not a complete lexical word. Finite phrase segmentation excludes only this whole token and does not exclude observate or the observar head.'))

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()

def main(out):
    pending_bytes=(PRIOR/'pending-review.json').read_bytes()
    old_pending=json.loads(pending_bytes)['records']
    inventory=json.loads((PRIOR/'inventory.json').read_text())
    assert sha(pending_bytes)==inventory['artifact_sha256']['pending-review.json']
    assert len(old_pending)==539
    source_path=BASE/'reflex-checkpoint-20261001/candidates.json.gz'
    source_bytes=source_path.read_bytes()
    assert sha(source_bytes)==inventory['source_candidate_sha256']
    candidates=json.loads(gzip.decompress(source_bytes))
    rows={(r['language'],r['canonical_root'],r['word']):r for r in old_pending}
    delta=[];proof=[];seen=set()
    for language,root,word,status,kind,analysis,urls,reason in GROUPS:
        original=rows[(language,root,word)]
        key=(language,root,original['lemma_id']);assert key not in seen;seen.add(key)
        member=next(m for m in candidates[language][root] if m['lemma_id']==original['lemma_id'])
        assert member['word']==word and member['source_family_ids']==original['source_family_ids']
        delta.append({**original,'previous_status':'pending_review','status':status,'analysis_type':kind,
                      'segmentation_or_lexical_identity':analysis,'reason':reason,'source_references':urls,
                      'runtime_applied':False})
        proof.append({'language':language,'canonical_root':root,'member':member,'previous_pending_record':original})
    remaining=[r for r in old_pending if (r['language'],r['canonical_root'],r['lemma_id']) not in seen]
    counts=Counter(r['status'] for r in delta)
    cumulative={'accepted':13+counts['accepted'],'excluded':160+counts['excluded'],'uncertain':50+counts['uncertain'],'pending_review':len(remaining)}
    assert sum(cumulative.values())==762
    ledger={'schema_version':1,'source_run_id':35647932153,'previous_pending_sha256':sha(pending_bytes),
            'source_candidate_sha256':sha(source_bytes),'decisions':delta,'new_counts':dict(counts),
            'continuation_counts':cumulative,'accepted_applied':6,'accepted_unapplied':7+counts['accepted'],'runtime_changes':False,'full_family_certification':False,
            'limitations':['Accepted additions are reviewed but not materialized; guarded additive application is a later independent stage.',
                           'Only explicit whole forms are reviewed; no open prefix/substring classifier.',
                           'Foreign lexical identities have been investigated but aggregated corpus sources cannot resolve quotation/title context.',
                           'Remaining records retain pending_review. No spelling repairs or synthetic corpus records.']}
    out.mkdir(parents=True,exist_ok=True)
    files={'decisions.json':encoded(ledger),'pending-review.json':encoded({'count':len(remaining),'records':remaining}),
           'source-records.json.gz':gzip.compress(encoded({'records':proof}),mtime=0)}
    for name,raw in files.items():(out/name).write_bytes(raw)
    inv={'source_run_id':35647932153,'previous_stage':str(PRIOR),'previous_pending_sha256':sha(pending_bytes),
         'source_candidate_sha256':sha(source_bytes),'reviewed_count':len(delta),'new_counts':dict(counts),
         'continuation_counts':cumulative,'artifact_sha256':{n:sha(raw) for n,raw in files.items()},
         'runtime_changes':False,'full_family_certification':False}
    (out/'inventory.json').write_bytes(encoded(inv));print(json.dumps(inv,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=OUT)
    main(parser.parse_args().output)

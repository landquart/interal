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
PRIOR=BASE/'reflex-phrase-boundary-review-20261002'
OUT=BASE/'reflex-foreign-forms-review-20261002'
MW='https://www.merriam-webster.com/dictionary/'
GROUPS=[]
def foreign(languages, root, words, origin, url):
    for language in languages:
        for word in words.split():
            GROUPS.append((language,root,word,'uncertain','foreign_lexical_context',origin,[url],
                f'Investigated {origin}; the exact saved form has a dictionary-supported foreign lexical analysis. This {language} record contains aggregated source frequencies, not original sentences or sense annotation. Foreign quotation, title/name and target-language lexical use cannot be distinguished. The observation/information head is plausible but target-language membership is not certified. This is contextual uncertainty after lexical analysis, not an unreviewed default.'))
foreign(['de','es','it'],'observ','observer','English observer noun (also French infinitive)',MW+'observer')
foreign(['de','it'],'observ','observers','English observer plural',MW+'observer')
foreign(['de'],'observ','observes','English observe third-person singular',MW+'observe')
foreign(['de','it'],'observ','observe','English observe verb',MW+'observe')
foreign(['es','fr','it'],'observ','observed','English observe past/participle',MW+'observe')
foreign(['es','it'],'observ','observing','English observe gerund/participle',MW+'observe')
foreign(['de','es','fr','it'],'observ','observatory','English observatory noun',MW+'observatory')
foreign(['de','es','fr','it'],'inform','informed','English inform past/participle',MW+'inform')
foreign(['es','fr'],'inform','informs','English inform third-person singular',MW+'inform')
foreign(['en'],'inform','informar informando informarnos','Spanish informar infinitive, gerund or infinitive + nos; finite morphological inference from the regular paradigm','https://dle.rae.es/informar')
foreign(['en','fr'],'inform','informados','Spanish informar masculine plural participle; regular number inflection','https://dle.rae.es/informar')
foreign(['en'],'observ','observaste','Spanish observar second-person singular preterite','https://dle.rae.es/observar')
foreign(['en'],'observ','osservatorio','Italian osservatorio noun','https://www.treccani.it/vocabolario/osservatorio/')
foreign(['en'],'observ','osservate','Italian osservare plural imperative or feminine plural participle; regular inflection','https://www.treccani.it/vocabolario/osservare/')
for lang,root,phrase,url in [
    ('es','inform','e informará','https://dle.rae.es/informar'),
    ('fr','observ','observant sans','https://www.dictionnaire-academie.fr/article/A9O0082'),
    ('it','inform','informatico tatuato','https://www.treccani.it/vocabolario/informatico/'),
]:
    GROUPS.append((lang,root,phrase.replace(' ',''),'excluded','phrase_fusion',phrase,[url],
                  'Finite reviewer segmentation of this exact token into a syntactic phrase. It does not constitute a lexical compound or an inflected word. The constituent head remains legitimate; no source spelling is repaired or source record deleted.'))

for i, item in enumerate(GROUPS):
    if item[2]=='observer':
        GROUPS[i]=(*item[:6],item[6]+['https://www.dictionnaire-academie.fr/article/A9O0082'],item[7])

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()

def main(out):
    pending_bytes=(PRIOR/'pending-review.json').read_bytes()
    old_pending=json.loads(pending_bytes)['records']
    inventory=json.loads((PRIOR/'inventory.json').read_text())
    assert sha(pending_bytes)==inventory['artifact_sha256']['pending-review.json']
    assert len(old_pending)==587
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
    cumulative={'accepted':6,'excluded':152+counts['excluded'],'uncertain':17+counts['uncertain'],'pending_review':len(remaining)}
    assert sum(cumulative.values())==762
    ledger={'schema_version':1,'source_run_id':35647932153,'previous_pending_sha256':sha(pending_bytes),
            'source_candidate_sha256':sha(source_bytes),'decisions':delta,'new_counts':dict(counts),
            'continuation_counts':cumulative,'runtime_changes':False,'full_family_certification':False,
            'limitations':['Only explicit whole forms are reviewed; no open prefix/substring classifier.',
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

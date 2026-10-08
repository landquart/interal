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
PRIOR=BASE/'reflex-spanish-enclitics-review-20261002'
OUT=BASE/'reflex-latin-context-review-20261002'
GROUPS=[]
VERB='https://atlas.perseus.tufts.edu/dictionaries/entry/urn:cite2:scaife-viewer:dictionary-entries.atlas_v1:lat.ls.perseus-eng2-n31849/'
MORPH='https://thrax.mpiwg-berlin.mpg.de/mpiwg-mpdl-cms-web/lt/GetDictionaryEntries?language=lat&outputFormat=html&outputType=dictFull&outputType=morphCompact&query=ob%C5%BFervare&queryDisplay=ob%C5%BFer-vare'
for language,word,analysis in [
 ('en','observabis','Latin future active indicative second person singular'),
 ('en','observarem','Latin imperfect active subjunctive first person singular'),
 ('en','observaveris','Latin perfect active subjunctive or future perfect active indicative second person singular'),
 ('en','observavi','Latin perfect active indicative first person singular'),
 ('de','observabis','Latin future active indicative second person singular'),
 ('fr','observaveris','Latin perfect active subjunctive or future perfect active indicative second person singular'),
 ('es','observabam','Latin imperfect active indicative first person singular'),
 ('es','observabis','Latin future active indicative second person singular'),
 ('es','observaveris','Latin perfect active subjunctive or future perfect active indicative second person singular'),
 ('it','observaveris','Latin perfect active subjunctive or future perfect active indicative second person singular')]:
 GROUPS.append((language,'observ',word,'uncertain','investigated_foreign_inflection',analysis,[VERB,MORPH],
  'Investigated Latin observation-head inflection from the documented observo/observare/observavi paradigm. Exact forms are present in the Max Planck historical morphology resource; grammatical labels are finite reviewer analyses. Aggregate corpus metadata lacks sentences and cannot distinguish Latin quotation/title from lexical use in the assigned language. The Latin head is recognizable observ, but native realization in the corpus language is not proved. No automatic foreign-word exclusion, acceptance, spelling repair or synthetic lemma.'))
for language in ['en','es']:
 GROUPS.append((language,'observ','observationes','uncertain','investigated_foreign_inflection','Latin observationes: nominative or accusative plural of observatio',
  ['https://alatius.com/ls/index.php?l=observation'],
  'Investigated Latin observation noun from documented observatio, observationis. Exact plural morphology is a finite reviewer inference. Source sentences are absent; a Latin quotation/title and target-language lexical use cannot be distinguished. The observation head is established, but native realization is unproved.'))
GROUPS.append(('en','inform','informis','excluded','independent_negative_form_head','Latin in- + forma: shapeless/unformed adjective',
 ['https://atlas.perseus.tufts.edu/dictionaries/entry/urn:cite2:scaife-viewer:dictionary-entries.atlas_v1:lat.ls.perseus-eng2-n23270/'],
 'Lewis and Short identifies informis as the negative form/shape adjective, independent of the information/informing head. A Latin quotation or taxonomic epithet preserves this independent lexical identity; the shared letters do not certify information membership. No global inform* exclusion.'))

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()

def main(out):
    pending_bytes=(PRIOR/'pending-review.json').read_bytes()
    old_pending=json.loads(pending_bytes)['records']
    inventory=json.loads((PRIOR/'inventory.json').read_text())
    assert sha(pending_bytes)==inventory['artifact_sha256']['pending-review.json']
    assert len(old_pending)==527
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
    cumulative={'accepted':24+counts['accepted'],'excluded':161+counts['excluded'],'uncertain':50+counts['uncertain'],'pending_review':len(remaining)}
    assert sum(cumulative.values())==762
    ledger={'schema_version':1,'source_run_id':35647932153,'previous_pending_sha256':sha(pending_bytes),
            'source_candidate_sha256':sha(source_bytes),'decisions':delta,'new_counts':dict(counts),
            'continuation_counts':cumulative,'accepted_applied':24,'accepted_unapplied':0,'runtime_changes':False,'full_family_certification':False,
            'limitations':['The existing 24 accepted continuation records are already applied in the separately saved runtime stage; this review adds none.',
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

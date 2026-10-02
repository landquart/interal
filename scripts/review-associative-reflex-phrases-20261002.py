"""Finite reviewed phrase boundaries, independent heads and contextual loans.

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
PRIOR=BASE/'reflex-continuation-20261002'
OUT=BASE/'reflex-phrase-boundary-review-20261002'
MW='https://www.merriam-webster.com/dictionary/'
ACA='https://www.dictionnaire-academie.fr/article/'
GROUPS=[]

def phrases(language,root,lines,url):
    for phrase in lines.strip().splitlines():
        phrase=phrase.strip()
        GROUPS.append((language,root,phrase.replace(' ',''),'excluded','phrase_fusion',phrase,[url],
                       'Exact saved token segments into the displayed syntactic phrase, not a lexical compound or an inflected word. Exclusion concerns this fused corpus token; the legitimate separate head remains valid. Segmentation is a reviewer inference, not a dictionary entry for the fused form.'))

phrases('en','observ','''and observe
observations as
observe and
observe and tell
observed that
observe the
observe the city
observing these
observing us
that observation
under observation
you will observe their''',MW+'observe')
phrases('en','inform','''all false information
any information
authentic information
better inform
colonel informed
delivered disinformation
exchanging information
false information
gather information
get any information
got information
has informed
her and inform
i await your information
inform against
informant for
informant puts
informant who
information about
information and
information be
information enough
information for
information from
information has
information is
information on
information president
information that
information the
information to
information we
information without
information with you
information you
information you understand
informed by
informed of
informed statements
informed that the
informed the
informed to
informer told
inform the
just informed
just want some information
me any information
misinformation about
new information
number for information
offer information
of information
other information
pertinent information
receiving information
secret information
somebody informed the police
some disinformation
the information
together information
whatever information
what information
withholding of information
your information''',MW+'information')
phrases('de','inform','''für information
informationen die
kontaktinformationen des
weitere informationen''','https://www.duden.de/rechtschreibung/Information')
phrases('fr','inform','''les informations dommageables
nous informés
réelles informations''',ACA+'A9I1218')
phrases('es','observ','''observación en
observando a
observando y
observar su
solo observándolo
y observen
y observo''','https://dle.rae.es/observar')
phrases('es','inform','''al sonsacar información
con información
dará información
el informe
esa información
hay informes
información de
información segura
información viene
informados de
informaron que
la información
los informes
mayor informacion
me informarían
mi informe
nos informaron
obtener más información
reunir información
sacar información
tengo información sólida''','https://dle.rae.es/informar')
phrases('it','observ','''devi osservare
hitler osserva
passeranno inosservate
per osservare
un osservazione''','https://www.treccani.it/vocabolario/osservare/')
phrases('it','inform','''cia informa
cia informare
informarti prima
male informato
per informare
per informarti
per informazione
tua informazione''','https://www.treccani.it/vocabolario/informare/')
phrases('ru','inform','''информацию в
проинформировать вас''','https://gramota.ru/poisk?mode=slovari&query=информировать')

GROUPS.extend([
    ('de','inform','reinform','excluded','independent_head','rein + Form',
     ['https://www.duden.de/rechtschreibung/Reinform'],
     'Independent German Reinform pure-form head. The apparent inform letters cross rein + Form; they do not realize the information element.'),
    ('de','inform','steinform','excluded','independent_head','Stein + Form',
     ['https://www.duden.de/rechtschreibung/Stein','https://www.duden.de/rechtschreibung/Form'],
     'Transparent Stein + Form compound. The overlapping inform letters span the end of Stein and Form; no information constituent is present. Compound analysis is a finite reviewer inference.'),
    ('en','inform','rainformonths','excluded','phrase_fusion','rain for months',
     [MW+'rain'],
     'Exact rain + for + months phrase fusion. The apparent inform sequence crosses word boundaries and contains no inform head.'),
])

# These lexical identities are actually investigated, but the corpus record
# supplies aggregated frequency sources and no original sentence. A foreign
# quotation/title and a genuine target-language lexical use cannot be separated.
for languages,word,url,origin in [
    (['en','de','es','it'],'observateur',ACA+'A9O0079','French agent noun'),
    (['en','de','es','it'],'observatoire',ACA+'A9O0081','French observatory noun'),
    (['en','de','fr','es'],'osservatore','https://www.treccani.it/vocabolario/osservatore/','Italian observation-agent noun'),
    (['en','fr'],'observar','https://dle.rae.es/observar','Spanish infinitive'),
]:
    for lang in languages:
        GROUPS.append((lang,'observ',word,'uncertain','foreign_lexical_context',origin,[url],
                       f'Investigated {origin} with a real observation head. In this {lang} corpus record, a foreign quotation or publication/institution title remains possible. Archived source metadata has no original sentence or sense annotation. Target-language lexical status and the permitted language-specific realization cannot be established; retain contextual uncertainty, not pending review.'))

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()

def main(out):
    pending_bytes=(PRIOR/'pending-review.json').read_bytes()
    old_pending=json.loads(pending_bytes)['records']
    inventory=json.loads((PRIOR/'inventory.json').read_text())
    assert sha(pending_bytes)==inventory['artifact_sha256']['pending-review.json']
    assert len(old_pending)==730
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
    cumulative={'accepted':6,'excluded':23+counts['excluded'],'uncertain':3+counts['uncertain'],'pending_review':len(remaining)}
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

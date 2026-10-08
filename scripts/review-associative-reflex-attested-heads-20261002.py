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
PRIOR=BASE/'reflex-foreign-forms-review-20261002'
OUT=BASE/'reflex-attested-heads-review-20261002'
GROUPS=[]
def decision(language,root,word,status,kind,analysis,urls,reason):
    GROUPS.append((language,root,word,status,kind,analysis,urls,reason))
decision('en','observ','imageobserver','accepted','attested_technical_compound','Image + observer',
 ['https://docs.oracle.com/en/java/javase/24/docs/api/java.desktop/java/awt/image/ImageObserver.html'],
 'Oracle documents ImageObserver as an interface receiving image updates. The exact technical identifier retains the English observer constituent, not an accidental substring. Image + observer is a finite morphological inference supported by its documented function. Existing corpus record only; no synthetic lemma.')
decision('de','inform','informatisierung','accepted','attested_information_derivative','Informatisierung information/computerization process',
 ['https://hls-dhs-dss.ch/de/articles/013724/2019-07-12/','https://link.springer.com/chapter/10.1007/978-3-642-77808-7_31'],
 'Attested German head describes adoption of information systems and is used in a German informatics publication. This is the information/informatics branch, not negative in- + formal. Finite derivative analysis preserves the visible inform constituent.')
for word,identity,url,analysis in [
 ('башинформ','Bashinform news agency','https://www.bashinform.ru/pages/about','Баш + информ'),
 ('информрегистр','Informregistr registration/information-resource institution','https://www.inforeg.ru/','информ + регистр'),
 ('совинформбюро','Soviet Information Bureau','https://guides.rusarchives.ru/funds/6/sovetskoe-informacionnoe-byuro-sovinformbyuro-pri-gosudarstvennom-komitete-po-kulturnym','Сов + информ + бюро'),
 ('юстицинформ','Justitsinform legal-information publisher/group','https://jusinf.ru/about/','юстици + информ'),
]:
    decision('ru','inform',word,'accepted','attested_information_name',analysis,[url],
             f'Attested {identity}. Official institutional evidence establishes an information-related referent; the saved name contains the Russian информ constituent. The displayed segmentation is a finite reviewer inference, not a claimed historical naming derivation. Native named compounds are permitted when the actual information constituent is evidenced; no frequency or original component is replaced.')
decision('it','inform','assinform','accepted','attested_information_name','Ass + inform (ICT association)',
 ['https://www.anitec-assinform.it/scopri-di-piu/english/who-we-are/profilo/organisation-profile.kl'],
 'Official association profile identifies Assinform within the Italian information/communication-technology association. The inform segment is the information/informatics constituent of this attested ICT name, a finite morphological inference. No inference that arbitrary names containing inform qualify.')
decision('en','inform','winforms','excluded','independent_technical_name','Win + Forms',
 ['https://learn.microsoft.com/en-us/dotnet/desktop/winforms/'],
 'Microsoft identifies WinForms as Windows Forms. The apparent inform sequence spans the end of Win and the Forms constituent; it is not the information head. This whole technical name is excluded, without rejecting unrelated compounds.')
decision('en','observ','jobserve','excluded','independent_technical_name','Job + Serve',
 ['https://www.jobserve.com/in/en/content/about/the-company.htm'],
 'Official JobServe evidence describes a recruitment/job service. Its name is analyzed as Job + Serve; the apparent observe letters cross that boundary. This is not an observer constituent. The segmentation is a finite reviewer inference supported by the actual service.')
for lang,word,head,url in [
 ('en','informel','French informal/art informel adjective','https://www.dictionnaire-academie.fr/article/A9I1224'),
 ('es','informality','English nonformal quality noun','https://www.merriam-webster.com/dictionary/informality'),
 ('it','informal','English nonformal adjective','https://www.merriam-webster.com/dictionary/informal'),
]:
    decision(lang,'inform',word,'excluded','independent_formal_head',head,[url],
             'The investigated foreign lexical identity belongs to the nonformal/formless branch, not informer/informare/information. Whether the occurrence is a quotation or a borrowed use does not change this constituent analysis. Exact whole form only, not a spelling substitution or global informal-prefix rule.')
decision('es','inform','informale','uncertain','native_or_foreign_head_ambiguity','Italian informale versus Spanish voseo informa + le',
 ['https://www.treccani.it/vocabolario/informale/','https://dle.rae.es/informar','https://www.rae.es/dpd/tilde'],
 'Investigated two competing valid analyses: Italian nonformal informale and Spanish voseo informá + le, which is correctly written informale because one enclitic makes it a plain word ending in a vowel. This inflection is a reviewer inference from the documented voseo paradigm and RAE enclitic accentuation. Corpus metadata has no sentence or sense annotation to choose. Preserve the exact saved spelling and genuine uncertainty; neither the Italian identity nor the Spanish inflection alone is decisive.')
decision('de','inform','informel','uncertain','spelling_or_foreign_head_ambiguity','French informel versus defective German informell homonyms',
 ['https://www.dictionnaire-academie.fr/article/A9I1224','https://www.duden.de/rechtschreibung/informell_formlos','https://www.duden.de/rechtschreibung/informell_informierend'],
 'Investigated French nonformal informel and the possibility of a one-letter-defective German informell. Duden separately attests information-related and nonformal informell homonyms. Original sentences and sense annotations are absent. Spelling-defect interpretation is a hypothesis, not a repaired source record; actual information membership cannot be certified or ruled out from aggregate frequencies.')

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()

def main(out):
    pending_bytes=(PRIOR/'pending-review.json').read_bytes()
    old_pending=json.loads(pending_bytes)['records']
    inventory=json.loads((PRIOR/'inventory.json').read_text())
    assert sha(pending_bytes)==inventory['artifact_sha256']['pending-review.json']
    assert len(old_pending)==553
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
    cumulative={'accepted':6+counts['accepted'],'excluded':155+counts['excluded'],'uncertain':48+counts['uncertain'],'pending_review':len(remaining)}
    assert sum(cumulative.values())==762
    ledger={'schema_version':1,'source_run_id':35647932153,'previous_pending_sha256':sha(pending_bytes),
            'source_candidate_sha256':sha(source_bytes),'decisions':delta,'new_counts':dict(counts),
            'continuation_counts':cumulative,'accepted_applied':6,'accepted_unapplied':counts['accepted'],'runtime_changes':False,'full_family_certification':False,
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

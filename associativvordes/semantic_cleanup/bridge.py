"""Finite dictionary-sense questions for the existing offline annotation engine."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from associativvordes.national_correspondences.registry import read,filehash,digest
from associativvordes.semantic_cleanup.policy import restore_cases

def load_queue(path):
    path=Path(path);manifest=read(path/'MANIFEST.json')
    if manifest['schema']!='semantic-review-release/1':raise ValueError('semantic manifest version')
    if manifest['version']!=digest({k:v for k,v in manifest.items() if k!='version'}):raise ValueError('semantic manifest identity')
    for name,h in manifest['outputs'].items():
        if Path(name).name!=name or filehash(path/name)!=h:raise ValueError('semantic artifact checksum/path')
    audit=ROOT/'audit/associative-v5-semantic-cleanup'
    if manifest.get('lexical_senses_sha256')!=filehash(audit/'LEXICAL-SENSES.json') or manifest.get('dictionary_sources_sha256')!=filehash(audit/'DICTIONARY-SOURCES.json'):
        raise ValueError('stale or unavailable dictionary authority catalog')
    catalog={s['id']:s for s in read(audit/'LEXICAL-SENSES.json')['senses']}
    source_catalog={s['id']:s for s in read(audit/'DICTIONARY-SOURCES.json')['sources']}
    cases=restore_cases((path/'SEMANTIC-CASES.ndjson').read_bytes())
    questions=read(path/'QUESTIONS.json')['questions']
    if len(questions)!=len(cases) or len({q['id'] for q in questions})!=len(questions):raise ValueError('semantic scope/sense loss')
    cases_by_id={c['id']:c for c in cases}
    for q in questions:
        c=cases_by_id[q['id']];s=c['scope'];sense=c['dictionary_sense']
        if sense!=catalog.get(sense['id']):raise ValueError('invented or altered dictionary sense')
        if q['source_family_id']!=s['family_id'] or q['source_lemma_id']!=s['lemma_id'] or q['language']!=s['language']:raise ValueError('semantic legacy scope mismatch')
        if len(q['lexeme_alternatives'])!=1 or len(q['lexeme_alternatives'][0]['verified_senses'])!=1 or q['lexeme_alternatives'][0]['verified_senses'][0]['id']!=sense['id']:raise ValueError('sense coalescing')
        expected_evidence=[dict(id='dictionary:'+ref,source_receipt=source_catalog[ref],meaning_status='DICTIONARY_ONLY_NOT_CORPUS_BINDING') for ref in sense['source_refs']]
        if q.get('evidence_refs')!=expected_evidence:raise ValueError('dictionary evidence receipt differs from pinned catalog')
        lex=q['lexeme_alternatives'][0]
        if lex['verified_senses'][0]!=dict(id=sense['id'],gloss=sense['gloss'],evidence_refs=['dictionary:'+ref for ref in sense['source_refs']]):
            raise ValueError('invented sense gloss or citation')
        if lex['id']!='lexeme:'+digest([sense['language'],sense['id'],sense['source_refs']]):raise ValueError('dictionary lexical ID')
    identity=dict(kind='semantic09',source_version=manifest['version'],manifest_sha256=filehash(path/'MANIFEST.json'),input_sha256=filehash(path/'QUESTIONS.json'),dictionary_scope='DOCUMENTED_DICTIONARY_SENSES_NOT_VERIFIED_CORPUS_IDENTITIES')
    return questions,identity

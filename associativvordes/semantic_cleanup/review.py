"""Join finite documentary senses to exact legacy rows as unresolved candidates."""
import argparse
from collections import Counter,defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from associativvordes.national_correspondences.registry import canonical,filehash,read,digest,Registry
from associativvordes.national_correspondences.audit import atomic
from associativvordes.semantic_cleanup.native import records
from associativvordes.semantic_cleanup.policy import case_id,triage,export_cases,restore_cases
from associativvordes.semantic_cleanup.history import load
from associativvordes.semantic_cleanup.scan import compressed

def build(scan,native,output):
    scan=Path(scan).resolve();native=Path(native).resolve();out=Path(output).resolve()
    if out.is_relative_to(ROOT):raise ValueError('research release outside Git')
    out.mkdir(parents=True,exist_ok=True);audit=ROOT/'audit/associative-v5-semantic-cleanup'
    sources=read(audit/'DICTIONARY-SOURCES.json');senses=read(audit/'LEXICAL-SENSES.json')['senses']
    byword=defaultdict(list)
    for sense in senses:byword[(sense['language'],sense['lemma'])].append(sense)
    for source in sources['sources']:
        if hashlib.sha256(source['excerpt'].encode()).hexdigest()!=source['excerpt_sha256']:raise ValueError('documentary capture checksum')
    sm=read(scan/'MANIFEST.json');nm=read(native/'MANIFEST.json');h=load();correspondences=Registry(ROOT/'audit/associative-national-correspondences')
    cases=[];questions=[];triage_rows=[];cache={};scope_counts=Counter();legacy_overlap=0
    config_sources={s['id']:s for s in sources['sources']}
    for part in sm['parts']:
        path=scan/(part['bucket']+'.ndjson.gz')
        if filehash(path)!=part['sha256']:raise ValueError('changed semantic scan')
        for line in gzip.open(path,'rt'):
            row=json.loads(line);alternatives=byword.get((row['language'],row['word']),[]);case_ids=[];statuses=[]
            for sense in alternatives:
                scope={k:row[k] for k in ('family_id','language','lemma_id','word')};scope['source_version']=sm['identity']['production_commit']
                sid=case_id(scope,sense['id']);case_ids.append(sid)
                constraint=h.check(dict(operation='delete',family_id=scope['family_id'],language=scope['language'],lemma_ids=[scope['lemma_id']],pos=sense['pos'],sense_id=None))
                positive=[o for o in constraint.get('historical_outcomes',[]) if o['outcome']=='CONFIRMED_MEMBER']
                protection=correspondences.check(dict(scope,operation='delete',pos=None,sense_id=None))
                case=dict(schema='interal-semantic-case/1',id=sid,scope=scope,dictionary_sense=sense,original_record_ref=dict(path='associativvordes/family-index-v5/members/'+row['language']+'/'+row['bucket']+'.json.gz',family_id=row['family_id'],ordinal=row['ordinal'],record_sha256=row['record_sha256']),upstream_question_id='v5q:'+digest([scope['family_id'],scope['language'],scope['lemma_id']]),
                    corpus_binding=None,source_facts=sense['source_refs'],llm_answers=[],independent_dictionary_refs=sense['source_refs'],human_decisions=[],history_check=constraint,positive_historical_decisions=positive,correspondence_check=protection,production_application_authorized=False)
                # Preserve the adapter's existing question identity exactly.
                from associativvordes.v5_adapter.common import qid
                case['upstream_question_id']=qid(scope['family_id'],scope['language'],scope['lemma_id'])
                status=triage(case,alternatives);case['status']=status;cases.append(case);statuses.append(status)
                key=(row['language'],row['word'])
                if key not in cache:cache[key]=list(records(native,*key))
                external=cache[key]
                evidence=[dict(id='dictionary:'+ref,source_receipt=config_sources[ref],meaning_status='DICTIONARY_ONLY_NOT_CORPUS_BINDING') for ref in sense['source_refs']]
                evidence += [dict(id=r['id'],artifact=r['body']['artifact'],revision=r['body']['revision'],raw_locator=r['body']['raw_locator'],interpretation='SAME_SPELLING_NATIVE_ALTERNATIVE_NOT_SENSE_IDENTITY') for r in external]
                lex=dict(id='lexeme:'+digest([sense['language'],sense['id'],sense['source_refs']]),lemma=row['word'],original_spelling=sense['original_form'],language=row['language'],pos=sense['pos'],verified_senses=[dict(id=sense['id'],gloss=sense['gloss'],evidence_refs=['dictionary:'+ref for ref in sense['source_refs']])],index_identity_status='DICTIONARY_TO_CORPUS_IDENTITY_UNRESOLVED',corpus_lemma_ids=[])
                questions.append(dict(id=sid,upstream_question_id=case['upstream_question_id'],family='family:legacy-v5:'+hashlib.sha256(row['family_id'].encode()).hexdigest(),source_family_id=row['family_id'],source_lemma_id=row['lemma_id'],original_record_ref=case['original_record_ref'],language=row['language'],lemma=row['word'],pos_status='dictionary_only',lexeme_alternatives=[lex],discovery_paths=[],evidence_refs=evidence,external_rows=external,guard=dict(status='hold',reason='UNRESOLVED_CORPUS_SENSE_AND_HISTORY'),existing_memberships=[dict(kind='legacy_membership_not_gold',scope=scope)],conflicts=dict(competing_families=[]),independence=dict(status='unknown; shared dataset origins not independent confirmations')))
            status='SENSE_SPLIT_REQUIRED' if 'SENSE_SPLIT_REQUIRED' in statuses else ('HISTORICAL_BUT_SEMANTICALLY_UNRESOLVED' if 'HISTORICAL_BUT_SEMANTICALLY_UNRESOLVED' in statuses else 'INSUFFICIENT_EVIDENCE')
            scope_counts[status]+=1
            triage_rows.append(dict(family_id=row['family_id'],language=row['language'],lemma_id=row['lemma_id'],word=row['word'],status=status,semantic_question_ids=case_ids,membership_operation='NONE'))
    data=export_cases(cases);assert export_cases(restore_cases(data))==data
    atomic(out/'SEMANTIC-CASES.ndjson',data);atomic(out/'QUESTIONS.json',canonical(dict(questions=sorted(questions,key=lambda q:q['id'])))+b'\n')
    atomic(out/'MEMBERSHIP-TRIAGE.ndjson.gz',compressed(triage_rows))
    for name in ('PROPOSED-MEMBERSHIP-CORRECTIONS.ndjson','PROPOSED-RELATION-CORRECTIONS.ndjson'):atomic(out/name,b'')
    outputs={name:filehash(out/name) for name in ('SEMANTIC-CASES.ndjson','QUESTIONS.json','MEMBERSHIP-TRIAGE.ndjson.gz','PROPOSED-MEMBERSHIP-CORRECTIONS.ndjson','PROPOSED-RELATION-CORRECTIONS.ndjson')}
    manifest=dict(schema='semantic-review-release/1',source_commit=sm['identity']['production_commit'],scan_manifest_sha256=filehash(scan/'MANIFEST.json'),native_manifest_sha256=filehash(native/'MANIFEST.json'),dictionary_sources_sha256=filehash(audit/'DICTIONARY-SOURCES.json'),lexical_senses_sha256=filehash(audit/'LEXICAL-SENSES.json'),history_sha256=h.digest,correspondence_registry_sha256=correspondences.sha256,outputs=outputs,counts=dict(memberships=len(triage_rows),dictionary_context_questions=len(cases),by_membership_status=dict(scope_counts),by_question_status=dict(Counter(c['status'] for c in cases))),production_writes=0)
    manifest['version']=digest(manifest);atomic(out/'MANIFEST.json',canonical(manifest)+b'\n');return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--scan',required=True);p.add_argument('--native',required=True);p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(build(a.scan,a.native,a.output)['counts']))

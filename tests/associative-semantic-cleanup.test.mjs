import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('sense-specific semantic decisions require exact independent authority and both guards',()=>{
const code=String.raw`
import copy,json,tempfile,pathlib,sys
from associativvordes.semantic_cleanup.policy import *
senses=json.load(open('audit/associative-v5-semantic-cleanup/LEXICAL-SENSES.json'))['senses']
def case(sid):
 sense=next(s for s in senses if s['id']=='dict-sense:'+sid)
 scope=dict(family_id='ety:1e7afcab5044',language=sense['language'],lemma_id='lemma:test',word=sense['lemma'],source_version='locked-source')
 return dict(id=case_id(scope,sense['id']),scope=scope,dictionary_sense=sense,corpus_binding=None,production_application_authorized=False)
a=case('en-sound-audio');water=case('en-sound-water');healthy=case('en-sound-healthy')
assert a['id']!=water['id'] and a['dictionary_sense']['pos']==water['dictionary_sense']['pos']=='NOUN'
assert healthy['id']!=a['id']
assert triage(a,[a['dictionary_sense'],water['dictionary_sense']])=='SENSE_SPLIT_REQUIRED'
data=export_cases([a,water,healthy]);restored=restore_cases(data);assert len(restored)==3 and export_cases(restored)==data
assert len({c['id'] for c in restored})==3
# An old lemma ID, shared spelling/POS, historical relation or model confidence is not a sense binding.
for requested in FINAL:
 assert adjudicate(a,requested)['status']=='INSUFFICIENT_EVIDENCE'
 assert adjudicate(dict(a,model_confidence=1),requested)['status']=='INSUFFICIENT_EVIDENCE'
q=copy.deepcopy(a);q.update(corpus_binding=dict(q['scope'],dictionary_sense_id=q['dictionary_sense']['id'],pos='NOUN',corpus_sense_id='independently-bound-test-sense'),all_alternative_paths_reviewed=True,family_target_meaning_ref='test-only-reviewed-root',positive_contradiction_refs=['test-only-proof'])
clear=lambda c:dict(allowed=True,status='CLEAR')
verifier=lambda h:dict(authority='INDEPENDENT_GOLD',payload_sha256=h,status='APPROVED')
assert adjudicate(q,'MEMBERSHIP_CONFIRMED',verifier,clear)['status']=='MEMBERSHIP_CONFIRMED'
assert adjudicate(q,'MEMBERSHIP_CONFIRMED',None,clear)['status']=='INSUFFICIENT_EVIDENCE'
assert adjudicate(q,'MEMBERSHIP_REJECT_PROPOSED',verifier,clear)['status']=='INSUFFICIENT_EVIDENCE'
assert adjudicate(q,'MEMBERSHIP_REJECT_PROPOSED',verifier,clear,lambda c:dict(allowed=False,status='BLOCKED_DOCUMENTED_CORRESPONDENCE'))['status']=='INSUFFICIENT_EVIDENCE'
assert adjudicate(q,'MEMBERSHIP_REJECT_PROPOSED',verifier,clear,clear)['membership_operation']=='NONE'
assert adjudicate(q,'MEMBERSHIP_CONFIRMED',verifier,lambda c:dict(allowed=False,status='HISTORY_UNAVAILABLE'))['status']=='INSUFFICIENT_EVIDENCE'
for authority in ['RESEARCH_HYPOTHESIS','ENGINEERING_CHECK','OWNER_ACCEPTED_AT_RISK']:
 assert adjudicate(q,'MEMBERSHIP_CONFIRMED',lambda h:dict(authority=authority,payload_sha256=h,status='APPROVED'),clear)['status']=='INSUFFICIENT_EVIDENCE'
for k,v in [('dictionary_sense_id',water['dictionary_sense']['id']),('pos','ADJ'),('family_id','other'),('language','de'),('source_version','stale')]:
 bad=copy.deepcopy(q);bad['corpus_binding'][k]=v
 assert adjudicate(bad,'MEMBERSHIP_CONFIRMED',verifier,clear)['status']=='INSUFFICIENT_EVIDENCE'
# The configured verifier must match the entire content, not a reusable signed boolean.
h=digest(dict(case=q,requested_status='MEMBERSHIP_CONFIRMED'))
frozen=lambda x:dict(authority='CONFIRMED_MANUAL',payload_sha256=h,status='APPROVED') if x==h else None
assert adjudicate(q,'MEMBERSHIP_CONFIRMED',frozen,clear)['status']=='MEMBERSHIP_CONFIRMED'
bad=copy.deepcopy(q);bad['dictionary_sense']['gloss']='invented meaning'
assert adjudicate(bad,'MEMBERSHIP_CONFIRMED',frozen,clear)['status']=='INSUFFICIENT_EVIDENCE'
bad=copy.deepcopy(q);bad['positive_contradiction_refs']=[]
assert adjudicate(bad,'MEMBERSHIP_REJECT_PROPOSED',verifier,clear,clear)['status']=='INSUFFICIENT_EVIDENCE'
try:export_cases([a,a])
except ValueError:pass
else:raise AssertionError('duplicate sense export accepted')
# Accent and source lexical identity are not normalized into each other.
gene=case('fr-gene-biology');gene2=case('fr-gene-discomfort');assert gene['scope']['word']!=gene2['scope']['word']
assert len(restore_cases(export_cases([gene,gene2])))==2
nettare=case('it-nettare-clean');nectar=case('it-nettare-nectar')
assert nettare['dictionary_sense']['pos']=='VERB' and nectar['dictionary_sense']['pos']=='NOUN'
assert nettare['id']!=nectar['id']
act=case('de-akt-nude');assert act['dictionary_sense']['family_relation']['ety:5bed7c192e10']=='HISTORICAL_SEMANTIC_BRIDGE_REVIEW'
assert all(s['corpus_identity_status']=='UNRESOLVED' and s['association_status']=='NOT_ASSESSED' for s in senses)
`;
const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
});

test('semantic release bridge preserves separate senses and fails on changed manifests',()=>{
const code=String.raw`
import tempfile,pathlib,json,copy
from associativvordes.semantic_cleanup.policy import *
from associativvordes.semantic_cleanup.bridge import load_queue
from associativvordes.national_correspondences.registry import filehash
senses=json.load(open('audit/associative-v5-semantic-cleanup/LEXICAL-SENSES.json'))['senses']
ss=[s for s in senses if s['id'] in {'dict-sense:en-sound-audio','dict-sense:en-sound-water'}]
sources={s['id']:s for s in json.load(open('audit/associative-v5-semantic-cleanup/DICTIONARY-SOURCES.json'))['sources']}
with tempfile.TemporaryDirectory() as td:
 root=pathlib.Path(td);cases=[];questions=[]
 for s in ss:
  scope=dict(family_id='ety:1e7afcab5044',language='en',lemma_id='lemma:fixed',word='sound',source_version='locked')
  c=dict(id=case_id(scope,s['id']),scope=scope,dictionary_sense=s,production_application_authorized=False);cases.append(c)
  questions.append(dict(id=c['id'],source_family_id=scope['family_id'],source_lemma_id=scope['lemma_id'],language='en',evidence_refs=[dict(id='dictionary:'+ref,source_receipt=sources[ref],meaning_status='DICTIONARY_ONLY_NOT_CORPUS_BINDING') for ref in s['source_refs']],lexeme_alternatives=[dict(id='lexeme:'+digest([s['language'],s['id'],s['source_refs']]),verified_senses=[dict(id=s['id'],gloss=s['gloss'],evidence_refs=['dictionary:'+r for r in s['source_refs']])])]))
 (root/'SEMANTIC-CASES.ndjson').write_bytes(export_cases(cases));(root/'QUESTIONS.json').write_bytes(canonical(dict(questions=questions))+b'\n')
 manifest=dict(schema='semantic-review-release/1',lexical_senses_sha256=filehash('audit/associative-v5-semantic-cleanup/LEXICAL-SENSES.json'),dictionary_sources_sha256=filehash('audit/associative-v5-semantic-cleanup/DICTIONARY-SOURCES.json'),outputs={n:filehash(root/n) for n in ['SEMANTIC-CASES.ndjson','QUESTIONS.json']});manifest['version']=digest(manifest);(root/'MANIFEST.json').write_bytes(canonical(manifest))
 qs,identity=load_queue(root);assert len(qs)==2 and qs[0]['id']!=qs[1]['id'] and identity['kind']=='semantic09'
 # Recomputing a self-authored manifest cannot authorize an invented dictionary gloss.
 altered=copy.deepcopy(cases);altered[0]['dictionary_sense']['gloss']='invented entry'
 (root/'SEMANTIC-CASES.ndjson').write_bytes(export_cases(altered))
 manifest['outputs']['SEMANTIC-CASES.ndjson']=filehash(root/'SEMANTIC-CASES.ndjson')
 manifest['version']=digest({k:v for k,v in manifest.items() if k!='version'})
 (root/'MANIFEST.json').write_bytes(canonical(manifest))
 try:load_queue(root)
 except ValueError:pass
 else:raise AssertionError('self-authored dictionary sense accepted')
 (root/'QUESTIONS.json').write_text('{}')
 try:load_queue(root)
 except ValueError:pass
 else:raise AssertionError('changed export accepted')
`;
const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
});

test('frozen semantic inventory keeps documentary facts, old IDs and unresolved senses separate',()=>{
const code=String.raw`
import json,pathlib,hashlib,collections
from associativvordes.semantic_cleanup.policy import restore_cases
root=pathlib.Path('audit/associative-v5-semantic-cleanup')
cases=restore_cases((root/'SEMANTIC-CASES.ndjson').read_bytes())
assert len(cases)==67 and len({c['id'] for c in cases})==67
assert all(c['corpus_binding'] is None and not c['human_decisions'] and not c['llm_answers'] for c in cases)
assert all(c['upstream_question_id'] for c in cases)
assert all(c['history_check']['allowed'] is False for c in cases)
assert all(not c['production_application_authorized'] for c in cases)
scopes={(c['scope']['family_id'],c['scope']['language'],c['scope']['lemma_id']) for c in cases}
assert len(scopes)==30
splits=[json.loads(x) for x in (root/'SENSE-SPLIT-QUEUE.ndjson').read_text().splitlines()]
assert len(splits)==27
assert all(s['membership_operation']=='NONE' for s in splits)
for name in ['PROPOSED-MEMBERSHIP-CORRECTIONS.ndjson','PROPOSED-RELATION-CORRECTIONS.ndjson']:
 assert (root/name).read_bytes()==b''
coverage=json.loads((root/'COVERAGE.json').read_text())
assert sum(coverage['membership_statuses'].values())==coverage['priority_memberships']==58821
assert coverage['human_memberships_confirmed']==coverage['production_writes']==0
assert len(coverage['uninstantiated_dictionary_senses'])==9
stats=json.loads((root/'MODEL-AND-HUMAN-STATISTICS.json').read_text())
assert stats['human_new_decisions']==0
# A second dictionary is documentary corroboration, not a new human verdict.
r=json.loads((root/'DOCUMENTARY-RECHECK.json').read_text())
assert r['independent_human_review'] is False and len(r['sources'])==3
for s in r['sources']:assert s['excerpt_sha256']==hashlib.sha256(s['excerpt'].encode()).hexdigest()
`;
const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
});

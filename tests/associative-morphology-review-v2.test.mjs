import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('exact native scope and independent authority are required for semantic verdicts',()=>{
 const script=String.raw`
import sys,copy
sys.path.insert(0,'associativvordes/morphology_review')
from policy import *
A=dict(id='1.0',artifact='source-A',revision='rev-A',language='en',lemma='act',pos='VERB',sense_id='do')
B=dict(A,id='2.0',lemma='action',pos='NOUN',sense_id='doing')
e=dict(id='e:1',artifact='source-A',artifact_sha256='a'*64,line=1,raw_sha256='b'*64)
p=dict(scope=dict(family_id='family:act',language='en',lemma_id='lemma:action',pos='NOUN',sense_id='doing'),native_binding=dict(head=A,member=B),steps=[dict(type='direct_derivation',direction='directed',**{'from':A,'to':B},evidence=e)],source_versions={'source-A':'a'*64},relation_type='direct_derivation',requested_status='CONFIRMED_RELATION',explanation='Fixture reviewed derivation',receipt_refs=['r'])
# This fixture simulates an external registry with one exact payload grant.
h=digest({k:v for k,v in p.items() if k!='receipt_refs'})
def verifier(ref,want):return dict(payload_sha256=h,authority='INDEPENDENT_GOLD',status='APPROVED') if ref=='r' and want==h else None
assert adjudicate(p)['status']=='INSUFFICIENT_EVIDENCE'
assert adjudicate(dict(p,model_confidence=1,identity_verified=True))['status']=='INSUFFICIENT_EVIDENCE'
assert adjudicate(p,verifier)['status']=='CONFIRMED_RELATION'
for authority in ['RESEARCH_HYPOTHESIS','OWNER_ACCEPTED_AT_RISK','ENGINEERING_CHECK','BOUNDED_OPERATION']:
 assert adjudicate(p,lambda r,w:dict(payload_sha256=w,authority=authority,status='APPROVED'))['status']=='INSUFFICIENT_EVIDENCE'
# Altered scope, evidence or source version cannot reuse the receipt.
for key,value in [('scope',dict(p['scope'],family_id='other')),('source_versions',{'source-A':'c'*64}),('native_binding',dict(p['native_binding'],member=dict(B,sense_id='homonym')))]:
 q=copy.deepcopy(p);q[key]=value;assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
# An ID shared between artifacts/revisions/languages/senses cannot bridge paths.
C=dict(B,id='3.0',lemma='actionable')
for changed in [dict(B,artifact='other'),dict(B,revision='other'),dict(B,language='de'),dict(B,sense_id='other'),dict(B,pos='VERB')]:
 q=copy.deepcopy(p);q['relation_type']='indirect_derivation';q['steps'].append(dict(type='suffixation',direction='directed',**{'from':changed,'to':C},evidence=e));q['native_binding']['member']=C
 assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
q=copy.deepcopy(p);q['steps'][0]['type']='common_ancestor';assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
q=copy.deepcopy(p);q['steps'][0]['direction']='unknown';assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
q=copy.deepcopy(p);q['steps'][0]['type']='compounding';q['relation_type']='compounding';assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
q=copy.deepcopy(p);q['steps'][0]['type']='allomorphy';q['steps'][0]['to']['language']='de';assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
q=copy.deepcopy(p);q['requested_status']='COMPETING_ANALYSES';q['analyses']=['direct_derivation','suffixation'];assert adjudicate(q,verifier)['status']=='INSUFFICIENT_EVIDENCE'
assert not guard_application({})['allowed']
assert not guard_application({},lambda q:dict(allowed=True,status='HISTORY_UNAVAILABLE'))['allowed']
assert not guard_application({},lambda q:dict(allowed=False,status='HISTORY_CONFLICT'))['allowed']
assert not guard_application({},lambda q:dict(allowed=True,status='CLEAR'))['allowed']
assert guard_application({},lambda q:dict(allowed=True,status='CLEAR'),lambda q:dict(allowed=True,status='CLEAR'))['allowed']
# No relationship ruling automatically deletes membership, even if its type is wrong.
assert adjudicate(p,verifier)['membership_operation']=='NONE'
for mask in [0,1,1|256,1|4,512]:
 assert 'NATIVE_LEXEME_UNBOUND' in unresolved_reasons(mask,1,[],[])
`;
 const r=spawnSync('python3',['-c',script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('finite documentary registry protects exact senses without promoting legacy membership', () => {
 const code=String.raw`
import copy,json,pathlib,tempfile,hashlib,shutil,sys
from associativvordes.national_correspondences.registry import *
from associativvordes.national_correspondences.audit import audit,REQUIRED,STAGES
sys.path.insert(0,'associativvordes/morphology_review')
from associativvordes.morphology_review.policy import guard_application
folder=pathlib.Path('audit/associative-national-correspondences');r=Registry(folder)
assert len(r.roots)==8 and len(r.registry['entries'])==27
assert r.mappings['family:pede']=='family:ped' and 'family:ped' not in r.mappings
assert r.roots['family:inter']['element_kind']=='preposition'
assert r.roots['family:manu']['normative_form']=='manu'
clear=lambda p:dict(allowed=True,status='CLEAR')
def prop(fid='family:manu',lang='ru',word='маникюр',**kw):
 return dict(operation='delete',family_id=fid,language=lang,word=word,lemma_id='test-only-id',source_version=r.registry['production_source_commit'],**kw)
for fid,lang,word in [('family:manu','ru','маникюр'),('family:manu','fr','manucure'),('family:manu','en','manicure'),('family:manu','de','Maniküre'),('family:regul','fr','règlement'),('family:regul','ru','регламент'),('family:creat','en','create'),('family:creat','fr','création'),('family:creat','de','Kreation'),('family:creat','ru','креативный'),('family:ocul','de','Monokel'),('family:ocul','fr','œil'),('family:pede','fr','pédicure'),('family:inter','fr','interposer'),('family:mut','fr','mutation')]:
 check=r.check(prop(fid,lang,word),clear)
 assert not check['allowed'] and check['matches'], (fid,word,check)
# Exact old lowercase carrier is held without enabling general German case folding.
q=prop('family:ocul','de','monokel');q['lemma_id']='lemma:274ced6b7dab9fb4ae00'
assert r.check(q)['matches']==['ocul-de-monokel:EXACT_LEGACY_IDENTITY_HOLD']
q['lemma_id']='different';assert not r.check(q)['matches']
# Unknown sense/POS holds; a documented different sense never inherits the positive.
p=prop(pos='NOUN',sense_id='v5-sense',dictionary_sense_id='manu-ru-manik:sense')
assert r.check(p,clear)['matches']==['manu-ru-manik']
assert not r.check(prop(pos='VERB',sense_id='hedge-trimming'),clear)['matches']
assert not r.check(prop(dictionary_sense_id='different-sense'),clear)['matches']
# No global manu->mani, regul->regl, accent stripping, case folding or wildcard.
for fid,lang,word in [('family:manu','ru','манифест'),('family:regul','en','reglwhatever'),('family:creat','fr','creation'),('family:creat','ru','креатин'),('family:manu','it','маникюр'),('family:other','ru','маникюр'),('family:mut','de','Mut'),('family:pede','fr','pédagogie')]:
 check=r.check(prop(fid,lang,word),clear)
 assert not check['matches'] and not check['allowed']
# Refuting a single etymological path does not confer nonmembership.
assert r.check(prop('family:mut','de','Mut'),clear)['allowed'] is False
assert r.check(prop('family:liber','fr','libraire'),clear)['matches']
assert r.check(prop('family:liber','fr','unknown'),clear)['status']=='TARGET_SENSE_UNRESOLVED'
q=prop();q['source_version']='different';assert not r.check(q,clear)['allowed']
q=prop();q['family_namespace']='v6';assert not r.check(q,clear)['allowed']
q=prop();q['operation']='REJECT_ENTIRE_FAMILY';assert not r.check(q,clear)['allowed']
# Competing routes survive serialization, source status is separate from final verdict.
reg=next(e for e in r.registry['entries'] if e['id']=='regul-ru-reglament')
assert len(reg['alternative_paths'])==2 and reg['membership_status']=='UNRESOLVED'
assert all(e['association_status']=='NOT_ASSESSED' for e in r.registry['entries'])
# No match requires exact independent authority and active history, never model confidence.
p=prop('family:mut','fr','muter',pos='VERB',sense_id='change')
assert r.check(p)['status']=='HISTORY_UNAVAILABLE'
assert not r.check(dict(p,model_confidence=1),clear)['allowed']
release=lambda h:dict(authority='INDEPENDENT_GOLD',status='APPROVED',payload_sha256=h)
assert r.check(p,clear,release)['allowed']
assert not r.check(p,lambda p:dict(allowed=False,status='HISTORY_CONFLICT'),release)['allowed']
assert not r.check(p,lambda p:dict(allowed=False,status='CONFIRMED_POSITIVE'),release)['allowed']
assert not r.check(p,clear,lambda h:dict(authority='OWNER_ACCEPTED_AT_RISK',status='APPROVED',payload_sha256=h))['allowed']
assert not r.check(prop(),clear,release)['allowed']
assert not guard_application(p,clear)['allowed']
assert guard_application(p,clear,lambda p:r.check(p,clear,release))['allowed']
assert not guard_application(prop(),clear,lambda p:r.check(p,clear,release))['allowed']
# Every finite row must be checked; sample/hash/order differences hold a family operation.
rows=[p,dict(p,lemma_id='second-id')]
h=hashlib.sha256(b''.join(canonical(x)+b'\n' for x in rows)).hexdigest()
assert finite_scope_guard(r,iter(rows),2,h,clear,release)['allowed']
assert not finite_scope_guard(r,iter(rows[:1]),2,h,clear,release)['allowed']
assert not finite_scope_guard(r,iter(reversed(rows)),2,h,clear,release)['allowed']
assert not finite_scope_guard(r,iter([prop()]),1,hashlib.sha256(canonical(prop())+b'\n').hexdigest(),clear,release)['allowed']
dups=[p,p];dh=hashlib.sha256(b''.join(canonical(x)+b'\n' for x in dups)).hexdigest()
assert not finite_scope_guard(r,iter(dups),2,dh,clear,release)['allowed']
# Invalid schema, broadened scope, broken chain, source tampering all fail closed.
for mutate in [lambda d:d['entries'][0]['scope'].update(regular_language_rule=True),lambda d:d['entries'][0].update(normative_form='mani'),lambda d:d['entries'][0]['lexeme'].update(lemma='mani*'),lambda d:d['entries'][1]['path'][1].update(from_form='homonym'),lambda d:d['entries'][0].update(membership_status='CONFIRMED_MEMBER')]:
 d=copy.deepcopy(r.registry);mutate(d)
 try:validate(d,r.receipts)
 except ValueError:pass
 else:raise AssertionError('malformed registry accepted')
with tempfile.TemporaryDirectory() as td:
 td=pathlib.Path(td)
 assert not preflight(td,p)['allowed']
 for name in ('CURRENT.json','NATIONAL-CORRESPONDENCE-REGISTRY.json','SOURCE-RECEIPTS.json'):shutil.copy(folder/name,td/name)
 (td/'SOURCE-RECEIPTS.json').write_text('{}')
 assert preflight(td,p)['status']=='CORRESPONDENCE_REGISTRY_UNAVAILABLE'
# Audit is complete over known + newly discovered proposal files. Malformed,
# bulk and duplicate rows cannot become zero affected memberships or a release.
with tempfile.TemporaryDirectory() as td:
 repo=pathlib.Path(td)/'repo';(repo/'audit').mkdir(parents=True)
 shutil.copytree(folder,repo/'audit/associative-national-correspondences')
 for name in REQUIRED:
  dest=repo/'audit'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b'')
 data=repo/'audit/associative-v5-structural-cleanup/DATA-CHANGE-PROPOSAL.json'
 shutil.copy('audit/associative-v5-structural-cleanup/DATA-CHANGE-PROPOSAL.json',data)
 result=audit(repo,pathlib.Path(td)/'first');assert result['physical_proposal_rows']==0 and result['actual_rescued_memberships']==0
 extra=repo/'audit/associative-v5-surface-cleanup/PROPOSED-NEW.ndjson'
 extra.write_bytes(canonical(prop())+b'\n'+canonical(prop())+b'\n'+b'broken\n'+canonical(dict(operation='REJECT_ENTIRE_FAMILY',affected_memberships=[prop()]))+b'\n')
 result=audit(repo,pathlib.Path(td)/'second')
 assert result['physical_proposal_rows']==4 and result['unique_exact_membership_scopes']==1 and result['blocked_proposal_rows']==4 and result['unknown_membership_scopes']==2
 assert result['documentary_match_rows']==2
 extra.unlink();(repo/'audit'/next(iter(REQUIRED))).unlink()
 try:audit(repo,pathlib.Path(td)/'third')
 except ValueError:pass
 else:raise AssertionError('missing history accepted')
print('finite scope, historical alternatives, compound carriers, homonyms, authority, integrity, complete manifest discovery: passed')
`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});


test('independent JavaScript verifies the locked registry and every proposal manifest', () => {
 const result=spawnSync(process.execPath,['associativvordes/national_correspondences/verify.mjs','.'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const receipt=JSON.parse(result.stdout);
 assert.equal(receipt.status,'PASS');assert.equal(receipt.proposal_rows,0);
 assert.equal(receipt.entries,27);assert.equal(receipt.sources,31);
});


import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const py=code=>{const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);};
test('4362693699: native structured membership scopes reach the proof gate',()=>py(String.raw`
from associativvordes.surface_cleanup.policy import authorize,scope_hash
ids=[['en','lemma:1'],['ru','lemma:2']]
p=dict(verified_existing_review_receipt=True,authority='INDEPENDENT_GOLD',independent_source_adapter_verified=True,all_native_identity_and_sense_bindings_verified=True,all_competing_paths_adjudicated=True,negative_scope_sha256=scope_hash(ids),source_version_matches=True)
checker=lambda ids,h:dict(allowed=True,status='CLEAR',scope_sha256=h,memberships_checked=len(ids),registry_sha256='a'*64)
assert authorize('REJECT_ENTIRE_FAMILY',ids,ids,p,dict(allowed=True,status='CLEAR'),lambda p:True,checker)
assert not authorize('REJECT_ENTIRE_FAMILY',ids,ids[:1],p,dict(allowed=True,status='CLEAR'),lambda p:True,checker)
assert not authorize('REMOVE_EXACT_MEMBERSHIPS',ids,ids+ids,p,dict(allowed=True,status='CLEAR'),lambda p:True,checker)
`));
test('4359927831: diagnostic reader checks every output pinned by manifest',()=>py(String.raw`
import sys,tempfile,json,sqlite3
from pathlib import Path
sys.path[:0]=['associativvordes/v5_diagnostics/tools','associativvordes/v5_diagnostics']
from query import open_registry,filehash
from classify import canonical,digest
with tempfile.TemporaryDirectory() as td:
 p=Path(td);sqlite3.connect(p/'registry.sqlite').close();(p/'SUMMARY.json').write_text('{}')
 m=dict(database='registry.sqlite',database_sha256=filehash(p/'registry.sqlite'),complete=True,outputs={'SUMMARY.json':filehash(p/'SUMMARY.json')});m['version']=digest(m);(p/'MANIFEST.json').write_bytes(canonical(m))
 c,_=open_registry(p);c.close();(p/'SUMMARY.json').write_text('changed')
 try:open_registry(p)
 except ValueError:pass
 else:raise AssertionError('unpinned summary accepted')
`));
test('4363144017: archive rejects a missing configured source',()=>py(String.raw`
import tempfile,subprocess,json
from pathlib import Path
with tempfile.TemporaryDirectory() as td:
 p=Path(td);(p/'config').write_text(json.dumps(dict(entries=[dict(source=str(p/'missing'),prefix='originals')])))
 result=subprocess.run(['python3','scripts/archive-v5-morphology.py','--config',str(p/'config'),'--output',str(p/'out.zip'),'--restore',str(p/'restored'),'--receipt',str(p/'receipt')],capture_output=True)
 assert result.returncode!=0 and not (p/'out.zip').exists()
`));

test('4363143999: cached profile verification hashes the current SQLite bytes',()=>py(String.raw`
import tempfile,json,importlib.util
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('profile_verifier','scripts/verify-v5-morphology-profiles.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as td:
 p=Path(td);profiles=p/'profiles';profiles.mkdir();out=p/'out';out.mkdir();(profiles/'00.sqlite').write_bytes(b'original');h=m.filehash(profiles/'00.sqlite')
 (profiles/'MANIFEST.json').write_text(json.dumps(dict(parts=[dict(sha256=h)])))
 (out/'00.json').write_text(json.dumps(dict(raw_sha256='raw',profile_sha256=h,counts={})))
 class E:
  parts=[dict(artifact=dict(id='TEST_ONLY'),database_sha256='raw')];identity='test'
 (profiles/'00.sqlite').write_bytes(b'changed')
 with patch.object(m,'External',lambda *args:E()):
  try:m.verify(p,p,profiles,out)
  except ValueError:pass
  else:raise AssertionError('corrupt profile accepted through cached verification')
`));
test('4362693732: scanner refuses output inside its immutable snapshot before writing',()=>py(String.raw`
import sys,tempfile,importlib.util
from pathlib import Path
sys.path[:0]=['associativvordes/surface_cleanup','associativvordes/structural_cleanup']
import run
with tempfile.TemporaryDirectory() as td:
 snap=Path(td)/'snapshot';snap.mkdir();out=snap/'output'
 try:run.scan(Path('.'),snap,out)
 except ValueError:pass
 else:raise AssertionError('overlapping immutable snapshot output accepted')
 assert not out.exists()
`));
test('4367043678: historical blind tasks retain observed word and locked locator',()=>py(String.raw`
import json,sqlite3
from pathlib import Path
from associativvordes.cleanup_quality.prepare import challenges,digest
p=Path('audit/associative-history-registry');pointer=json.loads((p/'CURRENT.json').read_text());s=json.loads((p/pointer['snapshot']).read_text())
h=next(d for d in s['decisions'] if d['decision']=='CONFIRMED_NONMEMBER' and d['scope'].get('lemma_ids'))
d=sqlite3.connect(':memory:');d.executescript('CREATE TABLE families(f INTEGER,fid TEXT,n INTEGER,meta TEXT,bucket TEXT);CREATE TABLE members(f INTEGER,lang TEXT,lid TEXT,ordinal INTEGER,record_hash TEXT);CREATE TABLE aliases(alias TEXT,fid TEXT);CREATE TABLE history(id TEXT,body TEXT);');d.execute('INSERT INTO history VALUES(?,?)',(h['id'],json.dumps(h)))
ordinary,historical=challenges(d);assert not ordinary and len(historical)==1
case=historical[0];assert case['word'] and case['source_record']['word']==case['word'] and case['source_record']['source_refs'][0]['artifact']=='HISTORICAL-LEXICAL-CONTEXTS.json'
assert not {'decision','verdict','explanation','reason'}&set(case['source_record'])
observed={k:v for k,v in case['source_record'].items() if k!='source_refs'};assert case['source_record']['source_refs'][0]['sha256']==digest(observed)
assert 'baseline-excluded' not in json.dumps(case['source_record'])
`));
test('4365260804: rehashed dictionary receipts are rejected',()=>py(String.raw`
import tempfile,json,copy
from pathlib import Path
from associativvordes.semantic_cleanup.bridge import load_queue,digest,filehash,ROOT
from associativvordes.semantic_cleanup.policy import export_cases,case_id
source=ROOT/'audit/associative-v5-semantic-cleanup';sense=json.loads((source/'LEXICAL-SENSES.json').read_bytes())['senses'][0]
refs=sense['source_refs'];sources={s['id']:s for s in json.loads((source/'DICTIONARY-SOURCES.json').read_bytes())['sources']}
scope=dict(family_id='TEST_ONLY',language=sense['language'],lemma_id='lemma:TEST_ONLY',word=sense['lemma'],source_version='TEST_ONLY')
c=dict(id=case_id(scope,sense['id']),scope=scope,dictionary_sense=sense,corpus_binding=None,production_application_authorized=False)
lex=dict(id='lexeme:'+digest([sense['language'],sense['id'],refs]),verified_senses=[dict(id=sense['id'],gloss=sense['gloss'],evidence_refs=['dictionary:'+ref for ref in refs])])
q=dict(id=c['id'],source_family_id=scope['family_id'],source_lemma_id=scope['lemma_id'],language=scope['language'],lexeme_alternatives=[lex],evidence_refs=[dict(id='dictionary:'+ref,source_receipt=copy.deepcopy(sources[ref]),meaning_status='DICTIONARY_ONLY_NOT_CORPUS_BINDING') for ref in refs])
with tempfile.TemporaryDirectory() as td:
 p=Path(td);(p/'SEMANTIC-CASES.ndjson').write_bytes(export_cases([c]));(p/'QUESTIONS.json').write_text(json.dumps(dict(questions=[q])))
 m=dict(schema='semantic-review-release/1',lexical_senses_sha256=filehash(source/'LEXICAL-SENSES.json'),dictionary_sources_sha256=filehash(source/'DICTIONARY-SOURCES.json'))
 def freeze():
  m['outputs']={n:filehash(p/n) for n in ['SEMANTIC-CASES.ndjson','QUESTIONS.json']};m['version']=digest({k:v for k,v in m.items() if k!='version'});(p/'MANIFEST.json').write_text(json.dumps(m))
 freeze();load_queue(p)
 q['evidence_refs'][0]['source_receipt']['excerpt']='FABRICATED';(p/'QUESTIONS.json').write_text(json.dumps(dict(questions=[q])));freeze()
 try:load_queue(p)
 except ValueError:pass
 else:raise AssertionError('fabricated dictionary statement accepted')
`));
test('4362693707: historical evidence-count mismatch is fatal',()=>py(String.raw`
import tempfile,json,gzip,hashlib,subprocess
from pathlib import Path
script=Path('associativvordes/surface_cleanup/historical_scope.mjs').resolve()
with tempfile.TemporaryDirectory() as td:
 p=Path(td);subprocess.run(['git','init','-q',str(p)],check=True)
 row=dict(lemma_id='L',word='word',components=[dict(evidence=[dict(type='surface',source='fixture')])]);raw=gzip.compress(json.dumps({'F':[row]}).encode(),mtime=0)
 blob=subprocess.check_output(['git','-C',str(p),'hash-object','-w','--stdin'],input=raw).decode().strip()
 h=hashlib.sha256(b'L\0word\n').hexdigest();history=dict(decisions=[dict(id='D',scope=dict(family_id='F',language='en',selector=dict(before=blob)),authority='TEST_ONLY')],sources=[dict(blob=blob,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())])
 audit=p/'audit/associative-history-registry';audit.mkdir(parents=True);(audit/'CURRENT.json').write_text(json.dumps(dict(snapshot='history.json')));(audit/'history.json').write_text(json.dumps(history))
 run=p/'run';run.mkdir();(run/'HISTORICAL-SCHEMES.json').write_text(json.dumps(dict(patterns=[dict(family_id='F',language='en',member_list_sha256=h,expected_members=1,expected_evidence={'surface:fixture':2},source_path='TEST_ONLY',pointer='/')])) )
 result=subprocess.run(['node',str(script),str(run),str(p/'result.json')],cwd=p,capture_output=True,text=True)
 assert result.returncode!=0 and 'evidence counts mismatch' in result.stderr
`));
test('4368023514: changed production tree has unknown current counts',()=>py(String.raw`
from associativvordes.v5_release_control.package import *
obs=loads((ROOT/'audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json').read_bytes());obs['production_v5_tree']='0'*40
files=compile_package(ROOT,obs);s=loads(files['BEFORE-AFTER-SUMMARY.json'])
assert s['current_unchanged'] is None and s['families_remaining_unchanged'] is None and s['unassigned_lemmas_preserved'] is None
assert 'current counts are unknown' in files['FINAL-CLEANUP-AUDIT.md'].decode()
`));
test('4368023519: rehashed package cannot omit required source inventory',()=>py(String.raw`
import tempfile,subprocess
from pathlib import Path
from associativvordes.v5_release_control.package import *
obs=loads((ROOT/'audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json').read_bytes());files=compile_package(ROOT,obs)
s=loads(files['SOURCE-LOCK.json']);s['inputs']=[];files['SOURCE-LOCK.json']=canonical(s)+b'\n'
m=loads(files['RELEASE-MANIFEST.json']);m['source_lock_sha256']=digest(files['SOURCE-LOCK.json']);files['RELEASE-MANIFEST.json']=canonical(m)+b'\n'
with tempfile.TemporaryDirectory() as td:
 p=Path(td)/'package';write_package(p,files)
 result=subprocess.run(['node','associativvordes/v5_release_control/verify.mjs',str(p),str(ROOT)],capture_output=True,text=True)
 assert result.returncode!=0 and 'required source inventory' in result.stderr
`));

test('4354484829: full driver executes and compares all auxiliary audits',()=>py(String.raw`
import sys,tempfile,sqlite3,types
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,'associativvordes/v5_baseline')
import certify,audit_ids,audit_metadata,audit_ledger
calls=[]
with tempfile.TemporaryDirectory() as td:
 work=Path(td)/'work'
 def execute(cmd,**kw):
  if '--crash-after' in cmd:
   (work/'run').mkdir();d=sqlite3.connect(work/'run/census.sqlite');d.execute('CREATE TABLE checkpoints(x INTEGER)');d.execute('INSERT INTO checkpoints VALUES(1)');d.commit();d.close();return types.SimpleNamespace(returncode=75)
  for n in ['audit_ids.py','audit_metadata.py','audit_ledger.py']:
   if any(str(x).endswith('/'+n) for x in cmd):calls.append('restored:'+n)
  return types.SimpleNamespace(returncode=0)
 with patch.object(certify,'prepare',lambda *args:None),patch.object(certify,'run',lambda *args:None),patch.object(certify,'backup',lambda *args:dict(archive_sha256='test')),patch.object(certify,'restore',lambda *args:dict(restore_verified=True)),patch.object(certify,'sha_file',lambda *args:'same'),patch.object(certify,'load',lambda *args:dict(verdict='TEST_ONLY')),patch.object(certify,'atomic_json',lambda *args:None),patch.object(certify.subprocess,'run',execute),patch.object(audit_ids,'audit',lambda *args:calls.append('first:audit_ids.py')),patch.object(audit_metadata,'audit',lambda *args:calls.append('first:audit_metadata.py')),patch.object(audit_ledger,'audit',lambda *args:calls.append('first:audit_ledger.py')),patch.object(sys,'argv',['certify','--repo',str(Path('.').resolve()),'--commit','a'*40,'--work',str(work)]):certify.main()
 assert set(calls)=={side+':'+name for side in ['first','restored'] for name in ['audit_ids.py','audit_metadata.py','audit_ledger.py']},calls
`));
test('4359927848: suffix exposure pins normalization and morph construction',()=>py(String.raw`
import sys,tempfile,json
from pathlib import Path
from unittest.mock import patch
sys.path[:0]=['associativvordes/v5_diagnostics/tools','associativvordes/v5_diagnostics']
import suffix_exposure as m
class D:
 def execute(self,*args):return self
 def fetchone(self):return None
 def close(self):pass
with tempfile.TemporaryDirectory() as td:
 p=Path(td);(p/'SUMMARY.json').write_text(json.dumps(dict(selected_signal_union=dict(families=0,memberships_in_affected_families=0))))
 with patch.object(m,'open_registry',lambda folder:(D(),dict(version='TEST_ONLY',database_sha256='TEST_ONLY'))):r=m.audit(p)
 assert {'associativvordes/js/search-normalizer.js','associativvordes/js/morphology/languages/base.js'}<=set(r['source_code_sha256'])
`));
test('4362693719: actual surface checkpoints bind imported decoding and history',()=>py(String.raw`
import sys,contextlib,io,json
sys.path.insert(0,'tests')
from review_audit_fixtures import surface,ROOT
with surface() as (t,m,snap,out):
 with contextlib.redirect_stdout(io.StringIO()):m.scan(ROOT,snap,out)
 identity=json.loads((out/'IDENTITY.json').read_bytes())
 assert {'associativvordes/structural_cleanup/shadow.py','associativvordes/structural_cleanup/common.py','associativvordes/history_registry/registry.py'}<=set(identity['code'])
`));
test('4362693741: consistent hashes cannot hide an incorrect family disposition',()=>py(String.raw`
import sys,contextlib,io,json,gzip,hashlib,subprocess
sys.path.insert(0,'tests')
from review_audit_fixtures import surface,ROOT
with surface() as (t,m,snap,out):
 with contextlib.redirect_stdout(io.StringIO()):m.scan(ROOT,snap,out)
 p=next(p for p in (out/'buckets').glob('*/FAMILIES.ndjson.gz') if gzip.decompress(p.read_bytes()).strip())
 rows=[json.loads(s) for s in gzip.decompress(p.read_bytes()).splitlines()];assert rows[0]['operation']=='RETAIN_WITH_REVIEW';rows[0]['operation']='INSUFFICIENT_EVIDENCE'
 data=b''.join(m.canonical(x)+b'\n' for x in rows);p.write_bytes(gzip.compress(data,mtime=0))
 r=json.loads((p.parent/'RECEIPT.json').read_bytes());r['files'][p.name]=dict(sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size);(p.parent/'RECEIPT.json').write_bytes(m.canonical(r))
 manifest=json.loads((out/'MANIFEST.json').read_bytes());manifest['buckets']=[r if b['bucket']==r['bucket'] else b for b in manifest['buckets']]
 summary=json.loads((out/'SUMMARY.json').read_bytes())
 for prefix in ['disposition:','candidate:']:
  summary['totals'][prefix+'RETAIN_WITH_REVIEW']-=1;summary['totals'][prefix+'INSUFFICIENT_EVIDENCE']=1
 (out/'SUMMARY.json').write_bytes(m.canonical(summary));manifest['summary_sha256']=hashlib.sha256((out/'SUMMARY.json').read_bytes()).hexdigest();(out/'MANIFEST.json').write_bytes(m.canonical(manifest))
 result=subprocess.run(['node',str(ROOT/'associativvordes/surface_cleanup/verify.mjs'),str(snap),str(out),str(t.root/'verified.json')],cwd=ROOT,capture_output=True,text=True)
 assert result.returncode!=0 and 'independent family disposition mismatch' in result.stderr,(result.stdout,result.stderr)
`));

test('4363144007: morphology checkpoints include the actual selection classifier',()=>py(String.raw`
import sys,json,sqlite3,importlib.util,contextlib,io
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,'tests')
from review_audit_fixtures import surface,ROOT
with surface() as (t,unused,snap,unused_out):
 for name in ['common','policy','native']:sys.modules.pop(name,None)
 sys.path.insert(0,str(ROOT/'associativvordes/morphology_cleanup'))
 spec=importlib.util.spec_from_file_location('TEST_ONLY_morphology_driver',ROOT/'associativvordes/morphology_cleanup/run.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 history=t.root/'history.sqlite';d=sqlite3.connect(history);d.execute('CREATE TABLE ids(family TEXT,language TEXT,lemma TEXT,decision TEXT)');d.close()
 profiles=t.root/'profiles';profiles.mkdir();(profiles/'MANIFEST.json').write_text('{}')
 class Profiles:
  def lookup(self,*args):return 0,0
  def close(self):pass
 original=m.load
 def load(path):return dict(sha256=m.sha_file(history)) if Path(path).name=='HISTORY-INDEX.json' else original(path)
 out=t.root/'morphology'
 with patch.object(m,'Profiles',lambda *args:Profiles()),patch.object(m,'load',load),contextlib.redirect_stdout(io.StringIO()):m.scan(snap,profiles,history,out)
 assert 'associativvordes/v5_diagnostics/classify.py' in json.loads((out/'IDENTITY.json').read_bytes())['code']
`));

test('4363656925: structural JSON plan bytes are verified with NDJSON inputs',()=>{
 const code=String.raw`
import fs from 'node:fs';import path from 'node:path';import {syncBuiltinESMExports} from 'node:module';import {pathToFileURL} from 'node:url';
const root=path.dirname(fs.realpathSync('audit')),original=fs.readFileSync;
fs.readFileSync=function(p,options){
 if(String(p)===path.join(root,'audit/associative-v5-structural-cleanup/DATA-CHANGE-PROPOSAL.json')){
  const bytes=Buffer.from(JSON.stringify({status:'DATA_PATCH_NEEDED',membership_removals:1}));return typeof options==='string'?bytes.toString(options):bytes;
 }
 return original.apply(this,arguments);
};syncBuiltinESMExports();
process.argv=['node','verify.mjs',root];await import(pathToFileURL(path.resolve('associativvordes/national_correspondences/verify.mjs')).href);
`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
 assert.notEqual(r.status,0,'a changed structural JSON plan was accepted');
});
test('4362455083: fresh apply and idempotence receipts substantiate different operations',()=>py(String.raw`
import json,subprocess
from pathlib import Path
r=json.loads(Path('audit/pr-review-679-694/APPLY-REPLAY-VERIFICATION.json').read_bytes())
assert r['fresh_apply']['status']=='SHADOW_ONLY' and r['idempotence']['status']=='ALREADY_APPLIED'
assert r['rollback']['status']=='ROLLBACK_VERIFIED'
m=json.loads(Path('audit/pr-review-679-694/FRESH-SHADOW-MANIFEST.json').read_bytes());assert r['fresh_apply']['inventory_sha256']==m['inventory_sha256']
import hashlib
raw=Path('audit/pr-review-679-694/ORIGINAL-APPLY-RECEIPT.json').read_bytes()
assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()=='bfaa842fa921aca82b72a288d179f1bd53797c58'
old=json.loads(raw)
assert old['status']=='ALREADY_APPLIED' and old!=r['fresh_apply']
`));
test('4362455091: both complete issue exports resolve and match their report counts',()=>py(String.raw`
import json,gzip
from pathlib import Path
for side in ['BEFORE','AFTER']:
 r=json.loads(Path('audit/associative-v5-structural-cleanup/'+side+'-INTEGRITY.json').read_bytes());p=Path(r['issue_details_location']);assert p.is_file()
 rows=[json.loads(x) for x in gzip.decompress(p.read_bytes()).splitlines() if x.strip()]
 assert len(rows)==sum(r['structural_findings'].values())
`));

test('4359323435: source-row body identity cannot differ from its evidence key',()=>py(String.raw`
import sys,tempfile,base64,json
from pathlib import Path
sys.path.insert(0,'associativvordes/review')
from associativvordes.review.store import Ledger,digest,canonical
with tempfile.TemporaryDirectory() as td:
 p=Path(td);qdir=p/'queue';qdir.mkdir();data=b'TEST_ONLY_SOURCE\n';loc=dict(raw_sha256=digest(data));e=dict(id='TEST_ONLY_ROW',raw_locator=loc,revision='fixture',artifact='fixture')
 q=dict(id='TEST_ONLY_Q',family='TEST_ONLY_F',language='en',lemma='word',lexeme_alternatives=[dict(id='TEST_ONLY_L')],evidence_refs=[e]);raw=(canonical(q)+'\n').encode();(qdir/'questions.ndjson').write_bytes(raw)
 rows={'TEST_ONLY_ROW':dict(record_id='FORGED',raw_locator=loc,revision='fixture',artifact='fixture',original_line_base64=base64.b64encode(data).decode(),raw_text=data.decode())}
 def freeze():
  source=canonical(rows).encode();(qdir/'source-rows.json').write_bytes(source);(qdir/'MANIFEST.json').write_text(json.dumps(dict(schema='v5-review-projection/1',counts=dict(questions=1),outputs={'questions.ndjson':digest(raw),'source-rows.json':digest(source)})))
 freeze();ledger=Ledger(p/'ledger')
 try:ledger.import_queue(qdir)
 except ValueError:pass
 else:raise AssertionError('forged raw-row identity accepted')
 assert not (p/'ledger/CURRENT').exists()
 rows['TEST_ONLY_ROW']['record_id']='TEST_ONLY_ROW';freeze();assert ledger.import_queue(qdir)['questions']==1
`));

test('4359927879: saved source and replay volumes have complete authenticated recovery locators',()=>py(String.raw`
import json
from pathlib import Path
root=Path('audit/pr-review-679-694');catalog=json.loads((root/'ARCHIVE-AVAILABILITY.json').read_bytes());items={r['file']:r for r in catalog['available_items']}
required=['v5-baseline-47723611.tar.part'+str(i).zfill(3) for i in range(6)]+['pinned-morphology-originals.zip','interal-history-sources-fe87153c.tar.gz']
assert len(items)>=61
for name in required:
 r=items[name];assert r['library_file_id'].startswith('libfile_') and r['library_file_id'] in r['url'] and r['bytes']>0
new=json.loads((root/'NEW-RESEARCH-ARCHIVES.json').read_bytes());assert len(new['archives'])==2
parts=[p for a in new['archives'] for p in a['parts']];assert len(parts)==8
for a in new['archives']:
 assert a['part_reassembly_verified'] and sum(p['bytes'] for p in a['parts'])==a['bytes']
 for p in a['parts']:assert len(p['sha256'])==64 and p['library_file_id'] in p['url']
assert json.loads((root/'ARCHIVE-RECOVERY-PROOF.json').read_bytes())['all_research_files_restored']==1978
`));

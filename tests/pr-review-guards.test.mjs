
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
import json
from pathlib import Path
from associativvordes.cleanup_quality.prepare import historical_context
p=Path('audit/associative-history-registry');pointer=json.loads((p/'CURRENT.json').read_text());s=json.loads((p/pointer['snapshot']).read_text())
ds=[d for d in s['decisions'] if d['decision']=='CONFIRMED_NONMEMBER' and d['scope'].get('lemma_ids')]
for d in ds:
 word,record=historical_context(d);assert word and record['word']==word and record['source_refs'][0]['sha256']==d['source']['sha256']
 assert not {'decision','verdict','explanation','reason'}&set(record)
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
assert s['current_unchanged'] is None and s['families_remaining_unchanged'] is None
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

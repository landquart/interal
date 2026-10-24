"""Adversarial engineering reproductions, keyed by immutable review comment ID.

Each probe runs in a fresh interpreter to isolate legacy bare-module imports.
Fixtures are TEST_ONLY, never linguistic decisions or release approval.
"""
import argparse,json,subprocess,sys,time
from pathlib import Path

PROBES = {
'4359323416': r'''
import sys,tempfile,json
from pathlib import Path
sys.path.insert(0,'associativvordes/v5_adapter')
from test_adapter import ProjectionTests
from bridge import export,history_reader
from queue_input import load_queue
from common import read,atomic,canonical,sha
t=ProjectionTests();t.setUp()
try:
 t.run_build();h,_=history_reader();a=t.obj(h.check);qdir=t.base/'queue';export(a,qdir,limit=2)
 qs=[json.loads(s) for s in (qdir/'questions.ndjson').read_text().splitlines()]
 qs[0]['discovery_paths']=[{'evidence_refs':[{'id':'TEST_ONLY_INJECTED','type':'direct_derivation'}]}]
 raw=b''.join(canonical(q)+b'\n' for q in qs);atomic(qdir/'questions.ndjson',raw)
 m=read(qdir/'MANIFEST.json');m['outputs']['questions.ndjson']=sha(raw);atomic(qdir/'MANIFEST.json',canonical(m))
 try:load_queue(qdir,t.out)
 except ValueError:pass
 else:raise AssertionError('rehashed fabricated question accepted')
finally:t.doCleanups()
''',
'4359323422': r'''
import sys
sys.path.insert(0,'associativvordes/v5_adapter')
from test_external import ExternalTests
from external import External
from common import read,atomic,canonical
ExternalTests.setUpClass()
try:
 p=ExternalTests.folder/'EXTERNAL.json';m=read(p);m['missing']=[{'TEST_ONLY':'altered retaining old version'}];atomic(p,canonical(m))
 try:External(ExternalTests.folder,ExternalTests.lock)
 except ValueError:pass
 else:raise AssertionError('external manifest identity not recomputed')
finally:ExternalTests.tearDownClass()
''',
'4359323448': r'''
import sys,json,gzip
sys.path.insert(0,'associativvordes/v5_adapter')
from test_adapter import ProjectionTests
from common import bucket
t=ProjectionTests();t.setUp()
try:
 b=t.buckets[0];fid='family:TEST_ONLY:wrong'
 while bucket(fid)==b:fid+='x'
 p=t.source/'families'/f'{b}.json.gz';m=json.loads(gzip.decompress(p.read_bytes()));m[fid]={'id':fid,'canonical':'test'};t.put(f'families/{b}.json.gz',m);t.commit()
 try:t.run_build()
 except ValueError:pass
 else:raise AssertionError('misrouted family accepted')
finally:t.doCleanups()
''',
'4359927831': r'''
import sys,tempfile,sqlite3,json,hashlib
from pathlib import Path
sys.path.insert(0,'associativvordes/v5_diagnostics/tools')
from query import open_registry,filehash
from classify import canonical,digest
with tempfile.TemporaryDirectory() as td:
 p=Path(td);sqlite3.connect(p/'registry.sqlite').close();(p/'SUMMARY.json').write_text('{}')
 m=dict(database='registry.sqlite',database_sha256=filehash(p/'registry.sqlite'),complete=True,outputs={'SUMMARY.json':filehash(p/'SUMMARY.json')});m['version']=digest(m);(p/'MANIFEST.json').write_bytes(canonical(m))
 (p/'SUMMARY.json').write_text('{"TEST_ONLY":"tampered"}')
 try:open_registry(p)
 except ValueError:pass
 else:raise AssertionError('manifest-pinned summary not checked')
''',
'4359927862': r'''
import sys,sqlite3,zlib
sys.path.insert(0,'associativvordes/v5_diagnostics')
from test_diagnostics import WholeShard
from run import ingest
from classify import canonical
t=WholeShard();t.setUp()
try:
 d=sqlite3.connect(t.root/'source.sqlite');d.execute('DELETE FROM families');d.execute('DELETE FROM members');d.execute('DELETE FROM aliases')
 f={'id':'surface:ru:iks','canonical':'iks','source':'surface_singleton'};d.execute('INSERT INTO families VALUES(?,?)',(f['id'],zlib.compress(canonical(f))))
 for i in range(5):
  r={'lemma_id':str(i),'word':'суффикс','normalized':'суффикс','search_form':f'test{i}iks','components':[]};d.execute('INSERT INTO members VALUES(?,?,?,?,?)',(f['id'],'ru',str(i),i,zlib.compress(canonical(r))))
 d.commit();d.close();ingest(t.db,t.root,t.receipt)
 assert t.db.execute("SELECT count(*) FROM flags WHERE flag='ENDING_PREFIX_DIVERSITY_PROXY'").fetchone()[0]==1,'Cyrillic normalized text compared to ASCII canonical'
finally:t.doCleanups()
''',
'4362693699': r'''
import sys
sys.path.insert(0,'associativvordes/surface_cleanup')
from policy import authorize,scope_hash
ids=[['en','TEST_ONLY_A'],['ru','TEST_ONLY_B']]
assert authorize('REMOVE_EXACT_MEMBERSHIPS',ids,ids,{},dict(allowed=False)) is False
assert authorize('REJECT_ENTIRE_FAMILY',ids,ids+ids[:1],{},dict(allowed=True)) is False
''',
'4367043681': r'''
from associativvordes.cleanup_quality.statistics import evaluate
rows=[dict(weight=1.,gold='VALID' if i%2 else 'INVALID',prediction='NOT_RUN',cluster=str(i)) for i in range(32)]
x=evaluate(rows,repetitions=20)
for k in ['precision_exclusions','false_removal_rate','recall_erroneous_existing_links']:
 assert x[k]['value'] is None and x[k]['ci95_linked_cluster_bootstrap'] is None,(k,x[k])
''',
'4367043683': r'''
from associativvordes.cleanup_quality.human import validate
j=dict(actor_id='TEST_ONLY',action='independent_review',case_id='a',case_sha256='h',protocol_sha256='p',blind_to_predictions=True,blind_to_other_review=True,verdict='VALID',reason='TEST_ONLY',sources=[dict(locator='test',finding='test',publisher='test')],reviewed_at='2026-10-24T00:00:00Z',pos='N',sense='test')
case=dict(id='a',content_sha256='h',protocol_sha256='p',language='en');roster={'TEST_ONLY':dict(kind='human',authorization_ref='TEST_ONLY',qualified_languages=['en'],roles=['A'])}
try:validate(j,case,roster,'A')
except ValueError:pass
else:raise AssertionError('missing relation accepted as resolved judgment')
''',
'4367043688': r'''
import tempfile
from pathlib import Path
from associativvordes.cleanup_quality.bundle import pack
with tempfile.TemporaryDirectory() as td:
 p=Path(td)
 try:pack(p/'out.zip',p/'missing',p/'missing2',p/'missing3',p/'missing4.zip',p/'missing5.json')
 except (ValueError,FileNotFoundError):pass
 else:raise AssertionError('empty archive certified with required inputs absent')
 assert not (p/'out.zip').exists()
''',
'4368023514': r'''
from associativvordes.v5_release_control.package import *
obs=loads((ROOT/'audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json').read_bytes());obs['production_v5_tree']='f'*40
files=compile_package(ROOT,obs);s=loads(files['BEFORE-AFTER-SUMMARY.json'])
assert s['current_unchanged'] is None and s['families_remaining_unchanged'] is None,'historical counts presented as current after tree drift'
''',
}

def run(selected=None):
 results=[]
 for identifier,code in PROBES.items():
  if selected and identifier not in selected:continue
  start=time.monotonic();r=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True)
  results.append(dict(comment_id=int(identifier),passed=r.returncode==0,exit_code=r.returncode,seconds=time.monotonic()-start,stdout=r.stdout[-3000:],stderr=r.stderr[-5000:]))
 return results

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--ids',nargs='*');a=p.parse_args()
 result=run(a.ids);Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(dict(tests=len(result),passed=sum(r['passed'] for r in result),failed=sum(not r['passed'] for r in result))))
 sys.exit(0 if all(r['passed'] for r in result) else 1)

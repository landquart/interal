import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const py=code=>{
 const r=spawnSync('python3',['-c',code],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
};

test('real pinned inputs yield only a blocked package; separate-process replay is exact',()=>py(String.raw`
import tempfile,subprocess
from pathlib import Path
from associativvordes.v5_release_control.package import *
obs=loads((ROOT/'audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json').read_bytes())
with tempfile.TemporaryDirectory() as td:
 package=Path(td)/'package';other=Path(td)/'replay'
 files=compile_package(ROOT,obs);write_package(package,files)
 assert verify_package(package)['publication_allowed'] is False
 m=loads(files['RELEASE-MANIFEST.json']);s=loads(files['BEFORE-AFTER-SUMMARY.json'])
 assert m['approved_release_id'] is None and m['owner_approval'] is None
 assert m['after_inventory'] is None and m['proposed_operation_count']==0
 assert s['memberships_removed']==0 and s['unassigned_lemmas_preserved']==699
 assert s['after_cleaned_release'] is None
 assert len(loads(files['SOURCE-LOCK.json'])['executed_dry_run_code_drift'])>=3
 assert all(loads(files['QUALITY-REPORT.json'])[k] is None for k in ['precision','false_removal_rate','recall','inter_annotator_agreement'])
 r=subprocess.run(['python3','-m','associativvordes.v5_release_control.package','replay','--repo',str(ROOT),'--package',str(package),'--destination',str(other)],capture_output=True,text=True)
 assert r.returncode==0,(r.stdout,r.stderr)
 assert all((package/n).read_bytes()==(other/n).read_bytes() for n in (*OUTPUTS,'PACKAGE-INDEX.json'))
 r=subprocess.run(['node','associativvordes/v5_release_control/verify.mjs',str(package),str(ROOT)],capture_output=True,text=True)
 assert r.returncode==0,(r.stdout,r.stderr)
 assert loads(r.stdout)['status']=='PASS_BLOCKED_PACKAGE_BYTE_INTEGRITY'
 raw=(package/'GATES.json').read_bytes();(package/'GATES.json').write_bytes(raw+b' ')
 r=subprocess.run(['node','associativvordes/v5_release_control/verify.mjs',str(package),str(ROOT)],capture_output=True,text=True)
 assert r.returncode!=0
 (package/'GATES.json').write_bytes(raw)
 r=subprocess.run(['python3','-m','associativvordes.v5_release_control.package','check-application','--package',str(package)],capture_output=True,text=True)
 assert r.returncode!=0 and 'BLOCKED' in r.stderr
`));

test('missing, changed, additional and self-qualified package artifacts fail closed',()=>py(String.raw`
import tempfile
from pathlib import Path
from associativvordes.v5_release_control.package import *
def denied(fn):
 try:fn()
 except (ValueError,FileNotFoundError):return
 raise AssertionError('invalid evidence admitted')
obs=loads((ROOT/'audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json').read_bytes())
files=compile_package(ROOT,obs)
with tempfile.TemporaryDirectory() as td:
 p=Path(td)/'package';write_package(p,files)
 target=p/'ROLLBACK-RECEIPT.json';raw=target.read_bytes();target.unlink();denied(lambda:verify_package(p));target.write_bytes(raw)
 target.write_bytes(raw+b' ');denied(lambda:verify_package(p));target.write_bytes(raw)
 (p/'unexpected').write_bytes(b'TEST_ONLY');denied(lambda:verify_package(p));(p/'unexpected').unlink()
 bad={**files};m=loads(bad['RELEASE-MANIFEST.json']);m['publication_allowed']=True;m['status']='QUALIFIED_FOR_EXACT_SCOPE';bad['RELEASE-MANIFEST.json']=canonical(m)+b'\n'
 q=Path(td)/'self-claimed';write_package(q,bad);denied(lambda:verify_package(q))
 denied(lambda:write_package(p,files))
`));

test('input corruption, missing history, repeated paths and malformed JSON are rejected',()=>py(String.raw`
import tempfile
from pathlib import Path
from associativvordes.v5_release_control.package import *
def denied(fn):
 try:fn()
 except (ValueError,FileNotFoundError):return
 raise AssertionError('invalid input admitted')
with tempfile.TemporaryDirectory() as td:
 p=Path(td);f=p/'history.json';f.write_bytes(b'{"TEST_ONLY":true}')
 row=dict(path='history.json',bytes=f.stat().st_size,sha256=file_sha(f));config=dict(files=[row])
 assert inventory(p,config)==[row]
 denied(lambda:inventory(p,dict(files=[row,row])))
 f.unlink();denied(lambda:inventory(p,config));f.write_bytes(b'CORRUPT');denied(lambda:inventory(p,config))
 f.unlink();(p/'dir').mkdir();(p/'dir/link').symlink_to('/dev/null');denied(lambda:safe_file(p,'dir/link'))
 denied(lambda:safe_file(p,'../escape'))
 for raw in [b'{"a":1,"a":2}',b'{"a":{"x":1,"x":2}}',b'{"a":NaN}',b'{"a":Infinity}']:
  denied(lambda:loads(raw))
 f=p/'ops.ndjson';f.write_bytes(b'{"id":"TEST_ONLY"}\n')
 declared=dict(inputs=[dict(path=f.name,bytes=f.stat().st_size,sha256=file_sha(f),rows=1)],operation_count=2)
 denied(lambda:operation_inventory(p,declared))
`));

test('stale production HEAD and historical risk acceptance cannot authorize a release',()=>py(String.raw`
from associativvordes.v5_release_control.package import *
obs=loads((ROOT/'audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json').read_bytes())
obs={**obs,'production_main_commit':'f'*40,'owner_approval':{'status':'OWNER_ACCEPTED_AT_RISK'}}
files=compile_package(ROOT,obs);gates={g['id']:g for g in loads(files['GATES.json'])}
assert gates['PRODUCTION_MATCHES_RECORDED_BASELINE']['status']=='BLOCKED'
assert gates['EXACT_OWNER_APPROVAL']['status']=='BLOCKED'
m=loads(files['RELEASE-MANIFEST.json']);assert m['publication_allowed'] is False and m['owner_approval'] is None
`));

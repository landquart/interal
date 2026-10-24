import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const py=code=>{const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);};
test('blocked and nonempty plans cannot become a production or shadow modification',()=>py(String.raw`
from associativvordes.full_v5_dry_run.core import *
p=dict(operations=[],categories={k:[] for k in CATEGORIES},semantic_gate='BLOCKED',unknown_proposals_applied=0,nonempty_application_supported=False);p['content_sha256']=digest(p);validate_plan(p)
for change in [dict(operations=[dict(status='BLOCKED')]),dict(operations=[dict(status='QUALIFIED_FOR_EXACT_SCOPE')]),dict(semantic_gate='PASS'),dict(categories={}),dict(nonempty_application_supported=True)]:
 x={**{k:v for k,v in p.items() if k!='content_sha256'},**change};x['content_sha256']=digest(x)
 try:validate_plan(x)
 except ValueError:pass
 else:raise AssertionError('unsupported operation admitted')
`));
test('complete shadow publication is idempotent and five empty layers preserve exact bytes',()=>py(String.raw`
import tempfile
from associativvordes.full_v5_dry_run.core import *
from associativvordes.full_v5_dry_run.store import materialize,layers
with tempfile.TemporaryDirectory() as td:
 w=Path(td);src=w/'before';(src/'current').mkdir(parents=True);(src/'original').mkdir();(src/'current/a.json').write_text('{"TEST_ONLY":1}');(src/'original/b.json').write_text('{"TEST_ONLY":2}')
 files=[dict(path=str(p.relative_to(src)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(src.rglob('*.json'))];lock=dict(files=files,inventory_sha256=digest(files));save(src/'SNAPSHOT.json',lock)
 p=dict(operations=[],categories={k:[] for k in CATEGORIES},semantic_gate='BLOCKED',unknown_proposals_applied=0,nonempty_application_supported=False);p['content_sha256']=digest(p);plan=w/'plan.json';save(plan,p)
 r=materialize(src,w/'store',plan);assert r['copied_files']==2
 assert materialize(src,w/'store',plan)['status']=='ALREADY_MATERIALIZED'
 a=layers(src,w/'store',plan);assert len(a)==5 and all(not x['applied_operation_ids'] for x in a)
 materialize(src,w/'replay',plan);layers(src,w/'replay',plan);assert load(w/'store/CURRENT.json')==load(w/'replay/CURRENT.json')
 bad=w/'store/objects'/lock['inventory_sha256']/'current/a.json';bad.chmod(0o644);bad.write_text('corrupt')
 try:materialize(src,w/'store',plan)
 except ValueError:pass
 else:raise AssertionError('corrupt completed shadow reused')
`));
test('strict bounded decoder rejects duplicate keys and verifies complete JSON',()=>py(String.raw`
import tempfile,gzip
from associativvordes.full_v5_dry_run.census import pairs
from pathlib import Path
with tempfile.TemporaryDirectory() as td:
 p=Path(td)/'bucket.gz'
 for raw in ['{"A":{"x":1,"x":2}}','{"A":1,"A":2}','{"A":NaN}','{"A":1} trailing']:
  p.write_bytes(gzip.compress(raw.encode()))
  try:list(pairs(p))
  except ValueError:pass
  else:raise AssertionError('damaged shard accepted')
 p.write_bytes(gzip.compress(b'{"A":{"TEST_ONLY":1}}'));assert list(pairs(p))==[('A',{'TEST_ONLY':1})]
`));
test('snapshot validation rejects unexpected records and symbolic links',()=>py(String.raw`
import tempfile
from associativvordes.full_v5_dry_run.core import *
with tempfile.TemporaryDirectory() as td:
 p=Path(td);(p/'a').write_text('TEST_ONLY');r=dict(path='a',bytes=9,sha256=sha(p/'a'));lock=dict(files=[r],inventory_sha256=digest([r]));verify_files(p,lock)
 (p/'extra').write_text('x')
 try:verify_files(p,lock)
 except ValueError:pass
 else:raise AssertionError('extra record accepted')
 (p/'extra').unlink();(p/'a').unlink();(p/'a').symlink_to('/dev/null')
 try:verify_files(p,lock)
 except ValueError:pass
 else:raise AssertionError('symlink accepted')
`));

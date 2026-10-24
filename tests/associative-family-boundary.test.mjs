import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const python=code=>{const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);};
test('exact overlap groups never imply transitive or semantic family identity',()=>python(String.raw`
import pathlib,tempfile,json
from associativvordes.family_boundary.core import *
from associativvordes.family_boundary.analyze import install,cohort
from associativvordes.family_boundary.guard import *
assert fp([('en','L')])!=fp([('de','L')])
with tempfile.TemporaryDirectory() as td:
 d=dbopen(pathlib.Path(td)/'db');d.executescript('CREATE TABLE state(k TEXT PRIMARY KEY,v TEXT);CREATE TABLE families(f INTEGER PRIMARY KEY,fid TEXT);CREATE TABLE members(f INTEGER,lang TEXT,lid TEXT);');install(d)
 for i in [1,2,3]:d.execute('INSERT INTO families VALUES(?,?)',(i,str(i)))
 d.executemany('INSERT INTO members VALUES(?,?,?)',[(1,'en','a'),(2,'en','a'),(2,'en','b'),(3,'en','b'),(3,'de','a')])
 d.execute('INSERT INTO overlaps SELECT a.f,b.f,COUNT(*) FROM members a JOIN members b ON a.lang=b.lang AND a.lid=b.lid AND a.f<b.f GROUP BY a.f,b.f')
 assert list(d.execute('SELECT a,b,n FROM overlaps ORDER BY a,b'))==[(1,2,1),(2,3,1)]
 cohort(d,[1,2],'SHARED_ALIAS','x');cohort(d,[2,3],'SHARED_ETYMON','y');cohort(d,[2,1],'NEAR_MEMBER_IDS','1');assert d.execute('SELECT COUNT(*) FROM groups').fetchone()[0]==2
 assert group_id(['2','1'])==group_id(['1','2']);d.close()
p=dict(id=group_id(['A','B']),family_ids=['A','B'],status='DUPLICATE_FAMILY_CANDIDATE',model_confidence=1)
assert not may_review(p)['allowed']
s=simulate({'A':[('en','L',None)],'B':[('en','L',None)]},{'A':['x'],'B':['x','y']});assert s['possible_legacy_id_collapse']==1 and s['semantic_membership_delta']=='UNKNOWN' and s['production_operation']=='NONE'
assert all(v=='UNKNOWN' for v in s['association_metrics'].values())
try:simulate({'A':[('en','L',None)]},{},'new-root')
except ValueError:pass
else:raise AssertionError('new root accepted')
p.update(exact_membership_scope_sha256='fixture',sense_partition_receipt='fixture',relation_evidence_refs=['fixture'],history_remap_old_ids=['A','B'])
clear=lambda p:dict(allowed=True,status='CLEAR');signed=lambda h:dict(authority='INDEPENDENT_GOLD',status='APPROVED',payload_sha256=h)
assert may_review(p,clear,clear,signed)['production_operation']=='NONE'
assert not may_review(dict(p,history_remap_old_ids=['B']),clear,clear,signed)['allowed']
for authority in ['ENGINEERING_CHECK','OWNER_ACCEPTED_AT_RISK','RESEARCH_HYPOTHESIS']:
 assert not may_review(p,clear,clear,lambda h:dict(authority=authority,status='APPROVED',payload_sha256=h))['allowed']
`));
test('historical negatives retain the exact original family, language, lemma, POS and sense',()=>python(String.raw`
from associativvordes.family_boundary.guard import check_original_scopes
s=dict(family_id='old:A',language='en',lemma_ids=['L'],pos='NOUN',sense_id='metal')
h=lambda q:dict(allowed=q!=s,status='HOLD' if q==s else 'CLEAR')
assert not check_original_scopes([s,dict(s,family_id='new:B')],h)['allowed']
for change in [dict(family_id='other'),dict(language='de'),dict(lemma_ids=['other']),dict(pos='VERB'),dict(sense_id='guide')]:assert check_original_scopes([dict(s,**change)],h)['allowed']
assert not check_original_scopes([s],None)['allowed']
def broken(q):raise OSError('missing history')
assert not check_original_scopes([s],broken)['allowed']
`));
test('transaction checkpoints are atomic and legacy exact records cannot become productive heads',()=>python(String.raw`
import tempfile,pathlib
from associativvordes.family_boundary.core import *
from associativvordes.family_boundary.analyze import install
with tempfile.TemporaryDirectory() as td:
 d=dbopen(pathlib.Path(td)/'db');d.executescript('CREATE TABLE state(k TEXT PRIMARY KEY,v TEXT);CREATE TABLE data(v TEXT);');install(d)
 def crash():d.execute("INSERT INTO data VALUES('partial')");raise RuntimeError('interrupted')
 try:checkpoint(d,'bucket',crash)
 except RuntimeError:pass
 assert d.execute('SELECT COUNT(*) FROM data').fetchone()[0]==d.execute('SELECT COUNT(*) FROM state').fetchone()[0]==0
 checkpoint(d,'bucket',lambda:d.execute("INSERT INTO data VALUES('complete')"));checkpoint(d,'bucket',crash);assert d.execute('SELECT COUNT(*) FROM data').fetchone()[0]==1
 d.execute("INSERT INTO v6_heads VALUES('h','legacy_exact_record','{}')")
 for i in [1,2]:d.execute('INSERT INTO v6_links VALUES(?,?,?,?,?,?)',(str(i),i,'h','root','EXACT_FINITE_SOURCE_PROOF','{}'))
 q="SELECT head FROM v6_links JOIN v6_heads ON v6_heads.id=v6_links.head WHERE kind IN ('lexical_head','historically_reviewed_lexical_head') GROUP BY head HAVING COUNT(DISTINCT f)>1"
 assert list(d.execute(q))==[];d.execute("UPDATE v6_heads SET kind='lexical_head'");assert list(d.execute(q))==[('h',)];d.close()
`));

test('independent membership checks recompute stored IDs instead of trusting copied fingerprints',()=>python(String.raw`
import pathlib,tempfile
from associativvordes.family_boundary.core import *
from associativvordes.family_boundary.replay import actual_fingerprints
with tempfile.TemporaryDirectory() as td:
 d=dbopen(pathlib.Path(td)/'db');d.executescript('CREATE TABLE families(f INTEGER,ids_hash TEXT,n INTEGER,langs TEXT);CREATE TABLE members(f INTEGER,lang TEXT,lid TEXT);')
 d.execute('INSERT INTO families VALUES(?,?,?,?)',(1,fp([('en','L')]),1,'{"en":1}'));d.execute("INSERT INTO members VALUES(1,'en','L')");assert actual_fingerprints(d)==1
 d.execute("UPDATE members SET lid='wrong'")
 try:actual_fingerprints(d)
 except ValueError:pass
 else:raise AssertionError('stale copied fingerprint trusted')
 d.close()
`));
test('v6 source proofs retain JavaScript insertion-order hashing and exact source forms',()=>python(String.raw`
import tempfile,pathlib,json,gzip,hashlib,subprocess
with tempfile.TemporaryDirectory() as td:
 r=pathlib.Path(td)/'repo';v=pathlib.Path(td)/'v6';(v/'generated').mkdir(parents=True);path='associativvordes/family-index-v5/members/en/00.json.gz';source=r/path;source.parent.mkdir(parents=True)
 raw='{"word":"x","lemma_id":"L","z":1,"a":2}';row=json.loads(raw);data=gzip.compress(json.dumps({'old:A':[row]}).encode());source.write_bytes(data)
 baseline=r/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json';baseline.parent.mkdir(parents=True);baseline.write_text(json.dumps(dict(files=[dict(path='current/'+path,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())])))
 m=dict(language='en',lemma_id='L',word='x',head_id='head:finite',family_id='v6:other',source_proof=[dict(lemma_id='L',source=dict(path=path,family_id='old:A',record_sha256=hashlib.sha256(raw.encode()).hexdigest()))]);(v/'generated/memberships.json.gz').write_bytes(gzip.compress(json.dumps([m]).encode()))
 cmd=['node','associativvordes/family_boundary/v6_proofs.mjs',str(r),str(v)];p=subprocess.run(cmd,capture_output=True,text=True);assert p.returncode==0,p.stderr
 assert json.loads((v/'SOURCE-PROOF-CHECKS.ndjson').read_text())['status']=='EXACT_FINITE_SOURCE_PROOF'
 m['word']='different';(v/'generated/memberships.json.gz').write_bytes(gzip.compress(json.dumps([m]).encode()));p=subprocess.run(cmd,capture_output=True,text=True);assert p.returncode==0,p.stderr
 assert json.loads((v/'SOURCE-PROOF-CHECKS.ndjson').read_text())['status']=='SOURCE_FORM_MISMATCH'
`));

test('immutable backups reject corruption, unfinished data and path escape',()=>python(String.raw`
import tempfile,pathlib,json,zipfile,hashlib
from associativvordes.family_boundary.archive import pack,restore,split,join
from associativvordes.family_boundary.core import sha
with tempfile.TemporaryDirectory() as td:
 p=pathlib.Path(td);r=p/'r';c=p/'c';i=p/'i'
 for d in [r,c,i]:d.mkdir();(d/'data').write_text(d.name)
 replay=p/'replay.json';replay.write_text('{}');a=p/'backup.zip';pack(a,r,c,i,replay)
 restore(a,p/'restored',sha(a));assert (p/'restored/release/data').read_text()=='r'
 def rejects(fn):
  try:fn()
  except (ValueError,FileExistsError):pass
  else:raise AssertionError('unsafe archive accepted')
 rejects(lambda:restore(a,p/'restored'));rejects(lambda:restore(a,p/'wrong','0'*64))
 (r/'unfinished.partial').write_text('partial');rejects(lambda:pack(p/'bad.zip',r,c,i,replay))
 split(a,p/'parts');join(p/'parts/BUNDLE-PARTS.json',p/'joined.zip');assert sha(a)==sha(p/'joined.zip')
 first=next((p/'parts').glob('*.part-*'));first.write_bytes(b'corrupt');rejects(lambda:join(p/'parts/BUNDLE-PARTS.json',p/'broken.zip'))
 evil=p/'evil.zip';body=b'escape'
 with zipfile.ZipFile(evil,'w') as z:
  z.writestr('../escape',body);z.writestr('ARCHIVE-CONTENTS.json',json.dumps(dict(files=[dict(path='../escape',bytes=len(body),sha256=hashlib.sha256(body).hexdigest())])))
 rejects(lambda:restore(evil,p/'evil-restore'));assert not (p/'escape').exists()
`));

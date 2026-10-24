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

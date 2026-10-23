import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('morphology policy adversarial cases and lossless native analysis',()=>{
 const script=String.raw`
import sys
sys.path.insert(0,'associativvordes/morphology_cleanup')
from policy import *
from native import row_mask
from morphology_import import parse,GLEMM
base=dict(source='fixture',resource='fixture',revision='sha',language='en')
g=dict(base,format='glemm_pairs')
r,n=parse(g,['read','V','reader','N','read','','er'],'hash',GLEMM)
assert n['claims'][0]['direction']=='unknown'
assert all(x['sense_scope']=='unresolved' for x in n['lexemes'])
_,rev=parse(g,['reader','N','read','V','read','er',''],'other',GLEMM)
assert rev['claims'][0]['direction']=='unknown'
_,inf=parse(dict(base,format='morphynet_inflection'),['walk','walked','V;PST','walk|ed'],'h')
assert not inf['claims'] and not inf['inflection']['derivational_model']
_,der=parse(dict(base,format='morphynet_derivation'),['walk','walker','V','N','er','suffix'],'h')
assert der['claims'][0]['direction']=='directed' and der['claims'][0]['segmentation'] is None
_,c=parse(dict(base,format='derinet2'),['1.1','','handmade','ADJ','','','1.0','Type=Compounding&Sources=1.0,2.0','','{}'],'h')
assert c['claims'][0]['sources']==['1.0','2.0'] and c['claims'][0]['primary_parent']=='1.0'
assert c['segmentation']==[] # No invented substring segmentation or semantic roles.
s=dict(evidence_id='e',source_native='one',target_native='two',language='en',identity_verified=True,sense_verified=True,kind='direct_derivation')
assert chain_valid([s,dict(s,source_native='two',target_native='three')])
for next_step in [dict(s,source_native='homonym'),dict(s,source_native='two',language='de'),dict(s,source_native='two',identity_verified=False),dict(s,source_native='two',sense_verified=False),dict(s,source_native='two',kind='common_ancestor')]:
 assert not chain_valid([s,next_step])
assert not chain_valid([])
for root,form in [('manu','mani'),('regul','regl'),('creat','cré'),('ocul','œil')]:
 assert not row_mask(dict(format='morphynet_derivation'),('\t'.join([root,form,'N','N','','unknown'])).encode())&BITS['allomorphy']
 assert disposition(True,True)['membership_operation']=='NONE'
assert classify(0)=='INSUFFICIENT_EVIDENCE'
assert classify(BITS['unconfirmed'])=='INSUFFICIENT_EVIDENCE'
assert classify(BITS['direct_derivation']|BITS['inflection'])=='COMPETING_ANALYSES'
`;
 const r=spawnSync('python3',['-c',script],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});
test('native profile corruption fails before any lookup',()=>{
 const r=spawnSync('python3',['-c',String.raw`
import sys,tempfile,pathlib,sqlite3,json,hashlib
sys.path.insert(0,'associativvordes/morphology_cleanup')
from native import Profiles
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d);db=sqlite3.connect(p/'00.sqlite');db.execute('CREATE TABLE profiles(word TEXT,mask INTEGER,n INTEGER)');db.commit();db.close()
 h=hashlib.sha256((p/'00.sqlite').read_bytes()).hexdigest()
 (p/'MANIFEST.json').write_text(json.dumps(dict(parts=[dict(index=0,language='en',sha256=h)])))
 good=Profiles(p);assert good.lookup('en','homonym')==(0,0);good.close()
 with open(p/'00.sqlite','ab') as f:f.write(b'corruption')
 try:Profiles(p)
 except ValueError:pass
 else:raise AssertionError('corrupted profile accepted')
`],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});

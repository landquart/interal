import contextlib,io,json,sqlite3,sys,tempfile,unittest,zlib
from pathlib import Path
from classify import *
from run import setup,ingest,cross_family,summarize,connect,rank
class Rules(unittest.TestCase):
 def test_origin_is_not_a_linguistic_verdict(self):
  self.assertEqual(origin(dict(source='surface_singleton'),{'morphological_parse':1}),'SURFACE_FRAGMENT')
  self.assertEqual(origin(dict(relation_types=['borrowed_form']),{}),'BORROWING_FAMILY')
  self.assertEqual(origin(dict(relation_types=['borrowed_form','inherited_form']),{}),'HISTORICAL_ETYMON')
  self.assertEqual(origin({},{}),'UNCLASSIFIED')
 def test_distinct_derivation_and_inflection(self):
  self.assertEqual(origin({},dict(inflection=1)),'INFLECTION_DERIVED')
  self.assertEqual(origin({},dict(inflection=1,morphological_parse=1)),'MIXED_ORIGIN')
  v=member(dict(components=[dict(evidence=[dict(type='inflection'),dict(type='morphological_parse')])]))
  self.assertIn('MIXED_DERIVATION_INFLECTION_CLAIMS',v['flags'])
 def test_legacy_manual_confidence_is_not_gold(self):
  v=member(dict(pos='NOUN',sense='FAKE',components=[dict(evidence=[dict(type='morphological_parse',source='manually_verified',confidence=1)])]))
  self.assertEqual(v['sense_status'],'UNRESOLVED');self.assertEqual(v['correspondence_status'],'UNKNOWN_NOT_EVALUATED')
 def test_threshold_three_languages_does_not_remove_singleton(self):
  f=family(dict(id='one',source='surface_singleton'),Counter(en=1),Counter(),Counter(),Counter(),None,[])
  self.assertEqual(f['memberships'],1);self.assertEqual(f['language_count'],1);self.assertIn('SINGLETON',f['flags'])
 def test_priority_is_bounded_nonprobabilistic(self):
  f=family(dict(id='one',canonical='en'),Counter(en=20000),Counter(),Counter(),Counter(),None,[])
  r=rank(f,['ALIAS_FANOUT','EXACT_DUPLICATE_MEMBER_SET','ENDING_PREFIX_DIVERSITY_PROXY'])
  self.assertLessEqual(r['score'],100);self.assertIn('not error probability',r['meaning'])
 def test_allomorph_not_inferred_from_substring(self):
  self.assertNotIn('ALLOMORPH_SCOPE_UNVERIFIED',member(dict(word='manifest',components=[]))['flags'])
 def test_unicode_length(self):self.assertEqual(len(normal('ёж')) ,2)
class WholeShard(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.db=connect(self.root/'out.sqlite');self.addCleanup(self.db.close);setup(self.db)
  self.db.execute('CREATE INDEX flag_family ON flags(family,flag)');self.db.execute('CREATE INDEX families_bucket ON families(bucket,id)')
  src=sqlite3.connect(self.root/'source.sqlite');src.executescript('CREATE TABLE families(id TEXT,body BLOB);CREATE TABLE members(family TEXT,language TEXT,lemma TEXT,ordinal INTEGER,body BLOB);CREATE TABLE aliases(alias TEXT,body BLOB);')
  for fid in ['a','b','c']:
   f=dict(id=fid,canonical='en',source='surface_singleton');src.execute('INSERT INTO families VALUES(?,?)',(fid,zlib.compress(canonical(f))))
   for i in range(5 if fid!='c' else 1):
    lid=f'lemma:{i}';row=dict(lemma_id=lid,word=f'prefix{i}en',normalized=f'prefix{i}en',components=[dict(evidence=[dict(type='surface_identity',source='candidate_index')])]);src.execute('INSERT INTO members VALUES(?,?,?,?,?)',(fid,'en',lid,i,zlib.compress(canonical(row))))
  src.execute('INSERT INTO aliases VALUES(?,?)',('en',zlib.compress(canonical(['a','b']))));src.commit();src.close()
  self.receipt=dict(identity=dict(bucket='00'),database='source.sqlite',database_sha256='fixture')
 def test_full_classification_exact_duplicate_and_overlap(self):
  r=ingest(self.db,self.root,self.receipt);self.assertEqual(r['memberships'],11);cross_family(self.db)
  s=summarize(self.db,{});self.assertEqual(s['counts'],dict(families=3,memberships=11,aliases=1));self.assertEqual(s['cross_family_patterns']['EXACT_DUPLICATE_MEMBER_SET']['groups'],1)
  self.assertEqual(s['cross_family_patterns']['SHARED_LEGACY_IDENTITY']['membership_edges'],11)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM flags WHERE flag="ENDING_PREFIX_DIVERSITY_PROXY"').fetchone()[0],2)
  self.assertEqual(s['semantic']['unresolved_memberships'],11)
 def test_scoped_negative_does_not_spread_family_or_homonym_id(self):
  scope=dict(family_id='a',language='en',lemma_ids=['lemma:0'],sense_id='known-sense')
  self.db.execute('INSERT INTO history VALUES(?,?,?,?,?,?)',('negative','a','en','CONFIRMED_NONMEMBER','ENGINEERING_CHECK',canonical(scope).decode()))
  self.db.execute('INSERT INTO history_ids VALUES(?,?,?,?)',('a','en','lemma:0','negative'));self.db.commit()
  ingest(self.db,self.root,self.receipt)
  affected=list(self.db.execute("SELECT family,lemma FROM members WHERE flags LIKE '%HISTORICAL_EXCLUSION_OVERLAP%'"));self.assertEqual(affected,[('a','lemma:0')]);self.assertEqual(json.loads(self.db.execute('SELECT scope FROM history').fetchone()[0])['sense_id'],'known-sense')
 def test_global_stage_is_idempotent(self):
  ingest(self.db,self.root,self.receipt);cross_family(self.db);a=summarize(self.db,{});cross_family(self.db);self.assertEqual(a,summarize(self.db,{}))


 def test_query_checksum_and_full_affected_ids(self):
  ingest(self.db,self.root,self.receipt);cross_family(self.db)
  from importlib.util import spec_from_file_location,module_from_spec
  path=Path(__file__).with_name('tools')/'query.py';spec=spec_from_file_location('diagnostic_query_test',path);q=module_from_spec(spec);spec.loader.exec_module(q)
  rows=list(q.query(self.db,flag='EXACT_DUPLICATE_MEMBER_SET',members=True))
  self.assertEqual(len([r for r in rows if r['record_type']=='family']),2)
  self.assertEqual(len([r for r in rows if r['record_type']=='membership']),10)
  m=dict(database='out.sqlite',database_sha256=q.filehash(self.root/'out.sqlite'),complete=True);m['version']=digest(m);(self.root/'MANIFEST.json').write_bytes(canonical(m));c,_=q.open_registry(self.root);c.close()
  with (self.root/'out.sqlite').open('ab') as f:f.write(b'corrupt')
  with self.assertRaisesRegex(ValueError,'checksum'):q.open_registry(self.root)



 def test_real_backup_restore_has_exact_database_bytes(self):
  ingest(self.db,self.root,self.receipt);cross_family(self.db);self.db.commit()
  sys.path.insert(0,str(Path(__file__).with_name('tools')))
  from query import filehash
  from backup import backup,restore_archive
  m=dict(database='out.sqlite',database_sha256=filehash(self.root/'out.sqlite'),complete=True);m['version']=digest(m);(self.root/'MANIFEST.json').write_bytes(canonical(m))
  r=backup(self.root,self.root/'archive.zip',self.root/'restored')
  self.assertTrue(r['all_exact_file_hashes_verified']);self.assertEqual(r['restored_counts'],dict(families=3,memberships=11))
  self.assertEqual(filehash(self.root/'out.sqlite'),filehash(self.root/'restored/out.sqlite'))
  (self.root/'MANIFEST.json').unlink()
  independent=restore_archive(self.root/'archive.zip',self.root/'restored-independent',filehash(self.root/'archive.zip'))
  self.assertFalse(independent['source_directory_required']);self.assertEqual(independent['restored_counts']['memberships'],11)



 def test_driver_resumes_committed_buckets_after_interruption(self):
  import shutil
  from unittest.mock import patch
  import run as driver
  sys.path.insert(0,str(Path(__file__).with_name('tools')))
  projection=self.root/'projection';projection.mkdir();shutil.copyfile(self.root/'source.sqlite',projection/'00.sqlite');shutil.copyfile(self.root/'source.sqlite',projection/'empty.sqlite')
  empty=sqlite3.connect(projection/'empty.sqlite');empty.executescript('DELETE FROM families;DELETE FROM members;DELETE FROM aliases;');empty.close()
  from query import filehash
  receipts=[dict(identity=dict(bucket=f'{i:02x}',files=[]),database='00.sqlite' if i==0 else 'empty.sqlite',database_sha256=filehash(projection/('00.sqlite' if i==0 else 'empty.sqlite'))) for i in range(256)]
  m=dict(complete=True,shards=receipts,version='TEST_ONLY',source_commit='0'*40,source_root=str(projection),counts=dict(families=3,aliases=1,en=11,de=0,es=0,fr=0,it=0,ru=0));(projection/'MANIFEST.json').write_bytes(canonical(m))
  class FixtureAdapter:
   manifest=m
   def __init__(self,*args):pass
   def close(self):pass
  class FixtureHistory:
   decisions=[];digest='TEST_ONLY'
  original=driver.ingest;calls=[]
  def interrupted(db,source,receipt,crash):
   if receipt['identity']['bucket']=='01':raise RuntimeError('TEST_ONLY interruption after committed bucket')
   return original(db,source,receipt,crash)
  out=self.root/'driver'
  with patch.object(driver,'Adapter',FixtureAdapter),patch.object(driver,'history_reader',lambda:(FixtureHistory(),'TEST_ONLY')),contextlib.redirect_stdout(io.StringIO()):
   with patch.object(driver,'ingest',interrupted):
    with self.assertRaisesRegex(RuntimeError,'interruption'):driver.run(projection,out)
   self.assertFalse((out/'MANIFEST.json').exists())
   def resumed(db,source,receipt,crash):calls.append(receipt['identity']['bucket']);return original(db,source,receipt,crash)
   with patch.object(driver,'ingest',resumed):result=driver.run(projection,out)
  self.assertNotIn('00',calls);self.assertEqual(len(calls),255);self.assertEqual(result['counts']['memberships'],11)
  from finalize import finalize
  copied=self.root/'copied';shutil.copytree(out,copied)
  with self.assertRaisesRegex(ValueError,'fresh execution'):finalize(out,copied)
  with self.assertRaisesRegex(ValueError,'fresh execution'):finalize(out,out)
  replay=self.root/'driver-replay'
  with patch.object(driver,'Adapter',FixtureAdapter),patch.object(driver,'history_reader',lambda:(FixtureHistory(),'TEST_ONLY')),contextlib.redirect_stdout(io.StringIO()):driver.run(projection,replay)
  finalize(out,replay)
  coverage=(replay/'COVERAGE.json').read_bytes();cov=json.loads(coverage);cov['buckets'][0]['family_ids_sha256']='0'*64
  (replay/'COVERAGE.json').write_bytes(canonical(cov)+b'\n')
  from classify import digest
  changed=json.loads((replay/'MANIFEST.json').read_bytes());changed['outputs']['COVERAGE.json']=filehash(replay/'COVERAGE.json');changed.pop('version');changed['version']=digest(changed);(replay/'MANIFEST.json').write_bytes(canonical(changed))
  with self.assertRaisesRegex(ValueError,'coverage'):finalize(out,replay)
  self.assertEqual(json.loads((out/'MECHANISM-COHORTS.json').read_bytes())['memberships'],11)
  self.assertEqual(json.loads((out/'PRIORITY-QUEUES/MANIFEST.json').read_bytes())['outputs']['PRIORITY_2.ndjson.gz']['families']+sum(v['families'] for k,v in json.loads((out/'PRIORITY-QUEUES/MANIFEST.json').read_bytes())['outputs'].items() if k!='PRIORITY_2.ndjson.gz'),3)


 def test_4359927862_russian_ending_uses_search_representation(self):
  src=sqlite3.connect(self.root/'source.sqlite')
  with src:
   for fid,body in list(src.execute('SELECT id,body FROM families')):
    f=json.loads(zlib.decompress(body));f['canonical']='iks';src.execute('UPDATE families SET body=? WHERE id=?',(zlib.compress(canonical(f)),fid))
   for fid,lang,lid,ordinal,body in list(src.execute('SELECT * FROM members')):
    r=json.loads(zlib.decompress(body));r.update(word='префикс'+str(ordinal)+'икс',normalized='префикс'+str(ordinal)+'икс',search_form='prefiks'+str(ordinal)+'iks')
    src.execute('UPDATE members SET language=?,body=? WHERE family=? AND lemma=?',('ru',zlib.compress(canonical(r)),fid,lid))
  src.close();ingest(self.db,self.root,self.receipt);cross_family(self.db)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM flags WHERE flag='ENDING_PREFIX_DIVERSITY_PROXY'").fetchone()[0],2)
 def test_4359927853_failed_restore_has_no_published_or_partial_target(self):
  import zipfile
  sys.path.insert(0,str(Path(__file__).with_name('tools')))
  from backup import restore_archive
  archive=self.root/'bad.zip';target=self.root/'restored'
  with zipfile.ZipFile(archive,'w') as z:
   z.writestr('data',b'changed');z.writestr('BACKUP-MANIFEST.json',canonical(dict(files={'data':dict(sha256='0'*64,bytes=7)})))
  with self.assertRaises(ValueError):restore_archive(archive,target)
  self.assertFalse(target.exists());self.assertFalse(target.with_name(target.name+'.partial').exists())

 def test_4359927816_coverage_mismatch_cannot_be_certified(self):
  import shutil
  from run import publish
  sys.path.insert(0,str(Path(__file__).with_name('tools')))
  from finalize import finalize
  from query import filehash
  ingest(self.db,self.root,self.receipt);cross_family(self.db)
  identity=dict(expected_counts=dict(families=3,aliases=1,en=11,de=0,fr=0,es=0,it=0,ru=0))
  dirs=[]
  for name in ['first','replay']:
   out=self.root/name;out.mkdir();execution=dict(run_id='TEST_ONLY_'+name,output=str(out.resolve()))
   with self.db:self.db.execute('INSERT OR REPLACE INTO state VALUES(?,?)',('execution',canonical(execution).decode()))
   shutil.copyfile(self.root/'out.sqlite',out/'registry.sqlite');publish(self.db,out,identity);dirs.append(out)
  first,replay=dirs;cov=json.loads((replay/'COVERAGE.json').read_bytes());cov['buckets'][0]['family_ids_sha256']='0'*64;(replay/'COVERAGE.json').write_bytes(canonical(cov))
  m=json.loads((replay/'MANIFEST.json').read_bytes());m['outputs']['COVERAGE.json']=filehash(replay/'COVERAGE.json');m.pop('version');m['version']=digest(m);(replay/'MANIFEST.json').write_bytes(canonical(m))
  with self.assertRaisesRegex(ValueError,'coverage'):finalize(first,replay)
 def test_4359927871_backup_manifest_has_fixed_timestamp(self):
  import shutil
  from unittest.mock import patch
  sys.path.insert(0,str(Path(__file__).with_name('tools')))
  from backup import backup
  from query import filehash
  ingest(self.db,self.root,self.receipt);cross_family(self.db);self.db.commit()
  source=self.root/'input';source.mkdir();shutil.copyfile(self.root/'out.sqlite',source/'out.sqlite')
  m=dict(database='out.sqlite',database_sha256=filehash(source/'out.sqlite'),complete=True);m['version']=digest(m);(source/'MANIFEST.json').write_bytes(canonical(m))
  import zipfile
  for day in [23,24]:
   with patch.object(zipfile.time,'localtime',lambda *args,d=day:(2026,10,d,1,0,0,0,0,0)):
    backup(source,self.root/f'{day}.zip',self.root/f'restored-{day}')
  self.assertEqual(filehash(self.root/'23.zip'),filehash(self.root/'24.zip'))
 def test_4359927842_transitive_implementation_is_pinned(self):
  from run import code_lock
  keys=set(code_lock())
  self.assertTrue({'associativvordes/v5_adapter/common.py','associativvordes/v5_adapter/bridge.py','associativvordes/history_registry/registry.py'}<=keys)
if __name__=='__main__':unittest.main()

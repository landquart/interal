import contextlib,gzip,importlib.util,io,json,pathlib,shutil,sqlite3,subprocess,sys,tarfile,tempfile,unittest
SPEC=importlib.util.spec_from_file_location('census',pathlib.Path(__file__).with_name('census.py'))
c=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(c)
class CensusTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def gz(self,p,x):
  p.parent.mkdir(parents=True,exist_ok=True)
  with gzip.open(p,'wt',encoding='utf8') as f:json.dump(x,f,ensure_ascii=False)
 def snapshot(self):
  snap=self.root/'snapshot';families={};members={};aliases={}
  for i in range(2):
   j=0
   while c.bucket(f'family:test:{i}:{j}')!=f'{i:02x}':j+=1
   fid=f'family:test:{i}:{j}';alias='test'+str(i)
   row={'lemma_id':'lemma:'+str(i),'word':alias,'normalized':alias,'frequency_score':12,'sources':[{'id':'test-source'}],'components':[{'canonical_candidate':alias,'evidence':[{'type':'TEST_ONLY'}]}]}
   families[fid]={'id':fid,'canonical':alias,'aliases':[alias],'support':1,'language_support':{'en':1},'relation_types':['TEST_ONLY']}
   members[fid]=[row];aliases[alias]=[fid]
  for bi in range(256):
   b=f'{bi:02x}';self.gz(snap/'current'/c.PREFIX/'families'/f'{b}.json.gz',{k:v for k,v in families.items() if c.bucket(k)==b})
   self.gz(snap/'current'/c.PREFIX/'aliases'/f'{b}.json.gz',{k:v for k,v in aliases.items() if c.bucket(k)==b})
   for lang in c.LANGS:
    rows={k:v for k,v in members.items() if c.bucket(k)==b} if lang=='en' else {}
    self.gz(snap/'current'/c.PREFIX/'members'/lang/f'{b}.json.gz',rows)
    self.gz(snap/'original'/c.PREFIX/'members'/lang/f'{b}.json.gz',rows)
  lock={'files':c.inventory(snap),'production_commit':'TEST_ONLY','original_materialization_commit':'TEST_ONLY'}
  lock['inventory_sha256']=c.hashlib.sha256(c.canonical(lock['files'])).hexdigest();c.atomic_json(snap/'SNAPSHOT.json',lock)
  return snap,members
 def refresh(self,snap):
  lock=c.load(snap/'SNAPSHOT.json');lock['files']=c.inventory(snap);lock['inventory_sha256']=c.hashlib.sha256(c.canonical(lock['files'])).hexdigest();c.atomic_json(snap/'SNAPSHOT.json',lock)
 def test_bucket_utf16_known_vectors(self):
  self.assertEqual(c.bucket('a'),'2c');self.assertEqual(c.bucket('family:liber'),'17')
  self.assertEqual(c.bucket('👁'),'cc');self.assertEqual(c.bucket('fr:œil'),'63')
 def test_parser_unicode_and_large_value(self):
  p=self.root/'large.gz';self.gz(p,{'one':{'unicode':'глаз👁','payload':'x'*180000},'two':[1,2,3]})
  rows=list(c.pairs(p));self.assertEqual(rows[0][1]['unicode'],'глаз👁');self.assertEqual(rows[1],('two',[1,2,3]))
 def test_parser_preserves_duplicate_top_level_keys(self):
  p=self.root/'dup.gz'
  with gzip.open(p,'wt') as f:f.write('{"x":[],"x":[1]}')
  self.assertEqual(len(list(c.pairs(p))),2)
 def test_parser_rejects_trailing_json(self):
  p=self.root/'bad.gz'
  with gzip.open(p,'wt') as f:f.write('{"x":[]} []')
  with self.assertRaises(ValueError):list(c.pairs(p))
 def test_gzip_crc_and_truncation(self):
  p=self.root/'bad.gz';self.gz(p,{'x':[1,2]});p.write_bytes(p.read_bytes()[:-5])
  with self.assertRaises((EOFError,OSError)):list(c.pairs(p))
 def test_atomic_replace_and_verify(self):
  p=self.root/'a.json';c.atomic_json(p,{'v':1});c.atomic_json(p,{'v':2});self.assertEqual(c.load(p),{'v':2})
  self.assertEqual(list(self.root.glob('a.json.*')),[])
 def test_real_hard_crash_resume_and_full_accounting(self):
  snap,_=self.snapshot();work=self.root/'run'
  cmd=[sys.executable,str(pathlib.Path(c.__file__)),'census','--snapshot',str(snap),'--work',str(work),'--crash-after','2']
  r=subprocess.run(cmd,capture_output=True);self.assertEqual(r.returncode,75,r.stderr)
  db=sqlite3.connect(work/'census.sqlite');self.assertEqual(db.execute('select count(*) from checkpoints').fetchone()[0],1);self.assertEqual(db.execute('select count(*) from current_lemmas').fetchone()[0],1);db.close()
  with contextlib.redirect_stdout(io.StringIO()):c.run(snap,work)
  result=c.load(work/'FULL-CENSUS.json');self.assertEqual(result['counts']['canonical_families'],2);self.assertEqual(result['counts']['memberships'],2)
  self.assertTrue(result['source_equation']['holds']);before=c.sha_file(work/'FULL-CENSUS.json')
  with contextlib.redirect_stdout(io.StringIO()):c.run(snap,work)
  self.assertEqual(before,c.sha_file(work/'FULL-CENSUS.json'))
  (work/'IDENTITY.json').write_text('{}')
  with self.assertRaisesRegex(ValueError,'other snapshot/code'):c.run(snap,work)
 def test_duplicates_orphans_and_corrupt_shards_recorded_not_fixed(self):
  snap,members=self.snapshot();fid=next(iter(members));b=c.bucket(fid);p=snap/'current'/c.PREFIX/'members'/'en'/f'{b}.json.gz'
  self.gz(p,{fid:members[fid]*2,'family:missing':members[fid]})
  bad=snap/'current'/c.PREFIX/'aliases'/'00.json.gz';bad.write_bytes(b'not gzip');self.refresh(snap);before=c.sha_file(p)
  with contextlib.redirect_stdout(io.StringIO()):c.run(snap,self.root/'run')
  issues=c.load(self.root/'run/INTEGRITY-REPORT.json')['structural_findings']
  for kind in ('duplicate_membership','orphan_member_family','corrupt_shard','support_mismatch'):self.assertGreater(issues[kind],0)
  self.assertEqual(c.sha_file(p),before)
 def test_snapshot_tampering_detected(self):
  snap,_=self.snapshot();p=snap/'current'/c.PREFIX/'families'/'00.json.gz';p.write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'checksum mismatch'):c.verify_snapshot(snap)
 def test_backup_restore_exact_bytes_and_no_overwrite(self):
  snap,_=self.snapshot();archive=self.root/'backup.tar';receipt=c.backup(snap,archive)
  restored=c.restore(archive,self.root/'restore',receipt['archive_sha256']);self.assertTrue(restored['restore_verified'])
  self.assertEqual(c.sha_file(snap/'SNAPSHOT.json'),c.sha_file(self.root/'restore/SNAPSHOT.json'))
  with self.assertRaises(ValueError):c.restore(archive,self.root/'restore',receipt['archive_sha256'])
  with self.assertRaisesRegex(ValueError,'checksum'):c.restore(archive,self.root/'other','0'*64)
 def test_restore_rejects_path_traversal(self):
  archive=self.root/'evil.tar'
  with tarfile.open(archive,'w') as tar:
   m=tarfile.TarInfo('../escape');m.size=1;tar.addfile(m,io.BytesIO(b'x'))
  with self.assertRaisesRegex(ValueError,'Unsafe'):c.restore(archive,self.root/'restore',c.sha_file(archive))
  self.assertFalse((self.root/'escape').exists())
 def test_restore_rejects_links(self):
  archive=self.root/'evil.tar'
  with tarfile.open(archive,'w') as tar:
   m=tarfile.TarInfo('link');m.type=tarfile.SYMTYPE;m.linkname='/etc/passwd';tar.addfile(m)
  with self.assertRaisesRegex(ValueError,'Unsafe'):c.restore(archive,self.root/'restore',c.sha_file(archive))
if __name__=='__main__':unittest.main()

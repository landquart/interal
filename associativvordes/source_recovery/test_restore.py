import hashlib,io,json,sqlite3,tempfile,unittest,zipfile
from pathlib import Path
from .restore import Concat,hash_file,safe,verify,SOURCE_ROOT
class RecoveryTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.downloads=self.root/'downloads';self.downloads.mkdir()
 def plan(self,entries):
  p=self.downloads/'test.zip'
  with zipfile.ZipFile(p,'w') as z:
   for name,content in entries:z.writestr(name,content)
  row=dict(file=p.name,bytes=p.stat().st_size,sha256=hash_file(p));return dict(name=p.name,format='zip',parts=[row],bytes=row['bytes'],sha256=row['sha256'])
 def run_plan(self,p):return verify(p,self.downloads,self.root/'cold',self.root/'report.json')
 def test_concat_random_seeks_and_boundaries(self):
  c=Concat([io.BytesIO(b'abc'),io.BytesIO(b'defg')]);self.assertEqual(c.read(5),b'abcde');c.seek(-3,2);self.assertEqual(c.read(),b'efg');c.seek(1);self.assertEqual(c.read(5),b'bcdef');c.seek(100);self.assertEqual(c.read(),b'')
 def test_real_sqlite_physical_restore(self):
  db=self.root/'fixture.sqlite';d=sqlite3.connect(db);d.execute('create table test(x)');d.execute('insert into test values (7)');d.commit();d.close();r=self.run_plan(self.plan([('fixture.sqlite',db.read_bytes())]));self.assertEqual(r['sqlite_databases'],1);self.assertEqual(r['members'][0]['sqlite_integrity'],'ok');self.assertFalse(r['pipeline_replayed']);self.assertEqual(list((self.root/'cold').iterdir()),[])
 def test_checkout_restore_destination_rejected(self):
  p=self.plan([('a',b'x')])
  with self.assertRaisesRegex(ValueError,'outside source checkout'):verify(p,self.downloads,SOURCE_ROOT/'TEST_ONLY_FORBIDDEN_RECOVERY',self.root/'report.json')
 def test_traversal_rejected(self):
  with self.assertRaisesRegex(ValueError,'unsafe'):self.run_plan(self.plan([('../bad',b'x')]))
 def test_duplicate_normalized_names_rejected(self):
  with self.assertRaisesRegex(ValueError,'duplicate'):self.run_plan(self.plan([('a',b'x'),('./a',b'y')]))
 def test_forged_part_hash_rejected(self):
  p=self.plan([('a',b'x')]);p['parts'][0]['sha256']='0'*64
  with self.assertRaisesRegex(ValueError,'part mismatch'):self.run_plan(p)
 def test_fresh_directory_required(self):
  p=self.plan([('a',b'x')]);(self.root/'cold').mkdir()
  with self.assertRaisesRegex(ValueError,'fresh'):self.run_plan(p)
 def test_missing_expected_member_rejected(self):
  p=self.plan([('a',b'x')]);p['expected_members']={'missing':dict(bytes=1,sha256='a'*64)}
  with self.assertRaisesRegex(ValueError,'absent'):self.run_plan(p)
if __name__=='__main__':unittest.main()

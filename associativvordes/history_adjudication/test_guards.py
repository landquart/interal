import hashlib,json,os,shutil,subprocess,sys,tempfile,unittest
from pathlib import Path
from .build import classify
ROOT=Path(__file__).resolve().parents[2]
class Guards(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.base=Path(self.tmp.name);self.repo=self.base/'repo';(self.repo/'associativvordes').mkdir(parents=True);(self.repo/'scripts/lib').mkdir(parents=True)
  for name in ['mutation_guard.py','__init__.py']:shutil.copy2(ROOT/'associativvordes'/name,self.repo/'associativvordes'/name)
  shutil.copy2(ROOT/'scripts/lib/installed-history-fence.mjs',self.repo/'scripts/lib/installed-history-fence.mjs')
  self.protected=self.repo/'associativvordes/family-index-v5';self.protected.mkdir();self.file=self.protected/'fixture.json';self.file.write_text('BEFORE')
 def py(self,code):
  r=subprocess.run([sys.executable,'-c',"import sys;sys.path.insert(0,sys.argv[1]);import associativvordes;from pathlib import Path;import os,shutil;"+code,str(self.repo),str(self.file),str(self.base)],capture_output=True,text=True,cwd=self.base)
  self.assertNotEqual(r.returncode,0,r.stdout+r.stderr);self.assertIn('HISTORY_BLOCKED',r.stderr);self.assertEqual(self.file.read_text(),'BEFORE')
 def test_python_open(self):self.py("Path(sys.argv[2]).write_text('BAD')")
 def test_python_os_open(self):self.py("os.open(sys.argv[2],os.O_RDWR)")
 def test_python_copy(self):self.py("shutil.copyfile(__file__ if '__file__' in globals() else sys.executable,sys.argv[2])")
 def test_python_parent_delete(self):self.py("shutil.rmtree(sys.argv[1])")
 def test_python_directory_fd(self):self.py("fd=os.open(str(Path(sys.argv[2]).parent),os.O_RDONLY);os.open('fixture.json',os.O_WRONLY,dir_fd=fd)")
 def test_python_posix_directory_fd(self):self.py("import posix;fd=posix.open(str(Path(sys.argv[2]).parent),os.O_RDONLY);posix.open('fixture.json',os.O_WRONLY,dir_fd=fd)")
 def test_python_sqlite_target(self):self.py("import sqlite3;sqlite3.connect(sys.argv[2])")
 def test_python_neighbor_research(self):
  p=self.base/'research.json';r=subprocess.run([sys.executable,'-c',"import sys;sys.path.insert(0,sys.argv[1]);import associativvordes;from pathlib import Path;Path(sys.argv[2]).write_text('TEST_ONLY')",str(self.repo),str(p)],capture_output=True,text=True,cwd=self.base);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(p.read_text(),'TEST_ONLY')
 def node(self,code):
  module=(self.repo/'scripts/lib/installed-history-fence.mjs').as_uri();script="import * as fs from 'node:fs';import * as fsp from 'node:fs/promises';await import("+json.dumps(module)+");const target="+json.dumps(str(self.file))+";"+code
  r=subprocess.run(['node','--input-type=module','-e',script],capture_output=True,text=True,cwd=self.base);self.assertNotEqual(r.returncode,0,r.stdout+r.stderr);self.assertIn('HISTORY_BLOCKED',r.stderr);self.assertEqual(self.file.read_text(),'BEFORE')
 def test_js_promises_write(self):self.node("await fsp.writeFile(target,'BAD')")
 def test_js_sync_write(self):self.node("fs.writeFileSync(target,'BAD')")
 def test_js_open_handle(self):self.node("await fsp.open(target,'r+')")
 def test_js_stream(self):self.node("fs.createWriteStream(target)")
 def test_js_parent_delete(self):self.node("await fsp.rm("+json.dumps(str(self.repo))+",{recursive:true,force:true})")
 def test_js_dotdot_name_inside_protected(self):self.node("await fsp.writeFile(target.replace('fixture.json','..innocent'),'BAD')")
 def test_js_symlink_alias(self):
  link=self.base/'alias';link.symlink_to(self.protected,target_is_directory=True);self.node("await fsp.writeFile("+json.dumps(str(link/'fixture.json'))+",'BAD')")
 def test_engineering_measurement_is_not_decision(self):self.assertEqual(classify(dict(status='PASS',records=100))[1],'RESOLVED_INVALID')
 def test_unknown_native_scope_quarantined(self):self.assertEqual(classify(dict(status='PASS',family_id='F'))[1],'QUARANTINED_UNRESOLVED')
 def test_claimed_newer_authority_never_supersedes(self):self.assertEqual(classify(dict(decision='CONFIRMED_MEMBER',supersedes=['old'],authority='OWNER',date='2099'))[1],'QUARANTINED_UNRESOLVED')
if __name__=='__main__':unittest.main()

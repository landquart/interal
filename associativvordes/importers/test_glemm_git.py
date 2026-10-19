import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from fetch_glemm_git import export
from morphology_import import validate_lock
import test_glemm_cache as cachefixtures

class GitExportTests(unittest.TestCase):
    def make_upstream(self,root,raw,path,lock):
        repo=root/'upstream';repo.mkdir()
        for a in lock['artifacts']:
            p=repo/('GLeMM_2.0/output/'+a['path'].removeprefix('GLeMM/'))
            p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((raw/a['path']).read_bytes())
        def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()
        git('init','-q');git('add','.');git('-c','user.name=Fixture test','-c','user.email=fixture@example.invalid','commit','-qm','Real attributed GLeMM excerpt transport fixture')
        for a in lock['artifacts']:a['revision']=git('rev-parse','HEAD')
        path.write_text(json.dumps(lock));return repo

    def test_real_excerpt_git_export_is_exact_and_repeatable(self):
        with tempfile.TemporaryDirectory() as d:
            root,raw,path,lock=cachefixtures.CacheTests().setup_cache(d)
            repo=self.make_upstream(root,raw,path,lock);out=root/'exported'
            result=export(path,out,str(repo));self.assertEqual(result['status'],'verified_git_export')
            validate_lock(lock,out)
            self.assertEqual(export(path,out,'nonexistent')['status'],'verified_cache')

    def test_git_export_does_not_publish_when_pinned_content_disagrees(self):
        with tempfile.TemporaryDirectory() as d:
            root,raw,path,lock=cachefixtures.CacheTests().setup_cache(d);repo=self.make_upstream(root,raw,path,lock)
            lock['artifacts'][-1]['sha256']='0'*64;path.write_text(json.dumps(lock))
            out=root/'exported'
            with self.assertRaises(ValueError):export(path,out,str(repo))
            self.assertFalse((out/'GLeMM').exists())

if __name__=='__main__':unittest.main()

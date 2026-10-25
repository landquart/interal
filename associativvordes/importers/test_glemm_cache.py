if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile
from associativvordes.importers.glemm_cache import pack,restore,import_upstream
from associativvordes.importers.morphology_import import validate_lock

FIXTURES=Path(__file__).with_name('fixtures')

class CacheTests(unittest.TestCase):
    def setup_cache(self,d):
        root=Path(d);raw=root/'raw';raw.mkdir()
        lock=json.loads((FIXTURES/'source-lock.json').read_text())
        lock['artifacts']=[a.copy() for a in lock['artifacts'] if a['source']=='GLeMM']
        for a in lock['artifacts']:
            source=FIXTURES/a['path'];a['path']='GLeMM/excerpts/'+source.name
            dest=raw/a['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
        path=root/'lock.json';path.write_text(json.dumps(lock))
        return root,raw,path,lock

    def test_real_excerpts_roundtrip_and_deterministic_archive(self):
        with tempfile.TemporaryDirectory() as d:
            root,raw,path,lock=self.setup_cache(d)
            a=pack(raw,root/'first.zip',path);b=pack(raw,root/'second.zip',path)
            self.assertEqual(a['sha256'],b['sha256']);self.assertEqual(a['bytes'],b['bytes'])
            dest=root/'restored';restore(root/'first.zip',dest,path);validate_lock(lock,dest)
            restore(root/'first.zip',dest,path)  # idempotent, does not overwrite
            for artifact in lock['artifacts']:self.assertEqual((raw/artifact['path']).read_bytes(),(dest/artifact['path']).read_bytes())

    def test_tampered_bytes_or_lock_never_publish(self):
        with tempfile.TemporaryDirectory() as d:
            root,raw,path,lock=self.setup_cache(d);pack(raw,root/'good.zip',path)
            for changed in ['source-lock.json',lock['artifacts'][0]['path']]:
                with zipfile.ZipFile(root/'good.zip') as src,zipfile.ZipFile(root/'bad.zip','w') as dest:
                    for i in src.infolist():
                        body=src.read(i.filename)
                        if i.filename==changed:body=bytes([body[0]^1])+body[1:]
                        dest.writestr(i,body)
                with self.assertRaises(ValueError):restore(root/'bad.zip',root/'out',path)
                self.assertFalse((root/'out/GLeMM').exists())

    def test_extra_entries_and_existing_corruption_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            root,raw,path,lock=self.setup_cache(d);pack(raw,root/'good.zip',path)
            shutil.copyfile(root/'good.zip',root/'extra.zip')
            with zipfile.ZipFile(root/'extra.zip','a') as z:z.writestr('../escape',b'bad')
            with self.assertRaises(ValueError):restore(root/'extra.zip',root/'out',path)
            self.assertFalse((root/'escape').exists())
            bad=raw/lock['artifacts'][0]['path'];bad.write_bytes(b'bad')
            with self.assertRaises(ValueError):restore(root/'good.zip',raw,path)
            self.assertEqual(bad.read_bytes(),b'bad')

    def test_upstream_directory_zip_selects_only_real_pinned_excerpts(self):
        with tempfile.TemporaryDirectory() as d:
            root,raw,path,lock=self.setup_cache(d)
            with zipfile.ZipFile(root/'upstream.zip','w') as z:
                z.writestr('upstream/unrelated',b'not an import input')
                for a in lock['artifacts']:
                    name='upstream/GLeMM_2.0/output/'+a['path'].removeprefix('GLeMM/')
                    z.writestr(name,(raw/a['path']).read_bytes())
            import_upstream(root/'upstream.zip',root/'out',path);validate_lock(lock,root/'out')
            with zipfile.ZipFile(root/'upstream.zip','a') as z:
                a=lock['artifacts'][0]
                z.writestr('second/GLeMM_2.0/output/'+a['path'].removeprefix('GLeMM/'),(raw/a['path']).read_bytes())
            with self.assertRaises(ValueError):import_upstream(root/'upstream.zip',root/'other',path)
            self.assertFalse((root/'other/GLeMM').exists())

if __name__=='__main__':unittest.main()

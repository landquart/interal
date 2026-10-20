import gzip
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
import zlib
from scale_project import build


class ProjectScaleTests(unittest.TestCase):
    def test_real_frequency_observation_checkpoint_and_source_change(self):
        fixture=json.loads((Path(__file__).parent/'fixtures/frequencies.json').read_text())[0]
        row=json.loads(fixture['record_json']); family=fixture['locators'][0]['family_key']; lang=fixture['language']
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); repo=root/'repo'; repo.mkdir(); prefix=repo/'associativvordes/family-index-v5'
            family_path=prefix/'families/00.json.gz'; family_path.parent.mkdir(parents=True)
            family_path.write_bytes(gzip.compress(json.dumps({family:{'id':family,'review_status':'fixture_original_observation'}}).encode(),mtime=0))
            member=prefix/'members'/lang/'00.json.gz'; member.parent.mkdir(parents=True)
            member.write_bytes(gzip.compress(json.dumps({family:[row]}).encode(),mtime=0))
            def git(*args): return subprocess.check_output(['git',*args],cwd=repo,stderr=subprocess.DEVNULL,text=True).strip()
            git('init'); git('add','.'); git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Real frequency excerpt')
            revision=git('rev-parse','HEAD'); output=root/'index'
            self.assertEqual(build(repo,revision,output,stop_after=1)['status'],'checkpoint')
            result=build(repo,revision,output)
            self.assertEqual(result['counts']['seeds'],1)
            db=sqlite3.connect(output/'project.sqlite')
            try:
                observed=json.loads(zlib.decompress(db.execute('SELECT body FROM frequencies').fetchone()[0]))
                for field in ['rank','frequency_score','category_breakdown','sources']:
                    if field in row: self.assertEqual(observed[field],row[field])
                original=db.execute('SELECT lemma FROM seeds').fetchone()[0]
                self.assertEqual(original,row['lemma_id'])
            finally: db.close()
            reused=build(repo,revision,output); self.assertEqual(reused['processed_shards'],0)
            member.write_bytes(b'damaged')
            with self.assertRaisesRegex(ValueError,'checksum mismatch'): build(repo,revision,output)


if __name__=='__main__': unittest.main()

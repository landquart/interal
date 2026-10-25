if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import gzip
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
import zlib
from associativvordes.candidate_search.scale_project import build
from associativvordes.candidate_search.project_store import verified_project, resume_project
from associativvordes.importers.scale_index import Index
from associativvordes.importers.morphology_import import hash_file
from associativvordes.candidate_search.benchmark_scale import benchmark


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
            self.assertEqual(verified_project(output/'project.sqlite')['status'],'PASS')
            db=sqlite3.connect(output/'project.sqlite')
            try:
                observed=json.loads(zlib.decompress(db.execute('SELECT body FROM frequencies').fetchone()[0]))
                for field in ['rank','frequency_score','category_breakdown','sources']:
                    if field in row: self.assertEqual(observed[field],row[field])
                original=db.execute('SELECT lemma FROM seeds').fetchone()[0]
                self.assertEqual(original,row['lemma_id'])
            finally: db.close()
            reused=build(repo,revision,output); self.assertEqual(reused['processed_shards'],0)
            with open(output/'project.sqlite','ab') as stream: stream.write(b'tampered index')
            with self.assertRaisesRegex(ValueError,'index checksum mismatch'): verified_project(output/'project.sqlite')
            receipt_before=(output/'PROJECT.json').read_bytes()
            with self.assertRaisesRegex(ValueError,'index checksum mismatch'):
                resume_project(repo,revision,output)
            self.assertEqual(receipt_before,(output/'PROJECT.json').read_bytes())
            member.write_bytes(b'damaged')
            with self.assertRaisesRegex(ValueError,'checksum mismatch'): build(repo,revision,output)

    def test_benchmark_real_internet_derivative_and_frequency_queue_replay(self):
        here=Path(__file__).parent
        fixture=json.loads((here/'fixtures/frequencies.json').read_text())[0]
        row=json.loads(fixture['record_json']); family=fixture['locators'][0]['family_key']
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); repo=root/'repo'; repo.mkdir()
            prefix=repo/'associativvordes/family-index-v5'
            family_file=prefix/'families/00.json.gz'; family_file.parent.mkdir(parents=True)
            family_file.write_bytes(gzip.compress(json.dumps({family:{'id':family}}).encode(),mtime=0))
            member=prefix/'members'/fixture['language']/'00.json.gz'; member.parent.mkdir(parents=True)
            member.write_bytes(gzip.compress(json.dumps({family:[row]}).encode(),mtime=0))
            def git(*args): return subprocess.check_output(['git',*args],cwd=repo,stderr=subprocess.DEVNULL,text=True).strip()
            git('init'); git('add','.'); git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Real frequency excerpt')
            project=root/'project'; build(repo,git('rev-parse','HEAD'),project)
            snapshot=root/'snapshot'; snapshot.mkdir()
            records=(here/'fixtures/records.ndjson').read_bytes()
            data=snapshot/'records.ndjson.gz'; data.write_bytes(gzip.compress(records,mtime=0))
            (snapshot/'manifest.json').write_text(json.dumps({'outputs':{'records.ndjson.gz':hash_file(data)},
                'reports':[{'accepted':len(records.splitlines())}]}))
            registry=json.loads((here.parents[1]/'data/morphology-evidence/sources/source-lock.json').read_text())
            source=root/'source.sqlite'; index=Index(source)
            try: index.ingest('real-candidate-excerpts',snapshot,registry)
            finally: index.close()
            out=root/'benchmark'
            first=benchmark(source,project/'project.sqlite',out)
            self.assertEqual(first['status'],'PASS')
            self.assertEqual(first['bounded_paths_and_queue']['history_retained'],'PASS')
            self.assertTrue(all(s['frequency_payloads_read']==1 for s in first['payload_stages']))
            self.assertTrue(all(s['grouped_questions']>0 for s in first['payload_stages']))
            before=(out/'payload-1000/questions.ndjson').read_bytes()
            second=benchmark(source,project/'project.sqlite',out)
            self.assertEqual(before,(out/'payload-1000/questions.ndjson').read_bytes())
            for line in before.splitlines():
                question=json.loads(line)
                self.assertFalse(question['establishes_membership'])
                self.assertEqual(question['family_guard_status'],'not_eligible_for_operational_queue')
                self.assertEqual(set(question['native_lexemes']),{p['nodes'][-1] for p in question['discovery_paths']})
                self.assertTrue(question['benchmark_only'])


if __name__=='__main__': unittest.main()

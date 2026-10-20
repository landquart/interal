import contextlib
import gzip
import io
import json
from pathlib import Path
import tempfile
import unittest
from morphology_import import run, digest, hash_file
from certify_corpus import atomic_json, verified, publish
from scale_index import Index

HERE=Path(__file__).parent


class CertificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.registry=json.loads((HERE/'fixtures/source-lock.json').read_text())
        with contextlib.redirect_stdout(io.StringIO()):
            self.snapshot=run(HERE/'fixtures/source-lock.json',HERE/'fixtures',self.root/'staging')

    def tearDown(self): self.tmp.cleanup()

    def test_resume_real_rows_and_preserve_original_payload(self):
        a=Index(self.root/'a.sqlite'); b=Index(self.root/'b.sqlite')
        try:
            stopped=a.ingest('real',self.snapshot,self.registry,stop_after=1)
            self.assertTrue(stopped['checkpoint'])
            a.close(); a=Index(self.root/'a.sqlite')
            resumed=a.ingest('real',self.snapshot,self.registry)
            fresh=b.ingest('real',self.snapshot,self.registry)
            self.assertEqual(resumed['read'],fresh['read'])
            originals={r['id']:r for r in map(json.loads,gzip.open(self.snapshot/'records.ndjson.gz','rt'))}
            inflections=sum('inflection' in r['body']['normalized'] for r in originals.values())
            self.assertEqual(resumed['inflections'],inflections)
            for seq,eid in a.db.execute('SELECT seq,eid FROM records'):
                row=a.record(seq); self.assertEqual(row,originals[row['id']])
                self.assertNotIn('inflection',row['body']['normalized'])
            for lang,word in a.db.execute('SELECT DISTINCT language,search FROM lexemes'):
                self.assertEqual(a.exact(lang,word),b.exact(lang,word))
            for identifier, in a.db.execute('SELECT id FROM lexemes'):
                self.assertEqual(a.paths('lexeme:'+identifier.hex()),b.paths('lexeme:'+identifier.hex()))
            self.assertEqual(a.ingest('real',self.snapshot,self.registry)['reprocessed'],0)
        finally: a.close(); b.close()

    def test_unknown_direction_is_not_productive(self):
        index=Index(self.root/'index.sqlite')
        try:
            index.ingest('real',self.snapshot,self.registry)
            unknown=list(index.db.execute("SELECT DISTINCT src FROM arcs WHERE direction='unknown'"))
            self.assertTrue(unknown)
            for source, in unknown:
                result=index.paths('lexeme:'+source.hex())
                self.assertFalse(result['establishes_membership'])
                for path in result['paths']:
                    self.assertTrue(all(s['direction']=='directed' for s in path['steps']))
            with self.assertRaisesRegex(ValueError,'bounded'): index.exact('en','word',100000)
        finally: index.close()

    def test_corrupt_and_missing_inputs_fail(self):
        index=Index(self.root/'index.sqlite')
        try:
            index.ingest('real',self.snapshot,self.registry,stop_after=1)
            (self.snapshot/'quarantine.ndjson').write_text('{}')
            with self.assertRaisesRegex(ValueError,'corruption'):
                index.ingest('real',self.snapshot,self.registry)
            (self.snapshot/'quarantine.ndjson').write_bytes(b'')
            (self.snapshot/'records.ndjson.gz').unlink()
            with self.assertRaises(FileNotFoundError): verified(self.snapshot,'manifest.json')
        finally: index.close()

    def test_failed_publication_preserves_current_and_previous(self):
        store=self.root/'store'
        selections=[]
        for name in ['first','second','bad']:
            p=self.root/name; p.mkdir(); (p/'data').write_text(name)
            identity={'fixture':name}
            atomic_json(p/'CATALOG.json',dict(identity=identity,build_id=digest(identity),establishes_membership=False,
                        outputs={'data':hash_file(p/'data')}))
            if name=='bad':
                (p/'data').write_text('damaged')
                with self.assertRaisesRegex(ValueError,'corruption'): publish(store,p)
            else: selections.append(publish(store,p))
        self.assertEqual(json.loads((store/'CURRENT.json').read_text()),selections[1])
        previous=json.loads((store/'PREVIOUS.json').read_text())
        self.assertEqual(previous,selections[0])
        # Same validation/promotion primitive restores the previous immutable release.
        self.assertEqual(publish(store,previous['path']),selections[0])


if __name__=='__main__': unittest.main()

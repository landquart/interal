if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import contextlib
import gzip
import io
import json
import shutil
from pathlib import Path
import tempfile
import unittest
from associativvordes.importers.morphology_import import run, digest, hash_file
from associativvordes.importers.certify_corpus import atomic_json, verified
from associativvordes.importers.scale_index import Index
from associativvordes.importers.corpus_cache import pack, restore
from associativvordes.importers.catalog_store import rollback, publish
from associativvordes.importers.audit_identity import partition as audit_identifiers
from associativvordes.importers.audit_scale_index import audit as audit_projection

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
            # Cache/journal tuning must not alter records or search results.
            b.db.executescript('PRAGMA journal_mode=WAL; PRAGMA cache_size=-65536;')
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

    def test_cache_roundtrip_preserves_real_pinned_excerpts(self):
        archive=self.root/'sources.zip'
        raw=self.root/'raw'; shutil.copytree(HERE/'fixtures',raw)
        receipt=pack(raw,archive,HERE/'fixtures/source-lock.json')
        self.assertEqual(receipt['status'],'PASS')
        restored=self.root/'restored'
        restore(archive,restored,HERE/'fixtures/source-lock.json')
        for artifact in self.registry['artifacts']:
            self.assertEqual(hash_file(restored/artifact['path']),artifact['sha256'])

    def test_index_payload_corruption_is_detected(self):
        index=Index(self.root/'index.sqlite')
        try:
            index.ingest('real',self.snapshot,self.registry)
            seq=index.db.execute('SELECT MIN(seq) FROM records').fetchone()[0]
            index.db.execute('UPDATE records SET body=? WHERE seq=?',(b'damaged',seq)); index.db.commit()
            with self.assertRaisesRegex(ValueError,'payload checksum'): index.record(seq)
        finally: index.close()

    def test_resumed_projection_audit_checks_all_payloads_and_coverage(self):
        path=self.root/'index.sqlite'; index=Index(path)
        try: counts=index.ingest('real',self.snapshot,self.registry)
        finally: index.close()
        release=self.root/'release'
        atomic_json(release/'CHECKPOINT.json',{'status':'PASS','counts':{'accepted':counts['read']},
            'partitions':{'real':{'counts':{'accepted':counts['read']}}}})
        result=audit_projection(path,release,self.root/'audit.json')
        self.assertEqual(result['status'],'PASS')
        self.assertEqual(result['stored_productive_records']+result['inflections_retained_only_in_staging'],counts['read'])
        self.assertEqual(result['stored_productive_records'],result['compressed_payload_checksums_verified'])
        index=Index(path)
        try:
            seq=index.db.execute('SELECT MIN(seq) FROM records').fetchone()[0]
            index.db.execute('UPDATE records SET body=? WHERE seq=?',(b'damaged',seq)); index.db.commit()
        finally: index.close()
        with self.assertRaisesRegex(ValueError,'payload checksum mismatch'):
            audit_projection(path,release,self.root/'audit.json')

    def test_independent_identifier_audit_rejects_forged_record_id(self):
        artifacts={a['id']:a for a in self.registry['artifacts']}
        self.assertEqual(audit_identifiers(self.snapshot,artifacts)['status'],'PASS')
        path=self.snapshot/'records.ndjson.gz'
        with gzip.open(path,'rt') as stream: records=list(map(json.loads,stream))
        records[0]['id']='evidence:'+'0'*64
        with gzip.open(path,'wt') as stream:
            for row in records: stream.write(json.dumps(row)+'\n')
        manifest=json.loads((self.snapshot/'manifest.json').read_text())
        manifest['outputs']['records.ndjson.gz']=hash_file(path)
        atomic_json(self.snapshot/'manifest.json',manifest)
        with self.assertRaisesRegex(ValueError,'invalid evidence identifier'):
            audit_identifiers(self.snapshot,artifacts)

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
        # Recovery must still work when CURRENT or its data is damaged.
        (self.root/'second/data').write_text('damaged current')
        (store/'CURRENT.json').write_text('damaged pointer')
        self.assertEqual(rollback(store),selections[0])
        self.assertEqual(json.loads((store/'CURRENT.json').read_text()),selections[0])


if __name__=='__main__': unittest.main()

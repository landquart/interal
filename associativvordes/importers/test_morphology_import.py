if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import base64
import bz2
import contextlib
import io
import gzip
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from associativvordes.importers.morphology_import import run, parse, digest, hash_file, kw
from associativvordes.importers.audit_import import audit
from associativvordes.importers.fetch_sources import fetch
from associativvordes.importers.build_catalog import make_catalog

HERE = Path(__file__).parent


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.raw = self.root/'raw'
        self.raw.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def artifact(self, data, fmt='morphynet_derivation', name='input.tsv', **extra):
        p = self.raw/name
        p.write_bytes(data)
        return dict(id=name,source='test-source',resource='test-resource',revision='fixture/1',
                    language='ru',format=fmt,path=name,sha256=hash_file(p),bytes=p.stat().st_size,
                    license='test-only',url='https://example.invalid/fixture',**extra)

    def ingest(self, artifacts, out='out'):
        lock = self.root/'lock.json'
        lock.write_text(json.dumps({'schema_version':'morphology-source-lock/1','artifacts':artifacts}))
        with contextlib.redirect_stdout(io.StringIO()):
            dest = run(lock,self.raw,self.root/out)
        return dest,json.loads((dest/'manifest.json').read_text())

    def test_actual_excerpts_and_fresh_replay(self):
        fixture = HERE/'fixtures'
        lock = json.loads((fixture/'source-lock.json').read_text())
        with contextlib.redirect_stdout(io.StringIO()):
            first = run(fixture/'source-lock.json',fixture,self.root/'a')
            second = run(fixture/'source-lock.json',fixture,self.root/'b')
            reused = run(fixture/'source-lock.json',fixture,self.root/'a')
        self.assertEqual(first,reused)
        self.assertEqual((first/'manifest.json').read_bytes(),(second/'manifest.json').read_bytes())
        summary=json.loads((first/'manifest.json').read_text())
        self.assertEqual(audit(fixture/'source-lock.json',fixture,first)['status'],'PASS')
        self.assertEqual(len(summary['reports']),len(lock['artifacts']))
        self.assertTrue(all(r['accepted']>0 and r['rejected']==0 for r in summary['reports']))
        for line in gzip.open(first/'records.ndjson.gz','rt').read().splitlines():
            body=json.loads(line)['body']
            original=base64.b64decode(body['original_line_base64'])
            self.assertEqual(len(original.decode().rstrip('\n').split('\t')),len(body['raw_fields']))
            self.assertFalse(body['establishes_membership'])
            if body['source']=='GLeMM':
                self.assertEqual(body['normalized']['claims'][0]['direction'],'unknown')
                self.assertEqual(body['normalized']['claims'][0]['lineage']['status'],'possible_dataset_dependency')

    def test_quarantine_is_lossless_and_counts_conserve(self):
        data='эбонит\tэбонитовый\tN\tJ\tовый\tsuffix\n'.encode()
        bad=b'\xff\tbroken\n'
        a=self.artifact(data+data+bad+b'x\ty\n')
        dest,m=self.ingest([a])
        r=m['reports'][0]
        self.assertEqual((r['read'],r['accepted'],r['rejected'],r['duplicates']),(4,2,2,1))
        q=[json.loads(l) for l in (dest/'quarantine.ndjson').read_text().splitlines()]
        self.assertEqual(base64.b64decode(q[0]['raw_base64']),bad)
        self.assertEqual(len((dest/'relation-evidence.ndjson').read_text().splitlines()),2)
        self.assertEqual(m['normalized_relation_views'],1)

    def test_missing_checksum_and_corrupted_reuse_fail(self):
        a=self.artifact(b'slow\tslowly\tJ\tR\tly\tsuffix\n')
        dest,_=self.ingest([a])
        (dest/'records.ndjson.gz').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError,'corrupted'):
            self.ingest([a])
        (self.raw/a['path']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'mismatch'):
            self.ingest([a],'new')
        (self.raw/a['path']).unlink()
        with self.assertRaises(FileNotFoundError):
            self.ingest([a],'missing')
        self.assertFalse((self.root/'missing').exists())

    def test_no_repository_output(self):
        a=self.artifact(b'slow\tslowly\tJ\tR\tly\tsuffix\n')
        self.ingest([a])
        with self.assertRaisesRegex(ValueError,'outside repository'):
            run(self.root/'lock.json',self.raw,HERE/'forbidden')
        self.assertFalse((HERE/'forbidden').exists())

    def test_multisource_unknowns_and_diacritics(self):
        a=self.artifact(b'',language_dummy='unused')
        a['language']='ru'
        _,r=parse(a,['ёлка','елочка','N','N','очк','suffix'],'hash')
        self.assertEqual(r['lexemes'][0]['lemma'],'ёлка')
        self.assertNotEqual(r['lexemes'][0]['id'],r['lexemes'][1]['id'])
        b=dict(a,source='other')
        _,r2=parse(b,['ёлка','елочка','N','N','очк','suffix'],'hash')
        self.assertNotEqual(r['lexemes'][0]['id'],r2['lexemes'][0]['id'])
        _,r3=parse(a,['e\u0301','x','UNK','N','','unknown-operation'],'hash')
        self.assertEqual(r3['lexemes'][0]['lemma'],'é')
        self.assertEqual(r3['lexemes'][0]['original'],'e\u0301')
        self.assertIsNone(r3['lexemes'][0]['pos'])

    def test_inflection_is_not_derivation_and_zip_hash(self):
        data='zufügen\tzugefügt\tV;V.PTCP;PST\tzu-|ge-|füg|-t\n'.encode()
        p=self.raw/'infl.zip'
        with zipfile.ZipFile(p,'w') as z:z.writestr('infl.tsv',data)
        import hashlib
        a=dict(id='zip',source='MorphyNet',resource='inflection',revision='fixture/1',language='deu',
               format='morphynet_inflection',path='infl.zip',bytes=p.stat().st_size,sha256=hash_file(p),
               license='CC-BY-SA-3.0',url='https://example.invalid',member='infl.tsv',member_bytes=len(data),
               member_sha256=hashlib.sha256(data).hexdigest())
        dest,m=self.ingest([a])
        body=json.loads(gzip.open(dest/'records.ndjson.gz','rt').read())['body']
        self.assertEqual(body['normalized']['claims'],[])
        self.assertEqual(m['normalized_relation_views'],0)
        self.assertEqual(body['normalized']['inflection']['features'],'V;V.PTCP;PST')
        a['member_sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'ZIP member checksum'):
            self.ingest([a],'badzip')

    def test_derinet_graph_slots_annotations_and_missing_refs(self):
        # Deliberately adversarial synthetic topology, not a purported corpus sample.
        rows=[['0.0','homonym','base','NOUN','','','','','','{}'],
              ['0.1','homonym','base','VERB','','','0.0','Type=Conversion','','{}'],
              ['0.2','compound','bases','NOUN','','Morph=base&Start=0&End=4|Morph=s&Start=4&End=5','0.0',
               'Type=Compounding&Sources=0.0,0.1','Type=Variant&Source=0.1|Type=Unknown&Label=x','{"extra":[1,2]}'],
              ['0.3','missing','missing','NOUN','','','1.0','Type=Derivation','','{}']]
        a=self.artifact(('\n'.join('\t'.join(r) for r in rows)+'\n').encode(),'derinet2')
        dest,m=self.ingest([a])
        r=m['reports'][0]
        self.assertEqual((r['accepted'],r['claims'],r['unresolved_references'],r['unresolved_secondary']),(4,5,2,1))
        body=json.loads(gzip.open(dest/'records.ndjson.gz','rt').read().splitlines()[2])['body']
        self.assertEqual(body['normalized']['claims'][0]['sources'],['0.0','0.1'])
        self.assertEqual(body['normalized']['annotations'],{'extra':[1,2]})
        self.assertEqual(len(body['normalized']['claims']),3)

    def test_bad_graph_duplicate_native_id_no_partial_commit(self):
        good='0.0\tx\tbase\tNOUN\t\t\t\t\t\t{}\n'
        bad='0.0\ty\tother\tVERB\t\t\t\t\t\t{}\n'
        a=self.artifact((good+bad).encode(),'derinet2')
        dest,m=self.ingest([a])
        self.assertEqual(m['reports'][0]['accepted'],1)
        self.assertEqual(m['reports'][0]['rejected'],1)
        self.assertEqual(len(gzip.open(dest/'records.ndjson.gz','rt').read().splitlines()),1)

    def test_header_failure_aborts_atomic_publication(self):
        a=self.artifact(b'lemma1\tlemma2\nx\ty\n','glemm_pairs')
        with self.assertRaisesRegex(ValueError,'header'):
            self.ingest([a])
        self.assertEqual(list((self.root/'out').iterdir()),[])

    def test_conflicting_types_and_truncated_row(self):
        a=self.artifact(b'0.0\tx\tbase\tNOUN\t\t\t\t\t\t{}\n0.1\ty\tderived\tVERB\t\t\t0.0\tType=Conversion\tType=Derivation&Source=0.0\t{}\n','derinet2')
        dest,m=self.ingest([a])
        self.assertTrue((dest/'conflicts.ndjson').read_text())
        b=self.artifact(b'x\ty\tN\tN\ta\tsuffix','morphynet_derivation','truncated.tsv')
        _,m=self.ingest([b],'truncated')
        self.assertEqual(m['reports'][0]['accepted'],1)
        self.assertEqual(m['reports'][0]['rejected'],0)

    def test_keyword_alternatives_preserved_and_duplicate_keys_rejected(self):
        self.assertEqual(kw('Type=Variant&Source=0.0|Type=Derivation&Source=0.1')[1]['Source'],'0.1')
        with self.assertRaises(ValueError):kw('Type=x&Type=y')

    def test_locked_acquisition_offline_and_cache_mismatch(self):
        data=b'slow\tslowly\tJ\tR\tly\tsuffix\n'
        a=self.artifact(data)
        a['url']=(self.raw/a['path']).as_uri()
        lock=self.root/'fetch-lock.json'
        lock.write_text(json.dumps({'schema_version':'morphology-source-lock/1','artifacts':[a]}))
        target=self.root/'downloaded'
        fetch(lock,target)
        self.assertEqual((target/a['path']).read_bytes(),data)
        fetch(lock,target)
        (target/a['path']).write_bytes(b'wrong')
        with self.assertRaisesRegex(ValueError,'checksum mismatch'):
            fetch(lock,target)
        self.assertEqual((target/a['path']).read_bytes(),b'wrong')

    def test_catalog_preserves_evidence_and_refuses_overlapping_partitions(self):
        fixture=HERE/'fixtures'
        lock=self.root/'catalog-registry.json'
        lock.write_bytes((fixture/'source-lock.json').read_bytes())
        with contextlib.redirect_stdout(io.StringIO()):
            snapshot=run(lock,fixture,self.root/'source')
        plan=self.root/'partition-plan.json'
        part={'name':'source','lock':lock.name,'build_id':snapshot.name}
        plan.write_text(json.dumps({'partitions':[part]}))
        catalog=make_catalog(lock,plan,self.root,self.root/'catalog')
        c=json.loads((catalog/'CATALOG.json').read_text())
        m=json.loads((snapshot/'manifest.json').read_text())
        self.assertEqual(c['unique_normalized_views'],m['normalized_relation_views'])
        self.assertEqual(c['evidence_occurrences'],sum(r['claims'] for r in m['reports']))
        self.assertFalse(c['establishes_membership'])
        self.assertEqual(make_catalog(lock,plan,self.root,self.root/'catalog'),catalog)
        plan.write_text(json.dumps({'partitions':[part,part]}))
        with self.assertRaisesRegex(ValueError,'duplicate artifact'):
            make_catalog(lock,plan,self.root,self.root/'bad-catalog')


if __name__=='__main__':unittest.main()

import json,sqlite3,tempfile,unittest
from pathlib import Path
from common import ROOT,read
from external import build,External
class ExternalTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.t=tempfile.TemporaryDirectory();cls.folder=Path(cls.t.name)/'index';cls.lock=ROOT/'associativvordes/importers/fixtures/source-lock.json'
  cls.report=build(cls.lock.parent,cls.lock,cls.folder)
 @classmethod
 def tearDownClass(cls):cls.t.cleanup()
 def test_all_three_pinned_source_formats_and_six_languages(self):
  e=External(self.folder,self.lock);self.assertTrue(e.manifest['complete'])
  self.assertEqual({a['artifact']['source'] for a in e.parts},{'UDer','GLeMM','MorphyNet'})
 def test_native_identity_and_unknown_independence(self):
  e=External(self.folder,self.lock);part=next(p for p in e.parts if p['artifact']['source']=='GLeMM')
  db=sqlite3.connect(self.folder/part['database']);word=db.execute('SELECT word FROM words LIMIT 1').fetchone()[0];db.close()
  from morphology_import import LANGUAGES
  q=e.enrich(dict(language=LANGUAGES[part['artifact']['language']],lemma=word))
  self.assertTrue(q['external_rows']);self.assertEqual(q['independence']['independent_groups'],[])
  self.assertEqual(q['external_alignment_status'],'same_language_spelling_only_not_identity')
  self.assertTrue(all(not r['body']['establishes_membership'] for r in q['external_rows']))
 def test_existing_graph_ingest_creates_no_memberships(self):
  e=External(self.folder,self.lock);part=next(p for p in e.parts if p['artifact']['source']=='GLeMM');db=sqlite3.connect(self.folder/part['database']);word=db.execute('SELECT word FROM words LIMIT 1').fetchone()[0];db.close()
  from morphology_import import LANGUAGES
  q=e.enrich(dict(language=LANGUAGES[part['artifact']['language']],lemma=word));path=Path(self.t.name)/'graph.sqlite';r=e.graph([q],path)
  db=sqlite3.connect(path);self.assertEqual(db.execute('SELECT COUNT(*) FROM known').fetchone()[0],0);self.assertEqual(db.execute('SELECT COUNT(*) FROM bindings').fetchone()[0],0);db.close();self.assertGreater(r['records'],0)
if __name__=='__main__':unittest.main()

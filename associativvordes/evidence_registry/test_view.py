import gzip,json,tempfile,unittest
from pathlib import Path
from .view import cases,sha
class FrozenViewTests(unittest.TestCase):
 def fixture(self,root,status='UNRESOLVED'):
  p=root/'part.gz';row=['family','lemma',0,'word','a'*64,'word',[],None,status,0,0,False]
  with gzip.open(p,'wt') as f:f.write(json.dumps(row)+'\n')
  r=dict(schema='interal-lexical-sense-mapping-registry/1',columns=['family_id','lemma_id','ordinal','word','record_sha256','lookup_key','priority_flags','original_pos','mapping_status','alternative_signature_count','pos_alternative_count','mapping_authorized'],source_commit='a'*40,native_database_sha256='b'*64,parts=[dict(file='part.gz',sha256=sha(p),language='en',rows=1,source=dict(path='members/en/00.json.gz'))])
  (root/'REGISTRY.json').write_text(json.dumps(r));return sha(root/'REGISTRY.json')
 def test_exact_origin_and_explicit_unknowns(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);h=self.fixture(root);c=list(cases(root,h))[0];self.assertEqual(c['status'],'UNRESOLVED_EVIDENCE');self.assertEqual(c['origin']['ordinal'],0);self.assertIsNone(c['target']);self.assertIsNone(c['canonical_family_id']);self.assertFalse(c['production_application_authorized'])
 def test_wrong_registry_hash(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);self.fixture(root)
   with self.assertRaises(ValueError):list(cases(root,'0'*64))
 def test_changed_part_bytes(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);h=self.fixture(root);(root/'part.gz').write_bytes(b'changed')
   with self.assertRaises(ValueError):list(cases(root,h))
 def test_new_strong_mapping_needs_new_evaluation(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);h=self.fixture(root,'SUPPORTED_MAPPING')
   with self.assertRaises(ValueError):list(cases(root,h))
if __name__=='__main__':unittest.main()

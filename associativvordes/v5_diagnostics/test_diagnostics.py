import json,sqlite3,sys,tempfile,unittest,zlib
from pathlib import Path
from classify import *
from run import setup,ingest,cross_family,summarize,connect,rank
class Rules(unittest.TestCase):
 def test_origin_is_not_a_linguistic_verdict(self):
  self.assertEqual(origin(dict(source='surface_singleton'),{'morphological_parse':1}),'SURFACE_FRAGMENT')
  self.assertEqual(origin(dict(relation_types=['borrowed_form']),{}),'BORROWING_FAMILY')
  self.assertEqual(origin(dict(relation_types=['borrowed_form','inherited_form']),{}),'HISTORICAL_ETYMON')
  self.assertEqual(origin({},{}),'UNCLASSIFIED')
 def test_distinct_derivation_and_inflection(self):
  self.assertEqual(origin({},dict(inflection=1)),'INFLECTION_DERIVED')
  self.assertEqual(origin({},dict(inflection=1,morphological_parse=1)),'MIXED_ORIGIN')
  v=member(dict(components=[dict(evidence=[dict(type='inflection'),dict(type='morphological_parse')])]))
  self.assertIn('MIXED_DERIVATION_INFLECTION_CLAIMS',v['flags'])
 def test_legacy_manual_confidence_is_not_gold(self):
  v=member(dict(pos='NOUN',sense='FAKE',components=[dict(evidence=[dict(type='morphological_parse',source='manually_verified',confidence=1)])]))
  self.assertEqual(v['sense_status'],'UNRESOLVED');self.assertEqual(v['correspondence_status'],'UNKNOWN_NOT_EVALUATED')
 def test_threshold_three_languages_does_not_remove_singleton(self):
  f=family(dict(id='one',source='surface_singleton'),Counter(en=1),Counter(),Counter(),Counter(),None,[])
  self.assertEqual(f['memberships'],1);self.assertEqual(f['language_count'],1);self.assertIn('SINGLETON',f['flags'])
 def test_priority_is_bounded_nonprobabilistic(self):
  f=family(dict(id='one',canonical='en'),Counter(en=20000),Counter(),Counter(),Counter(),None,[])
  r=rank(f,['ALIAS_FANOUT','EXACT_DUPLICATE_MEMBER_SET','ENDING_PREFIX_DIVERSITY_PROXY'])
  self.assertLessEqual(r['score'],100);self.assertIn('not error probability',r['meaning'])
 def test_allomorph_not_inferred_from_substring(self):
  self.assertNotIn('ALLOMORPH_SCOPE_UNVERIFIED',member(dict(word='manifest',components=[]))['flags'])
 def test_unicode_length(self):self.assertEqual(len(normal('ёж')) ,2)
class WholeShard(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.db=connect(self.root/'out.sqlite');self.addCleanup(self.db.close);setup(self.db)
  self.db.execute('CREATE INDEX flag_family ON flags(family,flag)');self.db.execute('CREATE INDEX families_bucket ON families(bucket,id)')
  src=sqlite3.connect(self.root/'source.sqlite');src.executescript('CREATE TABLE families(id TEXT,body BLOB);CREATE TABLE members(family TEXT,language TEXT,lemma TEXT,ordinal INTEGER,body BLOB);CREATE TABLE aliases(alias TEXT,body BLOB);')
  for fid in ['a','b','c']:
   f=dict(id=fid,canonical='en',source='surface_singleton');src.execute('INSERT INTO families VALUES(?,?)',(fid,zlib.compress(canonical(f))))
   for i in range(5 if fid!='c' else 1):
    lid=f'lemma:{i}';row=dict(lemma_id=lid,word=f'prefix{i}en',normalized=f'prefix{i}en',components=[dict(evidence=[dict(type='surface_identity',source='candidate_index')])]);src.execute('INSERT INTO members VALUES(?,?,?,?,?)',(fid,'en',lid,i,zlib.compress(canonical(row))))
  src.execute('INSERT INTO aliases VALUES(?,?)',('en',zlib.compress(canonical(['a','b']))));src.commit();src.close()
  self.receipt=dict(identity=dict(bucket='00'),database='source.sqlite',database_sha256='fixture')
 def test_full_classification_exact_duplicate_and_overlap(self):
  r=ingest(self.db,self.root,self.receipt);self.assertEqual(r['memberships'],11);cross_family(self.db)
  s=summarize(self.db,{});self.assertEqual(s['counts'],dict(families=3,memberships=11,aliases=1));self.assertEqual(s['cross_family_patterns']['EXACT_DUPLICATE_MEMBER_SET']['groups'],1)
  self.assertEqual(s['cross_family_patterns']['SHARED_LEGACY_IDENTITY']['membership_edges'],11)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM flags WHERE flag="ENDING_PREFIX_DIVERSITY_PROXY"').fetchone()[0],2)
  self.assertEqual(s['semantic']['unresolved_memberships'],11)
 def test_scoped_negative_does_not_spread_family_or_homonym_id(self):
  scope=dict(family_id='a',language='en',lemma_ids=['lemma:0'],sense_id='known-sense')
  self.db.execute('INSERT INTO history VALUES(?,?,?,?,?,?)',('negative','a','en','CONFIRMED_NONMEMBER','ENGINEERING_CHECK',canonical(scope).decode()))
  self.db.execute('INSERT INTO history_ids VALUES(?,?,?,?)',('a','en','lemma:0','negative'));self.db.commit()
  ingest(self.db,self.root,self.receipt)
  affected=list(self.db.execute("SELECT family,lemma FROM members WHERE flags LIKE '%HISTORICAL_EXCLUSION_OVERLAP%'"));self.assertEqual(affected,[('a','lemma:0')]);self.assertEqual(json.loads(self.db.execute('SELECT scope FROM history').fetchone()[0])['sense_id'],'known-sense')
 def test_global_stage_is_idempotent(self):
  ingest(self.db,self.root,self.receipt);cross_family(self.db);a=summarize(self.db,{});cross_family(self.db);self.assertEqual(a,summarize(self.db,{}))
if __name__=='__main__':unittest.main()

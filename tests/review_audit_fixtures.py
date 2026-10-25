"""TEST_ONLY tiny native snapshots for audit-boundary adversarial regressions."""
import contextlib,importlib.util,json,sqlite3,sys
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
@contextlib.contextmanager
def surface():
 sys.path[:0]=[str(ROOT/'associativvordes/v5_baseline'),str(ROOT/'associativvordes/surface_cleanup'),str(ROOT/'associativvordes/structural_cleanup')]
 from test_census import CensusTests,c
 t=CensusTests();t.setUp()
 try:
  snap,_=t.snapshot()
  for p in (snap/'current'/c.PREFIX/'families').glob('*.json.gz'):
   data=dict(c.pairs(p))
   for f in data.values():f.update(canonical='en',source='surface_singleton')
   t.gz(p,data)
  t.refresh(snap)
  spec=importlib.util.spec_from_file_location('TEST_ONLY_surface_driver',ROOT/'associativvordes/surface_cleanup/run.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  class History:decisions=[];digest='TEST_ONLY';snapshot={'coverage_complete':False}
  def index(h,p):
   d=sqlite3.connect(p);d.execute('CREATE TABLE ids(family TEXT,language TEXT,lemma TEXT,decision TEXT)');d.close();return 0
  catalog=dict(retained_exceptions=[],patterns=[])
  with patch.object(m,'collect',lambda repo:(History(),catalog)),patch.object(m,'build_scope_index',index):yield t,m,snap,t.root/'surface'
 finally:t.tearDown()

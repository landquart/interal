"""Independent stable-ID check over disk census tables; never repairs IDs."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import argparse,hashlib,json,pathlib,sqlite3,unicodedata
if __package__:
 from associativvordes.v5_baseline.census import atomic_json
else:
 # Frozen archives contain a standalone tool directory, without this checkout.
 import importlib.util as _util
 _spec=_util.spec_from_file_location('_restored_baseline_census',pathlib.Path(__file__).with_name('census.py'))
 _census=_util.module_from_spec(_spec);_spec.loader.exec_module(_census)
 atomic_json=_census.atomic_json

def audit(database,output):
 db=sqlite3.connect('file:'+str(pathlib.Path(database).resolve())+'?mode=ro',uri=True);results={}
 for table in ('current_lemmas','source_lemmas'):
  checked=bad=0;samples=[]
  for language,lid,normalized in db.execute('select language,id,normalized from '+table):
   payload='\0'.join(unicodedata.normalize('NFC',x) for x in (language.lower(),normalized.lower()))
   expected='lemma:'+hashlib.sha256(payload.encode()).hexdigest()[:20];checked+=1
   if expected!=lid:
    bad+=1
    if len(samples)<20:samples.append({'language':language,'id':lid,'expected':expected,'normalized':normalized})
  results[table]={'checked':checked,'mismatches':bad,'samples':samples}
 db.close();result={'schema_version':1,'algorithm':'stableLemmaId: lowercase und-equivalent normalized inputs, NFC fields, NUL separator, SHA256 first 20 hex','unicode_version':unicodedata.unidata_version,'tables':results,'verdict':'PASS' if not any(x['mismatches'] for x in results.values()) else 'BLOCKED'}
 atomic_json(output,result);return result
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--database',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();print(json.dumps(audit(a.database,a.output)))

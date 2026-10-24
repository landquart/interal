"""Independent stable-ID check over disk census tables; never repairs IDs."""
import argparse,hashlib,json,pathlib,sqlite3,unicodedata
from census import atomic_json

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

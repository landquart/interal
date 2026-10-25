"""Stream every preserved origin into an explicit, source-backed mapping status."""
import argparse,collections,functools,gzip,hashlib,json,resource,sqlite3,time
from pathlib import Path
from .model import canonical,digest
from .project import hash_file
EXTRA=['mapping_status','alternative_signature_count','pos_alternative_count','mapping_authorized']
def build(projection,native,output):
 projection=Path(projection);native=Path(native);output=Path(output)
 if output.exists():raise ValueError('fresh mapping registry required')
 output.mkdir(parents=True);(output/'mappings').mkdir();origin=json.loads((projection/'PROJECTION.json').read_bytes());nr=json.loads((native/'NATIVE-REPORT.json').read_bytes())
 db=sqlite3.connect((native/'native.sqlite').resolve().as_uri()+'?mode=ro&immutable=1',uri=True);db.execute('PRAGMA cache_size=-65536')
 @functools.lru_cache(maxsize=65536)
 def alternatives(lang,key):
  row=db.execute('SELECT alternatives,pos_alternatives FROM lookup_sets WHERE language=? AND lookup=?',(lang,key)).fetchone();return row or (0,0)
 parts=[];coverage={};sample={};start=time.monotonic()
 for part in origin['parts']:
  p=projection/part['file'];assert hash_file(p)==part['sha256'];lang=part['language'];counts=coverage.setdefault(lang,collections.Counter());samples=sample.setdefault(lang,{})
  dest=output/'mappings'/Path(part['file']).name;rows=0;statuses=collections.Counter()
  with gzip.open(p,'rt') as inp,dest.open('wb') as rawout,gzip.GzipFile(fileobj=rawout,mode='wb',filename='',mtime=0,compresslevel=1) as out:
   for line in inp:
    row=json.loads(line);n,pos=alternatives(lang,row[5]);status='MULTIPLE_POSSIBLE_IDENTITIES' if n>1 else 'UNRESOLVED'
    flags=row[6]
    if n>1:flags=flags+['MULTIPLE_SOURCE_SCOPED_ALTERNATIVES']
    if pos>1:flags=flags+['POS_AMBIGUITY']
    row[6]=flags;value=row+[status,n,pos,False];out.write(canonical(value)+b'\n');rows+=1;statuses[status]+=1;counts['memberships']+=1;counts[status]+=1;counts['no_source_candidate']+=n==0;counts['source_candidate_available']+=n>0;counts['pos_ambiguous']+=pos>1;counts.update('priority:'+x for x in flags)
    # Deterministic bottom-hash sample per language/status. Retains all strata;
    # sample selection is independent of whether a mapping could be confirmed.
    key=(status,);slot=samples.setdefault(key,[]);rank=digest([lang,part['bucket'],row[0],row[1],row[2]])
    if len(slot)<50 or rank<slot[-1][0]:
     slot.append((rank,dict(part=dest.name,language=lang,bucket=part['bucket'],source=part['source'],row=value)));slot.sort(key=lambda x:x[0]);del slot[50:]
  assert rows==part['rows'];parts.append(dict(language=lang,bucket=part['bucket'],file=str(dest.relative_to(output)),rows=rows,sha256=hash_file(dest),source=part['source'],statuses=dict(statuses)))
  if int(part['bucket'],16)%32==31:print(json.dumps(dict(language=lang,bucket=part['bucket'],memberships=counts['memberships'])),flush=True)
 db.close();coverage={k:dict(v) for k,v in coverage.items()};total=sum(x['memberships'] for x in coverage.values());assert total==origin['memberships']
 result=dict(schema='interal-lexical-sense-mapping-registry/1',columns=origin['columns']+EXTRA,source_commit=origin['source_commit'],source_inventory_sha256=origin['source_inventory_sha256'],projection_sha256=hash_file(projection/'PROJECTION.json'),native_report_sha256=hash_file(native/'NATIVE-REPORT.json'),native_database_sha256=hash_file(native/'native.sqlite'),native_database='native/native.sqlite',source_lock_sha256=nr['source_lock_sha256'],parts=parts,memberships=total,coverage=coverage,exact_identity=0,supported_mapping=0,unresolved_mapping_total=total,corpus_binding_inferred_from_spelling=False,all_alternative_source_occurrences_retained=True,association_metrics_changed=False,production_writes=0,seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
 (output/'REGISTRY.json').write_text(json.dumps(result,indent=2)+'\n');(output/'UNRESOLVED-REGISTRY.json').write_text(json.dumps(dict(schema='interal-unresolved-mappings/1',registry_sha256=hash_file(output/'REGISTRY.json'),scope='All non-EXACT_IDENTITY/non-SUPPORTED_MAPPING records in the complete registry, including MULTIPLE_POSSIBLE_IDENTITIES',memberships=total,parts=parts,irreversible_operations_allowed=False),indent=2)+'\n')
 selected=[v for langs in sample.values() for slots in langs.values() for _,v in slots];(output/'INDEPENDENT-SAMPLE.json').write_text(json.dumps(dict(method='Deterministic SHA-256 bottom 50 per language/status; not human gold',records=selected),ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--projection',required=True);p.add_argument('--native',required=True);p.add_argument('--output',required=True);a=p.parse_args();build(a.projection,a.native,a.output)

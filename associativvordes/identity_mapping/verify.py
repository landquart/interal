"""Independent source-format and physical-origin audits; imports no producer/model."""
import argparse,collections,gzip,hashlib,json,sqlite3,unicodedata,zipfile,bz2
from pathlib import Path

def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def audit_native(native,raw,lock,output):
 native=Path(native);raw=Path(raw);lock=json.loads(Path(lock).read_bytes());db=sqlite3.connect((native/'native.sqlite').resolve().as_uri()+'?mode=ro&immutable=1',uri=True)
 assert not db.execute('SELECT language,lookup,count(*),count(DISTINCT pos),count(DISTINCT artifact) FROM candidates GROUP BY language,lookup EXCEPT SELECT * FROM lookup_sets').fetchone()
 assert db.execute("SELECT count(*) FROM candidates WHERE sense_id IS NOT NULL AND kind!='FROZEN_DICTIONARY_SENSE_NOT_CORPUS_IDENTITY'").fetchone()[0]==0
 refs={};checks=[];source_errors=pos_errors=identity_errors=0
 # Deterministic coverage sample, eight source rows per artifact. This verifies
 # engineering extraction, not linguistic correctness or a representative gold set.
 for ai,source_id,body in db.execute('SELECT id,source_id,body FROM artifacts ORDER BY id'):
  a=json.loads(body);maximum=db.execute('SELECT max(line) FROM occurrences WHERE artifact=?',(ai,)).fetchone()[0]
  selected=set()
  for j in range(8):
   n=1+int(hashlib.sha256((source_id+':'+str(j)).encode()).hexdigest(),16)%maximum
   row=db.execute('SELECT line FROM occurrences WHERE artifact=? AND line>=? ORDER BY line LIMIT 1',(ai,n)).fetchone()
   if row:selected.add(row[0])
  refs[ai]=(a,selected)
 for ai,(a,selected) in refs.items():
  if a['format']=='frozen_dictionary_senses':
   assert sha(native/a['path'])==a['sha256'] and sha(native/a['sources_path'])==a['sources_sha256']
   senses=json.loads((native/a['path']).read_bytes())['senses']
   for line in sorted(selected):
    x=senses[line-1];r=db.execute('SELECT o.raw_sha256,o.definition,c.language,c.lemma,c.pos,c.sense_id FROM occurrences o JOIN candidates c ON c.id=o.candidate WHERE o.artifact=? AND o.line=?',(ai,line)).fetchone()
    assert r==(hashlib.sha256(canonical(x)).hexdigest(),x['gloss'],x['language'],x['lemma'],x['pos'],x['id'])
    checks.append(dict(artifact=a['id'],line=line,raw_sha256=r[0],language=x['language'],source_identity_projection_ok=True,raw_record_ok=True,pos_projection_ok=True,sense_binding='DOCUMENTARY_SOURCE_SENSE_ONLY_NOT_CORPUS_BOUND'))
   continue
  if a.get('member'):archive=zipfile.ZipFile(raw/a['path']);stream=archive.open(a['member'])
  else:archive=None;p=raw/a['path'];stream=bz2.open(p,'rb') if p.suffix=='.bz2' else gzip.open(p,'rb') if p.suffix=='.gz' else p.open('rb')
  with stream:
   header=None
   for line,data in enumerate(stream,1):
    if a['format'].startswith('glemm_') and header is None and data.strip():header=data.decode().rstrip('\r\n').split('\t');continue
    if line not in selected:continue
    fields=data.decode().rstrip('\n').removesuffix('\r').split('\t');h=hashlib.sha256(data).hexdigest();rows=db.execute('SELECT o.role,o.raw_sha256,o.native_observation_id,o.definition,c.language,c.lemma,c.pos,c.native_lexical_id,c.sense_id,c.kind FROM occurrences o JOIN candidates c ON c.id=o.candidate WHERE o.artifact=? AND o.line=? ORDER BY role',(ai,line)).fetchall()
    for role,rawsha,nativeid,definition,lang,lemma,pos,nativelex,sense,kind in rows:
     if a['format']=='derinet2':word,tag=fields[2],fields[3];native_key=fields[0]
     elif a['format'].startswith('glemm_'):
      x=dict(zip(header,fields));word,tag=x['lemma'+str(role+1)],x['cat'+str(role+1)];native_key=[h,'left' if role==0 else 'right']
      if role==1 and a['format']=='glemm_defs':assert definition==x['definition2']
     elif a['format']=='morphynet_derivation':word,tag=fields[role],fields[role+2];native_key=[h,'source' if role==0 else 'target']
     else:word,tag=fields[0],fields[2].replace('|',';').replace(' ',';').split(';')[0];native_key=[h,'lemma']
     expected_pos={'N':'NOUN','V':'VERB','A':'ADJ','J':'ADJ','R':'ADV','D':'ADV'}.get(tag,tag if tag in set('ADJ ADP ADV AUX CCONJ DET INTJ NOUN NUM PART PRON PROPN PUNCT SCONJ SYM VERB X'.split()) else None)
     expected_id='lexeme:'+hashlib.sha256(canonical([a['source'],a['resource'],a['revision'],lang,native_key])).hexdigest()
     okraw=rawsha==h and lemma==unicodedata.normalize('NFC',word);okpos=pos==expected_pos;okidentity=nativeid==expected_id and sense is None and (nativelex==nativeid if a['format']=='derinet2' else nativelex is None)
     source_errors+=not okraw;pos_errors+=not okpos;identity_errors+=not okidentity;checks.append(dict(artifact=a['id'],line=line,role=role,raw_sha256=h,language=lang,original_lemma=word,pos_projection=pos,source_identity_projection_ok=okidentity,raw_record_ok=okraw,pos_projection_ok=okpos,sense_binding=None))
  if archive:archive.close()
 assert source_errors==pos_errors==identity_errors==0
 report=dict(schema='interal-independent-native-mapping-audit/1',status='SOURCE_PROJECTION_SAMPLE_VERIFIED_NOT_LINGUISTIC_GOLD',artifacts=len(refs),checks=checks,sampled_endpoints=len(checks),source_projection_errors=source_errors,pos_projection_errors=pos_errors,source_identity_projection_errors=identity_errors,sense_bindings_created=0,accepted_mapping_error_rate=None,pos_binding_error_rate=None,sense_binding_error_rate=None,reason='No independently approved corpus mappings or human sense gold exist; error rates for final identity/POS/sense bindings are not estimable',producer_imported=False)
 Path(output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');db.close();return report

def audit_registry(registry,source,output):
 registry=Path(registry);source=Path(source);r=json.loads((registry/'REGISTRY.json').read_bytes());totals=collections.Counter();statuses=collections.Counter();sample=json.loads((registry/'INDEPENDENT-SAMPLE.json').read_bytes())['records'];by_part=collections.defaultdict(list)
 for s in sample:by_part[s['part']].append(s)
 checked=0
 for p in r['parts']:
  path=registry/p['file'];assert sha(path)==p['sha256'];assert sha(source/p['source']['path'])==p['source']['sha256'];count=0;identity_hash=hashlib.sha256()
  with gzip.open(path,'rt') as f:
   for line in f:
    row=json.loads(line);assert len(row)==len(r['columns']) and row[-1] is False;identity_hash.update(canonical(row[:4])+b'\n')
    assert row[-4]==('MULTIPLE_POSSIBLE_IDENTITIES' if row[-3]>1 else 'UNRESOLVED');statuses[row[-4]]+=1;count+=1
  assert count==p['rows'];totals[p['language']]+=count
  with gzip.open(source/p['source']['path'],'rt') as f:original=json.load(f)
  source_hash=hashlib.sha256()
  for fid,records in original.items():
   for ordinal,raw in enumerate(records):source_hash.update(canonical([fid,raw['lemma_id'],ordinal,raw['word']])+b'\n')
  assert source_hash.digest()==identity_hash.digest()
  if Path(p['file']).name in by_part:
   for s in by_part[Path(p['file']).name]:
    row=s['row'];raw=original[row[0]][row[2]];assert raw['lemma_id']==row[1] and raw['word']==row[3] and hashlib.sha256(canonical(raw)).hexdigest()==row[4];checked+=1
 assert sum(totals.values())==r['memberships'];assert statuses.get('EXACT_IDENTITY',0)==statuses.get('SUPPORTED_MAPPING',0)==0
 report=dict(schema='interal-independent-corpus-mapping-audit/1',status='ALL_MEMBERSHIP_STATUSES_AND_SAMPLED_ORIGINS_VERIFIED',memberships=sum(totals.values()),by_language=dict(totals),statuses=dict(statuses),source_origin_sample=checked,all_output_and_input_part_hashes_verified=True,all_physical_origin_identity_sequences_independently_replayed=True,unconfirmed_mappings_authorized=0,producer_imported=False,semantic_identity_gold=False)
 Path(output).write_text(json.dumps(report,indent=2)+'\n');return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native');p.add_argument('--raw');p.add_argument('--lock');p.add_argument('--registry');p.add_argument('--source');p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(audit_registry(a.registry,a.source,a.output) if a.registry else {k:v for k,v in audit_native(a.native,a.raw,a.lock,a.output).items() if k!='checks'}))

"""Lossless disk lookup of the pinned importer rows; spelling is not identity."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,json,os,resource,sys,time,zlib
from collections import Counter
from pathlib import Path
from associativvordes.v5_adapter.common import *
pass
from associativvordes.evidence_graph.records import make_record
from associativvordes.importers.morphology_import import binary_stream,validate_lock,GLEMM,LANGUAGES

def build(raw,lock,out,allow_unavailable=False):
 raw=Path(raw).resolve();lock=Path(lock).resolve();out=Path(out).resolve()
 if out.is_relative_to(ROOT) or out.is_relative_to(raw) or raw.is_relative_to(out):raise ValueError('separate external row index required')
 registry=read(lock);out.mkdir(parents=True,exist_ok=True);start=time.monotonic();parts=[];missing=[]
 code={str(p.relative_to(ROOT)):filehash(p) for p in [Path(__file__),Path(__file__).with_name('common.py'),ROOT/'associativvordes/evidence_graph/records.py',ROOT/'associativvordes/importers/morphology_import.py']}
 for a in sorted(registry['artifacts'],key=lambda x:x['id']):
  try:validate_lock(dict(registry,artifacts=[a]),raw)
  except FileNotFoundError as e:
   if not allow_unavailable:raise
   missing.append(dict(artifact=a['id'],revision=a['revision'],sha256=a['sha256'],status='UNAVAILABLE',reason=str(e)));continue
  key=sha(canonical([a,code]));receipt=out/(key+'.json');database=out/(key+'.sqlite')
  if receipt.exists():
   r=read(receipt)
   if filehash(database)!=r['database_sha256']:raise ValueError('external index corruption')
   parts.append(r);continue
  partial=database.with_suffix('.partial');partial.unlink(missing_ok=True);db=connect(partial)
  db.executescript('CREATE TABLE rows(line INTEGER PRIMARY KEY,raw BLOB);CREATE TABLE words(word TEXT,line INTEGER,PRIMARY KEY(word,line)) WITHOUT ROWID;CREATE TABLE quarantine(line INTEGER PRIMARY KEY,raw BLOB,reason TEXT);')
  counts=Counter();header=None
  try:
   with binary_stream(raw/a['path'],a) as stream,db:
    for line,data in enumerate(stream,1):
     if not data.strip() or (a['format']=='derinet2' and data.lstrip().startswith(b'#')):continue
     if a['format'].startswith('glemm_') and header is None:
      header=data.decode().rstrip('\n').removesuffix('\r').split('\t')
      required=GLEMM+(['definition2','lemmatized_definition2'] if a['format']=='glemm_defs' else [])
      if len(set(header))!=len(header) or not set(required)<=set(header):raise ValueError('invalid source header')
      continue
     counts['read']+=1
     try:
      if a['format']=='derinet2' and not data.endswith(b'\n'):raise ValueError('missing terminal newline')
      record=make_record(a,line,data,header);n=record['body']['normalized']
     except (ValueError,UnicodeError) as e:
      counts['quarantined']+=1;db.execute('INSERT INTO quarantine VALUES(?,?,?)',(line,zlib.compress(data,1),str(e)));continue
     db.execute('INSERT INTO rows VALUES(?,?)',(line,zlib.compress(data,1)))
     words={lookup(l['lemma']) for l in n['lexemes']}
     if 'inflection' in n:words.add(lookup(n['inflection']['form']));counts['inflections']+=1
     db.executemany('INSERT INTO words VALUES(?,?)',((w,line) for w in sorted(words)))
     counts['accepted']+=1;counts['claims']+=len(n['claims'])
   if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('external SQLite integrity')
   db.close()
   with partial.open('rb') as f:os.fsync(f.fileno())
   partial.rename(database)
  except BaseException:db.close();raise
  if filehash(raw/a['path'])!=a['sha256']:raise ValueError('source changed during index read')
  r=dict(artifact=a,database=database.name,database_sha256=filehash(database),counts=dict(counts),header=header,code=code)
  atomic(receipt,canonical(r)+b'\n');parts.append(r);print(json.dumps(dict(artifact=a['id'],counts=dict(counts))),flush=True)
 m=dict(schema='v5-external-row-index/1',identity=dict(source_lock_sha256=filehash(lock),code=code),
  complete=len(parts)==len(registry['artifacts']),missing=missing,parts=parts)
 m['version']=sha(canonical(m));atomic(out/'EXTERNAL.json',canonical(m)+b'\n');totals=Counter()
 for r in parts:totals.update(r['counts'])
 report=dict(version=m['version'],complete=m['complete'],counts=dict(totals),seconds=time.monotonic()-start,
  max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,disk_bytes=sum((out/r['database']).stat().st_size for r in parts))
 atomic(out/'BENCHMARK.json',canonical(report)+b'\n');return report

class External:
 def __init__(self,folder,source_lock,verify=True,allow_incomplete=False):
  self.folder=Path(folder);self.manifest=read(self.folder/'EXTERNAL.json');self.registry=read(source_lock)
  if self.manifest.get('version')!=sha(canonical({k:v for k,v in self.manifest.items() if k!='version'})):raise ValueError('external manifest identity mismatch')
  if filehash(source_lock)!=self.manifest['identity']['source_lock_sha256']:raise ValueError('source lock mismatch')
  if not self.manifest['complete'] and not allow_incomplete:raise ValueError('incomplete external corpus')
  self.parts=self.manifest['parts'];self.identity=self.manifest['version']
  if verify:
   for r in self.parts:
    if filehash(self.folder/r['database'])!=r['database_sha256']:raise ValueError('external rows checksum')
 def records(self,language,word,limit=12):
  if not 1<=limit<=100:raise ValueError('bounded source row limit')
  records=[];omitted=0
  for r in self.parts:
   a=r['artifact']
   if LANGUAGES[a['language']]!=language:continue
   db=connect(self.folder/r['database'],True)
   try:
    n=db.execute('SELECT COUNT(*) FROM words WHERE word=?',(lookup(word),)).fetchone()[0]
    rows=db.execute('SELECT r.line,r.raw FROM words w JOIN rows r ON r.line=w.line WHERE w.word=? ORDER BY r.line LIMIT ?',(lookup(word),limit)).fetchall()
    omitted+=n-len(rows)
    records.extend(make_record(a,line,zlib.decompress(raw),r['header']) for line,raw in rows)
   finally:db.close()
  return records,omitted
 def enrich(self,q):
  records,omitted=self.records(q['language'],q['lemma']);q=dict(q)
  q.update(external_rows=records,external_rows_omitted=omitted,
   external_alignment_status='same_language_spelling_only_not_identity',source_availability=dict(complete=self.manifest['complete'],missing=self.manifest['missing']))
  artifacts={a['id']:a for a in self.registry['artifacts']}
  q['evidence_refs']=[dict(id=r['id'],source=r['body']['source'],revision=r['body']['revision'],artifact=r['body']['artifact'],
   raw_locator=r['body']['raw_locator'],source_lineage=artifacts[r['body']['artifact']].get('lineage',{'status':'independence_unknown'})) for r in records]
  q['native_lexeme_alternatives']=[l for r in records for l in r['body']['normalized']['lexemes']]
  q['independence']=dict(status='not_established',independent_groups=[],possible_dependencies=['GLeMM-MorphyNet'],source_count_is_not_independent_count=True)
  if records:q['evidence_completeness']='external_claims_available_alignment_and_sense_unresolved'
  return q
 def graph(self,questions,destination,version_contract=None):
  from associativvordes.evidence_graph.graph import Graph
  from associativvordes.evidence_graph.build_graph import ingest
  destination=Path(destination)
  if destination.exists():raise ValueError('fresh isolated graph required')
  records={r['id']:r for q in questions for r in q.get('external_rows',[])};used={r['body']['artifact'] for r in records.values()}
  source=destination.with_suffix('.ndjson');atomic(source,b''.join(canonical(records[k])+b'\n' for k in sorted(records)))
  g=Graph(destination,version_contract=version_contract)
  try:
   g.db.execute('CREATE TABLE IF NOT EXISTS native_nodes(artifact TEXT,native TEXT,lexeme TEXT,PRIMARY KEY(artifact,native))')
   counts=ingest(g,source,dict(self.registry,artifacts=[a for a in self.registry['artifacts'] if a['id'] in used]))
   if g.db.execute('SELECT COUNT(*) FROM known').fetchone()[0]:raise ValueError('unexpected accepted membership projection')
   g.commit();return counts
  finally:g.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--raw',required=True);p.add_argument('--lock',required=True);p.add_argument('--output',required=True);p.add_argument('--allow-unavailable',action='store_true');a=p.parse_args()
 print(json.dumps(build(a.raw,a.lock,a.output,a.allow_unavailable),sort_keys=True))

"""Lossless source occurrence index; unbound morphology signatures are not lexemes."""
import argparse,collections,hashlib,json,sqlite3,time,unicodedata
from pathlib import Path
from .model import canonical,lookup
from associativvordes.importers.morphology_import import binary_stream,validate_lock,parse,LANGUAGES,GLEMM

def build(raw,lock,output):
 raw=Path(raw).resolve();lock=Path(lock);output=Path(output).resolve();output.mkdir(parents=True,exist_ok=True);path=output/'native.sqlite'
 if path.exists():raise ValueError('fresh native index required')
 source=json.loads(lock.read_bytes());validate_lock(source,raw);db=sqlite3.connect(path)
 db.executescript('''PRAGMA journal_mode=OFF;PRAGMA synchronous=OFF;PRAGMA cache_size=-65536;PRAGMA temp_store=FILE;
 CREATE TABLE artifacts(id INTEGER PRIMARY KEY,source_id TEXT,body TEXT);
 CREATE TABLE candidates(id INTEGER PRIMARY KEY,artifact INTEGER,lexkey TEXT,language TEXT,lookup TEXT,lemma TEXT,pos TEXT,native_lexical_id TEXT,sense_id TEXT,kind TEXT,UNIQUE(artifact,lexkey));
 CREATE TABLE occurrences(artifact INTEGER,line INTEGER,role INTEGER,candidate INTEGER,raw_sha256 TEXT,native_observation_id TEXT,definition TEXT);
 CREATE TABLE rejected(artifact INTEGER,line INTEGER,raw_sha256 TEXT,reason TEXT);
 ''');totals=collections.Counter();arts=[];start=time.monotonic()
 for ai,a in enumerate(sorted(source['artifacts'],key=lambda x:x['id']),1):
  db.execute('INSERT INTO artifacts VALUES(?,?,?)',(ai,a['id'],json.dumps(a,ensure_ascii=False)));header=None;counts=collections.Counter();cache={}
  with binary_stream(raw/a['path'],a) as stream:
   for line,data in enumerate(stream,1):
    if not data.strip() or a['format']=='derinet2' and data.lstrip().startswith(b'#'):continue
    if a['format'].startswith('glemm_') and header is None:header=data.decode().rstrip('\r\n').split('\t');continue
    h=hashlib.sha256(data).hexdigest();counts['source_rows']+=1
    try:
     b=dict(a,language=LANGUAGES[a['language']]);fields=data.decode().rstrip('\n').removesuffix('\r').split('\t');_,normalized=parse(b,fields,h,header)
    except (ValueError,UnicodeError) as e:db.execute('INSERT INTO rejected VALUES(?,?,?,?)',(ai,line,h,str(e)));counts['rejected_rows']+=1;continue
    for role,x in enumerate(normalized['lexemes']):
     known=x['identity_resolution']=='source_identified';key=json.dumps(['native',x['native_key'],x['lemma'],x['native_pos']] if known else ['unbound_signature',x['lemma'],x['native_pos']],ensure_ascii=False,separators=(',',':'))
     cid=cache.get(key)
     if cid is None:
      db.execute('INSERT OR IGNORE INTO candidates(artifact,lexkey,language,lookup,lemma,pos,native_lexical_id,sense_id,kind) VALUES(?,?,?,?,?,?,?,?,?)',(ai,key,x['language'],lookup(x['lemma']),x['lemma'],x['pos'],x['id'] if known else None,None,'SOURCE_NATIVE_LEXEME_WITH_UNKNOWN_SENSE' if known else 'UNBOUND_SOURCE_SIGNATURE_NOT_LEXICAL_IDENTITY'))
      cid=db.execute('SELECT id FROM candidates WHERE artifact=? AND lexkey=?',(ai,key)).fetchone()[0]
      if len(cache)>32768:cache.clear()
      cache[key]=cid
     definition=normalized.get('definitions',{}).get('definition2') if role==1 else None
     db.execute('INSERT INTO occurrences VALUES(?,?,?,?,?,?,?)',(ai,line,role,cid,h,x['id'],definition));counts['endpoint_occurrences']+=1
    if counts['source_rows']%25000==0:db.commit()
  db.commit();totals.update(counts);arts.append(dict(id=a['id'],counts=dict(counts)));print(json.dumps(arts[-1]),flush=True)
 db.executescript('CREATE INDEX candidate_lookup ON candidates(language,lookup);CREATE INDEX occurrence_candidate ON occurrences(candidate);CREATE INDEX occurrence_line ON occurrences(artifact,line);CREATE TABLE lookup_sets AS SELECT language,lookup,count(*) alternatives,count(DISTINCT pos) pos_alternatives,count(DISTINCT artifact) source_artifacts FROM candidates GROUP BY language,lookup;CREATE UNIQUE INDEX lookup_identity ON lookup_sets(language,lookup);')
 db.commit();assert db.execute('PRAGMA integrity_check').fetchall()==[('ok',)];candidate_count=db.execute('SELECT count(*) FROM candidates').fetchone()[0];db.close()
 result=dict(schema='interal-native-identity-index/1',artifacts=arts,totals=dict(totals),candidate_signatures=candidate_count,all_occurrences_preserved=True,senses_inferred=False,lookup_is_identity=False,source_lock_sha256=hashlib.sha256(lock.read_bytes()).hexdigest(),seconds=time.monotonic()-start,unicode_version=unicodedata.unidata_version)
 (output/'NATIVE-REPORT.json').write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--raw',required=True);p.add_argument('--lock',required=True);p.add_argument('--output',required=True);a=p.parse_args();build(a.raw,a.lock,a.output)

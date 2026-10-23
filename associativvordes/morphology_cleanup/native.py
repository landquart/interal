"""Compact disk profiles; full alternatives remain in hash-locked raw SQLite parts."""
import argparse,collections,json,os,pathlib,sqlite3,sys,time,zlib,resource
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'associativvordes/v5_adapter'))
from common import canonical,atomic,filehash,lookup,read,connect
from external import External,make_record,LANGUAGES
from policy import BITS

def row_mask(a,data):
    f=data.decode().rstrip('\r\n').split('\t');fmt=a['format']
    if fmt.startswith('glemm'):return BITS['unconfirmed']
    if 'inflection' in fmt:return BITS['inflection']
    if fmt=='derinet2':
        # Only explicit source relation labels, never row order or spelling.
        text=f[7]+'|'+f[8];m=0
        if 'Type=Derivation' in text or f[7]=='Derivation':m|=BITS['direct_derivation']
        if 'Type=Compounding' in text or f[7]=='Compounding':m|=BITS['compounding']
        return m or BITS['unconfirmed']
    m=BITS['direct_derivation'];op=f[-1].lower()
    if op in ('prefix','prefixation'):m|=BITS['prefixation']
    elif op in ('suffix','suffixation'):m|=BITS['suffixation']
    return m

def build(folder,lock,out):
    start=time.monotonic();e=External(folder,lock);out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
    identity=dict(external_version=e.identity,source_lock_sha256=filehash(lock),code={p.name:filehash(p) for p in sorted(pathlib.Path(__file__).parent.glob('*.py'))})
    parts=[]
    for i,r in enumerate(e.parts):
        target=out/f'{i:02d}.sqlite';receipt=out/f'{i:02d}.json';a=r['artifact']
        if receipt.exists():
            p=read(receipt)
            if p['identity']!=identity or filehash(target)!=p['sha256']:raise ValueError('stale/corrupt profile')
            parts.append(p);continue
        tmp=target.with_suffix('.partial');tmp.unlink(missing_ok=True);db=connect(tmp)
        db.execute('ATTACH DATABASE ? AS raw',(str(pathlib.Path(folder)/r['database']),))
        db.execute('CREATE TABLE profiles(word TEXT,mask INTEGER,n INTEGER,PRIMARY KEY(word,mask)) WITHOUT ROWID')
        fmt=a['format']
        if fmt.startswith('glemm') or 'inflection' in fmt:
            m=BITS['unconfirmed'] if fmt.startswith('glemm') else BITS['inflection']
            db.execute('INSERT INTO profiles SELECT word,?,count(*) FROM raw.words GROUP BY word',(m,))
        else:
            db.execute('CREATE TABLE kinds(line INTEGER PRIMARY KEY,mask INTEGER)')
            cursor=db.execute('SELECT line,raw FROM raw.rows ORDER BY line')
            while True:
                chunk=cursor.fetchmany(4096)
                if not chunk:break
                db.executemany('INSERT INTO kinds VALUES(?,?)',((line,row_mask(a,zlib.decompress(raw))) for line,raw in chunk))
            db.execute('INSERT INTO profiles SELECT word,mask,count(*) FROM raw.words JOIN kinds USING(line) GROUP BY word,mask')
            db.execute('DROP TABLE kinds')
        db.commit()
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('profile integrity')
        n=db.execute('SELECT count(*) FROM profiles').fetchone()[0];db.close();os.replace(tmp,target)
        p=dict(index=i,artifact=a['id'],language=LANGUAGES[a['language']],identity=identity,sha256=filehash(target),rows=n)
        atomic(receipt,canonical(p)+b'\n');parts.append(p);print(a['id'],n,flush=True)
    manifest=dict(identity=identity,parts=parts,raw_manifest=e.manifest,complete=True)
    atomic(out/'MANIFEST.json',canonical(manifest)+b'\n')
    atomic(out/'BENCHMARK.json',canonical(dict(seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,disk_bytes=sum(p.stat().st_size for p in out.glob('*'))))+b'\n')

class Profiles:
    def __init__(self,path):
        self.path=pathlib.Path(path);self.manifest=read(self.path/'MANIFEST.json');self.parts=[]
        for p in self.manifest['parts']:
            f=self.path/f"{p['index']:02d}.sqlite"
            if filehash(f)!=p['sha256']:raise ValueError('profile checksum')
            self.parts.append((p['language'],connect(f,True)))
    def lookup(self,language,word):
        mask=0;n=0
        for lang,db in self.parts:
            if lang==language:
                for m,c in db.execute('SELECT mask,n FROM profiles WHERE word=?',(lookup(word),)):mask|=m;n+=c
        return mask,n
    def close(self):
        for _,db in self.parts:db.close()

def records_all(folder,lock,language,word):
    """No limit: every same-language spelling alternative, with raw/native provenance."""
    e=External(folder,lock)
    for p in e.parts:
        if LANGUAGES[p['artifact']['language']]!=language:continue
        db=connect(pathlib.Path(folder)/p['database'],True)
        try:
            for line,raw in db.execute('SELECT r.line,r.raw FROM words w JOIN rows r USING(line) WHERE w.word=? ORDER BY r.line',(lookup(word),)):
                yield make_record(p['artifact'],line,zlib.decompress(raw),p['header'])
        finally:db.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--external',required=True);p.add_argument('--lock',required=True);p.add_argument('--output',required=True);a=p.parse_args();build(a.external,a.lock,a.output)

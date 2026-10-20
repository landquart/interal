#!/usr/bin/env python3
"""Checkpointed read-only v5 inventory and frequency observation projection.

Full inventory is a performance workload, not approved morphological gold.
No family acceptance or new lexical identity is inferred by this module.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import resource
import sqlite3
import subprocess
import sys
import time
import zlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'importers'))
from morphology_import import dumps, digest, hash_file
from certify_corpus import atomic_json
from scale_index import lookup


def build(repo,revision,destination,stop_after=None):
    repo=Path(repo).resolve(); destination=Path(destination).resolve()
    if destination.is_relative_to(repo): raise ValueError('external index required')
    destination.mkdir(parents=True,exist_ok=True)
    started=time.monotonic(); prefix='associativvordes/family-index-v5/'
    listing=subprocess.check_output(['git','ls-tree','-r',revision,'--',prefix],cwd=repo,text=True)
    files={}
    for line in listing.splitlines():
        head,path=line.split('\t',1); name=path.removeprefix(prefix)
        if name.startswith('families/') or any(name.startswith('members/'+lang+'/') for lang in ['en','de','fr','es','it','ru']):
            files[name]=head.split()[2]
    db=sqlite3.connect(destination/'project.sqlite')
    db.executescript('''PRAGMA cache_size=-8192; PRAGMA temp_store=FILE;
      CREATE TABLE IF NOT EXISTS identity(value TEXT);
      CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY,path TEXT UNIQUE,sha TEXT,rows INTEGER);
      CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,status TEXT);
      CREATE TABLE IF NOT EXISTS frequencies(id INTEGER PRIMARY KEY,fingerprint BLOB UNIQUE,body BLOB);
      CREATE TABLE IF NOT EXISTS seeds(family TEXT,language TEXT,word TEXT,lemma TEXT,file INTEGER,ordinal INTEGER,raw_sha BLOB,frequency INTEGER);
      CREATE INDEX IF NOT EXISTS family_seeds ON seeds(family,language,word);
      CREATE INDEX IF NOT EXISTS word_seeds ON seeds(language,word,family);''')
    identity=digest([revision,files,hash_file(__file__)])
    old=db.execute('SELECT value FROM identity').fetchone()
    if old and old[0]!=identity: raise ValueError('project identity changed')
    if not old: db.execute('INSERT INTO identity VALUES(?)',(identity,)); db.commit()
    reused=processed=0; maximum=0
    try:
        for name,blob in sorted(files.items()):
            data=(repo/prefix/name).read_bytes()
            if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=blob: raise ValueError('Git checksum mismatch: '+name)
            checksum=hashlib.sha256(data).hexdigest()
            previous=db.execute('SELECT sha FROM files WHERE path=?',(name,)).fetchone()
            if previous:
                if previous[0]!=checksum: raise ValueError('checkpoint checksum mismatch')
                reused+=1; continue
            with gzip.open(repo/prefix/name,'rb') as stream: decoded=stream.read(64*1024*1024+1)
            maximum=max(maximum,len(decoded))
            if len(decoded)>64*1024*1024: raise ValueError('explicit shard memory budget exceeded')
            shard=json.loads(decoded); rows=0
            with db:
                fileid=db.execute('INSERT INTO files(path,sha,rows) VALUES(?,?,0)',(name,checksum)).lastrowid
                for family,values in shard.items():
                    if name.startswith('families/'):
                        db.execute('INSERT INTO families VALUES(?,?)',(family,values.get('review_status'))); rows+=1
                    else:
                        language=name.split('/')[1]
                        for ordinal,row in enumerate(values):
                            frequency={k:row[k] for k in ['rank','frequency_score','category_breakdown','sources'] if k in row}
                            body=dumps(frequency); fingerprint=bytes.fromhex(digest([language,row['lemma_id'],frequency]))
                            found=db.execute('SELECT id FROM frequencies WHERE fingerprint=?',(fingerprint,)).fetchone()
                            fid=found[0] if found else db.execute('INSERT INTO frequencies(fingerprint,body) VALUES(?,?)',
                                (fingerprint,zlib.compress(body.encode(),1))).lastrowid
                            db.execute('INSERT INTO seeds VALUES(?,?,?,?,?,?,?,?)',(family,language,lookup(row['word']),row['lemma_id'],
                                fileid,ordinal,bytes.fromhex(digest(row)),fid)); rows+=1
                db.execute('UPDATE files SET rows=? WHERE id=?',(rows,fileid))
            processed+=1
            if processed%64==0: print(dumps({'shards':processed,'reused':reused}),flush=True)
            if stop_after and processed>=stop_after: return dict(status='checkpoint',processed=processed,reused=reused)
            del shard,data,decoded
        counts={t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['files','families','seeds','frequencies']}
    finally: db.close()
    result=dict(status='PASS',revision=revision,identity=identity,counts=counts,processed_shards=processed,reused_shards=reused,
        elapsed_seconds=round(time.monotonic()-started,3),max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        largest_decoded_shard_bytes=maximum,database_bytes=(destination/'project.sqlite').stat().st_size,
        database_sha256=hash_file(destination/'project.sqlite'),membership_writes=0)
    atomic_json(destination/'PROJECT.json',result); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',required=True,type=Path); p.add_argument('--revision',required=True)
    p.add_argument('--destination',required=True,type=Path); p.add_argument('--stop-after',type=int)
    a=p.parse_args(); print(dumps(build(a.repo,a.revision,a.destination,a.stop_after)))

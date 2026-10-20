#!/usr/bin/env python3
"""Disk-only source projection; lexical identity is never inferred from spelling.

Each partition is checkpointed in SQLite transactions. Productive observations
are stored compressed for random access; inflections remain losslessly in the
certified staging files and cannot become derivational arcs.
"""
import argparse
from collections import deque
import fcntl
import gzip
import json
from pathlib import Path
import resource
import sqlite3
import time
import unicodedata
import zlib
from morphology_import import digest, dumps, hash_file
from certify_corpus import atomic_json, verified, ROOT


def bid(value): return bytes.fromhex(value.split(':',1)[1])
def lookup(word): return unicodedata.normalize('NFC',word).casefold()


class Index:
    def __init__(self,path):
        self.path=Path(path).resolve()
        if self.path.is_relative_to(ROOT): raise ValueError('index must be outside checkout')
        self.path.parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(self.path)
        self.db.executescript('''PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA synchronous=FULL;
          CREATE TABLE IF NOT EXISTS partitions(name TEXT PRIMARY KEY,identity TEXT,progress INTEGER,complete INTEGER,inflections INTEGER);
          CREATE TABLE IF NOT EXISTS records(seq INTEGER PRIMARY KEY,eid BLOB UNIQUE,body BLOB);
          CREATE TABLE IF NOT EXISTS lexemes(id BLOB PRIMARY KEY,language TEXT,search TEXT,pos TEXT,fingerprint TEXT,seq INTEGER);
          CREATE INDEX IF NOT EXISTS lexical_lookup ON lexemes(language,search,id);
          CREATE TABLE IF NOT EXISTS arcs(src BLOB,dst BLOB,seq INTEGER,ordinal INTEGER,slot INTEGER,type TEXT,direction TEXT,
             PRIMARY KEY(src,dst,seq,ordinal,slot));
          CREATE TABLE IF NOT EXISTS unresolved(seq INTEGER,ordinal INTEGER,PRIMARY KEY(seq,ordinal));''')

    def ingest(self,name,snapshot,registry,stop_after=None):
        snapshot=Path(snapshot); m=verified(snapshot,'manifest.json')
        identity=digest([hash_file(snapshot/'manifest.json'),digest(registry),hash_file(__file__)])
        old=self.db.execute('SELECT identity,progress,complete,inflections FROM partitions WHERE name=?',(name,)).fetchone()
        if old and old[0]!=identity: raise ValueError('partition identity changed; use a new versioned index')
        if old and old[2]: return {'reused':True,'read':old[1],'reprocessed':0,'inflections':old[3]}
        progress,inflections=(old[1],old[3]) if old else (0,0)
        if not old:
            self.db.execute('INSERT INTO partitions VALUES(?,?,0,0,0)',(name,identity)); self.db.commit()
        initial=progress; artifacts={a['id']:a for a in registry['artifacts']}; scanned=0
        try:
            with gzip.open(snapshot/'records.ndjson.gz','rb') as source:
                for _ in range(progress):
                    if not source.readline(): raise ValueError('invalid checkpoint')
                for raw in source:
                    row=json.loads(raw); b=row['body']; n=b['normalized']; a=artifacts[b['artifact']]
                    if b['establishes_membership'] or b['review_status']!='unreviewed': raise ValueError('unsafe staging status')
                    if 'inflection' in n:
                        if n['claims'] or n['inflection']['derivational_model']: raise ValueError('inflection contamination')
                        inflections+=1
                    else:
                        cursor=self.db.execute('INSERT INTO records(eid,body) VALUES(?,?)',(bid(row['id']),zlib.compress(raw,1)))
                        seq=cursor.lastrowid
                        for lex in n['lexemes']:
                            lid=bid(lex['id']); fingerprint=digest(lex)
                            prior=self.db.execute('SELECT fingerprint FROM lexemes WHERE id=?',(lid,)).fetchone()
                            if prior and prior[0]!=fingerprint: raise ValueError('lexical identity collision')
                            expected='lexeme:'+digest([a['source'],a['resource'],a['revision'],lex['language'],lex['native_key']])
                            if expected!=lex['id']: raise ValueError('invalid lexical identifier')
                            self.db.execute('INSERT OR IGNORE INTO lexemes VALUES(?,?,?,?,?,?)',
                                (lid,lex['language'],lex['lookup'],lex['pos'],fingerprint,seq))
                        for ordinal,c in enumerate(n['claims']):
                            if b['source']=='UDer':
                                ids=[bytes.fromhex(digest([a['source'],a['resource'],a['revision'],b['language'],native])) for native in c['sources']]
                                ids.append(bid(n['lexemes'][0]['id']))
                            else: ids=list(map(bid,c['participants']))
                            if len(ids)<2: self.db.execute('INSERT INTO unresolved VALUES(?,?)',(seq,ordinal))
                            for slot,src in enumerate(ids[:-1]):
                                self.db.execute('INSERT INTO arcs VALUES(?,?,?,?,?,?,?)',(src,ids[-1],seq,ordinal,slot,c['type'],c['direction']))
                                if c['direction']!='directed':
                                    self.db.execute('INSERT INTO arcs VALUES(?,?,?,?,?,?,?)',(ids[-1],src,seq,ordinal,slot,c['type'],c['direction']))
                    progress+=1; scanned+=1
                    if scanned%1000==0 or (stop_after and scanned>=stop_after):
                        self.db.execute('UPDATE partitions SET progress=?,inflections=? WHERE name=?',(progress,inflections,name)); self.db.commit()
                    if stop_after and scanned>=stop_after:
                        return dict(reused=False,checkpoint=True,read=progress,reprocessed=scanned,inflections=inflections)
            self.db.execute('UPDATE partitions SET progress=?,complete=1,inflections=? WHERE name=?',(progress,inflections,name)); self.db.commit()
        except BaseException:
            self.db.rollback(); raise
        expected=sum(r['accepted'] for r in m['reports'])
        if expected!=progress: raise ValueError('staging/index count mismatch')
        return dict(reused=False,read=progress,reprocessed=progress-initial,inflections=inflections)

    def exact(self,language,word,limit=30):
        if not 1<=limit<=1000: raise ValueError('bounded lookup required')
        rows=self.db.execute('SELECT id,pos,seq FROM lexemes WHERE language=? AND search=? ORDER BY id LIMIT ?',
                             (language,lookup(word),limit+1)).fetchall()
        return {'matches':[{'id':'lexeme:'+r[0].hex(),'pos':r[1],'record':r[2]} for r in rows[:limit]],
                'truncated':len(rows)>limit,'identity_established':False}

    def record(self,seq):
        row=self.db.execute('SELECT body FROM records WHERE seq=?',(seq,)).fetchone()
        if not row: raise KeyError(seq)
        return json.loads(zlib.decompress(row[0]))

    def paths(self,start,max_depth=2,max_paths=20,max_expansions=300):
        if not 1<=max_depth<=3 or not 1<=max_paths<=100 or not 1<=max_expansions<=10000: raise ValueError('bounded traversal required')
        queue=deque([(bid(start),[start],[])]); found=[]; expanded=0
        while queue and len(found)<max_paths and expanded<max_expansions:
            current,nodes,steps=queue.popleft()
            if steps: found.append(dict(nodes=nodes,steps=steps,status='hypothesis_only',establishes_membership=False))
            if len(steps)>=max_depth: continue
            for dst,seq,ordinal,slot,kind,direction in self.db.execute('''SELECT a.dst,a.seq,a.ordinal,a.slot,a.type,a.direction
               FROM arcs a JOIN lexemes l ON l.id=a.dst JOIN lexemes s ON s.id=a.src
               WHERE a.src=? AND s.language=l.language ORDER BY a.dst,a.seq,a.ordinal,a.slot''',(current,)):
                expanded+=1
                if expanded>=max_expansions: break
                target='lexeme:'+dst.hex()
                if target in nodes or direction!='directed' or kind not in {'direct_derivation','conversion','compounding'}: continue
                row=self.record(seq); b=row['body']
                step=dict(type=kind,direction=direction,evidence_id=row['id'],claim_ordinal=ordinal,component_slot=slot,
                          source=b['source'],artifact=b['artifact'],raw_locator=b['raw_locator'],confirmed=False)
                queue.append((dst,nodes+[target],steps+[step]))
        return dict(paths=found,expanded=expanded,truncated=bool(queue) or expanded>=max_expansions,
                    establishes_membership=False,family_guard_required_before_queue=True)

    def close(self): self.db.close()


def build(release,registry_path,destination):
    release=Path(release); destination=Path(destination); registry=json.loads(Path(registry_path).read_text())
    state=json.loads((release/'CHECKPOINT.json').read_text())
    if state['status']!='PASS': raise ValueError('certified release required')
    started=time.monotonic(); destination.mkdir(parents=True,exist_ok=True)
    with open(destination/'.index-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        index=Index(destination/'index.sqlite'); results={}
        try:
            for name,p in sorted(state['partitions'].items()):
                results[name]=index.ingest(name,release/'snapshots'/name/p['build_id'],registry)
                atomic_json(destination/'PROGRESS.json',results); print(dumps({name:results[name]}),flush=True)
            counts={t:index.db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['records','lexemes','arcs','unresolved']}
            counts['source_records']=index.db.execute('SELECT SUM(progress) FROM partitions').fetchone()[0]
            counts['inflections']=index.db.execute('SELECT SUM(inflections) FROM partitions').fetchone()[0]
        finally: index.close()
    result=dict(status='PASS',counts=counts,partitions=results,elapsed_seconds=round(time.monotonic()-started,3),
        max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,database_bytes=(destination/'index.sqlite').stat().st_size,
        database_sha256=hash_file(destination/'index.sqlite'),catalog_build_id=state['catalog']['build_id'],establishes_membership=False)
    atomic_json(destination/'INDEX.json',result); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['release','registry','destination']: p.add_argument('--'+name,required=True,type=Path)
    a=p.parse_args(); print(dumps(build(a.release,a.registry,a.destination)))

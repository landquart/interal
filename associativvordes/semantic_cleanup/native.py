"""Full pinned-source pass; keep every alternative for finite exact search forms."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import resource
import sqlite3
import sys
import time
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT),str(ROOT/'associativvordes/evidence_graph')]
from records import make_record,parse,binary_stream,validate_lock,GLEMM,LANGUAGES
from associativvordes.national_correspondences.registry import canonical,filehash,read
from associativvordes.national_correspondences.audit import atomic
import unicodedata

def lookup(s):return unicodedata.normalize('NFC',s).casefold()
def build(raw,lock,targets,output):
    raw=Path(raw).resolve();lock=Path(lock);targets=Path(targets);out=Path(output).resolve()
    if out.is_relative_to(ROOT) or out.is_relative_to(raw):raise ValueError('separate research index required')
    out.mkdir(parents=True,exist_ok=True);start=time.monotonic();registry=read(lock);validate_lock(registry,raw)
    wanted={lang:{lookup(w) for w in words} for lang,words in read(targets)['words'].items()}
    identity=dict(source_lock_sha256=filehash(lock),target_sha256=filehash(targets),code_sha256=filehash(__file__))
    parts=[]
    for index,a in enumerate(sorted(registry['artifacts'],key=lambda a:a['id'])):
        receipt=out/f'{index:02d}.json';dbpath=out/f'{index:02d}.sqlite'
        if receipt.exists():
            r=read(receipt)
            if r['identity']!=identity or filehash(dbpath)!=r['sha256']:raise ValueError('stale/corrupt native checkpoint')
            parts.append(r);continue
        temporary=dbpath.with_suffix('.partial');temporary.unlink(missing_ok=True)
        db=sqlite3.connect(temporary);db.executescript('CREATE TABLE rows(id TEXT PRIMARY KEY,artifact TEXT,line INTEGER,record TEXT);CREATE TABLE matches(language TEXT,word TEXT,id TEXT,PRIMARY KEY(language,word,id)) WITHOUT ROWID;')
        counts=Counter();header=None;lang=LANGUAGES[a['language']];normalized_artifact=dict(a,language=lang)
        with binary_stream(raw/a['path'],a) as stream,db:
            for line,data in enumerate(stream,1):
                if not data.strip() or (a['format']=='derinet2' and data.lstrip().startswith(b'#')):continue
                if a['format'].startswith('glemm_') and header is None:
                    header=data.decode().rstrip('\n').removesuffix('\r').split('\t')
                    if len(set(header))!=len(header) or not set(GLEMM)<=set(header):raise ValueError('source header')
                    continue
                counts['read']+=1
                try:
                    if a['format']=='derinet2' and not data.endswith(b'\n'):raise ValueError('terminal newline')
                    _,n=parse(normalized_artifact,data.decode().rstrip('\n').removesuffix('\r').split('\t'),hashlib.sha256(data).hexdigest(),header)
                except (ValueError,UnicodeError):counts['quarantined']+=1;continue
                counts['accepted']+=1
                forms={lookup(l['lemma']) for l in n['lexemes']}
                if 'inflection' in n:forms.add(lookup(n['inflection']['form']))
                hits=forms&wanted.get(lang,set())
                if not hits:continue
                record=make_record(a,line,data,header)
                db.execute('INSERT INTO rows VALUES(?,?,?,?)',(record['id'],a['id'],line,canonical(record).decode()))
                db.executemany('INSERT INTO matches VALUES(?,?,?)',((lang,w,record['id']) for w in sorted(hits)));counts['retained_rows']+=1
        db.commit()
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('index corruption')
        db.close();temporary.replace(dbpath)
        if filehash(raw/a['path'])!=a['sha256']:raise ValueError('source modified')
        r=dict(identity=identity,artifact=a['id'],database=dbpath.name,sha256=filehash(dbpath),counts=dict(counts));atomic(receipt,canonical(r)+b'\n');parts.append(r);print(a['id'],dict(counts),flush=True)
    totals=Counter()
    for p in parts:totals.update(p['counts'])
    manifest=dict(schema='interal-semantic-native-lookup/1',identity=identity,parts=parts,counts=dict(totals),alignment='NFC_CASEFOLD_SEARCH_ONLY_NOT_LEXEME_OR_SENSE_IDENTITY',alternatives_truncated=False,source_independence='NOT_ASSUMED_GLEMM_MORPHYNET_DEPENDENCY_PRESERVED_IN_SOURCE_LOCK')
    atomic(out/'MANIFEST.json',canonical(manifest)+b'\n');atomic(out/'RESOURCE.json',canonical(dict(elapsed_seconds=round(time.monotonic()-start,3),peak_rss_mib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,3),disk_bytes=sum(p.stat().st_size for p in out.iterdir() if p.is_file())))+b'\n')
    return manifest

def records(folder,language,word):
    folder=Path(folder);manifest=read(folder/'MANIFEST.json')
    for part in manifest['parts']:
        path=folder/part['database']
        if filehash(path)!=part['sha256']:raise ValueError('native checksum')
        db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
        try:
            for (body,) in db.execute('SELECT r.record FROM rows r JOIN matches m USING(id) WHERE m.language=? AND m.word=? ORDER BY r.line',(language,lookup(word))):yield json.loads(body)
        finally:db.close()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--raw',required=True);p.add_argument('--lock',required=True);p.add_argument('--targets',required=True);p.add_argument('--output',required=True);a=p.parse_args();build(a.raw,a.lock,a.targets,a.output)

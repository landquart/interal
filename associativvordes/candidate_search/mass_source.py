"""Read-only disk source graph and resumable bounded-owner auxiliary projection."""
import argparse
import fcntl
from functools import lru_cache
import gzip
import json
from pathlib import Path
import re
import resource
import sqlite3
import time
import zlib
from mass_registry import canonical, sha, file_hash
from scale_index import Index, bid
from certify_corpus import verified, atomic_json


def readonly(path):
    db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    db.executescript('PRAGMA query_only=ON; PRAGMA cache_size=-8192; PRAGMA temp_store=FILE;')
    return db


def checked(path, receipt):
    value = json.loads(Path(receipt).read_text())
    if value.get('status', 'PASS') != 'PASS' or value['database_sha256'] != file_hash(path):
        raise ValueError('completed database integrity: ' + str(path))
    return value


class Source(Index):
    def __init__(self, path, verify=True):
        self.path = Path(path)
        if verify: checked(path, self.path.parent / 'INDEX.json')
        self.db = readonly(path)
        self.record = lru_cache(maxsize=128)(self.record)

    def lexeme(self, identifier):
        seq = self.db.execute('SELECT seq FROM lexemes WHERE id=?', (identifier,)).fetchone()
        if not seq: raise ValueError('missing native endpoint')
        key = 'lexeme:' + identifier.hex()
        for value in self.record(seq[0])['body']['normalized']['lexemes']:
            if value['id'] == key: return value
        raise ValueError('native endpoint identity mismatch')

    def close(self):
        self.record.cache_clear(); self.db.close()


def owner_key(registry):
    return sha([list(r) for r in registry.execute('SELECT DISTINCT language,word FROM seeds ORDER BY language,word')])


def prepare(index, release, registry, source_lock, destination):
    destination=Path(destination).resolve()
    if destination.is_relative_to(Path(__file__).resolve().parents[2]): raise ValueError('external auxiliary projection required')
    destination.mkdir(parents=True,exist_ok=True)
    with open(destination/'.prepare-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        return _prepare(index,release,registry,source_lock,destination)


def _prepare(index, release, registry, source_lock, destination):
    index, release, destination = Path(index), Path(release), Path(destination)
    repo = Path(__file__).resolve().parents[2]
    if destination.resolve().is_relative_to(repo): raise ValueError('external auxiliary projection required')
    destination.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    index_receipt = checked(index, index.parent / 'INDEX.json')
    state = json.loads((release / 'CHECKPOINT.json').read_text())
    if state['status'] != 'PASS' or state['catalog']['build_id'] != index_receipt['catalog_build_id']:
        raise ValueError('certified source/catalog identity mismatch')
    lock = json.loads(Path(source_lock).read_text())
    artifacts = {a['id']: a for a in lock['artifacts']}
    reg = readonly(registry)
    owners = set(reg.execute('SELECT DISTINCT language,word FROM seeds'))
    identity = dict(source=index_receipt['database_sha256'], catalog=state['catalog']['build_id'],
                    source_lock=file_hash(source_lock), owners=owner_key(reg), policy=file_hash(__file__))
    reg.close()
    dbpath = destination / 'aux.sqlite'
    if (destination / 'AUX.json').exists():
        old = checked(dbpath, destination / 'AUX.json')
        if old['identity'] != identity: raise ValueError('auxiliary identity changed; use fresh version')
        return dict(old, reused=True)
    db = sqlite3.connect(dbpath)
    db.executescript('''PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA synchronous=FULL;
       CREATE TABLE IF NOT EXISTS identity(value TEXT);
       CREATE TABLE IF NOT EXISTS progress(name TEXT PRIMARY KEY,stats TEXT);
       CREATE TABLE IF NOT EXISTS ranges(first INTEGER PRIMARY KEY,last INTEGER,artifact TEXT,source TEXT);
       CREATE TABLE IF NOT EXISTS incoming(dst BLOB,src BLOB,seq INTEGER,ordinal INTEGER,slot INTEGER,type TEXT,direction TEXT,
          PRIMARY KEY(dst,src,seq,ordinal,slot));
       CREATE TABLE IF NOT EXISTS inflections(language TEXT,owner TEXT,eid TEXT PRIMARY KEY,body TEXT);
       CREATE INDEX IF NOT EXISTS owner_lookup ON inflections(language,owner,eid);''')
    old = db.execute('SELECT value FROM identity').fetchone()
    if old and old[0] != canonical(identity): raise ValueError('auxiliary checkpoint identity mismatch')
    if not old: db.execute('INSERT INTO identity VALUES(?)', (canonical(identity),)); db.commit()
    source = Source(index, verify=False)
    try:
        if not db.execute("SELECT 1 FROM progress WHERE name='native'").fetchone():
            with db:
                last_artifact = None
                first = last = None
                for seq, packed in source.db.execute('SELECT seq,body FROM records ORDER BY seq'):
                    prefix = zlib.decompressobj().decompress(packed, 512)
                    match = re.search(rb'"artifact":"([^"\\]+)"', prefix)
                    if not match: raise ValueError('artifact absent from canonical prefix')
                    artifact = match[1].decode()
                    if artifact not in artifacts: raise ValueError('unknown source artifact')
                    if artifact != last_artifact:
                        # Check real records at each boundary; seq ranges may interleave after resume.
                        if last_artifact is not None:
                            if source.record(last)['body']['artifact'] != last_artifact: raise ValueError('range boundary')
                            db.execute('INSERT INTO ranges VALUES(?,?,?,?)', (first, last, last_artifact, artifacts[last_artifact]['source']))
                        if source.record(seq)['body']['artifact'] != artifact: raise ValueError('range start')
                        first, last_artifact = seq, artifact
                    last = seq
                if last_artifact is not None:
                    if source.record(last)['body']['artifact'] != last_artifact: raise ValueError('range end')
                    db.execute('INSERT INTO ranges VALUES(?,?,?,?)', (first, last, last_artifact, artifacts[last_artifact]['source']))
                for row in source.db.execute("SELECT dst,src,seq,ordinal,slot,type,direction FROM arcs WHERE direction='directed'"):
                    db.execute('INSERT INTO incoming VALUES(?,?,?,?,?,?,?)', row)
                db.execute('INSERT INTO progress VALUES(?,?)', ('native', '{}'))
        for name, part in sorted(state['partitions'].items()):
            if db.execute('SELECT 1 FROM progress WHERE name=?', ('inflection:' + name,)).fetchone(): continue
            snapshot = release / 'snapshots' / name / part['build_id']
            manifest = verified(snapshot, 'manifest.json')
            seen = selected = 0
            with db, gzip.open(snapshot / 'records.ndjson.gz', 'rt', encoding='utf-8') as stream:
                for raw in stream:
                    seen += 1
                    # Never infer a derivational arc from these records.
                    if '"inflection":' not in raw: continue
                    row = json.loads(raw); body = row['body']; normal = body['normalized']
                    if 'inflection' not in normal: continue
                    if normal['claims'] or normal['inflection']['derivational_model']: raise ValueError('inflection contamination')
                    lexeme = normal['lexemes'][0]
                    if (lexeme['language'], lexeme['lookup']) in owners:
                        db.execute('INSERT INTO inflections VALUES(?,?,?,?)',
                                   (lexeme['language'], lexeme['lookup'], row['id'], canonical(row)))
                        selected += 1
                if seen != sum(r['accepted'] for r in manifest['reports']): raise ValueError('staging count mismatch')
                db.execute('INSERT INTO progress VALUES(?,?)', ('inflection:' + name, canonical(dict(read=seen, selected=selected))))
        counts = {t: db.execute('SELECT COUNT(*) FROM ' + t).fetchone()[0] for t in ['ranges', 'incoming', 'inflections']}
    finally:
        source.close(); db.close()
    result = dict(status='PASS', identity=identity, counts=counts, database_sha256=file_hash(dbpath),
                  database_bytes=dbpath.stat().st_size, elapsed_seconds=round(time.monotonic() - started, 3),
                  max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    atomic_json(destination / 'AUX.json', result)
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ['index', 'release', 'registry', 'source-lock', 'destination']: p.add_argument('--' + name, required=True)
    a = p.parse_args(); print(canonical(prepare(a.index, a.release, a.registry, a.source_lock, a.destination)))

#!/usr/bin/env python3
"""Isolated, offline morphology ingestion. No runtime/family imports or writes.

Stdlib Python 3.11+. Input paths are relative to a separately supplied raw root;
all products are created atomically below a caller-supplied directory OUTSIDE
this repository. See README.md for the staging contract and limitations.
"""
import argparse
import base64
import bz2
from contextlib import contextmanager
import gzip
import hashlib
import io
import zlib
import json
import os
import platform
from pathlib import Path
import re
import shutil
import sqlite3
import tempfile
import unicodedata
import zipfile

VERSION = 'isolated-morphology-import/1.0.2'
SCHEMA = 'morphology-import-record/1'
LANGUAGES = {'en':'en','eng':'en','de':'de','deu':'de','fr':'fr','fra':'fr','esp':'es',
             'es':'es','spa':'es','it':'it','ita':'it','ru':'ru','rus':'ru'}
POS = {'N':'NOUN','V':'VERB','A':'ADJ','J':'ADJ','R':'ADV','D':'ADV'}
UPOS = set('ADJ ADP ADV AUX CCONJ DET INTJ NOUN NUM PART PRON PROPN PUNCT SCONJ SYM VERB X'.split())
DIRECTIONS = {'Derivation':'direct_derivation','Conversion':'conversion',
              'Compounding':'compounding','Univerbisation':'univerbisation','Variant':'orthographic_variant'}
GLEMM = ['lemma1','cat1','lemma2','cat2','stem','exponent1','exponent2']
UDER = ['id','lemid','lemma','pos','feats','segmentation','parent_id','reltype','otherrels','annotations']


def dumps(value):
    # Versioned canonical subset: strings, bool, null, ints; no floats in identity keys.
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(dumps(value).encode('utf-8')).hexdigest()


def hash_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda:f.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def nfc(text):
    return unicodedata.normalize('NFC', text)


def pos(tag):
    return POS.get(tag, tag if tag in UPOS else None)


def kw(text):
    if not text:
        return []
    result = []
    for group in text.split('|'):
        row = {}
        for item in group.split('&'):
            key, val = item.split('=', 1)
            if not key or key in row:
                raise ValueError('invalid or duplicate keyword')
            row[key] = val
        result.append(row)
    return result


def valid_id(value):
    if not re.fullmatch(r'[0-9]+\.[0-9]+', value):
        raise ValueError('invalid DeriNet ID: '+value)
    return value


def lexeme(a, native, lemma, tag, identified=False):
    if not lemma.strip():
        raise ValueError('empty lemma/form')
    return {'id':'lexeme:'+digest([a['source'], a['resource'], a['revision'], a['language'], native]),
            'native_key':native, 'lemma':nfc(lemma), 'original':lemma,
            'native_pos':tag, 'pos':pos(tag), 'language':a['language'],
            'lookup':nfc(lemma).casefold(), 'identity_resolution':'source_identified' if identified else 'unresolved',
            'sense_scope':'unresolved'}


def parse(a, fields, row_hash, header=None):
    """Extract source claims, never reviewed relations, heads or memberships."""
    kind = a['format']
    claims = []
    if kind == 'derinet2':
        if len(fields) != 10:
            raise ValueError('DeriNet2 requires 10 columns')
        raw = dict(zip(UDER, fields))
        native = valid_id(raw['id'])
        feature_groups = kw(raw['feats'])
        if len(feature_groups) > 1:
            raise ValueError('multiple feature dictionaries')
        segment = json.loads(raw['segmentation']) if raw['segmentation'].startswith('[') else kw(raw['segmentation'])
        if not isinstance(segment, list) or not all(isinstance(m, dict) for m in segment):
            raise ValueError('segmentation must be list of objects')
        last_end = 0
        for m in segment:
            m = {k.title():v for k,v in m.items()}
            if 'Morph' not in m and not {'Start','End'} <= m.keys():
                raise ValueError('morph missing span and string')
            start = int(m.get('Start', int(m['End'])-len(m['Morph']) if 'End' in m and 'Morph' in m else last_end))
            end = int(m.get('End', start+len(m.get('Morph',''))))
            if not 0 <= start < end <= len(raw['lemma']) or start < last_end:
                raise ValueError('invalid morph span')
            if 'Morph' in m and raw['lemma'][start:end] != m['Morph']:
                raise ValueError('morph/span mismatch')
            last_end = end
        annotations = json.loads(raw['annotations'])
        if not isinstance(annotations, dict):
            raise ValueError('annotations must be object')
        target = lexeme(a, native, raw['lemma'], raw['pos'], True)
        lexemes = [target]
        relations = kw(raw['reltype'])
        if len(relations) > 1:
            raise ValueError('multiple main relations')
        if raw['parent_id']:
            parent = valid_id(raw['parent_id'])
            if parent == native:
                raise ValueError('self parent')
            main = relations[0] if relations else {}
            sources = [valid_id(x) for x in main.get('Sources',parent).split(',')]
            # Keep the ordered source slots AND primary parent; no tree flattening.
            claims.append({'type':DIRECTIONS.get(main.get('Type'), 'source_extension'),
                           'native_type':main.get('Type'), 'direction':'directed',
                           'sources':sources, 'target':native, 'primary_parent':parent,
                           'parameters':main, 'slot':'primary'})
        elif relations:
            raise ValueError('relation without primary parent')
        for ordinal, rel in enumerate(kw(raw['otherrels'])):
            # Secondary-edge syntax varies across releases. Keep every annotation;
            # project graph endpoints only when explicit, otherwise flag unresolved.
            source = rel.get('Sources', rel.get('Source', rel.get('Parent', rel.get('ID', rel.get('id')))))
            sources = [valid_id(x) for x in source.split(',')] if source else []
            claims.append({'type':DIRECTIONS.get(rel.get('Type'), 'source_extension'),
                           'native_type':rel.get('Type'), 'direction':'directed' if sources else 'unknown',
                           'sources':sources,'target':native,'parameters':rel,
                           'slot':'secondary:'+str(ordinal), 'endpoint_resolution':'explicit' if sources else 'unresolved'})
        return raw, {'lexemes':lexemes,'claims':claims,'features':feature_groups,
                     'segmentation':segment,'annotations':annotations}
    if kind.startswith('glemm_'):
        if header is None or len(fields) != len(header):
            raise ValueError('GLeMM row/header width mismatch')
        raw = dict(zip(header, fields))
        missing = set(GLEMM + (['definition2','lemmatized_definition2'] if kind == 'glemm_defs' else []))-raw.keys()
        if missing:
            raise ValueError('missing GLeMM columns: '+','.join(sorted(missing)))
        lexemes = [lexeme(a, [row_hash, role],raw['lemma'+str(i)],raw['cat'+str(i)]) for i,role in [(1,'left'),(2,'right')]]
        # Ordered raw columns are retained, but their order proves no direction.
        claims.append({'type':'morphological_relatedness','direction':'unknown',
                       'participants':[x['id'] for x in lexemes],
                       'parameters':{k:raw[k] for k in ['stem','exponent1','exponent2']},
                       'lineage':{'upstream':'MorphyNet','status':'possible_dataset_dependency','exact_row':None}})
        return raw, {'lexemes':lexemes,'claims':claims,'definitions':{k:raw[k] for k in ['definition2','lemmatized_definition2'] if k in raw}}
    if kind == 'morphynet_derivation':
        if len(fields) != 6:
            raise ValueError('MorphyNet derivation requires 6 columns')
        raw = dict(zip(['source','target','source_pos','target_pos','affix','operation'], fields))
        lexemes = [lexeme(a,[row_hash,'source'],fields[0],fields[2]),lexeme(a,[row_hash,'target'],fields[1],fields[3])]
        claims.append({'type':'direct_derivation','direction':'directed',
                       'participants':[x['id'] for x in lexemes],
                       'parameters':{'affix':fields[4],'operation':fields[5]},
                       'segmentation':None})
        return raw, {'lexemes':lexemes,'claims':claims}
    if kind == 'morphynet_inflection':
        if len(fields) != 4:
            raise ValueError('MorphyNet inflection requires 4 columns')
        raw = dict(zip(['lemma','form','features','segmentation'],fields))
        lemma = lexeme(a,[row_hash,'lemma'],fields[0],re.split('[;| ]',fields[2])[0])
        if not fields[1].strip():
            raise ValueError('empty inflected form')
        return raw, {'lexemes':[lemma], 'claims':[],
                     'inflection':{'lemma_id':lemma['id'],'form':nfc(fields[1]),'features':fields[2],
                                   'segmentation':None if fields[3] == '-' else fields[3].split('|'),
                                   'derivational_model':False}}
    raise ValueError('unknown format: '+kind)


@contextmanager
def binary_stream(path, a):
    member = a.get('member')
    if member:
        with zipfile.ZipFile(path) as z, z.open(member) as f:
            yield f
    else:
        opener = bz2.open if path.suffix == '.bz2' else gzip.open if path.suffix == '.gz' else open
        with opener(path,'rb') as f:
            yield f


def checked_path(root, relative):
    p = (root / relative).resolve()
    if not p.is_relative_to(root):
        raise ValueError('raw path escapes root')
    return p


def validate_lock(lock, root):
    if lock.get('schema_version') != 'morphology-source-lock/1':
        raise ValueError('unsupported source lock')
    if not lock.get('artifacts'):
        raise ValueError('empty artifact list')
    seen = set()
    for a in lock['artifacts']:
        for k in ['id','source','resource','revision','language','format','path','sha256','bytes','license','url']:
            if k not in a:
                raise ValueError('missing artifact '+k)
        if a['id'] in seen:
            raise ValueError('duplicate artifact id')
        seen.add(a['id'])
        if a['language'] not in LANGUAGES or not re.fullmatch('[0-9a-f]{64}',a['sha256']):
            raise ValueError('invalid language/hash')
        if a['revision'] in ('main','master','latest','HEAD','') or not a['license']:
            raise ValueError('unlocked revision/license')
        p = checked_path(root,a['path'])
        if p.stat().st_size != a['bytes'] or hash_file(p) != a['sha256']:
            raise ValueError('checksum/size mismatch: '+a['id'])
        if a.get('member'):
            with zipfile.ZipFile(p) as z:
                info = z.getinfo(a['member'])
                if info.file_size != a['member_bytes']:
                    raise ValueError('ZIP member size mismatch')
                h = hashlib.sha256()
                with z.open(a['member']) as f:
                    for b in iter(lambda:f.read(1024*1024),b''):
                        h.update(b)
                if h.hexdigest() != a['member_sha256']:
                    raise ValueError('ZIP member checksum mismatch')


def relation_view(a, normalized, claim):
    """Lookup-only cross-source equivalence; NEVER lexical identity or review."""
    lex = normalized['lexemes']
    if a['format'] == 'derinet2':
        # Endpoints have native IDs, not strings; cross-source alignment is deferred.
        endpoints = [a['source'],a['resource'],a['revision'],claim['sources'],claim['target']]
    else:
        endpoints = [[x['language'],x['lemma'],x['pos'],x['native_pos']] for x in lex]
        if claim['direction'] == 'unknown':
            endpoints = sorted(endpoints,key=dumps)
    return {'language':a['language'],'type':claim['type'],'direction':claim['direction'],
            'endpoints':endpoints,'parameters':claim.get('parameters',{}),
            'identity_established':False}


def run(lock_path, raw_root, output_root):
    lock = json.loads(Path(lock_path).read_text('utf-8'))
    root = Path(raw_root).resolve()
    out = Path(output_root).resolve()
    repo = Path(__file__).resolve().parents[2]
    if out.is_relative_to(repo):
        raise ValueError('build output must be outside repository')
    validate_lock(lock, root)  # Fail before writing any snapshot.
    policy = {'importer':VERSION,'schema':SCHEMA,'code_sha256':hash_file(__file__),
              'python_version':platform.python_version(),'sqlite_version':sqlite3.sqlite_version,
              'unicode_version':unicodedata.unidata_version,'zlib_version':zlib.ZLIB_VERSION,'gzip_level':1,'normalization':'NFC+lookup-casefold/1'}
    build = digest({'lock':lock,'policy':policy})
    out.mkdir(parents=True,exist_ok=True)
    final = out / build
    if final.exists():
        manifest = json.loads((final/'manifest.json').read_text('utf-8'))
        for name, checksum in manifest['outputs'].items():
            if hash_file(final/name) != checksum:
                raise ValueError('existing output corrupted: '+name)
        return final
    # Keep mutable SQLite/journals away from synced artifact directories. Only
    # a completed immutable snapshot is moved into the output namespace.
    tmp = Path(tempfile.mkdtemp(prefix='morphology-ingest-'))
    db = sqlite3.connect(tmp/'working.sqlite')
    db.executescript('''PRAGMA cache_size=-8192; PRAGMA temp_store=FILE;
      CREATE TABLE occurrences(artifact TEXT,line INTEGER,raw_hash TEXT,PRIMARY KEY(artifact,line));
      CREATE INDEX raw_duplicates ON occurrences(artifact,raw_hash);
      CREATE TABLE lexids(artifact TEXT,native TEXT,PRIMARY KEY(artifact,native));
      CREATE TABLE refs(artifact TEXT,line INTEGER,native TEXT);
      CREATE INDEX ref_artifact ON refs(artifact);
      CREATE TABLE views(key TEXT PRIMARY KEY,body TEXT);
      CREATE TABLE evidence(viewkey TEXT,evidence TEXT,artifact TEXT,line INTEGER);
      CREATE INDEX ev_key ON evidence(viewkey);
      CREATE TABLE pair_types(pairkey TEXT,type TEXT,viewkey TEXT);
      CREATE INDEX pair_idx ON pair_types(pairkey);''')
    reports = []
    try:
        with open(tmp/'records.ndjson.gz','wb') as record_bytes, gzip.GzipFile(filename='',mode='wb',compresslevel=1,mtime=0,fileobj=record_bytes) as record_gzip, io.TextIOWrapper(record_gzip,encoding='utf-8',newline='\n') as records, open(tmp/'quarantine.ndjson','w',encoding='utf-8',newline='\n') as quarantine:
            for original in sorted(lock['artifacts'],key=lambda x:x['id']):
                db.execute('BEGIN')
                a = dict(original,language=LANGUAGES[original['language']])
                report = {'artifact':a['id'],'language':a['language'],'source':a['source'],
                          'read':0,'accepted':0,'rejected':0,'comments':0,'blank':0,'headers':0,
                          'claims':0,'inflections':0,'unresolved_secondary':0}
                header = None
                with binary_stream(checked_path(root,a['path']),a) as stream:
                    for line, data in enumerate(stream,1):
                        if not data.strip():
                            report['blank'] += 1
                            continue
                        if a['format'] == 'derinet2' and data.lstrip().startswith(b'#'):
                            report['comments'] += 1
                            continue
                        raw_hash = hashlib.sha256(data).hexdigest()
                        evidence = 'evidence:'+digest([a['id'],a['revision'],a['sha256'],a.get('member_sha256'),line,raw_hash,VERSION])
                        is_header = a['format'].startswith('glemm_') and header is None
                        if not is_header:
                            report['read'] += 1
                        db.execute('SAVEPOINT row')
                        try:
                            text = data.decode('utf-8',errors='strict')
                            if not text.endswith('\n') and a['format'] == 'derinet2':
                                raise ValueError('missing terminal newline; possibly truncated')
                            fields = text.rstrip('\n').removesuffix('\r').split('\t')
                            if a['format'].startswith('glemm_') and header is None:
                                header = fields
                                required = GLEMM + (['definition2','lemmatized_definition2'] if a['format']=='glemm_defs' else [])
                                if len(set(header)) != len(header) or not set(required)<=set(header):
                                    raise ValueError('invalid GLeMM header')
                                report['headers'] += 1
                                db.execute('RELEASE row')
                                continue
                            raw, normalized = parse(a,fields,raw_hash,header)
                            if a['format']=='derinet2':
                                db.execute('INSERT INTO lexids VALUES(?,?)',(a['id'],raw['id']))
                                for c in normalized['claims']:
                                    for native in c['sources'] + ([c['primary_parent']] if 'primary_parent' in c else []):
                                        db.execute('INSERT INTO refs VALUES(?,?,?)',(a['id'],line,native))
                            db.execute('INSERT INTO occurrences VALUES(?,?,?)',(a['id'],line,raw_hash))
                            for ordinal,c in enumerate(normalized['claims']):
                                view = relation_view(a,normalized,c)
                                key = digest(view)
                                db.execute('INSERT OR IGNORE INTO views VALUES(?,?)',(key,dumps(view)))
                                db.execute('INSERT INTO evidence VALUES(?,?,?,?)',(key,evidence+':'+str(ordinal),a['id'],line))
                                pair = digest([view['language'],view['endpoints']])
                                db.execute('INSERT INTO pair_types VALUES(?,?,?)',(pair,view['type'],key))
                            body = {'source':a['source'],'resource':a['resource'],'revision':a['revision'],
                                    'artifact':a['id'],'language':a['language'],
                                    'raw_locator':{'line':line,'raw_sha256':raw_hash,'artifact_sha256':a['sha256'],'member':a.get('member')},
                                    'raw_fields':raw,'original_line_base64':base64.b64encode(data).decode('ascii'),
                                    'normalized':normalized,'review_status':'unreviewed','establishes_membership':False}
                            records.write(dumps({'schema_version':SCHEMA,'id':evidence,'body':body})+'\n')
                            db.execute('RELEASE row')
                            report['accepted'] += 1
                            report['claims'] += len(normalized['claims'])
                            report['inflections'] += int('inflection' in normalized)
                            report['unresolved_secondary'] += sum(c.get('endpoint_resolution')=='unresolved' for c in normalized['claims'])
                        except (ValueError,KeyError,TypeError,sqlite3.IntegrityError) as exc:
                            db.execute('ROLLBACK TO row')
                            db.execute('RELEASE row')
                            # Header failures are artifact failures, never guess positional schema.
                            if a['format'].startswith('glemm_') and report['headers']==0:
                                raise ValueError('invalid GLeMM header: '+str(exc)) from exc
                            report['rejected'] += 1
                            quarantine.write(dumps({'artifact':a['id'],'line':line,'raw_sha256':raw_hash,
                                                    'raw_base64':base64.b64encode(data).decode('ascii'),
                                                    'reason':type(exc).__name__+': '+str(exc)})+'\n')
                        if line % 10000 == 0:
                            db.commit()
                            db.execute('BEGIN')
                if a['format'].startswith('glemm_') and header is None:
                    raise ValueError('empty GLeMM file')
                db.commit()
                report['duplicates'] = db.execute('SELECT COALESCE(SUM(n-1),0) FROM (SELECT COUNT(*) n FROM occurrences WHERE artifact=? GROUP BY raw_hash HAVING n>1)',(a['id'],)).fetchone()[0]
                report['unresolved_references'] = db.execute('SELECT COUNT(*) FROM refs r LEFT JOIN lexids l ON l.artifact=r.artifact AND l.native=r.native WHERE r.artifact=? AND l.native IS NULL',(a['id'],)).fetchone()[0]
                reports.append(report)
                print(dumps(report),flush=True)
        with open(tmp/'normalized-relations.ndjson','w',encoding='utf-8') as f:
            for key, body in db.execute('SELECT key,body FROM views ORDER BY key'):
                f.write(dumps({'key':key,'view':json.loads(body)})+'\n')
        with open(tmp/'relation-evidence.ndjson','w',encoding='utf-8') as f:
            for key, evidence, artifact, line in db.execute('SELECT viewkey,evidence,artifact,line FROM evidence ORDER BY viewkey,evidence'):
                f.write(dumps({'key':key,'evidence':evidence,'artifact':artifact,'line':line})+'\n')
        with open(tmp/'conflicts.ndjson','w',encoding='utf-8') as f:
            for pair, count in db.execute('SELECT pairkey,COUNT(DISTINCT type) FROM pair_types GROUP BY pairkey HAVING COUNT(DISTINCT type)>1 ORDER BY pairkey'):
                f.write(dumps({'pair_key':pair,'distinct_types':count,'status':'needs_review'})+'\n')
        # Logical export is normative; SQLite physical bytes are deliberately not hashed.
        total_views = db.execute('SELECT COUNT(*) FROM views').fetchone()[0]
        db.close()
        (tmp/'working.sqlite').unlink()
        outputs = {p.name:hash_file(p) for p in sorted(tmp.iterdir())}
        manifest = {'build_id':build,'policy':policy,'source_lock_sha256':hash_file(lock_path),
                    'mode':'ingest_shadow','reports':reports,'normalized_relation_views':total_views,
                    'outputs':outputs,'establishes_membership':False}
        (tmp/'manifest.json').write_text(dumps(manifest)+'\n',encoding='utf-8')
        # No mutable latest pointer. Atomic directory rename; concurrent identical builds reuse only after verification.
        try:
            try:
                os.rename(tmp,final)
            except OSError as exc:
                import errno
                if exc.errno != errno.EXDEV:
                    raise
                publication = Path(tempfile.mkdtemp(prefix='.publish-',dir=out))
                try:
                    shutil.copytree(tmp,publication,dirs_exist_ok=True)
                    os.rename(publication,final)
                    shutil.rmtree(tmp)
                finally:
                    shutil.rmtree(publication,ignore_errors=True)
        except OSError:
            if not final.exists():
                raise
            shutil.rmtree(tmp)
            return run(lock_path,raw_root,output_root)
        return final
    except BaseException:
        db.close()
        shutil.rmtree(tmp,ignore_errors=True)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock',required=True)
    parser.add_argument('--raw-root',required=True)
    parser.add_argument('--output-root',required=True)
    args = parser.parse_args()
    print(run(args.lock,args.raw_root,args.output_root))

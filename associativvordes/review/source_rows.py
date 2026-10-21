"""Attach lossless rows from existing certified importer snapshots, never fetch URLs."""
import base64
import gzip
import json
from pathlib import Path
from store import atomic, canonical, digest


def attach(ledger, snapshots):
    wanted = {}
    for q in ledger.questions.values():
        for e in q.get('evidence_refs', []) + q.get('inflection_observations', []):
            key = e.get('id', e.get('evidence_id'))
            if key: wanted[key] = e
    rows = {}
    for folder in map(Path, snapshots):
        manifest = json.loads((folder/'manifest.json').read_bytes())
        source = folder/'records.ndjson.gz'
        import hashlib
        h = hashlib.sha256()
        with source.open('rb') as f:
            for block in iter(lambda: f.read(1024*1024), b''): h.update(block)
        if h.hexdigest() != manifest['outputs']['records.ndjson.gz']: raise ValueError('importer snapshot checksum mismatch')
        with gzip.open(source, 'rt', encoding='utf-8') as f:
            for line in f:
                record = json.loads(line)
                if record['id'] not in wanted: continue
                body, evidence = record['body'], wanted[record['id']]
                raw = base64.b64decode(body['original_line_base64'], validate=True)
                if digest(raw) != evidence['raw_locator']['raw_sha256'] or body['raw_locator'] != evidence['raw_locator']:
                    raise ValueError('source row locator/hash mismatch')
                if evidence.get('revision') and evidence['revision'] != body['revision']: raise ValueError('source revision mismatch')
                rows[record['id']] = {'raw_text': raw.decode('utf-8'), 'original_line_base64': body['original_line_base64'],
                    'raw_locator': body['raw_locator'], 'revision': body['revision'], 'artifact': body['artifact'],
                    'importer_manifest_sha256': digest(manifest), 'record_id': record['id']}
    with ledger.lock():
        ledger.sync()
        folder = ledger.root/'source-rows'; folder.mkdir(exist_ok=True)
        payload = canonical(rows).encode(); version = digest(payload)
        atomic(folder/(version+'.json'), payload)
    return {'attached': len(rows), 'wanted': len(wanted), 'version': version, 'missing': len(wanted)-len(rows)}


def lookup(ledger, question):
    found = {}
    wanted = {e.get('id', e.get('evidence_id')): e for e in question.get('evidence_refs', []) + question.get('inflection_observations', [])}
    for file in sorted((ledger.root/'source-rows').glob('*.json')):
        cache = getattr(ledger, 'row_cache', {})
        if file.stem not in cache:
            raw = file.read_bytes()
            if digest(raw) != file.stem: raise ValueError('source row attachment checksum mismatch')
            cache[file.stem] = json.loads(raw)
        ledger.row_cache = cache
        for key in wanted.keys() & cache[file.stem].keys():
            row = cache[file.stem][key]
            if row['raw_locator'] != wanted[key]['raw_locator'] or digest(base64.b64decode(row['original_line_base64'])) != wanted[key]['raw_locator']['raw_sha256']:
                raise ValueError('attached row mismatch')
            found[key] = row
    return found

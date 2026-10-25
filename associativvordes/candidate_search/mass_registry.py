"""All actual v6 families; verified pinned inputs, no family creation."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import gzip
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import resource
import time
pass
pass
from associativvordes.evidence_graph.graph import Graph, canonical, sha, lookup, file_hash
from associativvordes.evidence_graph.build_graph import load_registry
from associativvordes.evidence_graph.prepare_registry import COMMIT, FILES, bucket
from associativvordes.importers.certify_corpus import atomic_json
from associativvordes.importers.morphology_import import digest

LANGUAGES = ('de', 'en', 'es', 'fr', 'it', 'ru')


def local_content(value):
    """Drop only global snapshot provenance from per-family invalidation keys."""
    if isinstance(value, str) and value[:1] in ('{', '['):
        try: return local_content(json.loads(value))
        except ValueError: pass
    if isinstance(value, dict):
        return {k: local_content(v) for k, v in value.items() if k != 'snapshot_sha256'}
    if isinstance(value, (tuple, list)): return [local_content(v) for v in value]
    return value


def prepare(repo, destination, legacy_revision, revision=COMMIT):
    started=time.monotonic()
    repo, destination = Path(repo).resolve(), Path(destination).resolve()
    if destination.is_relative_to(repo): raise ValueError('external registry required')
    if revision != COMMIT: raise ValueError('unapproved v6 revision')
    destination.mkdir(parents=True, exist_ok=True)
    database = destination / 'registry.sqlite'
    if database.exists(): raise ValueError('use a fresh versioned registry destination')
    proofs = {}

    def read(path, rev, expected=None):
        blob = subprocess.check_output(['git', 'rev-parse', rev + ':' + path], cwd=repo, text=True).strip()
        if expected and blob != expected: raise ValueError('unexpected pinned blob: ' + path)
        data = subprocess.check_output(['git', 'show', rev + ':' + path], cwd=repo)
        if len(data) > 64 * 1024 * 1024: raise ValueError('compressed shard budget exceeded')
        if hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() != blob:
            raise ValueError('git checksum mismatch')
        proofs[path] = dict(commit=rev, git_blob=blob, sha256=hashlib.sha256(data).hexdigest())
        if path.endswith('.gz'):
            import io
            with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream: data = stream.read(128 * 1024 * 1024 + 1)
        if len(data) > 128 * 1024 * 1024: raise ValueError('decoded shard budget exceeded')
        return json.loads(data)

    prefix = 'associativvordes/family-index-v6/'
    values = {name: read(prefix + name, revision, blob) for name, blob in FILES.items()}
    snapshot = dict(commit=revision, files=proofs, catalog=values['catalog.json'],
                    heads=values['generated/heads.json.gz'], edges=values['generated/edges.json.gz'],
                    links=values['generated/lemma-head-links.json.gz'], memberships=values['generated/memberships.json.gz'],
                    corrections=values['generated/correction-verdicts.json.gz'], realizations=values['generated/reflexes.json'],
                    manual_decisions=[], family_controls=[])
    targets = {}
    for f in snapshot['catalog']['families']:
        for fid in [f['id'], *f.get('legacy_ids', [])]: targets[fid] = f['id']
    if 'family:ped' in targets: targets['family:pede'] = 'family:ped'
    @lru_cache(maxsize=1)
    def old(relative):
        return read('associativvordes/family-index-v5/' + relative, legacy_revision)
    for fid, target in sorted(targets.items()):
        f = old('families/' + bucket(fid) + '.json.gz').get(fid)
        if not f: continue
        if not (f.get('runtime_curated') or 'manual_override' in str(f.get('source')) or
                f.get('review_status') in {'rejected', 'split_required', 'blocked_from_runtime'}): continue
        snapshot['family_controls'].append(dict(family_id=target, source_family_id=fid,
            family_review_status=f.get('review_status'), family_record_json=json.dumps(f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))))
        for lang in LANGUAGES:
            for m in old('members/' + lang + '/' + bucket(fid) + '.json.gz').get(fid, []):
                marker = any(e.get('type') == 'manual_override' for c in m.get('components', []) for e in c.get('evidence', []))
                bad = m.get('corpus_quality', {}).get('status') == 'rejected'
                if marker or bad:
                    snapshot['manual_decisions'].append(dict(family_id=target, language=lang, word=m['word'],
                        lemma_id=m['lemma_id'], status='blocked_from_runtime' if bad else 'accepted',
                        reason='existing corpus quality exclusion' if bad else 'finite prior manual_override; identity not extended',
                        source_record_json=json.dumps(m, ensure_ascii=False, sort_keys=True, separators=(',', ':'))))
    g = Graph(database)
    try:
        load_registry(g, snapshot)
        g.db.executescript('''CREATE TABLE seeds(family TEXT,language TEXT,word TEXT,head TEXT,role TEXT,proof TEXT,
           PRIMARY KEY(family,language,word,head,role));
           CREATE INDEX seed_scope ON seeds(family,language,role,word);
           CREATE TABLE family_fingerprints(family TEXT PRIMARY KEY,value TEXT);
           CREATE TABLE registry_documents(path TEXT PRIMARY KEY,body TEXT,proof TEXT);''')
        heads = {h['id']: h for h in snapshot['heads']}
        def seed(family, lang, word, head, role, proof):
            if lang in LANGUAGES and word:
                g.db.execute('INSERT OR IGNORE INTO seeds VALUES(?,?,?,?,?,?)',
                    (family, lang, lookup(word), head, role, canonical(proof)))
        for e in snapshot['edges']:
            h = heads[e['head_id']]
            if h['identity_kind'] != 'legacy_exact_record':
                seed(e['family_id'], h['language'], h['normalized_head'], h['id'],
                     'head' if e['status'] == 'accepted' else 'negative', dict(head=h, edge=e))
        for f, lang, word, lemma, head, proof in g.db.execute('SELECT * FROM known'):
            seed(f, lang, word, head, 'member', json.loads(proof))
        for a in snapshot['realizations']:
            if a.get('status') == 'accepted':
                seed(a['family_id'], a.get('language'), a.get('realization'), '', 'allomorph', a)
        for name in ['head-lifecycle.json', 'baseline-corrections.json', 'generated/manifest.json']:
            g.db.execute('INSERT INTO registry_documents VALUES(?,?,?)', (name, canonical(values[name]), canonical(proofs[prefix + name])))
        for f in snapshot['catalog']['families']:
            fid = f['id']
            scoped = {k: [x for x in snapshot[k] if x.get('family_id') == fid]
                      for k in ['edges', 'links', 'memberships', 'corrections', 'realizations', 'manual_decisions', 'family_controls']}
            ids = {x['head_id'] for x in scoped['edges']}
            scoped.update(family=f, heads=[heads[k] for k in sorted(ids)])
            g.db.execute('INSERT INTO family_fingerprints VALUES(?,?)', (fid, digest(local_content(scoped))))
        g.commit()
        counts = {table: g.db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
                  for table in ['known', 'decisions', 'aliases', 'seeds', 'family_controls']}
        counts['families'] = len(snapshot['catalog']['families'])
    finally: g.close()
    receipt = dict(schema='mass-registry/1', commit=revision, legacy_revision=legacy_revision,
                   files=proofs, counts=counts, database_sha256=file_hash(database), membership_writes=0,
                   memory_budget_bytes=1024**3, policy_sha256=file_hash(__file__),
                   elapsed_seconds=round(time.monotonic()-started,3),max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    if receipt['max_rss_kib'] > receipt['memory_budget_bytes']//1024:raise ValueError('registry memory budget exceeded')
    atomic_json(destination / 'REGISTRY.json', receipt)
    return receipt


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ['repo', 'destination', 'legacy-revision']: p.add_argument('--' + name, required=True)
    a = p.parse_args(); print(json.dumps(prepare(a.repo, a.destination, a.legacy_revision),sort_keys=True))

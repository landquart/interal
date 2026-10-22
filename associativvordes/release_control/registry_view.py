"""Audited release -> mass-search registry, using existing graph/seed policies.

Build a fresh auxiliary owner projection if owner_key changes. This never writes
the production v5 index or rewrites the original pinned registry.
"""
import argparse
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
from control import *
from graph_view import build as graph_view, active_operations
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'candidate_search'))
from mass_registry import local_content
from graph import canonical as graph_canonical, lookup


def build(store, trust, baseline_registry, destination):
    target = external(destination); require(not target.exists(), 'fresh mass registry destination required')
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='.release07-registry-', dir=target.parent))
    try:
        built = temp/'built'; graph = graph_view(store, trust, built)
        version = graph['approved_version']; state = store.version(version)['state']; data = state['data']
        h = hashlib.sha256()
        with open(baseline_registry, 'rb') as source:
            for block in iter(lambda: source.read(1024*1024), b''): h.update(block)
        require(h.hexdigest() == state['source_files']['prior_decision_registry'], 'baseline registry changed')
        db = sqlite3.connect(built/'registry.sqlite')
        base = sqlite3.connect(Path(baseline_registry).resolve().as_uri()+'?mode=ro', uri=True)
        try:
            db.executescript('''CREATE TABLE seeds(family TEXT,language TEXT,word TEXT,head TEXT,role TEXT,proof TEXT,
                PRIMARY KEY(family,language,word,head,role));
                CREATE INDEX seed_scope ON seeds(family,language,role,word);
                CREATE TABLE family_fingerprints(family TEXT PRIMARY KEY,value TEXT);
                CREATE TABLE registry_documents(path TEXT PRIMARY KEY,body TEXT,proof TEXT);''')
            db.executemany('INSERT INTO registry_documents VALUES(?,?,?)', base.execute('SELECT * FROM registry_documents'))
            heads = {h['id']: h for h in data['heads']}
            def seed(f, lang, word, head, role, proof):
                if lang in LANGUAGES and word:
                    db.execute('INSERT OR IGNORE INTO seeds VALUES(?,?,?,?,?,?)',
                        (f, lang, lookup(word), head, role, graph_canonical(proof)))
            for edge in data['edges']:
                head = heads[edge['head_id']]
                if head.get('identity_kind', 'legacy_exact_record') != 'legacy_exact_record':
                    seed(edge['family_id'], head['language'], head['normalized_head'], head['id'],
                         'head' if edge['status'] == 'accepted' else 'negative', dict(head=head, edge=edge))
            for f, lang, word, lemma, head, proof in db.execute('SELECT * FROM known').fetchall():
                seed(f, lang, word, head, 'member', json.loads(proof))
            for row in data.get('realizations', []):
                if row.get('status') == 'accepted':
                    seed(row['family_id'], row.get('language'), row.get('realization'), '', 'allomorph', row)
            policy = digest(Path(__file__).read_bytes()); operations = active_operations(store, version)
            for family in data['catalog']['families']:
                fid = family['id']
                scoped = {name: [r for r in data.get(name, []) if r.get('family_id') == fid]
                    for name in ('edges', 'links', 'memberships', 'corrections', 'realizations', 'manual_decisions', 'family_controls')}
                ids = {r['head_id'] for r in scoped['edges']}|{r['head_id'] for r in scoped['memberships']}
                relevant = [op for op in operations if any(r and r['family_id'] == fid for r in (op['before'], op['after']))]
                scoped.update(family=family, heads=[heads[i] for i in sorted(ids)], operations=relevant)
                db.execute('INSERT INTO family_fingerprints VALUES(?,?)', (fid, digest([policy, local_content(scoped)])))
            db.commit()
            counts = {name: db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0]
                      for name in ('known', 'decisions', 'aliases', 'seeds', 'family_controls')}
            counts['families'] = len(data['catalog']['families'])
            require(db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok', 'SQLite integrity failed')
        finally: base.close(); db.close()
        sha = digest((built/'registry.sqlite').read_bytes())
        graph['database_sha256'] = sha; graph['mass_registry_prepared'] = True
        atomic(built/'GRAPH-VIEW.json', canonical(graph))
        receipt = dict(schema='controlled-mass-registry/1', database_sha256=sha, approved_version=version,
            state_sha256=digest(state), policy_sha256=policy, counts=counts, membership_writes=0,
            production_writes=0, auxiliary_owner_projection_must_match=True)
        atomic(built/'REGISTRY.json', canonical(receipt)); built.rename(target)
        return receipt
    finally: shutil.rmtree(temp, ignore_errors=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for n in ('store', 'trust', 'baseline-registry', 'destination'): p.add_argument('--'+n, required=True)
    a = p.parse_args(); print(canonical(build(Store(a.store), read(external(a.trust)),
        a.baseline_registry, a.destination)).decode())

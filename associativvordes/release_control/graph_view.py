"""Build an isolated current evidence view from an audited approved version.

This is not the production family index or a replacement mass-registry receipt.
Historical evidence stays present; explicit grants are finite operation proofs.
"""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from pathlib import Path
import shutil
import sys
import tempfile
from associativvordes.release_control.control import *
pass
from associativvordes.evidence_graph.graph import Graph, canonical as graph_canonical
from associativvordes.evidence_graph.build_graph import load_registry


def active_operations(store, version):
    value = store.version(version)
    if value['transition'] == 'BASELINE': return []
    if value['transition'] == 'ROLLBACK': return active_operations(store, value['restored_version'])
    return active_operations(store, value['parent']) + value['plan']['operations']


def build(store, trust, destination):
    audited = store.audit(trust)
    with store.lock():
        version, value = store.current()
        require(version == audited['current_version'],
                'release version changed since audited; retry with fresh trust')
        state = value['state']
        target = external(destination); require(not target.exists(), 'fresh graph destination required')
        target.parent.mkdir(parents=True, exist_ok=True)
        temp = Path(tempfile.mkdtemp(prefix='.release07-graph-', dir=target.parent))
        try:
            graph = Graph(temp/'registry.sqlite')
            snapshot = dict(state['data'], commit='approved-version:'+version,
                            files=dict(state.get('source_files', {}), approved_version=version))
            ref = load_registry(graph, snapshot)
            effects = {}
            for op in active_operations(store, version):
                proof = graph.existing('ApprovedFiniteOperation', op['id']+':'+digest(op), op, ref)
                before, after = op['before'], op['after']
                if before and (not after or key(before) != key(after)):
                    effects[key(before)] = (before, 'excluded', proof, op['reason'])
                if after: effects[key(after)] = (after, 'accepted', proof, op['reason'])
            for row, status, proof, reason in effects.values():
                graph.trusted_manual_refs.add(graph_canonical(proof))
                graph.add_decision(row['family_id'], row['language'], row['word'], status, proof,
                    lemma=row['lemma_id'], authority='manual_verified', reason=reason)
            graph.commit()
            counts = dict(known=graph.db.execute('SELECT COUNT(*) FROM known').fetchone()[0],
                          decisions=graph.db.execute('SELECT COUNT(*) FROM decisions').fetchone()[0])
            graph.close()
            receipt = dict(schema='release07-isolated-graph/1', approved_version=version,
                state_sha256=digest(state), counts=counts, database_sha256=digest((temp/'registry.sqlite').read_bytes()),
                graph_policy_sha256=digest(Path(__file__).read_bytes()), production_writes=0,
                replaces_mass_registry=False)
            atomic(temp/'GRAPH-VIEW.json', canonical(receipt)); temp.rename(target)
            return receipt
        finally: shutil.rmtree(temp, ignore_errors=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for n in ('store', 'trust', 'destination'): p.add_argument('--'+n, required=True)
    a = p.parse_args(); print(canonical(build(Store(a.store), read(external(a.trust)), a.destination)).decode())

#!/usr/bin/env python3
"""Select a checksum-verified previous proposal export; review history is retained."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import fcntl
import json
from pathlib import Path
from associativvordes.candidate_search.mass_source import file_hash
from associativvordes.importers.certify_corpus import atomic_json


def rollback(output):
    output=Path(output).resolve()
    with open(output/'.run-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        previous=json.loads((output/'PREVIOUS.json').read_text())
        selected=Path(previous['path']).resolve()
        if selected.parent != output/'releases' or selected.name != previous['version']:
            raise ValueError('export pointer outside versioned output')
        if file_hash(selected/'MANIFEST.json') != previous['manifest_sha256']:raise ValueError('manifest checksum')
        manifest=json.loads((selected/'MANIFEST.json').read_text())
        for name,h in manifest['outputs'].items():
            target=(selected/name).resolve()
            if target.parent != selected or file_hash(target)!=h:raise ValueError('export checksum')
        # Keep PREVIOUS intact so a damaged CURRENT never destroys the last known good pointer.
        atomic_json(output/'CURRENT.json',previous)
        return dict(status='PASS',version=previous['version'],review_history_changed=False)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True)
    print(json.dumps(rollback(p.parse_args().output),sort_keys=True))

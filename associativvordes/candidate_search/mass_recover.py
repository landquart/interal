#!/usr/bin/env python3
"""Select a checksum-verified previous proposal export; review history is retained."""
import argparse
import fcntl
import json
from pathlib import Path
from mass_source import file_hash
from certify_corpus import atomic_json


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

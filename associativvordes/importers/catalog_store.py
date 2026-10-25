#!/usr/bin/env python3
"""Explicit recovery can select a verified previous catalog even if CURRENT broke."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import fcntl
import json
import os
from pathlib import Path
from associativvordes.importers.certify_corpus import atomic_json, verified, publish as select_catalog, ROOT


def publish(store,catalog):
    catalog=Path(catalog).resolve(); manifest=verified(catalog,'CATALOG.json')
    # The pointer must not become durable before the immutable product files.
    for name in [*manifest['outputs'],'CATALOG.json']:
        with open(catalog/name,'rb') as stream: os.fsync(stream.fileno())
    for path in [catalog,catalog.parent]:
        directory=os.open(path,os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    return select_catalog(store,catalog)


def rollback(store):
    store=Path(store).resolve()
    if store.is_relative_to(ROOT): raise ValueError('external store required')
    with open(store/'.publish-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        previous=json.loads((store/'PREVIOUS.json').read_text())
        if not previous: raise ValueError('no previous release')
        verified(previous['path'],'CATALOG.json',previous['manifest_sha256'])
        # Keep the old pointer as forensic data; it need not resolve successfully.
        current=store/'CURRENT.json'
        if current.exists():
            atomic_json(store/'BEFORE-ROLLBACK.json',{'original_pointer_text':current.read_text()})
        atomic_json(current,previous)
        return previous


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('action',choices=['publish','rollback'])
    p.add_argument('--store',required=True,type=Path); p.add_argument('--catalog',type=Path)
    a=p.parse_args()
    if a.action=='publish' and a.catalog is None: p.error('--catalog is required for publish')
    print(json.dumps(publish(a.store,a.catalog) if a.action=='publish' else rollback(a.store),sort_keys=True))

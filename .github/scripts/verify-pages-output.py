#!/usr/bin/env python3
"""Check real Jekyll output without touching source data or deploying a site."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(source, destination):
    source, destination = source.resolve(), destination.resolve()
    tracked = subprocess.check_output(
        ['git', '-C', str(source), 'ls-files', '-z', '--', '*.html']
    ).decode().split('\0')
    html = sorted(p for p in tracked if p)
    if 'index.html' not in html or 'associativvordes/index.html' not in html:
        raise ValueError('incomplete source checkout')
    assets = [
        'associativvordes/script.js',
        'associativvordes/js/root-matcher.js',
        'associativvordes/js/associative-calculation-runner.js',
        'associativvordes/family-index-v5/manifest.json',
        'associativvordes/search-index/manifest.json',
        'shared/card-schema.mjs',
        'shared/button-status.js',
        'sitemap.xml',
        'robots.txt',
    ]
    hashes = {}
    for name in html + assets:
        original, published = source / name, destination / name
        if not published.is_file():
            raise ValueError('missing public page/asset: ' + name)
        if sha(original) != sha(published):
            raise ValueError('changed public page/asset: ' + name)
        hashes[name] = sha(published)
    for name in ['data/morphology-evidence/sources', 'node_modules']:
        if (destination / name).exists():
            raise ValueError('offline input leaked into Pages output: ' + name)
    return {
        'status': 'PASS',
        'tracked_html_pages_preserved': len(html),
        'runtime_assets_preserved': len(assets),
        'original_sources_excluded_from_rendering': True,
        'public_file_sha256': hashes,
        'deployment_performed': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('.'))
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    result = verify(args.source, args.destination)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'public_file_sha256'}))

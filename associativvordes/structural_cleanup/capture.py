"""Pin current v5 and historical source carriers without changing the checkout."""
import argparse, hashlib, os, pathlib
from common import *

def capture(repo, work, commit=MAIN):
    work = outside_repo(repo, work); work.mkdir(parents=True, exist_ok=True)
    tool = pinned_baseline(repo, work)
    final = work / 'before'
    if final.exists():
        lock = load(final / 'SNAPSHOT.json'); verify(final, lock)
        if lock['production_commit'] != commit: raise ValueError('different source commit')
        return lock
    partial = work / 'before.partial'
    if partial.exists(): raise ValueError('incomplete capture; preserve and choose a fresh work directory')
    if git(repo, 'rev-parse', commit + '^{commit}').decode().strip() != commit:
        raise ValueError('exact commit required')
    tool.extract_git(repo, commit, [PREFIX], partial / 'current')
    tool.extract_git(repo, ORIGINAL, [PREFIX + '/members'], partial / 'original')
    files = inventory(partial)
    lock = dict(schema='v5-structural-snapshot/1', production_commit=commit,
                original_materialization_commit=ORIGINAL, baseline_code_commit=BASELINE,
                files=files, inventory_sha256=hashlib.sha256(canonical(files)).hexdigest(),
                source_assignments_available=False, original_memberships_are_source_carriers_only=True)
    save(partial / 'SNAPSHOT.json', lock)
    os.replace(partial, final)
    for p in final.rglob('*'):
        if p.is_file(): p.chmod(0o444)
    return lock

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--repo', required=True); p.add_argument('--work', required=True)
    a = p.parse_args(); r = capture(a.repo, a.work)
    print(canonical(dict(inventory_sha256=r['inventory_sha256'], files=len(r['files']))).decode())

"""Verify a complete disk project projection before serving or reusing it."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import json
import argparse
import fcntl
from pathlib import Path
from associativvordes.candidate_search.scale_project import hash_file, build


def verified_project(database):
    database=Path(database).resolve()
    receipt=json.loads((database.parent/'PROJECT.json').read_text())
    if receipt['status']!='PASS' or hash_file(database)!=receipt['database_sha256']:
        raise ValueError('project index checksum mismatch')
    return receipt


def resume_project(repo,revision,destination,stop_after=None):
    """Fail closed on completed-index corruption before the builder can reuse it."""
    destination=Path(destination).resolve()
    if destination.is_relative_to(Path(repo).resolve()): raise ValueError('external index required')
    destination.mkdir(parents=True,exist_ok=True)
    with open(destination/'.project-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if (destination/'PROJECT.json').exists():
            verified_project(destination/'project.sqlite')
        return build(repo,revision,destination,stop_after)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',required=True,type=Path)
    p.add_argument('--revision',required=True)
    p.add_argument('--destination',required=True,type=Path)
    p.add_argument('--stop-after',type=int)
    a=p.parse_args(); print(json.dumps(resume_project(a.repo,a.revision,a.destination,a.stop_after),sort_keys=True))

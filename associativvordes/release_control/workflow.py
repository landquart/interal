"""Explicit release requests and incremental jobs; no background scheduler."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from pathlib import Path
from associativvordes.release_control.control import *
from associativvordes.release_control.inputs import source_delta


def incremental(previous, current, dependencies, reviewed, config):
    plan = source_delta(previous, current, dependencies, reviewed)
    families = plan['affected_families']
    argv = ['python3', 'associativvordes/candidate_search/mass_run.py']
    for name in ('index', 'registry', 'aux', 'project', 'source-lock', 'output', 'prior-queue'):
        require(config.get(name), 'missing incremental configuration: '+name)
        argv += ['--'+name, config[name]]
    plan['commands'] = [argv+['--changed-only', '--families', *families]] if families and plan['runnable'] else []
    plan['next_steps'] = ['import verified new/changed queue into the existing annotation/review workflow',
        'retain prior question IDs and review ledger; mark source-changed reviews as stale',
        'offline preannotation only; no paid calls without a separate budget',
        'prepare a new exact release; repeat independent checks and owner approval']
    return plan


def approval_request(store, plan, checks, current, trust, ledger):
    parent, version = store.current()
    require(plan['operations'], 'no confirmed operations to approve')
    require(digest(version['state']) == plan['inputs']['base'], 'release base changed')
    evidence_gate(plan, current, checks, trust); check_verdicts(plan, trust, ledger)
    return dict(schema=VERSION, purpose='approve-release', release=digest(plan),
                checks=digest(checks), store=str(store.root), parent=parent)


def package(store, destination, approval, trust):
    """Owner-authorized PR input package; publication and merge are separate."""
    with store.lock():
        version, value = store.current()
        require(value['transition'] == 'APPLY', 'no approved applied release to package')
        payload = dict(schema=VERSION, purpose='approve-publication-package', version=version,
                       release=value['release'], store=str(store.root))
        verify(approval, trust, 'owner', payload)
        target = external(destination); require(not target.exists(), 'fresh package destination required')
        target.mkdir(parents=True, mode=0o700)
        public = dict(schema=VERSION, approved_release_id=value['release'], data_version=version,
            parent=value['parent'], summary=value['plan']['summary'], operations=value['plan']['operations'],
            checks_sha256=digest(value['checks']), history_sha256=digest(value['human_history']),
            rollback_target=value['parent'], production_switch=False, approval_sha256=digest(approval))
        atomic(target/'RELEASE.json', canonical(public))
        atomic(target/'STATE.json', canonical(value['state']))
        atomic(target/'PUBLICATION-APPROVAL.json', canonical(approval))
        atomic(target/'CHECKSUMS.json', canonical({name: digest((target/name).read_bytes())
                                                 for name in ('RELEASE.json', 'STATE.json',
                                                              'PUBLICATION-APPROVAL.json')}))
        return dict(path=str(target), release=value['release'], merge_authorized=False,
                    production_switch_authorized=False)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); sub = p.add_subparsers(dest='command', required=True)
    c = sub.add_parser('incremental')
    for n in ('previous', 'current', 'dependencies', 'reviewed', 'config', 'output'): c.add_argument('--'+n, required=True)
    c = sub.add_parser('request-approval')
    for n in ('store', 'plan', 'checks', 'current-inputs', 'trust', 'review-ledger', 'output'): c.add_argument('--'+n, required=True)
    c = sub.add_parser('package')
    for n in ('store', 'destination', 'approval', 'trust'): c.add_argument('--'+n, required=True)
    a = p.parse_args()
    if a.command == 'incremental':
        result = incremental(read(a.previous), read(a.current), read(a.dependencies), read(a.reviewed), read(a.config))
        atomic(Path(a.output), canonical(result))
    elif a.command == 'request-approval':
        result = approval_request(Store(a.store), read(a.plan), read(a.checks), read(a.current_inputs),
                                  read(external(a.trust)), a.review_ledger)
        atomic(Path(a.output), canonical(result))
    else: result = package(Store(a.store), a.destination, read(a.approval), read(external(a.trust)))
    print(canonical(result).decode())

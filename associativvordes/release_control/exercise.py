"""Reproducible phase-07 engineering exercise on all real pinned v6 inputs.

No owner key or real approval is created. No proposed semantic change is applied.
"""
import argparse
import gzip
import resource
import subprocess
import time
from control import *
from inputs import ROOT, REPORT, native_state, verify_published, source_delta
from recordings import capture
from review_bridge import witnesses
from graph_view import build


def run(a):
    work = external(a.work); require(not work.exists(), 'fresh exercise workspace required')
    work.mkdir(parents=True, mode=0o700); started = time.monotonic()
    published = verify_published(); atomic(work/'INPUTS.json', canonical(published))
    frozen = json.loads(gzip.decompress((REPORT/'FROZEN-INPUTS.json.gz').read_bytes()))
    state = native_state(registry=a.registry, registry_sha256=frozen['databases']['registry']['sha256'])
    atomic(work/'BASELINE.json', canonical(state))
    store = Store(work/'registry'); version = store.initialize(state)
    human = witnesses(a.review_ledger)
    files = {name: dict(path=str(path), sha256=digest(Path(path).read_bytes())) for name, path in (
        ('snapshot', REPORT/'PACKED-PROPOSALS.json.gz'),
        ('sources', ROOT/'data/morphology-evidence/sources/source-lock.json'),
        ('algorithm', ROOT/'associativvordes/auto_annotation/pipeline.py'), ('controller', Path(__file__).with_name('control.py')))}
    for name, path in [('registry', a.registry), ('index', a.index), ('aux', a.aux), ('project', a.project)]:
        files[name] = dict(path=str(Path(path).resolve()), sha256=frozen['databases'][name]['sha256'])
    inputs = context(state, files['snapshot']['sha256'], files['sources']['sha256'],
                     files['algorithm']['sha256'], human['head'], files)
    check_input_files(inputs)
    plan = preview(state, [], inputs); atomic(work/'PREVIEW.json', canonical(plan))
    result = dict(schema='release07-real-exercise/1', project_commit=subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), state_counts=validate_state(state),
        baseline_sha256=digest(state), baseline_version=version,
        preserved_prior_decisions=len(state['data']['manual_decisions']),
        preserved_family_controls=len(state['data']['family_controls']), approved_release_id=None,
        changes=dict(added=0, excluded=0, modified=0, affected_families=0), paid_requests=0,
        llm_cost_usd=0, infrastructure_cost='unknown', steps=[])
    def save(): atomic(work/'EXERCISE.json', canonical(result))
    def command(name, args):
        now = time.monotonic()
        with open(work/(name+'.log'), 'w') as log:
            r = subprocess.run(args, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=1200)
        result['steps'].append(dict(name=name, exit=r.returncode, seconds=round(time.monotonic()-now, 3),
            log_sha256=digest((work/(name+'.log')).read_bytes())))
        save(); print(canonical(result['steps'][-1]).decode(), flush=True)
    try: store.apply(plan, inputs, {}, {}, {'principals': {}}, a.review_ledger)
    except ValueError as e: result['empty_release_blocked'] = str(e)
    else: raise ValueError('unapproved empty release applied')
    # Explicitly UNCONFIRMED probe: exercise the real quality gate, not a verdict.
    m = state['data']['memberships'][0]
    probe = dict(id='UNCONFIRMED_GATE_PROBE', kind='CORRECT_RELATION', question_id='UNCONFIRMED',
        candidate_id=m['lemma_id'], before=m, after=dict(m, relation='unresolved'),
        evidence_refs=m['source_proof'], reason='UNCONFIRMED: safety-gate exercise only', supersedes=[])
    probe_plan = preview(state, [probe], inputs)
    checks = dict(plan=digest(probe_plan), base=digest(state), after=probe_plan['after'], checks={
        'snapshot_integrity': 'PASS', 'source_versions_and_licenses': 'PASS', 'independent_quality': 'BLOCKED'})
    try: store.apply(probe_plan, inputs, checks, {}, {'principals': {}}, a.review_ledger)
    except ValueError as e:
        require('independent_quality' in str(e), 'probe did not reach the real quality gate: '+str(e))
        result['unconfirmed_change_blocked'] = str(e)
    else: raise ValueError('unconfirmed change applied')
    result['backup'] = store.backup(work/'BASELINE-BACKUP.zip')
    result['restore'] = restore(work/'BASELINE-BACKUP.zip', work/'restored', result['backup']['sha256'])
    require(Store(work/'restored').current() == store.current(), 'restore differs')
    result['independent_audit'] = store.audit({'principals': {}})
    result['graph_view'] = build(store, {'principals': {}}, work/'graph')
    result['unchanged_incremental'] = source_delta(published['source_lock']['value'],
        published['source_lock']['value'], {}, [])
    now = time.monotonic(); receipt = capture(state, ROOT, work/'recordings')
    atomic(work/'CAPTURE.json', canonical(receipt))
    result['capture'] = {k: v for k, v in receipt.items() if k != 'recordings'}
    result['capture_seconds'] = round(time.monotonic()-now, 3); save()
    command('calculator-baseline', ['node', str(Path(__file__).with_name('baseline.mjs')),
        str(work/'CAPTURE.json'), str(work/'CALCULATOR-BASELINE.json')])
    command('release-unit-tests', ['python3', '-m', 'unittest', 'discover', '-s',
        'associativvordes/release_control', '-p', 'test_*.py', '-v'])
    command('full-regressions', ['npm', 'test'])
    command('browser-regressions', ['npm', 'run', 'test:browser'])
    require(store.current()[0] == version, 'blocked attempts modified registry')
    check_input_files(inputs)
    require(witnesses(a.review_ledger)['head'] == human['head'], 'manual history changed')
    result['tracked_diff'] = subprocess.check_output(['git', 'diff', '--name-only'], cwd=ROOT, text=True).strip()
    require(not result['tracked_diff'], 'tracked production/formula changes')
    result['elapsed_seconds'] = round(time.monotonic()-started, 3)
    result['max_rss_kib'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    result['engineering_passed'] = all(s['exit'] == 0 for s in result['steps'])
    result['status'] = 'SEMANTIC_APPLICATION_BLOCKED'
    result['production_writes'] = 0; result['history_unchanged'] = True; save()
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for n in ('work', 'registry', 'review-ledger', 'index', 'aux', 'project'): p.add_argument('--'+n, required=True)
    a = p.parse_args(); result = run(a)
    print(canonical({k: result[k] for k in ('status', 'engineering_passed', 'elapsed_seconds')}).decode())

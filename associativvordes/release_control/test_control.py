"""TEST_ONLY engineering fixtures; not human gold or owner authorization."""
import copy
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parent))
from control import *
from inputs import source_delta


def fixture():
    return dict(schema=VERSION, data=dict(catalog={'families': [dict(id='family:a', canonical='a', aliases=['a']),
        dict(id='family:b', canonical='b', aliases=['b'])]}, heads=[dict(id='head:a', language='en'), dict(id='head:b', language='en')],
        links=[], edges=[], corrections=[], memberships=[]), history=[])


def member():
    return dict(family_id='family:a', language='en', lemma_id='native:a', word='TEST_ONLY_alpha',
                head_id='head:a', relation='direct derivation')


def operation(kind='ADD_MEMBER', before=None, after=None):
    return dict(id='TEST_ONLY_op', kind=kind, question_id='TEST_ONLY_question', candidate_id='native:a',
                before=before, after=member() if after is None and before is None else after,
                evidence_refs=['TEST_ONLY_evidence'], reason='TEST_ONLY explicit finite verdict', supersedes=[])


class Releases(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = Path(self.tmp.name)
        self.state = fixture(); self.op = operation()
        self.inputs = context(self.state, 'snapshot', 'sources', 'algorithm', 'ledger-head')
        for name in ('snapshot', 'sources', 'algorithm', 'controller', 'registry', 'index', 'aux', 'project'):
            path = self.root/(name+'.input')
            path.write_bytes(Path(__file__).with_name('control.py').read_bytes() if name == 'controller' else name.encode())
            sha = digest(path.read_bytes()); self.inputs['files'][name] = dict(path=str(path), sha256=sha)
            if name in ('snapshot', 'sources', 'algorithm'): self.inputs[name] = sha
        self.trust = {'principals': {}}; self.keys = {}
        for name, role in [('owner', 'owner'), ('first', 'reviewer'), ('second', 'blind'), ('independent', 'verifier')]:
            keyfile = self.root/(name+'.key')
            subprocess.run(['openssl', 'genpkey', '-algorithm', 'ED25519', '-out', str(keyfile)], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            os.chmod(keyfile, 0o600)
            pub = subprocess.check_output(['openssl', 'pkey', '-in', str(keyfile), '-pubout']).decode()
            self.keys[name] = keyfile; self.trust['principals'][name] = {'role': role, 'public_key_pem': pub}
        self.plan = preview(self.state, [self.op], self.inputs)
        self.plan['verdicts'] = {self.op['id']: [self.token(n, verdict_payload(self.op, self.inputs))
                                                for n in ('first', 'second')]}
        self.checks = dict(plan=digest(self.plan), base=digest(self.state), after=self.plan['after'],
            checks={n: 'PASS' for n in ('snapshot_integrity', 'source_versions_and_licenses', 'independent_quality',
             'no_unresolved_conflicts', 'regressions', 'canonical_families', 'aliases', 'lexical_heads',
             'negative_history', 'frequency_links', 'model_independence', 'six_languages', 'formulas_unchanged',
             'calculator_before_after', 'restoration')}, calculator_complete=True)
        proof = self.root/'TEST_ONLY-check.txt'; proof.write_text('TEST_ONLY engineering fixture')
        self.checks['evidence_files'] = {str(proof): digest(proof.read_bytes())}
        for field, value in [('quality_file', dict(TEST_ONLY=True, usable_independent_gold=1,
                            thresholds_passed=True, semantic_application_allowed=True)),
                            ('calculator_file', dict(TEST_ONLY=True, complete=True,
                            before_state_sha256=digest(self.state), after_state_sha256=self.plan['after']))]:
            path = self.root/(field+'.json'); path.write_bytes(canonical(value))
            self.checks[field] = str(path); self.checks['evidence_files'][str(path)] = digest(path.read_bytes())
        self.attest()
        self.store = Store(self.root/'store'); self.baseline = self.store.initialize(self.state)
        self.approval = self.token('owner', dict(schema=VERSION, purpose='approve-release', release=digest(self.plan),
            checks=digest(self.checks), store=str(self.store.root), parent=self.baseline))

    def tearDown(self): self.tmp.cleanup()

    def token(self, name, payload):
        return dict(signer=name, payload=payload, signature=signature(payload, self.keys[name]))

    def attest(self):
        self.checks.pop('attestation', None)
        self.checks['attestation'] = self.token('independent', dict(purpose='verified-checks',
            checks=digest(self.checks), schema=VERSION))

    def view(self):
        q = self.op['question_id']
        return dict(head='ledger-head', snapshot='current-snapshot', transactions=[], current={
            (q, n): dict(family_id='family:a', language='en', status='ACCEPT_PROPOSED', lexeme_id='native:a',
                         snapshot='current-snapshot', action='decide') for n in ('first', 'second')})

    def apply(self, **extra):
        with patch('review_bridge.locked_witnesses', return_value=contextlib.nullcontext(self.view())):
            return self.store.apply(self.plan, self.inputs, self.checks, self.approval, self.trust, 'TEST_ONLY', **extra)

    def test_signed_apply_and_retry(self):
        a = self.apply(); b = self.apply()
        self.assertEqual(a['version'], b['version']); self.assertTrue(b['idempotent'])
        self.assertEqual(self.store.current()[1]['state']['data']['memberships'], [member()])
        self.assertEqual(self.store.verify_chain()['committed_versions'], 2)

    def test_without_owner_signature(self):
        self.approval['signature'] = self.token('first', self.approval['payload'])['signature']
        with self.assertRaises(ValueError): self.apply()
        self.assertEqual(self.store.current()[0], self.baseline)

    def test_classifier_cannot_sign_as_owner(self):
        self.approval = self.token('first', self.approval['payload'])
        with self.assertRaises(ValueError): self.apply()

    def test_revoked_key(self):
        self.trust['principals']['owner']['revoked'] = True
        with self.assertRaises(ValueError): self.apply()

    def test_wrong_store_approval(self):
        self.approval['payload']['store'] = '/another/store'
        with self.assertRaises(ValueError): self.apply()

    def test_stale_source(self):
        self.inputs = dict(self.inputs, sources='new-source')
        with self.assertRaises(ValueError): self.apply()

    def test_input_content_change_without_context_refresh(self):
        Path(self.inputs['files']['index']['path']).write_bytes(b'changed after approval')
        with self.assertRaises(ValueError): self.apply()

    def test_changed_evidence(self):
        Path(next(iter(self.checks['evidence_files']))).write_text('modified')
        with self.assertRaises(ValueError): self.apply()

    def test_every_mandatory_gate_fails_closed(self):
        original = copy.deepcopy(self.checks)
        for name in original['checks']:
            self.checks = copy.deepcopy(original); self.checks['checks'][name] = 'BLOCKED'; self.attest()
            with self.subTest(name=name), self.assertRaises(ValueError): self.apply()

    def test_gold_missing_not_allowed(self):
        self.checks['checks']['independent_quality'] = 'BLOCKED'
        with self.assertRaises(ValueError): self.apply()

    def test_fake_check_attestation(self):
        self.checks['calculator_complete'] = False
        with self.assertRaises(ValueError): self.apply()

    def test_two_models_not_two_humans(self):
        self.plan['verdicts'][self.op['id']] *= 2
        with self.assertRaises(ValueError):
            with patch('review_bridge.witnesses', return_value=self.view()): check_verdicts(self.plan, self.trust, 'x')

    def test_one_reviewer_not_independent(self):
        self.plan['verdicts'][self.op['id']] = [self.plan['verdicts'][self.op['id']][0]]*2
        with self.assertRaises(ValueError):
            with patch('review_bridge.witnesses', return_value=self.view()): check_verdicts(self.plan, self.trust, 'x')

    def test_wrong_family_review(self):
        view = self.view(); view['current'][(self.op['question_id'], 'first')]['family_id'] = 'family:b'
        with self.assertRaises(ValueError):
            with patch('review_bridge.witnesses', return_value=view): check_verdicts(self.plan, self.trust, 'x')

    def test_rejected_or_stale_review(self):
        for field, value in [('status', 'REJECT'), ('snapshot', 'obsolete'), ('action', 'undo')]:
            view = self.view(); view['current'][(self.op['question_id'], 'second')][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                with patch('review_bridge.witnesses', return_value=view): check_verdicts(self.plan, self.trust, 'x')

    def test_exact_negative_scope_preserved(self):
        state = fixture(); negative = dict(family_id='family:a', head_id='head:a', status='excluded')
        state['data']['edges'] = [negative]
        with self.assertRaises(ValueError): transform(state, [self.op])
        op = dict(self.op, supersedes=[digest(negative)])
        after = transform(state, [op]); self.assertEqual(after['data']['edges'], [negative])
        state['data']['edges'][0]['family_id'] = 'family:b'
        transform(state, [self.op])

    def test_unresolved_and_new_base_blocked(self):
        for kind in ('POSSIBLE_BASE', 'UNCERTAIN', 'MERGE_FAMILIES'):
            with self.subTest(kind=kind), self.assertRaises(ValueError): transform(self.state, [dict(self.op, kind=kind)])

    def test_no_new_canonical_family_or_head(self):
        for field, value in [('family_id', 'family:new'), ('head_id', 'head:new'), ('language', 'ru')]:
            op = copy.deepcopy(self.op); op['after'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): transform(self.state, [op])

    def test_no_inflection_member(self):
        op = copy.deepcopy(self.op); op['after']['relation'] = 'inflection'
        with self.assertRaises(ValueError): transform(self.state, [op])

    def test_duplicate_and_stale_before(self):
        with self.assertRaises(ValueError): preview(self.state, [self.op, self.op], self.inputs)
        with self.assertRaises(ValueError): transform(self.state, [operation('EXCLUDE_MEMBER', member())])

    def test_all_update_classes_and_exclusion(self):
        state = transform(self.state, [self.op]); before = member()
        for kind, patch_value in [('CORRECT_RELATION', {'relation': 'orthographic variant'}),
                 ('CORRECT_IDENTITY', {'lemma_id': 'native:b', 'word': 'TEST_ONLY_beta'}),
                 ('CORRECT_FAMILY', {'family_id': 'family:b', 'head_id': 'head:b'})]:
            after = dict(before, **patch_value)
            changed = transform(state, [operation(kind, before, after)])
            self.assertEqual(changed['data']['memberships'], [after])
        removed = transform(state, [operation('EXCLUDE_MEMBER', before)])
        self.assertEqual(removed['data']['memberships'], [])
        self.assertEqual(len(removed['history']), 2)

    def test_no_unrelated_changes(self):
        state = transform(self.state, [self.op]); after = dict(member(), relation='compound', word='different')
        with self.assertRaises(ValueError): transform(state, [operation('CORRECT_RELATION', member(), after)])

    def test_crash_before_pointer_and_resume(self):
        def crash(stage):
            if stage == 'before_pointer': raise RuntimeError('TEST_ONLY interrupted')
        with self.assertRaises(RuntimeError): self.apply(fault=crash)
        self.assertEqual(self.store.current()[0], self.baseline)
        self.assertEqual(self.store.verify_chain()['orphan_versions_ignored'], 1)
        self.apply(); self.assertEqual(self.store.verify_chain()['orphan_versions_ignored'], 0)

    def test_crash_after_pointer_is_idempotent(self):
        def fault(stage):
            if stage == 'after_pointer': raise RuntimeError('TEST_ONLY interrupted')
        with self.assertRaises(RuntimeError): self.apply(fault=fault)
        self.assertTrue(self.apply()['idempotent'])

    def test_rollback_retains_history_and_requires_owner(self):
        current = self.apply()['version']
        payload = dict(schema=VERSION, purpose='approve-rollback', current=current,
                       target=self.baseline, store=str(self.store.root))
        with self.assertRaises(ValueError): self.store.rollback(self.baseline, current, self.token('first', payload), self.trust)
        self.store.rollback(self.baseline, current, self.token('owner', payload), self.trust)
        state = self.store.current()[1]['state']
        self.assertEqual(state['data'], self.state['data']); self.assertEqual(len(state['history']), 2)
        self.assertEqual(self.store.verify_chain()['committed_versions'], 3)
        with self.assertRaises(ValueError): self.apply()

    def test_backup_restore_and_tamper(self):
        self.apply(); archive = self.root/'backup.zip'; receipt = self.store.backup(archive)
        self.assertEqual(restore(archive, self.root/'restored', receipt['sha256'])['status'], 'PASS')
        self.assertEqual(Store(self.root/'restored').current(), self.store.current())
        with self.assertRaises(ValueError): restore(archive, self.root/'bad', '0'*64)

    def test_store_corruption_detected(self):
        (self.store.root/'versions'/(self.baseline+'.json')).write_text('{}')
        with self.assertRaises(ValueError): self.store.current()

    def test_invalid_restored_chain_never_publishes_target(self):
        import zipfile
        raw = canonical({'version': '0'*64})
        archive = self.root/'invalid-chain.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('CURRENT', raw)
            z.writestr('CHECKSUMS.json', canonical({'CURRENT': digest(raw)}))
        with self.assertRaises((ValueError, FileNotFoundError)):
            restore(archive, self.root/'invalid-restored', digest(archive.read_bytes()))
        self.assertFalse((self.root/'invalid-restored').exists())

    def test_real_sigkill_before_publication(self):
        pid = os.fork()
        if pid == 0:
            def fault(stage):
                if stage == 'before_pointer': os.kill(os.getpid(), signal.SIGKILL)
            self.apply(fault=fault)
            os._exit(1)
        _, status = os.waitpid(pid, 0)
        self.assertTrue(os.WIFSIGNALED(status)); self.assertEqual(os.WTERMSIG(status), signal.SIGKILL)
        self.assertEqual(self.store.current()[0], self.baseline)
        self.apply(); self.assertEqual(self.store.verify_chain()['committed_versions'], 2)

    def test_concurrent_same_release_serializes(self):
        from concurrent.futures import ThreadPoolExecutor
        with patch('review_bridge.locked_witnesses', side_effect=lambda _: contextlib.nullcontext(self.view())):
            def call(_):
                return Store(self.store.root).apply(self.plan, self.inputs, self.checks,
                    self.approval, self.trust, 'TEST_ONLY')
            with ThreadPoolExecutor(max_workers=2) as pool: results = list(pool.map(call, range(2)))
        self.assertEqual(results[0]['version'], results[1]['version'])
        self.assertEqual(sum(r['idempotent'] for r in results), 1)
        self.assertEqual(self.store.verify_chain()['committed_versions'], 2)

    def test_real_review_ledger_bridge(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'review'))
        import importlib.util
        spec = importlib.util.spec_from_file_location('test07_actual_review', Path(__file__).resolve().parents[1]/'review/store.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        queue = self.root/'queue'; queue.mkdir()
        q = dict(id=self.op['question_id'], family='family:a', language='en', lemma='TEST_ONLY_alpha',
                 lexeme_alternatives=[{'id': 'native:a'}], evidence_refs=[])
        raw = canonical(q)+b'\n'; (queue/'questions.ndjson').write_bytes(raw)
        (queue/'MANIFEST.json').write_bytes(canonical(dict(outputs={'questions.ndjson': digest(raw)}, counts={'questions': 1})))
        ledger = module.Ledger(self.root/'human-ledger'); ledger.import_queue(queue)
        accounts = {'first': 'reviewer', 'second': 'blind'}
        for n, role in accounts.items():
            ledger.decide(n, role, accounts, 'TEST_ONLY_'+n, [dict(question_id=q['id'], expected_revision=0,
                status='ACCEPT_PROPOSED', lexeme_id='native:a', relation='direct derivation', reason='TEST_ONLY')], ledger.snapshot)
        inputs = dict(self.inputs, review_head=ledger.head)
        plan = preview(self.state, [self.op], inputs)
        plan['verdicts'] = {self.op['id']: [self.token(n, verdict_payload(self.op, inputs)) for n in accounts]}
        proof = check_verdicts(plan, self.trust, ledger.root)
        self.assertEqual(len(proof['transactions']), 2)
        checks = copy.deepcopy(self.checks); checks['plan'] = digest(plan)
        checks.pop('attestation')
        checks['attestation'] = self.token('independent', dict(purpose='verified-checks', checks=digest(checks), schema=VERSION))
        approval = self.token('owner', dict(schema=VERSION, purpose='approve-release', release=digest(plan),
            checks=digest(checks), store=str(self.store.root), parent=self.baseline))
        self.store.apply(plan, inputs, checks, approval, self.trust, ledger.root)
        self.assertEqual(self.store.audit(self.trust)['applied_releases'], 1)
        from graph_view import build
        graph = build(self.store, self.trust, self.root/'graph-after')
        self.assertEqual(graph['counts']['known'], 1)
        ledger.decide('second', 'blind', accounts, 'TEST_ONLY_changed', [dict(question_id=q['id'], expected_revision=1,
            status='REJECT', lexeme_id='native:a', relation='unresolved', reason='TEST_ONLY correction')], ledger.snapshot)
        with self.assertRaises(ValueError): check_verdicts(plan, self.trust, ledger.root)
        # Later re-review does not erase the exact historical witnesses.
        self.assertEqual(self.store.audit(self.trust)['applied_releases'], 1)
        current = self.store.current()[0]
        payload = dict(schema=VERSION, purpose='approve-rollback', current=current,
                       target=self.baseline, store=str(self.store.root))
        self.store.rollback(self.baseline, current, self.token('owner', payload), self.trust)
        graph = build(self.store, self.trust, self.root/'graph-after-rollback')
        self.assertEqual(graph['counts']['known'], 0)
        self.assertEqual(graph['counts']['decisions'], 0)

    def test_incremental_partition_not_all_families(self):
        v = dict(revision='r2', sha256='a', license_sha256='b', license_status='VERIFIED')
        plan = source_delta({}, {'UDer/en': v}, {'UDer/en': ['family:a']}, ['old-q'])
        self.assertEqual(plan['affected_families'], ['family:a']); self.assertTrue(plan['runnable'])
        self.assertEqual(plan['prior_reviewed_question_ids'], ['old-q']); self.assertFalse(plan['execute_automatically'])

    def test_incremental_unknown_license_and_dependency_block(self):
        plan = source_delta({}, {'new': {'revision': 'unknown'}}, {}, [])
        self.assertFalse(plan['runnable'])
        self.assertEqual(plan['blockers']['missing_dependency_partitions'], ['new'])

    def test_unknown_gold_cannot_be_overridden_by_boolean_gate(self):
        path = Path(self.checks['quality_file'])
        path.write_bytes(canonical(dict(usable_independent_gold=0, thresholds_passed=False,
                                       semantic_application_allowed=False)))
        self.checks['evidence_files'][str(path)] = digest(path.read_bytes()); self.attest()
        with self.assertRaises(ValueError): self.apply()

    def test_publication_requires_separate_owner_authorization(self):
        from workflow import package
        version = self.apply()['version']
        payload = dict(schema=VERSION, purpose='approve-publication-package', version=version,
                       release=digest(self.plan), store=str(self.store.root))
        with self.assertRaises(ValueError): package(self.store, self.root/'no', self.approval, self.trust)
        result = package(self.store, self.root/'package', self.token('owner', payload), self.trust)
        self.assertFalse(result['merge_authorized']); self.assertFalse(result['production_switch_authorized'])
        self.assertNotIn('transactions', read(self.root/'package/RELEASE.json'))

    def test_approval_request_checks_before_signing(self):
        from workflow import approval_request
        with patch('review_bridge.witnesses', return_value=self.view()):
            payload = approval_request(self.store, self.plan, self.checks, self.inputs, self.trust, 'TEST_ONLY')
        self.assertEqual(payload, self.approval['payload'])
        self.checks['checks']['calculator_before_after'] = 'BLOCKED'
        with self.assertRaises(ValueError): approval_request(self.store, self.plan, self.checks, self.inputs, self.trust, 'TEST_ONLY')

    def test_incremental_uses_exact_selected_families_and_prior_queue(self):
        from workflow import incremental
        config = {n: 'TEST_ONLY/'+n for n in ('index', 'registry', 'aux', 'project', 'source-lock', 'output', 'prior-queue')}
        current = {'UDer/en': dict(revision='r', sha256='a', license_status='VERIFIED', license_sha256='b')}
        result = incremental({}, current, {'UDer/en': ['family:a']}, ['already-reviewed'], config)
        self.assertEqual(result['commands'][0][-2:], ['--families', 'family:a'])
        self.assertIn('--prior-queue', result['commands'][0]); self.assertIn('--changed-only', result['commands'][0])


if __name__ == '__main__': unittest.main()

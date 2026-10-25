"""Integration tests of durable review and HTTP privacy boundaries."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import concurrent.futures
import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import uuid

from associativvordes.review.store import Ledger, Conflict, atomic, canonical, digest, restore
from associativvordes.review.server import Application, initialize

ROLES = {'a': 'reviewer', 'b': 'blind', 'c': 'arbiter'}


def queue(folder, count=110, revision=1):
    folder.mkdir(exist_ok=True)
    qs = [{'id': f'candidate:{i:04}', 'family': 'family:ocul', 'language': 'en', 'lemma': f'word{i}', 'pos': 'NOUN',
           'lexeme_alternatives': [{'id': f'lexeme:{i}', 'language': 'en', 'original': f'Word{i}', 'sense_scope': 'unresolved'}],
           'relation_types': ['direct derivation'], 'categories': ['NEW_MEMBER', 'IDENTITY_UNRESOLVED'],
           'evidence_refs': [{'id': f'evidence:{i}', 'source': 'UDer', 'revision': str(revision), 'raw_locator': {'line': i+1}}],
           'priority': {'expected_answer': 'ACCEPT'}, 'previous_decisions': [{'secret': 'prior-reject'}],
           'discovery_paths': [{'algorithm_hint': 'answer'}], 'independence': {'status': 'unknown', 'independent_groups': []}}
          for i in range(count)]
    raw = ''.join(canonical(q)+'\n' for q in qs).encode()
    atomic(folder/'questions.ndjson', raw)
    atomic(folder/'MANIFEST.json', canonical({'counts': {'questions': count}, 'identity': {'code': {'test': revision}},
            'outputs': {'questions.ndjson': digest(raw)}}).encode())
    return qs


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.qs = queue(self.root/'queue')
        self.l = Ledger(self.root/'data')
        self.l.import_queue(self.root/'queue')

    def tearDown(self): self.tmp.cleanup()

    def item(self, i=0, status='REJECT', actor='a', **extra):
        return dict(question_id=self.qs[i]['id'], source_snapshot=self.l.snapshot, expected_revision=self.l.revision(self.qs[i]['id'], actor),
                    lexeme_id=f'lexeme:{i}', status=status, relation='direct derivation', reason='source row requires review', **extra)

    def save(self, item=None, actor='a', request=None, **kwargs):
        return self.l.decide(actor, ROLES[actor], ROLES, request or str(uuid.uuid4()), [item or self.item(actor=actor)], self.l.snapshot, **kwargs)

    def test_100_sequence_resume_and_versioned_export(self):
        for i in range(100): self.save(self.item(i))
        reopened = Ledger(self.l.root)
        self.assertEqual(len(reopened.history(self.qs[0]['id'])), 1)
        self.assertEqual(reopened.listing('a', 'reviewer', ROLES, {})['progress']['done'], 100)
        export = reopened.export()
        restored = restore(export, self.root/'restored', self.l.root)
        self.assertEqual(restored.head, reopened.head)
        self.assertEqual(len(restored.events), 100)

    def test_correction_and_undo_preserve_every_event(self):
        self.save(); self.save(self.item(status='UNCERTAIN'))
        self.save(self.item(), undo=True)
        self.assertEqual(self.l.state(self.qs[0]['id'], 'a')['status'], 'REJECT')
        self.assertEqual(len(self.l.history(self.qs[0]['id'])), 3)
        self.save(self.item(), undo=True)
        self.assertEqual(len(self.l.history(self.qs[0]['id'])), 4)

    def test_family_and_native_lexeme_scope(self):
        self.save()
        self.assertIsNone(self.l.state(self.qs[1]['id'], 'a'))
        x = self.item(); x['lexeme_id'] = 'other-same-spelling'
        with self.assertRaises(ValueError): self.save(x)

    def test_idempotent_retry_and_request_collision(self):
        item = self.item(); rid = str(uuid.uuid4()); first = self.save(item, request=rid)
        self.assertEqual(self.save(item, request=rid), first)
        item['reason'] = 'changed'
        with self.assertRaises(Conflict): self.save(item, request=rid)
        self.assertEqual(len(self.l.events), 1)

    def test_two_writers_one_wins_no_lost_update(self):
        item = self.item()
        def write(_):
            other = Ledger(self.l.root)
            try: other.decide('a', 'reviewer', ROLES, str(uuid.uuid4()), [item], other.snapshot); return 'saved'
            except Conflict: return 'conflict'
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            self.assertCountEqual(list(pool.map(write, range(2))), ['saved', 'conflict'])
        self.assertEqual(len(Ledger(self.l.root).events), 1)

    def test_independent_review_and_arbitration(self):
        self.save()
        self.save(self.item(status='ACCEPT_PROPOSED', actor='b'), actor='b')
        card = self.l.card(self.qs[0]['id'], 'c', 'arbiter', ROLES)
        self.assertTrue(card['comparison']['disagreement'])
        basis = digest(card['comparison']['primary']+card['comparison']['blind'])
        self.save(self.item(status='UNCERTAIN', actor='c', pair_hash=basis), actor='c', arbitration=True)
        self.assertEqual(self.l.state(self.qs[0]['id'], 'c')['status'], 'UNCERTAIN')
        self.save(self.item(status='DEFER'))
        with self.assertRaises(Conflict): self.save(self.item(actor='c', pair_hash=basis), actor='c', arbitration=True)

    def test_arbitration_requires_both_and_role(self):
        with self.assertRaises(ValueError): self.save(self.item(actor='c'), actor='c', arbitration=True)
        with self.assertRaises(ValueError): self.save(arbitration=True)

    def test_blind_server_allowlist_hides_all_outcomes(self):
        self.save()
        value = self.l.card(self.qs[0]['id'], 'b', 'blind', ROLES)
        text = canonical(value)
        for secret in ('prior-reject', 'expected_answer', 'algorithm_hint', 'REJECT', 'previous_decisions', 'discovery_paths', 'categories'):
            self.assertNotIn(secret, text)
        self.assertEqual(value['revision'], 0)
        self.assertIsNone(value['comparison'])
        self.assertEqual(value['history'], [])
        first = self.l.listing('b', 'blind', ROLES, {})
        second = self.l.listing('b', 'blind', ROLES, {'category': 'NEGATIVE_HISTORY', 'disagreement': 'yes'})
        self.assertEqual(first, second)

    def test_source_refresh_rejection_and_proposal_survive(self):
        self.save()
        self.save(self.item(1, status='ACCEPT_PROPOSED'))
        old = self.l.snapshot
        queue(self.root/'queue', revision=2)
        self.l.import_queue(self.root/'queue')
        self.assertNotEqual(old, self.l.snapshot)
        self.assertEqual(self.l.state(self.qs[0]['id'], 'a')['status'], 'REJECT')
        self.assertTrue(self.l.card(self.qs[0]['id'], 'a', 'reviewer', ROLES)['source_changed'])
        self.assertEqual(self.l.overlay(ROLES)[0]['layer'], 'research_proposal')
        self.assertTrue(self.l.overlay(ROLES)[0]['source_changed'])
        self.assertFalse(self.l.overlay(ROLES)[0]['establishes_membership'])
        with self.assertRaises(Conflict): self.l.decide('a', 'reviewer', ROLES, str(uuid.uuid4()), [self.item()], old)

    def test_inactive_question_history_restored_on_rediscovery(self):
        self.save(self.item(109))
        queue(self.root/'queue', count=1, revision=2); self.l.import_queue(self.root/'queue')
        self.assertNotIn(self.qs[109]['id'], self.l.questions)
        queue(self.root/'queue', revision=3); self.l.import_queue(self.root/'queue')
        self.assertEqual(self.l.state(self.qs[109]['id'], 'a')['status'], 'REJECT')

    def test_interrupted_atomic_write_and_committed_retry(self):
        with patch('associativvordes.review.store.os.replace', side_effect=OSError('simulated power interruption')):
            with self.assertRaises(OSError): self.save()
        self.assertEqual(len(Ledger(self.l.root).events), 0)
        self.save()
        atomic(self.l.root/'events'/'.pending-orphan', b'partial')
        self.assertEqual(len(Ledger(self.l.root).events), 1)

    def test_corruption_and_missing_transaction_fail_closed(self):
        self.save(); self.save(self.item(1))
        (self.l.root/'events'/'0000000001.json').unlink()
        with self.assertRaises(ValueError): Ledger(self.l.root)

    def test_missing_committed_tail_is_detected(self):
        self.save()
        (self.l.root/'events'/'0000000001.json').unlink()
        with self.assertRaises(ValueError): Ledger(self.l.root)

    def test_invalid_batch_all_or_nothing(self):
        items = [self.item(), self.item(1)]
        items[1]['lexeme_id'] = 'invalid'
        with self.assertRaises(ValueError): self.l.decide('a', 'reviewer', ROLES, str(uuid.uuid4()), items, self.l.snapshot)
        self.assertEqual(self.l.loaded, 0)

    def test_frequency_unknown_and_independence_not_fabricated(self):
        self.assertNotIn('frequency', self.l.card(self.qs[0]['id'], 'a', 'reviewer', ROLES)['question'])
        self.assertEqual(self.l.listing('a', 'reviewer', ROLES, {'independent': 'yes'})['total'], 0)

    def test_lossless_source_row_attachment_and_tamper(self):
        import gzip, base64
        from associativvordes.review.source_rows import attach
        raw = b'Word0\tword0\tNOUN\n'
        q = self.qs[0]
        q['evidence_refs'][0]['artifact'] = 'UDer:test'
        q['evidence_refs'][0]['raw_locator'] = {'line': 1, 'raw_sha256': digest(raw), 'artifact_sha256': 'test', 'member': None}
        data = (canonical(q)+'\n').encode()
        atomic(self.root/'queue'/'questions.ndjson', data)
        atomic(self.root/'queue'/'MANIFEST.json', canonical({'counts': {'questions': 1}, 'outputs': {'questions.ndjson': digest(data)}}).encode())
        self.l.import_queue(self.root/'queue')
        folder = self.root/'importer'; folder.mkdir()
        record = {'id': 'evidence:0', 'body': {'artifact': 'UDer:test', 'revision': '1',
            'raw_locator': q['evidence_refs'][0]['raw_locator'], 'original_line_base64': base64.b64encode(raw).decode()}}
        packed = gzip.compress((canonical(record)+'\n').encode())
        atomic(folder/'records.ndjson.gz', packed)
        atomic(folder/'manifest.json', canonical({'outputs': {'records.ndjson.gz': digest(packed)}}).encode())
        self.assertEqual(attach(self.l, [folder])['attached'], 1)
        self.assertEqual(self.l.card(q['id'], 'b', 'blind', ROLES)['source_rows']['evidence:0']['raw_text'], raw.decode())
        packed += b'corrupt'
        atomic(folder/'records.ndjson.gz', packed)
        with self.assertRaises(ValueError): attach(self.l, [folder])

    def test_progress_private_and_recoverable(self):
        self.l.progress('a', {'question': self.qs[0]['id'], 'filters': {'language': 'en'}})
        self.assertEqual(Ledger(self.l.root).progress('a')['question'], self.qs[0]['id'])
        self.assertEqual(self.l.progress('b'), {})


class HTTPTests(unittest.TestCase):
    item = ReviewTests.item
    save = ReviewTests.save
    def setUp(self):
        ReviewTests.setUp(self)
        initialize(self.l.root, ['a:reviewer', 'b:blind', 'c:arbiter'])
        self.tokens = json.loads((self.l.root/'credentials.json').read_bytes())
        self.app = Application(('127.0.0.1', 0), self.l)
        self.thread = threading.Thread(target=self.app.serve_forever, daemon=True); self.thread.start()
        self.cookie = None; self.csrf = None

    def tearDown(self): self.app.shutdown(); self.app.server_close(); ReviewTests.tearDown(self)

    def request(self, path, body=None, headers=None):
        c = http.client.HTTPConnection('127.0.0.1', self.app.server_port)
        h = {'Content-Type': 'application/json', **({'Cookie': self.cookie} if self.cookie else {}),
             **({'X-CSRF-Token': self.csrf} if self.csrf else {}), **(headers or {})}
        c.request('GET' if body is None else 'POST', path if path.startswith('/') else '/api/'+path, None if body is None else canonical(body), h)
        r = c.getresponse(); data = r.read(); status = r.status
        if r.getheader('Set-Cookie'): self.cookie = r.getheader('Set-Cookie').split(';')[0]
        c.close()
        return status, json.loads(data) if 'application/json' in (r.getheader('Content-Type') or '') else data

    def login(self, actor):
        self.assertEqual(self.request('login', {'token': self.tokens[actor]['token']})[0], 200)
        code, s = self.request('session'); self.assertEqual(code, 200); self.csrf = s['csrf']

    def test_shared_styles_keep_variables_without_external_font(self):
        code, css = self.request('/shared/ui.css')
        self.assertEqual(code, 200)
        self.assertTrue(css.lstrip().startswith(b':root'))
        self.assertIn(b'--border-subtle:', css)
        self.assertNotIn(b'@import', css)

    def test_http_auth_csrf_origin_and_production_route(self):
        self.assertEqual(self.request('questions')[0], 403)
        self.login('a')
        self.csrf = 'bad'
        self.assertEqual(self.request('decide', {})[0], 403)
        self.assertEqual(self.request('login', {}, {'Origin': 'https://evil.invalid'})[0], 403)
        self.assertEqual(self.request('production')[0], 404)
        self.assertEqual(self.request('backup')[0], 403)

    def test_batch_preview_commit_stale_and_individual_history(self):
        self.login('a'); items = [self.item(), self.item(1)]
        for i in items: i['status'] = 'ACCEPT_PROPOSED'
        code, preview = self.request('preview', {'items': items}); self.assertEqual(code, 200)
        rid = str(uuid.uuid4())
        self.assertEqual(self.request('commit-preview', {'preview': preview['preview'], 'request_id': rid})[0], 200)
        self.assertEqual(self.request('commit-preview', {'preview': preview['preview'], 'request_id': rid})[0], 200)
        self.assertEqual(len(self.l.events), 1)
        self.assertEqual(len(self.l.history(self.qs[1]['id'])), 1)
        self.assertEqual(self.request('commit-preview', {'preview': preview['preview'], 'request_id': str(uuid.uuid4())})[0], 409)
        self.assertEqual(self.request('commit-preview', {'preview': 'invented', 'request_id': rid})[0], 400)

    def test_batch_staged_before_refresh_requires_reopen(self):
        self.login('a'); items = [self.item(), self.item(1)]
        for item in items: item['status'] = 'ACCEPT_PROPOSED'
        queue(self.root/'queue', revision=2); self.l.import_queue(self.root/'queue')
        self.assertEqual(self.request('preview', {'items': items})[0], 409)
        self.assertEqual(self.l.loaded, 0)

    def test_blind_http_cannot_access_backup_overlay_or_batch(self):
        self.save(); self.login('b')
        code, c = self.request('card?id='+self.qs[0]['id']); self.assertEqual(code, 200)
        self.assertNotIn('REJECT', canonical(c))
        for path in ('backup', 'overlay'): self.assertEqual(self.request(path)[0], 403)
        self.assertEqual(self.request('preview', {'items': []})[0], 403)


if __name__ == '__main__': unittest.main()

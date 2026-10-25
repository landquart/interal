"""Loopback-only annotation application, using Interal shared UI styles."""

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
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import re
import secrets
import time
from urllib.parse import parse_qs, urlparse
import zipfile
import io

from associativvordes.review.store import Ledger, Conflict, STATUSES, RELATIONS, atomic, canonical, digest, group_key, restore

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def accounts(root):
    return json.loads((Path(root) / 'accounts.json').read_bytes())


def initialize(root, reviewers):
    path = Path(root) / 'accounts.json'
    if path.exists(): raise ValueError('accounts already initialized')
    data, credentials = {}, {}
    for spec in reviewers:
        actor, role = spec.split(':')
        if not re.fullmatch('[a-zA-Z0-9_-]{1,40}', actor) or role not in ('reviewer', 'blind', 'arbiter') or actor in data:
            raise ValueError('unique pseudonym:reviewer|blind|arbiter required')
        token = secrets.token_urlsafe(32)
        data[actor] = {'role': role, 'token_hash': digest(token.encode())}
        credentials[actor] = {'role': role, 'token': token}
    atomic(path, canonical(data).encode())
    atomic(Path(root) / 'credentials.json', canonical(credentials).encode())


class Application(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, ledger):
        super().__init__(address, Handler)
        self.ledger = ledger
        self.accounts = accounts(ledger.root)
        self.roles = {a: d['role'] for a, d in self.accounts.items()}
        self.sessions = {}
        self.previews = {}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass  # No tokens, reviewer IDs, words, or reasons in access logs.

    def send(self, status, value, content_type='application/json; charset=utf-8', cookie=None, download=None):
        data = value if isinstance(value, bytes) else canonical(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        if cookie: self.send_header('Set-Cookie', cookie)
        if download: self.send_header('Content-Disposition', 'attachment; filename="' + download + '"')
        self.end_headers()
        self.wfile.write(data)

    def guard_host(self):
        if self.headers.get('Host') not in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'):
            raise PermissionError('invalid local host')

    def session(self):
        c = SimpleCookie(self.headers.get('Cookie', ''))
        sid = c['review_session'].value if 'review_session' in c else ''
        s = self.server.sessions.get(sid)
        if not s or s['expires'] < time.time(): raise PermissionError('login required')
        return s

    def do_GET(self):
        try:
            self.guard_host()
            parsed = urlparse(self.path)
            path = parsed.path
            static = {'/': HERE/'index.html', '/app.js': HERE/'app.js', '/review.css': HERE/'review.css', '/shared/ui.css': REPO/'shared/ui.css'}
            if path in static:
                p = static[path]
                data = p.read_bytes()
                if path == '/shared/ui.css':
                    data = re.sub(rb'@import url\([^)]*\)\s*;', b'', data)
                return self.send(200, data, mimetypes.guess_type(p.name)[0] or 'text/plain')
            if path == '/api/session':
                try: self.session()
                except PermissionError: return self.send(200, {'authenticated': False})
            if path == '/favicon.ico': return self.send(204, b'', 'image/x-icon')
            s = self.session()
            actor, role = s['actor'], s['role']
            l = self.server.ledger
            with l.lock():
                l.sync()
                params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
                if path == '/api/session':
                    return self.send(200, {'actor': actor, 'role': role, 'csrf': s['csrf'], 'statuses': STATUSES,
                        'relations': RELATIONS, 'progress': l.progress(actor)})
                if path == '/api/questions': return self.send(200, l.listing(actor, role, self.server.roles, params))
                if path == '/api/card':
                    card = l.card(params['id'], actor, role, self.server.roles)
                    if role == 'arbiter' and card['comparison']:
                        card['pair_hash'] = digest(card['comparison']['primary'] + card['comparison']['blind'])
                    return self.send(200, card)
                if path == '/api/backup':
                    if role != 'arbiter': raise PermissionError('arbiter required for private full backup')
                    export = l.export()
                    buffer = io.BytesIO()
                    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as z:
                        z.write(export, 'exports/' + export.name)
                        snaps = {l.snapshot} | {d['snapshot'] for t in l.events for d in t['decisions']}
                        for snap in sorted(snaps):
                            for name in ('MANIFEST.json', 'questions.ndjson'):
                                z.write(l.root/'snapshots'/snap/name, 'snapshots/'+snap+'/'+name)
                        for rowfile in sorted((l.root/'source-rows').glob('*.json')):
                            z.write(rowfile, 'source-rows/'+rowfile.name)
                        for progress in sorted((l.root/'progress').glob('*.json')):
                            z.write(progress, 'progress/'+progress.name)
                    return self.send(200, buffer.getvalue(), 'application/zip', download='review-backup.zip')
                if path == '/api/overlay':
                    if role != 'arbiter': raise PermissionError('arbiter required')
                    return self.send(200, l.overlay(self.server.roles))
            self.send(404, {'error': 'unknown route'})
        except Exception as e: self.error(e)

    def do_POST(self):
        try:
            self.guard_host()
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + self.headers['Host']: raise PermissionError('cross-origin write blocked')
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json': raise ValueError('JSON required')
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 200000: raise ValueError('invalid request size')
            body = json.loads(self.rfile.read(size))
            path = urlparse(self.path).path
            if path == '/api/login':
                token_hash = digest(str(body.get('token', '')).encode())
                found = next(((a, d) for a, d in self.server.accounts.items() if secrets.compare_digest(d['token_hash'], token_hash)), None)
                if not found: raise PermissionError('invalid credential')
                actor, info = found
                sid = secrets.token_urlsafe(32)
                self.server.sessions[sid] = {'actor': actor, 'role': info['role'], 'csrf': secrets.token_urlsafe(32), 'expires': time.time()+12*3600}
                return self.send(200, {'ok': True}, cookie='review_session='+sid+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200')
            s = self.session()
            if not secrets.compare_digest(self.headers.get('X-CSRF-Token', ''), s['csrf']): raise PermissionError('CSRF token required')
            actor, role = s['actor'], s['role']
            l = self.server.ledger
            if path == '/api/logout':
                c = SimpleCookie(self.headers['Cookie'])
                self.server.sessions.pop(c['review_session'].value, None)
                return self.send(200, {'ok': True}, cookie='review_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if path == '/api/progress':
                # Per-reviewer resume state, never shared with another reviewer.
                return self.send(200, l.progress(actor, {'filters': body.get('filters', {}), 'question': body.get('question')}))
            if path == '/api/preview':
                if role != 'reviewer': raise PermissionError('batch acceptance requires primary reviewer')
                items = body['items']
                if not 2 <= len(items) <= 100: raise ValueError('batch preview requires 2..100 items')
                if len({i['question_id'] for i in items}) != len(items): raise ValueError('duplicate item')
                with l.lock():
                    l.sync()
                    qs = [l.questions[i['question_id']] for i in items]
                    if len({group_key(q) for q in qs}) != 1 or len({i['relation'] for i in items}) != 1: raise ValueError('batch must have identical family/language/POS/relation types')
                    for i, q in zip(items, qs):
                        if i.get('source_snapshot') != l.snapshot: raise Conflict('sources changed since card staging; reopen each card')
                        if i['lexeme_id'] not in {x['id'] for x in q['lexeme_alternatives']} or i['status'] != 'ACCEPT_PROPOSED': raise ValueError('explicit native lexeme and ACCEPT_PROPOSED required')
                        if i['expected_revision'] != l.revision(q['id'], actor): raise Conflict('stale decision')
                    preview = secrets.token_urlsafe(24)
                    self.server.previews[preview] = {'actor': actor, 'items': items, 'snapshot': l.snapshot, 'expires': time.time()+600}
                    return self.send(200, {'preview': preview, 'snapshot': l.snapshot,
                        'items': [{'question_id': q['id'], 'lemma': q['lemma'], 'family': q['family'], 'language': q['language'],
                           'lexeme_id': i['lexeme_id'], 'reason': i['reason'], 'relation': i['relation'],
                           'warnings': q.get('categories', []), 'prior_status': (l.state(q['id'], actor) or {}).get('status')} for q, i in zip(qs, items)],
                        'establishes_membership': False})
            if path == '/api/commit-preview':
                p = self.server.previews.get(body['preview'])
                if not p or p['actor'] != actor or p['expires'] < time.time(): raise ValueError('preview expired; preview again')
                result = l.decide(actor, role, self.server.roles, body['request_id'], p['items'], p['snapshot'])
                return self.send(200, {'saved': len(result['decisions']), 'transaction': result['sha256']})
            if path in ('/api/decide', '/api/undo', '/api/arbitrate'):
                result = l.decide(actor, role, self.server.roles, body['request_id'], [body['item']], body['snapshot'],
                                  undo=path == '/api/undo', arbitration=path == '/api/arbitrate')
                return self.send(200, {'saved': 1, 'transaction': result['sha256']})
            self.send(404, {'error': 'unknown route'})
        except Exception as e: self.error(e)

    def error(self, e):
        code = 409 if isinstance(e, Conflict) else 403 if isinstance(e, PermissionError) else 400
        self.send(code, {'error': str(e) if isinstance(e, (ValueError, PermissionError)) else 'invalid request'})


def main():
    p = argparse.ArgumentParser(description='Interal local research annotation; never writes production families')
    p.add_argument('--data', type=Path, required=True, help='persistent local directory outside checkout')
    sub = p.add_subparsers(dest='command', required=True)
    init = sub.add_parser('init')
    init.add_argument('--queue', type=Path, required=True)
    init.add_argument('--reviewer', action='append', required=True, help='pseudonym:reviewer|blind|arbiter')
    imp = sub.add_parser('import')
    imp.add_argument('--queue', type=Path, required=True)
    serve = sub.add_parser('serve')
    serve.add_argument('--port', type=int, default=8765)
    rows = sub.add_parser('attach-rows')
    rows.add_argument('--snapshot', type=Path, action='append', required=True)
    sub.add_parser('export')
    acc = sub.add_parser('accounts')
    acc.add_argument('--reviewer', action='append', required=True)
    rec = sub.add_parser('restore')
    rec.add_argument('--backup', type=Path, required=True)
    a = p.parse_args()
    if a.data.resolve().is_relative_to(REPO): p.error('--data must be outside the repository')
    if a.command == 'restore':
        if a.data.exists() and any(a.data.iterdir()): p.error('restore target must be empty')
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            with zipfile.ZipFile(a.backup) as z:
                for name in z.namelist():
                    if not (name.startswith('snapshots/') or name.startswith('exports/') or name.startswith('progress/') or name.startswith('source-rows/')) or '..' in Path(name).parts or name.startswith('/'):
                        raise ValueError('unsafe backup member')
                z.extractall(tmp)
            exports = list((Path(tmp)/'exports').glob('*.json'))
            if len(exports) != 1: raise ValueError('one versioned export required')
            restore(exports[0], a.data, tmp)
            import shutil
            for rowfile in (Path(tmp)/'source-rows').glob('*.json'):
                data = rowfile.read_bytes()
                if digest(data) != rowfile.stem: raise ValueError('row backup checksum mismatch')
                (a.data/'source-rows').mkdir(exist_ok=True)
                atomic(a.data/'source-rows'/rowfile.name, data)
            for progress in (Path(tmp)/'progress').glob('*.json'):
                shutil.copyfile(progress, a.data/'progress'/progress.name)
        print('Restored. Initialize new reviewer credentials with the accounts command described in RUNBOOK.')
        return
    l = Ledger(a.data)
    if a.command == 'accounts':
        initialize(a.data, a.reviewer)
        print('Private reviewer tokens: ' + str(a.data/'credentials.json'))
    elif a.command == 'init':
        if l.snapshot: p.error('already initialized')
        initialize(a.data, a.reviewer)
        print(canonical(l.import_queue(a.queue)))
        print('Private reviewer tokens: ' + str(a.data/'credentials.json'))
    elif a.command == 'import': print(canonical(l.import_queue(a.queue)))
    elif a.command == 'attach-rows':
        from associativvordes.review.source_rows import attach
        print(canonical(attach(l, a.snapshot)))
    elif a.command == 'export': print(l.export())
    else:
        app = Application(('127.0.0.1', a.port), l)
        print(f'http://127.0.0.1:{app.server_port}', flush=True)
        app.serve_forever()


if __name__ == '__main__': main()

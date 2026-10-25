"""Exact immutable inputs and publication primitives; no production writer."""
import hashlib, importlib.util, json, os, pathlib, shutil, subprocess, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PREFIX = 'associativvordes/family-index-v5'
MAIN = '47723611112610945cb09b34e18588b7bd151911'
BASELINE = '44f1105cfe8e59d50affa08889654bfb488056c1'
ORIGINAL = 'ee6637b266f4bbb4acd77cccf597ed75b2b44aef'
DIAGNOSTICS = '842ddbb5c9d9db51df000e6d4a17c9b762531a0c'
LANGS = ('en', 'de', 'fr', 'es', 'it', 'ru')

def canonical(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()

def sha_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1048576), b''): h.update(b)
    return h.hexdigest()

def atomic(path, data):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.partial-')
    try:
        with os.fdopen(fd, 'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(name, path)
        fd = os.open(path.parent, os.O_RDONLY)
        try: os.fsync(fd)
        finally: os.close(fd)
    finally:
        if os.path.exists(name): os.unlink(name)

def save(path, value): atomic(path, canonical(value) + b'\n')
def load(path): return json.loads(pathlib.Path(path).read_bytes())
def git(repo, *args): return subprocess.check_output(['git', '-C', str(repo), *args])

def pinned_baseline(repo, work):
    # Historical commits identify DATA only. Execute the installed audited scanner.
    path = ROOT / 'associativvordes/v5_baseline/census.py'
    spec = importlib.util.spec_from_file_location('installed_v5_baseline', path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def inventory(root):
    root = pathlib.Path(root)
    return [dict(path=p.relative_to(root).as_posix(), bytes=p.stat().st_size, sha256=sha_file(p))
            for p in sorted(root.rglob('*')) if p.is_file() and p != root / 'SNAPSHOT.json']

def verify(root, manifest):
    root = pathlib.Path(root)
    actual = inventory(root)
    if actual != manifest['files']: raise ValueError('exact inventory differs')
    if hashlib.sha256(canonical(actual)).hexdigest() != manifest['inventory_sha256']:
        raise ValueError('inventory digest differs')
    return actual

def outside_repo(repo, work):
    repo = pathlib.Path(repo).resolve(); work = pathlib.Path(work).resolve()
    if work == repo or repo in work.parents: raise ValueError('shadow work must be outside repository')
    return work

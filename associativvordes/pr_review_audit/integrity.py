"""Finite executable dependency locks for research checkpoints."""
import hashlib
from pathlib import Path

def executable_lock(root,*names):
 root=Path(root).resolve();paths=set()
 for name in names:
  p=root/name
  if not p.exists():raise ValueError('missing code dependency: '+name)
  paths.update(q for q in p.rglob('*') if q.is_file() and q.suffix in {'.py','.js','.mjs','.json'} and '__pycache__' not in q.parts) if p.is_dir() else paths.add(p)
 return {'@lock_implementation':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),**{p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}}

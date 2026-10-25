"""Conservative transitive implementation lock for research-only pipelines.

Broad scope deliberately invalidates checkpoints after any research-code change.
Data snapshots and production dictionaries are locked separately by their readers.
"""
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def code_lock(root=ROOT):
 root=Path(root);files=[]
 for folder in (root/'associativvordes',root/'scripts',root/'shared'):
  for p in folder.rglob('*'):
   if p.is_file() and p.suffix in {'.py','.mjs','.js'} and '__pycache__' not in p.parts and not p.name.startswith('test_'):
    files.append(p)
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}

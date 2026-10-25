"""Process-local fence for installed repository family-index writes.

Not an OS sandbox: historical code in other checkouts, native syscalls and
arbitrary external programs are outside this hook. Current mutation entrypoints
and workflows are audited separately. No environment variable disables the fence.
"""
import os,sys,errno
from urllib.parse import urlsplit,unquote
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROTECTED=(ROOT/'associativvordes/family-index-v5',ROOT/'associativvordes/family-index-v6')
_installed=False
class HistoricalMutationBlocked(PermissionError):
 def __init__(self,message):super().__init__(errno.EPERM,message)

def _path(value,dir_fd=None):
 if isinstance(value,int):return Path(os.readlink('/proc/self/fd/'+str(value))).resolve()
 p=Path(os.fsdecode(value))
 if not p.is_absolute() and dir_fd not in (None,-1):p=Path(os.readlink('/proc/self/fd/'+str(dir_fd)))/p
 return p.resolve()
def assert_target(value,*,ancestors=False,dir_fd=None):
 p=_path(value,dir_fd)
 if any(p==q or p.is_relative_to(q) or ancestors and q.is_relative_to(p) for q in PROTECTED):raise HistoricalMutationBlocked('HISTORY_BLOCKED: installed family-index data is immutable; controlled historical authorization and a certified materializer are required')

def _audit(event,args):
 if event=='sqlite3.connect':
  value=args[0]
  if str(value)!=':memory:':assert_target(unquote(urlsplit(value).path) if isinstance(value,str) and value.startswith('file:') else value)
 elif event=='open':
  path,mode,flags=args
  if flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND):assert_target(path)
 elif event=='shutil.rmtree':assert_target(args[0],ancestors=True,dir_fd=args[1] if len(args)>1 else None)
 elif event in {'os.remove','os.rmdir'}:assert_target(args[0],ancestors=True,dir_fd=args[1] if len(args)>1 else None)
 elif event in {'os.rename','os.link'}:
  assert_target(args[0],ancestors=True,dir_fd=args[2] if len(args)>2 else None);assert_target(args[1],ancestors=True,dir_fd=args[3] if len(args)>3 else None)
 elif event=='os.symlink':
  assert_target(args[0],ancestors=True);assert_target(args[1],dir_fd=args[2] if len(args)>2 else None)
 elif event in {'os.mkdir','os.chmod'}:assert_target(args[0],dir_fd=args[2] if len(args)>2 else None)
 elif event=='os.truncate':assert_target(args[0])
def install():
 global _installed
 if not _installed:
  original_open=os.open
  def guarded_open(path,flags,mode=0o777,*,dir_fd=None):
   if flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND):assert_target(path,dir_fd=dir_fd)
   return original_open(path,flags,mode,dir_fd=dir_fd)
  os.open=guarded_open
  # CPython's open audit event does not include dir_fd, so cover this API too.
  try:import posix
  except ImportError:posix=os
  posix.open=guarded_open
  for name in ('write','writev','ftruncate','fchmod'):
   original=getattr(os,name,None)
   if original is None:continue
   def wrap(original):
    def guarded(fd,*args,**kwargs):
     assert_target(fd)
     return original(fd,*args,**kwargs)
    return guarded
   function=wrap(original);setattr(os,name,function);setattr(posix,name,function)
  sys.addaudithook(_audit);_installed=True

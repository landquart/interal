"""Deterministic private code/metadata capsule; raw corpora and keys are excluded."""
import argparse,hashlib,json,zipfile
from pathlib import Path
from associativvordes.v5_contract.versions import COMPONENTS

def build(repo,output,generation_code):
 repo=Path(repo).resolve();output=Path(output).resolve();generation_code=Path(generation_code).resolve();files=set();audit=repo/'audit/source-recovery-20261025'
 for folder in set(COMPONENTS.values())|{'source_recovery'}:
  for p in (repo/'associativvordes'/folder).rglob('*'):
   if p.is_file() and '__pycache__' not in p.parts and p.suffix in {'.py','.json','.mjs','.js','.md'} and (not p.name.startswith('test_') or folder=='source_recovery'):files.add(p)
 for folder in ['shared','scripts','.github/workflows','data/morphology-evidence/sources']:
  files.update(p for p in (repo/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix in {'.py','.json','.mjs','.js','.md','.txt','.yml','.yaml',''})
 for row in json.loads((audit/'ARTIFACT-INVENTORY.json').read_text())['repository_objects']:
  p=(repo/row['path']).resolve()
  if not p.is_relative_to(repo) or p.is_symlink() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('metadata inventory differs from source checkout')
  files.add(p)
 files.update(p for p in audit.rglob('*') if p.is_file() and p.name!='SOURCE-CAPSULE.json');files.update([repo/'package.json',repo/'package-lock.json',repo/'associativvordes/research_integrity.py'])
 for p in files:
  if p.suffix in {'.pem','.key'} or p.name.startswith('.env'):raise ValueError('private material excluded')
 output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p,name in [(p,p.relative_to(repo).as_posix()) for p in sorted(files)]+[(generation_code,'historical-generation/generation-code-3d71828.tar.gz')]:
   info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,p.read_bytes(),compresslevel=6)
 with zipfile.ZipFile(output) as z:
  if z.testzip():raise ValueError('capsule CRC failure')
 return dict(file=str(output),bytes=output.stat().st_size,sha256=hashlib.sha256(output.read_bytes()).hexdigest(),files=len(files)+1)
def main():
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--output',required=True);p.add_argument('--generation-code',required=True);a=p.parse_args();print(json.dumps(build(a.repo,a.output,a.generation_code)))
if __name__=='__main__':main()

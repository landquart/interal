// Archive completed research receipts/SQL indexes; corpus backup is independently pinned.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const [work,archive]=process.argv.slice(2);if(!work||!archive)throw Error('usage: bundle.mjs WORK ARCHIVE');
const script=String.raw`
import pathlib,json,zipfile,hashlib,os
import sys
w=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();root=pathlib.Path(sys.argv[3]).resolve()
if out.exists() or out.is_relative_to(root):raise ValueError('fresh external archive required')
run=json.load(open(w/'RUN.json'))
if run['status']!='PASS_EMPTY_PLAN_INTEGRITY_ONLY':raise ValueError('incomplete full run')
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
files=list(w.glob('*.json'))+list(w.glob('*DIFF.ndjson*'))
for name in ['before-census','after-census','pinned-normative']:
 files += [p for p in (w/name).rglob('*') if p.is_file() and not p.name.endswith(('-wal','-shm','.partial'))]
for name in ['shadow','replay','rollback']:
 files += list((w/name).glob('*.json'))+list((w/name/'versions').rglob('VIEW.json'))
records=[];seen=set()
for p in sorted(files):
 name=p.relative_to(w).as_posix()
 if name in seen:continue
 if p.is_symlink():raise ValueError('symlink archive input')
 seen.add(name);records.append(dict(path=name,bytes=p.stat().st_size,sha256=sha(p)))
tmp=out.with_name(out.name+'.partial')
with zipfile.ZipFile(tmp,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
 for r in records:
  p=w/r['path'];z.write(p,r['path'])
  if sha(p)!=r['sha256']:raise ValueError('completed receipt/index changed during archive')
 z.writestr('ARCHIVE-CONTENTS.json',json.dumps(dict(schema='full-v5-dry-run-research/1',files=records),sort_keys=True,separators=(',',':')))
os.replace(tmp,out);print(json.dumps(dict(schema='full-v5-dry-run-bundle/1',bytes=out.stat().st_size,sha256=sha(out),files=len(records))))
`;
const root=fileURLToPath(new URL('../../',import.meta.url));const r=spawnSync('python3',['-c',script,work,archive,root],{encoding:'utf8',maxBuffer:1024*1024});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)process.exit(r.status||1);

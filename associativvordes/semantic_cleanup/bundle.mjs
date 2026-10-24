/** Portable research outputs only; production and licensed dictionary pages stay outside. */
import {spawnSync} from 'node:child_process';
const result=spawnSync('python3',['-c',String.raw`
import hashlib,json,os,pathlib,shutil,sys,tempfile,zipfile
P=pathlib.Path
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1048576),b''):h.update(chunk)
    return h.hexdigest()
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':')).encode()+b'\n'
mode,archive,*args=sys.argv[1:];archive=P(archive).resolve()
if mode=='pack':
    if len(args)!=5:raise ValueError('pack ZIP SCAN NATIVE REVIEW ANNOTATION_BACKUP ANNOTATION_EXPORT')
    if archive.exists():raise ValueError('archive already exists')
    entries=[]
    for label,source in zip(('scan','native','review','annotation-backup.zip','annotation-export'),args):
        root=P(source).resolve()
        if not root.exists():raise ValueError('missing source')
        if root==archive or archive.is_relative_to(root):raise ValueError('archive inside input')
        for path in sorted(root.rglob('*')) if root.is_dir() else [root]:
            if path.is_symlink():raise ValueError('symlink source')
            if not path.is_file():continue
            name=str(P(label)/path.relative_to(root)) if root.is_dir() else label
            entries.append((name,path,dict(path=name,bytes=path.stat().st_size,sha256=sha(path))))
    manifest=dict(schema='interal-semantic-bundle/1',files=[e[2] for e in entries])
    temporary=archive.with_suffix(archive.suffix+'.partial')
    with zipfile.ZipFile(temporary,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name,path,receipt in entries:
            z.write(path,name)
            if sha(path)!=receipt['sha256']:raise ValueError('source changed while archiving')
        z.writestr('ARCHIVE-CONTENTS.json',canonical(manifest))
    os.replace(temporary,archive)
    print(canonical(dict(status='PACKED',files=len(entries),bytes=archive.stat().st_size,sha256=sha(archive))).decode(),end='')
elif mode=='restore':
    if len(args)!=1:raise ValueError('restore ZIP NEW_DESTINATION')
    dest=P(args[0]).resolve()
    if dest.exists():raise ValueError('restore destination already exists')
    dest.parent.mkdir(parents=True,exist_ok=True)
    temporary=P(tempfile.mkdtemp(prefix='semantic-restore-',dir=dest.parent))
    try:
        with zipfile.ZipFile(archive) as z:
            manifest=json.loads(z.read('ARCHIVE-CONTENTS.json'));names=[e['path'] for e in manifest['files']]
            if len(names)!=len(set(names)) or sorted(z.namelist())!=sorted(names+['ARCHIVE-CONTENTS.json']):raise ValueError('inventory mismatch')
            for item in manifest['files']:
                name=item['path'];path=(temporary/name).resolve()
                if not path.is_relative_to(temporary) or path==temporary:raise ValueError('unsafe entry')
                if z.getinfo(name).file_size!=item['bytes']:raise ValueError('entry size mismatch')
                path.parent.mkdir(parents=True,exist_ok=True)
                with z.open(name) as source,path.open('xb') as target:shutil.copyfileobj(source,target,1048576)
                if sha(path)!=item['sha256']:raise ValueError('restored hash mismatch')
            (temporary/'ARCHIVE-CONTENTS.json').write_bytes(canonical(manifest))
        temporary.rename(dest)
    except BaseException:
        shutil.rmtree(temporary);raise
    print(canonical(dict(status='PASS',files_verified=len(names),archive_bytes=archive.stat().st_size,archive_sha256=sha(archive),all_restored_hashes_exact=True,destination=str(dest))).decode(),end='')
else:raise ValueError('pack or restore required')
`,...process.argv.slice(2)],{stdio:'inherit'});
process.exit(result.status??1);

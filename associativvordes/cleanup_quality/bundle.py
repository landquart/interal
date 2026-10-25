"""Exact research bundle; restore using family_boundary.archive's hash verifier."""
import argparse,os,zipfile
from pathlib import Path
from associativvordes.family_boundary.core import ROOT,sha,canonical
def pack(archive,release,evaluation,normative,old_kit,verification):
    archive=Path(archive).resolve()
    if archive.exists() or archive.is_relative_to(ROOT):raise ValueError('fresh research archive outside Git required')
    entries=[]
    for prefix,path in [('release',release),('evaluation',evaluation),('pinned-normative',normative),('historical-kit/v5-probability-kit-v2.zip',old_kit),('INDEPENDENT-VERIFICATION.json',verification)]:
        path=Path(path)
        required_directory=prefix in {'release','evaluation','pinned-normative'}
        if path.is_symlink() or not (path.is_dir() if required_directory else path.is_file()):raise ValueError('missing or unsupported required archive input: '+prefix)
        for f in sorted(path.rglob('*')) if path.is_dir() else [path]:
            if f.is_symlink():raise ValueError('symlink archive input')
            if not f.is_file():continue
            if f.name.endswith('.partial'):raise ValueError('unfinished input')
            name=str(Path(prefix)/f.relative_to(path)) if path.is_dir() else prefix
            entries.append((f,dict(path=name,bytes=f.stat().st_size,sha256=sha(f))))
    tmp=archive.with_name(archive.name+'.partial')
    with zipfile.ZipFile(tmp,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for f,r in entries:
            z.write(f,r['path'])
            if sha(f)!=r['sha256']:raise ValueError('input changed during backup')
        z.writestr('ARCHIVE-CONTENTS.json',canonical(dict(schema='cleanup-quality-research-bundle/1',files=[r for f,r in entries])))
    os.replace(tmp,archive)
    return dict(schema='cleanup-quality-bundle/1',bytes=archive.stat().st_size,sha256=sha(archive),files=len(entries),production_writes=0)
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for n in ['archive','release','evaluation','normative','old-kit','verification']:p.add_argument('--'+n,required=True)
    a=p.parse_args();import json;print(json.dumps(pack(a.archive,a.release,a.evaluation,a.normative,a.old_kit,a.verification)))

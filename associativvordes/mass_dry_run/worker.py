#!/usr/bin/env python3
"""Separate annotation process. Network is unconditionally disabled for phase 06."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,json,os,signal,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
None
from associativvordes.auto_annotation.pipeline import load_input,execute
from associativvordes.auto_annotation.storage import Store
from associativvordes.auto_annotation.contract import canonical

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for n in ('input','registry','store','config'):p.add_argument('--'+n,required=True)
    p.add_argument('--index');p.add_argument('--aux');p.add_argument('--v5-external')
    p.add_argument('--kill-after',type=int);p.add_argument('--resume',action='store_true');a=p.parse_args()
    config=json.loads(Path(a.config).read_text())
    if config.get('allow_paid') or config.get('max_requests') or config.get('providers'):
        raise ValueError('phase06 requires zero-generation offline configuration')
    qs,identity=load_input(a.input,a.registry,a.v5_external)
    if identity['kind']=='mass02' and (not a.index or not a.aux):raise ValueError('mass02 requires native index and auxiliary')
    if identity['kind']=='v5' and (a.index or a.aux):raise ValueError('v5 uses its exact row index; no implicit v6 index alignment')
    s=Store(a.store)
    with s.lease():
        count=0;append=s.append
        def fault(kind,key,value):
            nonlocal count
            result=append(kind,key,value)
            if kind=='result' and key.startswith('proposal:'):
                count+=1
                if a.kill_after and count==a.kill_after:os.kill(os.getpid(),signal.SIGKILL)
            return result
        s.append=fault
        result=execute(s,'mass06',qs,identity,config,'offline',
               source_index=a.index,aux_index=a.aux)
    print(canonical(result))
if __name__=='__main__':main()

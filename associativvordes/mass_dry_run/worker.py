#!/usr/bin/env python3
"""Separate annotation process. Network is unconditionally disabled for phase 06."""
import argparse,json,os,signal,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'associativvordes/auto_annotation'))
from pipeline import load_input,execute
from storage import Store
from contract import canonical

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for n in ('input','registry','index','aux','store','config'):p.add_argument('--'+n,required=True)
    p.add_argument('--kill-after',type=int);p.add_argument('--resume',action='store_true');a=p.parse_args()
    config=json.loads(Path(a.config).read_text())
    if config.get('allow_paid') or config.get('max_requests') or config.get('providers'):
        raise ValueError('phase06 requires zero-generation offline configuration')
    qs,identity=load_input(a.input,a.registry);s=Store(a.store)
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

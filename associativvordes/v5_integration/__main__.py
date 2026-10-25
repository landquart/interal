"""Inspect the installed release; incompatible/archived inputs fail closed."""
import argparse,json
from pathlib import Path
from associativvordes.v5_contract.versions import capture,validate,read,require_directory,Blocked
from .dependencies import graph

def main():
    p=argparse.ArgumentParser(description=__doc__);s=p.add_subparsers(dest='action',required=True)
    s.add_parser('contract');s.add_parser('dependencies')
    v=s.add_parser('verify');v.add_argument('manifest',type=Path)
    d=s.add_parser('verify-directory');d.add_argument('stage');d.add_argument('directory',type=Path)
    a=p.parse_args()
    try:
        if a.action=='dependencies':result=graph()
        else:
            contract=capture();validate(contract)
            if a.action=='contract':result=contract
            elif a.action=='verify':validate(read(a.manifest),'research-v5');result=dict(status='PASS',version=contract['version'])
            else:require_directory(a.directory,a.stage,contract);result=dict(status='PASS',version=contract['version'])
        print(json.dumps(result,ensure_ascii=False,sort_keys=True,indent=2))
    except (Blocked,ValueError) as e:p.exit(2,str(e)+'\n')
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Independent-process search/replay/recovery measurements against full inputs."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
from associativvordes.candidate_search.mass_source import file_hash
from associativvordes.importers.certify_corpus import atomic_json

DIFFICULT=('OCUL','PEDE','MANU','LIBER','ALTER','REGUL','CREAT','NAT','RELAT','OPER','MUT','INTER')


def benchmark(a):
    output=Path(a.output).resolve()
    if output.is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('external benchmark required')
    output.mkdir(parents=True,exist_ok=True)
    script=Path(__file__).with_name('mass_run.py')
    common=[]
    for key in ['index','registry','aux','project','source_lock']:
        common.extend(['--'+key.replace('_','-'),str(getattr(a,key))])
    receipts={}
    def stage(name,directory,extra=()):
        command=[sys.executable,str(script),*common,'--output',str(output/directory),*extra]
        result=subprocess.run(command,capture_output=True,text=True)
        if result.returncode:raise RuntimeError(name+': '+result.stderr)
        receipt=json.loads(result.stdout)
        atomic_json(output/'receipts'/(name+'.json'),receipt);receipts[name]=receipt
        print(json.dumps(dict(stage=name,status=receipt['status'],processed=receipt['processed'],reused=receipt['reused'],seconds=receipt['elapsed_seconds'])),flush=True)
        return receipt
    stage('small','small',['--family','OCUL','--language','en'])
    stage('difficult','difficult',['--families',*DIFFICULT])
    first=stage('full','full',['--all'])
    replay=stage('independent','independent',['--all'])
    if first['version'] != replay['version']:raise ValueError('independent deterministic export differs')
    unchanged=stage('unchanged','full',['--all','--changed-only'])
    if unchanged['processed'] or unchanged['reused'] != first['selected_units']:raise ValueError('unchanged units reprocessed')
    stage('interrupted','interrupted',['--all','--stop-after','5'])
    if (output/'interrupted/CURRENT.json').exists():raise ValueError('partial export published')
    resumed=stage('resumed','interrupted',['--all','--resume'])
    if resumed['version'] != first['version'] or resumed['reused'] != 5:raise ValueError('checkpoint replay differs')
    result=dict(status='PASS',stages={name:dict(status=r['status'],processed=r['processed'],reused=r['reused'],
        elapsed_seconds=r['elapsed_seconds'],max_rss_kib=r.get('max_rss_kib'),counts=r.get('counts'),
        version=r.get('version'),export_bytes=r.get('export_bytes'),queue_bytes=r.get('queue_bytes')) for name,r in receipts.items()},
        independent_export_identical=True,resumed_export_identical=True,partial_publication=False,
        receipts={p.name:file_hash(p) for p in sorted((output/'receipts').iterdir())},membership_writes=0)
    atomic_json(output/'BENCHMARK.json',result);return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['index','registry','aux','project','source-lock','output']:p.add_argument('--'+name,required=True)
    print(json.dumps(benchmark(p.parse_args()),sort_keys=True))

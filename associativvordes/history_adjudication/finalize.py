"""Bind independently enumerated row updates without altering the old snapshot."""
import argparse,hashlib,json
from pathlib import Path

def run(build,output,pointer=None):
 build=Path(build);output=Path(output);output.mkdir(parents=True,exist_ok=True)
 report=json.loads((build/'REGISTRY.json').read_bytes());diff=(build/'COMPLETE-DIFF.json').read_bytes();replay=json.loads(diff)
 if replay['status']!='EXACT_MEMBER_AND_ALIAS_GIT_DIFF_VERIFIED':raise ValueError('unverified Git diff')
 report['record_update_safeguards']=replay['record_update_safeguards'];report['complete_diff_sha256']=hashlib.sha256(diff).hexdigest()
 raw=(json.dumps(report,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode();(output/'REGISTRY.json').write_bytes(raw)
 (output/'CONFLICT-RESOLUTION-LEDGER.json').write_text(json.dumps(report['conflict_resolution_ledger'],ensure_ascii=False,indent=2)+'\n')
 for name in ['COMPLETE-DIFF.json','COVERAGE.json','INDEPENDENT-VERIFICATION.json']:(output/name).write_bytes((build/name).read_bytes())
 if pointer:
  root=Path(__file__).resolve().parents[2];relative=(output/'REGISTRY.json').resolve().relative_to(root)
  Path(pointer).write_text(json.dumps(dict(schema=report['schema'],registry=str(relative),sha256=hashlib.sha256(raw).hexdigest()),indent=2)+'\n')
 return hashlib.sha256(raw).hexdigest()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--build',required=True);p.add_argument('--output',required=True);p.add_argument('--pointer');a=p.parse_args();print(run(a.build,a.output,a.pointer))

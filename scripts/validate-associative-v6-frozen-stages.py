#!/usr/bin/env python3
"""Run the unchanged historical validators at exact published snapshots."""
import subprocess,tempfile,json
from pathlib import Path
stages=[('prompt03','63b8f44539f752cad6e4fc875bba85be39035bb9'),('prompt04','2351a07722d88faa82dc05049144c567d43923c8')]
results=[]
for stage,sha in stages:
 with tempfile.TemporaryDirectory(prefix='v6-frozen-'+stage+'-') as temp:
  p=Path(temp)/'checkout';subprocess.run(['git','worktree','add','--quiet','--detach',str(p),sha],check=True)
  try:
   r=subprocess.run(['python','scripts/validate-associative-v6-'+stage+'.py'],cwd=p,check=True,capture_output=True,text=True)
   results.append({'stage':stage,'published_sha':sha,'result':json.loads(r.stdout)})
  finally:subprocess.run(['git','worktree','remove','--force',str(p)],check=True)
print(json.dumps({'verdict':'pass','historical_snapshots':results}))

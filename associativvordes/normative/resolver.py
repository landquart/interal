"""One admission boundary; proposal data never supplies trusted context."""
import copy,functools,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent

def hash_file(p):return hashlib.sha256(p.read_bytes()).hexdigest()
@functools.lru_cache(maxsize=16)
def _observation(policy_hash,validator_hash,bridge_hash):
 run=subprocess.run(['node',str(HERE/'resolver.mjs')],input='{"type":"observation"}',text=True,capture_output=True,timeout=30)
 if run.returncode:raise ValueError('installed normative resolver unavailable: '+run.stderr)
 return json.loads(run.stdout)
def observe(stage,payload=None):
 """Unversioned historical inputs stay observations, with live resolver provenance."""
 hashes=[hash_file(HERE/p) for p in ['rules.json','validator.mjs','resolver.mjs']]
 result=copy.deepcopy(_observation(*hashes))
 result.update(stage=stage,policy_sha256=hashes[0],validator_sha256=hashes[1],resolver_sha256=hashes[2])
 return result

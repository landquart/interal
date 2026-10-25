"""Content-addressed approved decisions, revalidated on every read and write."""
import json
from pathlib import Path
from .versions import ROOT,canonical,digest,validate,require,write_receipt
from .policy import admit
class ApprovedRegistry:
 def __init__(self,folder,contract):
  validate(contract);self.contract=contract;self.folder=Path(folder).resolve()
  require(not self.folder.is_relative_to(ROOT),'approved research registry outside checkout required')
 def approve(self,d,trust):
  result=admit(d,dict(version_contract=self.contract,trust=trust))
  body=dict(schema='interal-approved-membership/1',namespace=self.contract['namespace'],version_contract_sha256=self.contract['version'],decision=d,result=result,production_write_authorized=False)
  row=dict(body,sha256=digest(body));self.folder.mkdir(parents=True,exist_ok=True);path=self.folder/(row['sha256']+'.json')
  if path.exists():require(json.loads(path.read_bytes())==row,'approved record collision')
  else:write_receipt(path,canonical(row)+b'\n')
  return row
 def verify(self,row,trust):
  require(row.get('schema')=='interal-approved-membership/1' and row.get('namespace')==self.contract['namespace'] and row.get('version_contract_sha256')==self.contract['version'],'incompatible approved registry record')
  require(row.get('sha256')==digest({k:v for k,v in row.items() if k!='sha256'}),'approved record checksum')
  result=admit(row['decision'],dict(version_contract=self.contract,trust=trust))
  require(result==row['result'] and row['production_write_authorized'] is False,'forged approved conclusion')
  return result
 def read(self,sha256,trust):
  require(isinstance(sha256,str) and len(sha256)==64 and set(sha256)<=set('0123456789abcdef'),'unsafe approved registry selector')
  path=self.folder/(sha256+'.json');require(not path.is_symlink(),'approved record symlink')
  row=json.loads(path.read_bytes());require(row.get('sha256')==sha256,'approved selector mismatch');self.verify(row,trust);return row

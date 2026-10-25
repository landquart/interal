"""Prepare/check finite mappings against actual locked native/dictionary index facts."""
import json,sqlite3
from pathlib import Path
from .model import entity,adjudicate,digest
from .project import hash_file
class MappingReviewer:
 def __init__(self,native):
  self.folder=Path(native);self.path=self.folder/'native.sqlite';self.db=sqlite3.connect(self.path.resolve().as_uri()+'?mode=ro&immutable=1',uri=True);self.db.row_factory=sqlite3.Row;self.source_index_sha256=hash_file(self.path)
 def close(self):self.db.close()
 def proposal(self,origin,candidate_id,context,evidence_refs,decision_scope):
  row=self.db.execute('SELECT c.*,a.source_id,a.body artifact_body FROM candidates c JOIN artifacts a ON a.id=c.artifact WHERE c.id=?',(candidate_id,)).fetchone()
  if row is None:raise ValueError('unknown native target')
  row=dict(row);a=json.loads(row['artifact_body']);target=entity(dict(language=row['language'],source=row['source_id'],source_version=a['revision'],lemma=row['lemma'],pos=row['pos'],lexical_identity=row['native_lexical_id'],sense=row['sense_id'],context=context),True)
  if not evidence_refs:raise ValueError('independent corpus-to-source/context alignment evidence required')
  return dict(status='SUPPORTED_MAPPING',origin=origin,target=target,target_source_sha256=a['sha256'],source_index_sha256=self.source_index_sha256,candidate_id=candidate_id,decision_scope=decision_scope,evidence_refs=evidence_refs)
 def evaluate(self,proposal,verify_receipt=None):
  reconstructed=self.proposal(proposal['origin'],proposal['candidate_id'],proposal['target']['context'],proposal['evidence_refs'],proposal['decision_scope'])
  if reconstructed!=proposal:raise ValueError('mapping target/source facts differ from locked index')
  return adjudicate(proposal['origin'],[proposal['target']],proposal,verify_receipt)
 def binding(self,proposal,contract,verify_receipt=None):
  result=self.evaluate(proposal,verify_receipt)
  if result['status'] not in {'EXACT_IDENTITY','SUPPORTED_MAPPING'}:raise ValueError('mapping still requires independent confirmation')
  return dict(schema='interal-verified-identity-binding/1',status=result['status'],scope=proposal['decision_scope'],target=proposal['target'],target_source_sha256=proposal['target_source_sha256'],origin=proposal['origin'],input_version=contract['version'],evidence_refs=proposal['evidence_refs'],mapping_proof_sha256=result['proof_sha256'],source_index_sha256=self.source_index_sha256)

"""Bounded random access to legacy observations, without v6 head creation."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
from associativvordes.normative.resolver import observe
import json,zlib
from pathlib import Path
from associativvordes.v5_adapter.common import *
class Adapter:
 def __init__(self,folder,verify=True,history=None):
  self.normative=observe('v5_adapter')
  self.folder=Path(folder);self.manifest=read(self.folder/'MANIFEST.json');self.history=history;self.conns={}
  m=self.manifest
  if m.get('schema')!=SCHEMA or m.get('authoritative') is not False:raise ValueError('projection schema')
  expected=sha(canonical({k:v for k,v in m.items() if k not in {'source_root','version'}}))
  if expected!=m['version']:raise ValueError('projection manifest identity')
  self.shards={r['identity']['bucket']:r for r in m['shards']}
  if verify:
   for r in self.shards.values():
    if filehash(self.folder/r['database'])!=r['database_sha256']:raise ValueError('projection checksum')
 def db(self,b):
  if b not in self.shards:raise ValueError('bucket outside projection')
  if b not in self.conns:
   if len(self.conns)>=2:self.conns.pop(next(iter(self.conns))).close()
   self.conns[b]=connect(self.folder/self.shards[b]['database'],True)
  return self.conns[b]
 def close(self):
  for db in self.conns.values():db.close()
 def aliases(self,alias):
  r=self.db(bucket(alias)).execute('SELECT body FROM aliases WHERE alias=?',(alias,)).fetchone()
  return json.loads(zlib.decompress(r[0])) if r else []
 def rows(self,family=None,language=None,lemma=None,after=None):
  for b in ([bucket(family)] if family else sorted(self.shards)):
   if after and b<after[0]:continue
   sql='SELECT family,language,lemma,ordinal,body FROM members';args=[];where=[]
   for column,value in [('family',family),('language',language),('lemma',lemma)]:
    if value is not None:where.append(column+'=?');args.append(value)
   if after and b==after[0]:where.append('(family,language,lemma)>(?,?,?)');args.extend(after[1:])
   if where:sql+=' WHERE '+' AND '.join(where)
   for fid,lang,lid,ordinal,body in self.db(b).execute(sql+' ORDER BY family,language,lemma',args):yield fid,lang,lid,ordinal,json.loads(zlib.decompress(body))
 def question(self,fid,lang,lid,ordinal,row):
  f=json.loads(zlib.decompress(self.db(bucket(fid)).execute('SELECT body FROM families WHERE id=?',(fid,)).fetchone()[0]))
  evidence=[e for c in row.get('components',[]) for e in c.get('evidence',[])];types=sorted({e.get('type','unknown') for e in evidence})
  categories={'SENSE_IDENTITY_UNRESOLVED','EVIDENCE_MISSING'}
  if fid.startswith('surface:') or f.get('source')=='surface_singleton':categories.add('SURFACE_ONLY_FAMILY')
  if f.get('id')!=fid or not row.get('normalized'):categories.add('STRUCTURAL_DEFECT')
  if f.get('review_status') in {'split_required','needs_review','rejected'}:categories.add('FAMILY_BOUNDARY_CONFLICT')
  if any('allomorph' in t for t in types):categories.add('ALLOMORPH_REVIEW')
  if len(set(types)&{'compound_morphology','morphological_parse'})>1:categories.add('MORPHOLOGY_CONFLICT')
  guard=self.history(dict(operation='change_membership',family_id=fid,language=lang,lemma_ids=[lid])) if self.history else dict(status='HISTORY_UNAVAILABLE',allowed=False)
  if not guard.get('allowed'):categories.add('HISTORY_CONFLICT')
  path=f'members/{lang}/{bucket(fid)}.json.gz';dep=next(d for d in self.shards[bucket(fid)]['identity']['files'] if d['path']==path)
  locator=dict(path=path,file_sha256=dep['sha256'],git_blob=dep['git_blob'],source_commit=self.manifest['source_commit'],
   family_id=fid,language=lang,lemma_id=lid,ordinal=ordinal,record_sha256=sha(canonical(row)),record_hash_policy='adapter-canonical-json/1')
  return dict(id=qid(fid,lang,lid),family=family_view(fid),source_family_id=fid,language=lang,lemma=row['word'],pos=None,
   sense_scope='unresolved',source_lemma_id=lid,lexical_identity_status='legacy_exact_record',
   lexeme_alternatives=[dict(id=lid,language=lang,lemma=row['word'],pos=None,sense_scope='unresolved',identity_kind='legacy_exact_record',establishes_lexical_head=False)],
   categories=sorted(categories),relation_types=types,legacy_evidence=evidence,evidence_refs=[],previous_decisions=[],
   original_record_ref=locator,canonical=f.get('canonical'),aliases=f.get('aliases',[]),history_check=guard,
   provenance=dict(family_source=f.get('source'),legacy_review_status=f.get('review_status')),
   evidence_completeness='legacy_observation_only',independence=dict(status='not_established',independent_groups=[]),
   normative=self.normative,establishes_membership=False,existing_memberships=[dict(family_id=fid,lemma_id=lid,status='legacy_materialized')])

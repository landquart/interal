"""Verified finite contexts; original records and all competing claims remain visible."""
import argparse
from .core import *
from associativvordes.v5_adapter.common import qid
class Boundary:
 def __init__(self,folder):
  self.root=Path(folder);self.manifest=read(self.root/'MANIFEST.json')
  if sha(self.root/'index.sqlite')!=self.manifest['database_sha256']:raise ValueError('frozen index checksum')
  self.db=dbopen(self.root/'index.sqlite',True)
 def context(self,g):
  packed=self.db.execute('SELECT ids FROM groups WHERE id=?',(g,)).fetchone()
  if not packed:raise ValueError('unknown finite group')
  ids=json.loads(packed[0]);families=[]
  for fid in ids:
   f,b,n,l,fp,meta=self.db.execute('SELECT f,bucket,n,langs,ids_hash,meta FROM families WHERE fid=?',(fid,)).fetchone();m=json.loads(meta);raw=json.load(gzip.open(ROOT/m['source_path']))[fid]
   if digest(raw)!=m['source_record_sha256']:raise ValueError('family source changed')
   profile=json.loads(self.db.execute('SELECT body FROM profiles WHERE f=?',(f,)).fetchone()[0]);families.append(dict(family_id=fid,memberships=n,language_counts=json.loads(l),member_ids_sha256=fp,original_family_record=raw,legacy_diagnostic_claim_profile=profile,metadata=m))
  aliases=[dict(alias=a,family_id=f) for a,f in self.db.execute('SELECT a.alias,a.fid FROM aliases a JOIN families f ON f.fid=a.fid JOIN group_families gf ON gf.f=f.f WHERE gf.g=? ORDER BY a.alias,a.fid',(g,))];names={r['alias'] for r in aliases}
  history=[json.loads(r[0]) for r in self.db.execute('SELECT h.body FROM history h JOIN families f ON f.fid=h.fid JOIN group_families gf ON gf.f=f.f WHERE gf.g=? ORDER BY h.id',(g,))]
  related=[json.loads(r[0]) for r in self.db.execute("SELECT body FROM history WHERE json_extract(body,'$.scope.domain')='alias' ORDER BY id") if json.loads(r[0])['scope'].get('alias') in names]
  links=[json.loads(r[0]) for r in self.db.execute('SELECT v.body FROM v6_links v JOIN group_families gf ON gf.f=v.f WHERE gf.g=? ORDER BY v.id',(g,))];heads={p['v6_membership']['head_id'] for p in links};targets={p['v6_membership']['family_id'] for p in links}
  allheads={r[0]:json.loads(r[1]) for r in self.db.execute('SELECT id,body FROM v6_heads')};vheads=[allheads[h] for h in sorted(heads) if h in allheads]
  edges=[json.loads(r[0]) for r in self.db.execute('SELECT body FROM v6_edges WHERE head IN (SELECT v.head FROM v6_links v JOIN group_families gf ON gf.f=v.f WHERE gf.g=?) ORDER BY id',(g,))]
  catalog=[json.loads(r[0]) for r in self.db.execute('SELECT body FROM v6_catalog ORDER BY id')];catalog=[r for r in catalog if r['id'] in targets or set(r.get('legacy_ids',[]))&set(ids)]
  registry=read(ROOT/'audit/associative-national-correspondences/NATIONAL-CORRESPONDENCE-REGISTRY.json');correspondences=[r for r in registry['entries'] if r['canonical_root_id'] in ids]
  semantic=[json.loads(line) for line in (ROOT/'audit/associative-v5-semantic-cleanup/SEMANTIC-CASES.ndjson').read_text().splitlines() if json.loads(line)['scope']['family_id'] in ids]
  union=self.db.execute('SELECT COUNT(*) FROM (SELECT lang,lid FROM members WHERE f IN (SELECT f FROM group_families WHERE g=?) GROUP BY lang,lid)',(g,)).fetchone()[0];before=sum(r['memberships'] for r in families)
  return dict(schema='boundary-context/2',id=g,family_ids=ids,families=families,signals=[dict(kind=k,key=v) for k,v in self.db.execute('SELECT kind,key FROM signals WHERE g=? ORDER BY kind,key',(g,))],historical_decisions=history,historical_alias_route_context=related,alias_history_scope_policy='Related routing history is not transferred to other family/POS/sense scopes',alias_edges=aliases,v6_finite_proofs=links,v6_head_claims=vheads,v6_edge_claims=edges,v6_catalog_claims=catalog,national_correspondence_claims=correspondences,correspondence_authority=registry['authority'],semantic_case_contexts=semantic,impact=dict(observed_membership_edges=before,legacy_identity_union=union,counterfactual_legacy_edge_collapse=before-union,counterfactual_is_not_semantic_deduplication=True,source_lemma_delta=0,actual_membership_delta=0,actual_alias_delta=0,actual_redirects=[],new_canonical_roots=0,language_coverage_before={r['family_id']:sorted(r['language_counts']) for r in families},counterfactual_language_union=sorted({l for r in families for l in r['language_counts']}),association_metrics={k:'UNKNOWN' for k in ['Di','Pr','Sh','SWOW','A','F','P','FAv','FAa']},calculator_effect='UNKNOWN',manual_decision_effect='Blocked until every original family/lemma/POS/sense restriction remains queryable'),content_review=dict(status='INSUFFICIENT_EVIDENCE',unresolved=['target meanings','corpus lexical/sense identity','national correspondences','alternative morphological paths','independent authority'],production_admission='BLOCKED'),production_operation='NONE')
 def scope(self,g):
  cached=None;data=None
  for fid,l,lid,i,rh,b in self.db.execute('SELECT f.fid,m.lang,m.lid,m.ordinal,m.record_hash,f.bucket FROM group_families gf JOIN families f ON f.f=gf.f JOIN members m ON m.f=f.f WHERE gf.g=? ORDER BY f.fid,m.lang,m.lid',(g,)):
   path=f'associativvordes/family-index-v5/members/{l}/{b}.json.gz'
   if path!=cached:data=json.load(gzip.open(ROOT/path));cached=path
   raw=data[fid][i]
   if raw['lemma_id']!=lid or digest(raw)!=rh:raise ValueError('original record mismatch')
   yield dict(family_id=fid,language=l,lemma_id=lid,word=raw['word'],pos=None,sense_id=None,upstream_question_id=qid(fid,l,lid),source_path=path,ordinal=i,source_record_sha256=rh,original_record=raw,production_operation='NONE')
 def close(self):self.db.close()
def cases(folder,output):
 out=Path(output).resolve()
 if out.is_relative_to(ROOT):raise ValueError('large exact scopes outside Git')
 out.mkdir(parents=True,exist_ok=True);b=Boundary(folder);d=b.db;selected=set();selectors=["SELECT DISTINCT g FROM signals WHERE kind='COMPETING_V6_HEAD_REFERENCES' ORDER BY g","SELECT DISTINCT g FROM signals WHERE kind='SHARED_TYPED_V6_HEAD_FINITE_PROOF' ORDER BY g LIMIT 5","SELECT gf.g FROM group_families gf JOIN families f ON f.f=gf.f WHERE f.n>=1000 GROUP BY gf.g ORDER BY MAX(f.n) DESC,gf.g LIMIT 12","SELECT gf.g FROM group_families gf JOIN families f ON f.f=gf.f WHERE gf.g IN (SELECT g FROM signals WHERE kind='EXACT_MEMBER_IDS') GROUP BY gf.g ORDER BY MAX(f.n) DESC,gf.g LIMIT 8","SELECT DISTINCT g FROM signals WHERE kind='NEAR_MEMBER_IDS' ORDER BY g LIMIT 8","SELECT DISTINCT g FROM signals WHERE kind='SHARED_ALIAS' AND key IN ('net','act','regul','manu','liber','inter') ORDER BY g"]
 for sql in selectors:selected.update(r[0] for r in d.execute(sql))
 receipts=[]
 for g in sorted(selected):
  context=b.context(g);stem=g.split(':')[1];scope=stream(out/(stem+'.scope.ndjson.gz'),b.scope(g));context['affected_scope_artifact']=scope;save(out/(stem+'.json'),context);receipts.append(dict(id=g,family_ids=context['family_ids'],context_file=stem+'.json',context_sha256=sha(out/(stem+'.json')),scope=scope,production_admission='BLOCKED'))
 result=dict(schema='boundary-detailed-contexts/2',release_version=b.manifest['version'],context_code_sha256=sha(__file__),contexts=receipts,selection='Explicit deterministic investigation selection; complete registry remains BOUNDARY-GROUPS',production_writes=0);save(out/'MANIFEST.json',result);b.close();return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--output',required=True);p.add_argument('--group');p.add_argument('--scope-output');a=p.parse_args()
 if a.group:
  if Path(a.output).resolve().is_relative_to(ROOT) or a.scope_output and Path(a.scope_output).resolve().is_relative_to(ROOT):raise ValueError('research output outside checkout')
  b=Boundary(a.index)
  try:
   save(a.output,b.context(a.group))
   if a.scope_output:stream(a.scope_output,b.scope(a.group))
  finally:b.close()
 else:print(json.dumps(dict(contexts=len(cases(a.index,a.output)['contexts']))))

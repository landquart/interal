"""Independently enumerate complete Git member/alias deltas, including row edits."""
import argparse,collections,gzip,hashlib,json,sqlite3,subprocess
from pathlib import Path

def enc(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def digest(x):return hashlib.sha256(enc(x)).hexdigest()
def run(repo,restored,output):
 repo=Path(repo);root=Path(restored);out=Path(output);old=json.loads((root/'REGISTRY.json').read_text());db=sqlite3.connect((out/'history.sqlite').resolve().as_uri()+'?mode=ro&immutable=1',uri=True);counts=collections.Counter();updates=[];alias_edges=set();changed=[]
 def obj(oid):
  if set(oid)=={'0'}:return {}
  return json.loads(gzip.decompress((root/'objects'/oid).read_bytes()))
 for rev in old['revisions']:
  raw=subprocess.check_output(['git','-C',str(repo),'diff-tree','--no-commit-id','--raw','--no-abbrev','-r',rev['parent'],rev['commit'],'--','associativvordes/family-index-v5/members','associativvordes/family-index-v5/aliases'],text=True)
  for line in raw.splitlines():
   meta,path=line.split('\t');before,after=meta.split()[2:4];aa=obj(before);bb=obj(after);counts['changed_files']+=1;changed.append(dict(commit=rev['commit'],parent=rev['parent'],path=path,before_blob=before,after_blob=after))
   if '/members/' in path:
    language=path.split('/members/')[1].split('/')[0]
    for family in set(aa)|set(bb):
     a={r['lemma_id']:r for r in aa.get(family,[])};b={r['lemma_id']:r for r in bb.get(family,[])}
     for direction,derived in [('removed',set(a)-set(b)),('added',set(b)-set(a))]:
      actual={r[0] for r in db.execute('SELECT lemma FROM events WHERE source_version=? AND family=? AND language=? AND direction=?',(rev['commit'],family,language,direction))}
      assert actual==derived;counts[direction]+=len(derived)
     for lid in set(a)&set(b):
      if a[lid]==b[lid]:continue
      fields=sorted(k for k in set(a[lid])|set(b[lid]) if a[lid].get(k)!=b[lid].get(k))
      updates.append(dict(id='record-update:'+digest([rev['commit'],family,language,lid]),resolution='RESOLVED_CONFIRMED',certification_scope='EXACT_ENGINEERING_RECORD_UPDATE_ONLY',linguistic_decision='UNRESOLVED',scope=dict(domain='membership',family_id=family,language=language,lemma_ids=[lid],pos=None,sense_id=None),relation='HISTORICAL_METADATA_CHANGED_NOT_LINGUISTICALLY_CERTIFIED',source=dict(commit=rev['commit'],parent=rev['parent'],path=path,before_blob=before,after_blob=after,before_row_sha256=digest(a[lid]),after_row_sha256=digest(b[lid])),changed_fields=fields,authority='ENGINEERING_OPERATION_ONLY',supersession_status='NO_AUTOMATIC_SUPERSESSION',restoration_requires_new_independent_proof=True))
   else:
    for alias in set(aa)|set(bb):
     for direction,ids in [('removed',set(aa.get(alias,[]))-set(bb.get(alias,[]))),('added',set(bb.get(alias,[]))-set(aa.get(alias,[])))]:
      for family in ids:alias_edges.add((rev['commit'],alias,family,direction))
      counts['alias_'+direction]+=len(ids)
 normalized={(d['data_version'],d['scope']['alias'],d['scope']['family_id'],d['operation'].removeprefix('alias_')) for d in old['decisions'] if d['scope']['domain']=='alias'}
 assert alias_edges==normalized
 counts['same_identity_record_updates']=len(updates);db.close();result=dict(schema='interal-complete-history-diff/1',status='EXACT_MEMBER_AND_ALIAS_GIT_DIFF_VERIFIED',counts=dict(counts),changed_files=changed,record_update_safeguards=sorted(updates,key=lambda x:x['id']),scope='All member and reverse-alias changes in the 17 provenance revisions; family metadata files and non-provenance commits remain separately bounded by source quarantine',producer_imported=False,production_writes=0)
 (out/'COMPLETE-DIFF.json').write_bytes(enc(result)+b'\n');print(json.dumps(dict(counts)));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--restored',required=True);p.add_argument('--output',required=True);a=p.parse_args();run(a.repo,a.restored,a.output)

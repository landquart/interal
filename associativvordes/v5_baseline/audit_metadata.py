"""Full metadata distributions, explicitly retaining absent relation-type declarations."""
import argparse,collections,json,pathlib
from census import pairs,sha_file,load,atomic_json,PREFIX

def audit(snapshot,output):
 snapshot=pathlib.Path(snapshot);lock=load(snapshot/'SNAPSHOT.json');files={r['path']:r for r in lock['files']}
 sources=collections.Counter();statuses=collections.Counter();types=collections.Counter();signatures=collections.Counter();count=missing=verified=0
 for i in range(256):
  rel=f'current/{PREFIX}/families/{i:02x}.json.gz';p=snapshot/rel
  if sha_file(p)!=files[rel]['sha256']:raise ValueError('Changed metadata input')
  for fid,f in pairs(p):
   count+=1;sources[f.get('source','UNSPECIFIED')]+=1;statuses[f.get('review_status','UNSPECIFIED')]+=1
   rels=f.get('relation_types',[]);types.update(rels);signatures['|'.join(sorted(set(rels))) or 'UNSPECIFIED']+=1
   missing+=not bool(rels);verified+=f.get('verified') is True
 result={'schema_version':1,'buckets_visited':256,'family_records':count,'family_relation_type_occurrences':dict(types),
  'family_records_by_relation_signature':dict(signatures),'family_records_without_declared_relation_type':missing,
  'family_source_distribution':dict(sources),'family_review_status_distribution':dict(statuses),'legacy_verified_flag_true':verified,
  'note':'Empty relation_types and legacy verified/safe_automatic are stored production metadata, not linguistic confirmation. Component-evidence counts use a separate unit.'}
 atomic_json(output,result);print(json.dumps(result));return result
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--snapshot',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();audit(a.snapshot,a.output)

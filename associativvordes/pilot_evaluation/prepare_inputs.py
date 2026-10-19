"""Verified read-only 12-family registry projection. No labels inferred from status."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
from gold import canonical,file_hash,sha
sys_path=Path(__file__).resolve().parents[1]/'evidence_graph'
import sys
sys.path.insert(0,str(sys_path))
from prepare_registry import FILES,COMMIT

ROOTS=['ocul','ped','manu','liber','alter','regul','creat','nat','relat','oper','mut','inter']
REQUESTED=['OCUL','PEDE','MANU','LIBER','ALTER','REGUL','CREAT','NAT','RELAT','OPER','MUT','INTER']
DIFFICULTIES={'ocul':['allomorph','compound'],'ped':['homonym','substring_only'],'manu':['allomorph','compound'],
 'liber':['homonym','semantic_distant'],'alter':['indirect','semantic_distant'],'regul':['orthographic_variant','allomorph','negative_decision'],
 'creat':['direct','substring_only'],'nat':['indirect','homonym'],'relat':['indirect','lexical_head_collision'],
 'oper':['homonym','semantic_distant'],'mut':['allomorph','semantic_distant'],'inter':['compound','substring_only']}

def read(path):return json.loads(gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_bytes())

def prepare(cache,prior_snapshot,output):
    cache=Path(cache);output=Path(output);output.mkdir(parents=True,exist_ok=True);prior=read(Path(prior_snapshot));locked={}
    for n,blob in FILES.items():
        name='associativvordes/family-index-v6/'+n;p=cache/name;data=p.read_bytes()
        if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=blob:raise ValueError('pinned registry blob mismatch: '+name)
        locked[name]={'sha256':file_hash(p),'git_blob':blob,'commit':COMMIT,'bytes':len(data)}
    v6=cache/'associativvordes/family-index-v6';catalog=read(v6/'catalog.json');families={'family:'+r for r in ROOTS}
    mapping={'heads':'heads.json.gz','edges':'edges.json.gz','links':'lemma-head-links.json.gz','memberships':'memberships.json.gz','corrections':'correction-verdicts.json.gz','realizations':'reflexes.json'}
    data={k:read(v6/'generated'/v) for k,v in mapping.items()};heads={h['id']:h for h in data['heads']}
    data['edges']=[e for e in data['edges'] if e['family_id'] in families];wanted={e['head_id'] for e in data['edges']}
    data['heads']=[h for h in data['heads'] if h['id'] in wanted]
    for k in ['links','memberships','corrections','realizations']:data[k]=[x for x in data[k] if x['family_id'] in families]
    snapshot={'schema_version':'v6-readonly-snapshot/1','commit':COMMIT,'files':locked,'catalog':catalog,**data,
      'manual_decisions':prior['manual_decisions'],'family_controls':prior['family_controls'],
      'prior_manual_control_snapshot_sha256':file_hash(prior_snapshot),'manual_control_scope':'prior seven families only; all twelve retain current v6 corrections/edges'}
    (output/'v6.json').write_text(canonical(snapshot)+'\n')
    inventory=[];seeds=[]
    for requested,r in zip(REQUESTED,ROOTS):
        fid='family:'+r;f=next(x for x in catalog['families'] if x['id']==fid);edges=[e for e in data['edges'] if e['family_id']==fid]
        inventory.append({'requested':requested,'family_id':fid,'canonical':f['canonical'],'aliases':f['aliases'],'promotion_status':f['promotion_status'],
          'edges_by_status':dict(Counter(e['status'] for e in edges)),
          'head_identity_kinds':dict(Counter(heads[e['head_id']]['identity_kind'] for e in edges)),
          'membership_records':sum(m['family_id']==fid for m in data['memberships']),
          'difficulties_to_annotate_not_labels':DIFFICULTIES[r],'membership_certification':f['canonical_decision'].get('membership_certification'),
          'production_enabled':catalog['production_enabled']})
        for language in ['en','de','fr','es','it','ru']:
            possible={}
            for m in data['memberships']:
                if m['family_id']==fid and m['language']==language:
                    h=heads[m['head_id']];possible.setdefault(m['word'],(h['identity_kind']=='legacy_exact_record',m['head_id']))
            for word,value in sorted(possible.items(),key=lambda x:(x[1][0],len(x[0]),x[0]))[:12]:seeds.append({'family_id':fid,'language':language,'word':word,'head_id':value[1],'origin':'finite_project_record','scope':'lookup_only'})
    (output/'FAMILIES.json').write_text(canonical(inventory)+'\n');(output/'seeds.json').write_text(canonical(seeds)+'\n')
    (output/'v6-lock.json').write_text(canonical({'commit':COMMIT,'original_files':locked,'snapshot_sha256':file_hash(output/'v6.json'),'projection_code_sha256':file_hash(__file__)})+'\n')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['cache','prior-snapshot','output']:p.add_argument('--'+n,required=True)
    a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('output outside checkout')
    prepare(a.cache,a.prior_snapshot,a.output)

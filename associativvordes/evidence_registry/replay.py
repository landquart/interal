"""Independent full replay. Deliberately imports no producer/model code."""
import argparse, collections, gzip, hashlib, json
from pathlib import Path

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        while True:
            b=f.read(1048576)
            if not b:break
            h.update(b)
    return h.hexdigest()

def replay(manifest,registry,output):
    manifest=Path(manifest);root=Path(registry);m=json.loads(manifest.read_bytes());r=json.loads((root/'REGISTRY.json').read_bytes())
    assert m['schema']=='interal-evidence-registry-view/1' and m['namespace']=='research'
    assert sha(root/'REGISTRY.json')==m['parent_registry_sha256']
    assert m['parts']==r['parts'] and m['native_database_sha256']==r['native_database_sha256']
    counts=collections.Counter();statuses=collections.Counter();stream=hashlib.sha256();files=0
    for part in r['parts']:
        p=root/part['file'];assert sha(p)==part['sha256'];n=0
        with gzip.open(p,'rt') as f:
            for line in f:
                row=json.loads(line);assert len(row)==12 and row[8] in {'UNRESOLVED','MULTIPLE_POSSIBLE_IDENTITIES'} and row[11] is False
                origin={'family_id':row[0],'lemma_id':row[1],'language':part['language'],'ordinal':row[2],'word':row[3],'record_sha256':row[4],'path':'associativvordes/family-index-v5/'+part['source']['path'],'source_commit':r['source_commit']}
                data=json.dumps(origin,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
                stream.update(('evidence:'+hashlib.sha256(data).hexdigest()+'\n').encode());n+=1;counts[part['language']]+=1;statuses[row[8]]+=1
        assert n==part['rows'];files+=1
    total=sum(counts.values())
    assert total==m['memberships']==r['memberships'] and dict(counts)==m['languages'] and dict(statuses)==m['mapping_statuses']
    assert stream.hexdigest()==m['case_id_stream_sha256']
    assert m['statuses']==dict(UNRESOLVED_EVIDENCE=total,SUPPORTED_MEMBER=0,SUPPORTED_NONMEMBER=0,CONFLICTING_EVIDENCE=0)
    result=dict(schema='interal-independent-evidence-replay/1',status='PASS',manifest_sha256=sha(manifest),physical_parts=files,rows=total,languages=dict(counts),case_id_stream_sha256=stream.hexdigest(),producer_imported=False,semantic_certification=False,production_writes=0)
    Path(output).write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--registry',required=True);p.add_argument('--output',required=True);a=p.parse_args();replay(a.manifest,a.registry,a.output)

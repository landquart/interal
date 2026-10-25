"""Lossless, bounded-memory unresolved evidence view over the frozen mapping registry.

No duplicate ten-million-row archive: the exact parent parts are content addressed.
Every logical case retains its physical origin and a query for ALL native alternatives.
"""
import argparse, collections, gzip, hashlib, json
from pathlib import Path
from ..identity_mapping.model import digest

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def cases(folder, expected_registry_sha256):
    folder=Path(folder); path=folder/'REGISTRY.json'
    if sha(path)!=expected_registry_sha256:raise ValueError('mapping registry hash mismatch')
    registry=json.loads(path.read_bytes())
    if registry['schema']!='interal-lexical-sense-mapping-registry/1':raise ValueError('incompatible mapping schema')
    if registry['columns']!=['family_id','lemma_id','ordinal','word','record_sha256','lookup_key','priority_flags','original_pos','mapping_status','alternative_signature_count','pos_alternative_count','mapping_authorized']:
        raise ValueError('incompatible mapping columns')
    for part in registry['parts']:
        p=folder/part['file']
        if sha(p)!=part['sha256']:raise ValueError('mapping part hash mismatch')
        count=0
        with gzip.open(p,'rt') as f:
            for line in f:
                row=json.loads(line);count+=1
                if row[8] not in {'UNRESOLVED','MULTIPLE_POSSIBLE_IDENTITIES'} or row[11] is not False:
                    raise ValueError('view only supports this frozen unresolved baseline; re-evaluation required')
                origin=dict(family_id=row[0],lemma_id=row[1],language=part['language'],ordinal=row[2],word=row[3],record_sha256=row[4],path='associativvordes/family-index-v5/'+part['source']['path'],source_commit=registry['source_commit'])
                yield dict(schema='interal-unresolved-evidence-view-case/1',id='evidence:'+digest(origin),origin=origin,canonical_family_id=None,normative_element=None,target=None,segmentation=None,component_role=None,relation=None,direction=None,correspondences=[],historical_path=[],analyses=[],contradicting_analyses=[],status='UNRESOLVED_EVIDENCE',blockers=['LEXICAL_SENSE_BINDING_MISSING','NORMATIVE_ELEMENT_AND_PATH_UNPROVEN'],mapping_status=row[8],priority_flags=row[6],source_alternatives=dict(database_sha256=registry['native_database_sha256'],language=part['language'],lookup_key=row[5],candidate_signatures=row[9],query_module='associativvordes.identity_mapping.query',all_occurrences=True),mapping_part_sha256=part['sha256'],production_application_authorized=False)
        if count!=part['rows']:raise ValueError('mapping part row count mismatch')

def build(folder, output, parent_archive):
    folder=Path(folder); expected=sha(folder/'REGISTRY.json');reg=json.loads((folder/'REGISTRY.json').read_bytes());counts=collections.Counter();mappings=collections.Counter();stream=hashlib.sha256()
    for c in cases(folder,expected):
        counts[c['origin']['language']]+=1;mappings[c['mapping_status']]+=1
        stream.update((c['id']+'\n').encode())
    if sum(counts.values())!=reg['memberships']:raise ValueError('incomplete membership coverage')
    result=dict(schema='interal-evidence-registry-view/1',namespace='research',status='BLOCKED',parent_registry_sha256=expected,parent_archive=parent_archive,source_commit=reg['source_commit'],memberships=sum(counts.values()),languages=dict(counts),mapping_statuses=dict(mappings),statuses=dict(UNRESOLVED_EVIDENCE=sum(counts.values()),SUPPORTED_MEMBER=0,SUPPORTED_NONMEMBER=0,CONFLICTING_EVIDENCE=0),case_id_stream_sha256=stream.hexdigest(),parts=reg['parts'],physical_parts_verified=len(reg['parts']),native_database_sha256=reg['native_database_sha256'],source_lock_sha256=reg['source_lock_sha256'],query='python -m associativvordes.evidence_registry.view --registry RESTORED/registry --expected-registry-sha256 '+expected,production_writes=0,association_metrics_changed=False)
    Path(output).write_text(json.dumps(result,indent=2)+'\n');return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--registry',required=True);p.add_argument('--output');p.add_argument('--parent-archive');p.add_argument('--expected-registry-sha256');a=p.parse_args()
    if a.output:build(a.registry,a.output,a.parent_archive)
    else:
        if not a.expected_registry_sha256:p.error('expected parent hash required')
        for c in cases(a.registry,a.expected_registry_sha256):print(json.dumps(c,ensure_ascii=False,sort_keys=True))

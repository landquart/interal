#!/usr/bin/env python3
"""Check every physical input line against lossless accepted/quarantine outputs.

This audit does not call the adapter parser. It verifies byte preservation,
column preservation and counts, not linguistic truth.
"""
import argparse
import base64
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import resource
import time
from morphology_import import binary_stream, hash_file, validate_lock

COLUMNS = {
 'derinet2':['id','lemid','lemma','pos','feats','segmentation','parent_id','reltype','otherrels','annotations'],
 'morphynet_derivation':['source','target','source_pos','target_pos','affix','operation'],
 'morphynet_inflection':['lemma','form','features','segmentation']}


def audit(lock_path,raw_root,snapshot):
    start=time.monotonic()
    lock=json.loads(Path(lock_path).read_text())
    raw=Path(raw_root).resolve();snapshot=Path(snapshot)
    validate_lock(lock,raw)
    manifest=json.loads((snapshot/'manifest.json').read_text())
    assert manifest['source_lock_sha256']==hash_file(lock_path),'different source lock'
    for name,h in manifest['outputs'].items():
        assert hash_file(snapshot/name)==h,('output checksum',name)
    with gzip.open(snapshot/'records.ndjson.gz','rt',encoding='utf-8') as f, open(snapshot/'quarantine.ndjson',encoding='utf-8') as q:
        records=(json.loads(l) for l in f);rejects=(json.loads(l) for l in q)
        record=next(records,None);reject=next(rejects,None)
        reports={r['artifact']:r for r in manifest['reports']}
        total=Counter()
        for a in sorted(lock['artifacts'],key=lambda x:x['id']):
            counts=Counter();header=None
            with binary_stream(raw/a['path'],a) as stream:
                for line,data in enumerate(stream,1):
                    if not data.strip():counts['blank']+=1;continue
                    if a['format']=='derinet2' and data.lstrip().startswith(b'#'):
                        counts['comments']+=1;continue
                    if a['format'].startswith('glemm_') and header is None:
                        header=data.decode('utf-8').rstrip('\n').removesuffix('\r').split('\t')
                        counts['headers']+=1;continue
                    counts['read']+=1
                    if reject is not None and (reject['artifact'],reject['line'])==(a['id'],line):
                        assert base64.b64decode(reject['raw_base64'])==data,'quarantine bytes'
                        assert reject['raw_sha256']==hashlib.sha256(data).hexdigest()
                        counts['rejected']+=1;reject=next(rejects,None)
                    else:
                        assert record is not None,('missing record',a['id'],line)
                        body=record['body'];locator=body['raw_locator']
                        assert (body['artifact'],locator['line'])==(a['id'],line),'locator'
                        assert base64.b64decode(body['original_line_base64'])==data,'accepted bytes'
                        assert locator['raw_sha256']==hashlib.sha256(data).hexdigest()
                        fields=data.decode('utf-8').rstrip('\n').removesuffix('\r').split('\t')
                        expected=dict(zip(header or COLUMNS[a['format']],fields))
                        assert expected==body['raw_fields'],'original field loss'
                        assert body['establishes_membership'] is False
                        assert body['review_status']=='unreviewed'
                        counts['accepted']+=1;record=next(records,None)
            for key in ['read','accepted','rejected','blank','comments','headers']:
                assert counts[key]==reports[a['id']][key],(a['id'],key,counts[key],reports[a['id']][key])
            assert counts['read']==counts['accepted']+counts['rejected']
            total.update(counts)
        assert record is None and reject is None,'unexpected extra output'
    return {'status':'PASS','source_lock_sha256':hash_file(lock_path),'build_id':manifest['build_id'],
            'counts':dict(total),'all_original_bytes_and_fields_preserved':True,
            'elapsed_seconds':round(time.monotonic()-start,3),
            'max_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--lock',required=True);p.add_argument('--raw-root',required=True);p.add_argument('--snapshot',required=True)
    a=p.parse_args()
    print(json.dumps(audit(a.lock,a.raw_root,a.snapshot),sort_keys=True,indent=2))

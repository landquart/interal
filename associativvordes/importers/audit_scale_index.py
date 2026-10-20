#!/usr/bin/env python3
"""Bounded read-only validation of the full resumed source projection."""
import argparse
import hashlib
import json
from pathlib import Path
import resource
import time
from certify_corpus import atomic_json
from morphology_import import hash_file
from scale_index import Index, bid


def audit(database,release,receipt):
    started=time.monotonic(); index=Index(database); db=index.db
    try:
        state=json.loads((Path(release)/'CHECKPOINT.json').read_text())
        if state['status']!='PASS': raise ValueError('certified release required')
        actual={name:(progress,complete) for name,progress,complete in db.execute('SELECT name,progress,complete FROM partitions')}
        expected={name:(part['counts']['accepted'],1) for name,part in state['partitions'].items()}
        if actual!=expected: raise ValueError('source checkpoint coverage mismatch')
        integrity=[r[0] for r in db.execute('PRAGMA quick_check')]
        if integrity!=['ok']: raise ValueError('database integrity failure')
        inflections=db.execute('SELECT SUM(inflections) FROM partitions').fetchone()[0]
        stored=db.execute('SELECT COUNT(*) FROM records').fetchone()[0]
        if stored+inflections!=state['counts']['accepted']: raise ValueError('projection record loss')
        missing_checksums=db.execute('SELECT COUNT(*) FROM records r LEFT JOIN record_checksums c ON c.seq=r.seq WHERE c.seq IS NULL').fetchone()[0]
        orphan_checksums=db.execute('SELECT COUNT(*) FROM record_checksums c LEFT JOIN records r ON r.seq=c.seq WHERE r.seq IS NULL').fetchone()[0]
        orphan_arcs=db.execute('SELECT COUNT(*) FROM arcs a LEFT JOIN records r ON r.seq=a.seq WHERE r.seq IS NULL').fetchone()[0]
        if missing_checksums or orphan_checksums or orphan_arcs: raise ValueError('dangling stored provenance')
        checked=sampled=0
        for seq,eid,packed,checksum in db.execute('SELECT r.seq,r.eid,r.body,c.sha FROM records r JOIN record_checksums c ON c.seq=r.seq ORDER BY r.seq'):
            if hashlib.sha256(packed).digest()!=checksum: raise ValueError('payload checksum mismatch')
            checked+=1
            if checked==1 or checked%10000==0:
                row=index.record(seq); body=row['body']
                if bid(row['id'])!=eid or body['establishes_membership'] or 'inflection' in body['normalized']:
                    raise ValueError('invalid productive observation')
                sampled+=1
        if checked!=stored: raise ValueError('payload count mismatch')
        missing_endpoints=db.execute('''SELECT COUNT(*) FROM arcs a LEFT JOIN lexemes s ON s.id=a.src
          LEFT JOIN lexemes t ON t.id=a.dst WHERE s.id IS NULL OR t.id IS NULL''').fetchone()[0]
        kinds=[dict(type=t,direction=d,occurrences=n) for t,d,n in db.execute('SELECT type,direction,COUNT(*) FROM arcs GROUP BY type,direction')]
        result=dict(status='PASS',source_records=state['counts']['accepted'],stored_productive_records=stored,
            inflections_retained_only_in_staging=inflections,compressed_payload_checksums_verified=checked,
            random_access_payloads_decoded=sampled,sqlite_quick_check='ok',dangling_stored_provenance=0,
            unresolved_native_endpoint_arc_occurrences=missing_endpoints,arc_types=kinds,
            max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            elapsed_seconds=round(time.monotonic()-started,3),database_sha256=hash_file(database),
            scope='all compressed payload checksums; stratified decoding, not a second full linguistic graph build',
            establishes_membership=False)
    finally: index.close()
    atomic_json(receipt,result); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['database','release','receipt']: p.add_argument('--'+name,required=True,type=Path)
    a=p.parse_args(); print(json.dumps(audit(a.database,a.release,a.receipt),sort_keys=True))

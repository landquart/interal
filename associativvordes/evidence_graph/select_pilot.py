#!/usr/bin/env python3
"""Bounded real source selection by finite v6 lookups and native UDer neighborhoods."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import json
from pathlib import Path
import sqlite3
import tempfile
from associativvordes.evidence_graph.graph import canonical,file_hash,lookup
from associativvordes.evidence_graph.records import binary_stream,validate_lock,LANGUAGES,make_record

def select(lock_path,raw_root,seeds_path,output,limit=2000,radius=2):
    if not 1<=limit<=10000 or not 0<=radius<=3:raise ValueError('finite limits required')
    out=Path(output).resolve();repo=Path(__file__).resolve().parents[2]
    if out.is_relative_to(repo):raise ValueError('selection must be outside checkout')
    lock=json.loads(Path(lock_path).read_text());root=Path(raw_root);validate_lock(lock,root);words={}
    for s in json.loads(Path(seeds_path).read_text()):words.setdefault(s['language'],set()).add(lookup(s['word']))
    out.mkdir(parents=True,exist_ok=True);reports=[]
    with tempfile.TemporaryDirectory(prefix='graph-selection-') as tmp,open(out/'records.ndjson','w',encoding='utf-8') as dest:
        db=sqlite3.connect(Path(tmp)/'select.sqlite');db.executescript('PRAGMA cache_size=-8192;CREATE TABLE nodes(id TEXT PRIMARY KEY,line INTEGER,raw BLOB);CREATE TABLE arcs(src TEXT,dst TEXT);CREATE INDEX a_src ON arcs(src);CREATE INDEX a_dst ON arcs(dst);')
        for a in sorted(lock['artifacts'],key=lambda x:x['id']):
            wanted=words.get(LANGUAGES[a['language']],set());header=None;read=eligible=0;selected=[];front=set()
            if a['format']=='derinet2':db.executescript('DELETE FROM nodes;DELETE FROM arcs;')
            with binary_stream(root/a['path'],a) as stream:
                for line,data in enumerate(stream,1):
                    if not data.strip() or a['format']=='derinet2' and data.lstrip().startswith(b'#'):continue
                    fields=data.decode('utf-8').rstrip('\n').removesuffix('\r').split('\t')
                    if a['format'].startswith('glemm_') and header is None:header=fields;continue
                    read+=1
                    if a['format']=='derinet2':
                        db.execute('INSERT INTO nodes VALUES(?,?,?)',(fields[0],line,data))
                        if lookup(fields[2]) in wanted:front.add(fields[0])
                        record=make_record(a,line,data)
                        for claim in record['body']['normalized']['claims']:
                            for src in claim['sources']:db.execute('INSERT INTO arcs VALUES(?,?)',(src,fields[0]))
                        if read%10000==0:db.commit()
                    else:
                        positions=[0,2] if a['format'].startswith('glemm_') else [0,1] if a['format']=='morphynet_derivation' else [0]
                        if any(lookup(fields[i]) in wanted for i in positions):
                            eligible+=1
                            if len(selected)<limit:selected.append((line,data))
            if a['format']=='derinet2':
                db.commit();seen=set(front)
                for _ in range(radius):
                    nxt=set()
                    for id in sorted(front):nxt.update(x[0] for x in db.execute('SELECT src FROM arcs WHERE dst=? UNION SELECT dst FROM arcs WHERE src=?',(id,id)))
                    front=nxt-seen;seen.update(front)
                eligible=len(seen)
                for id in sorted(seen)[:limit*5]:
                    row=db.execute('SELECT line,raw FROM nodes WHERE id=?',(id,)).fetchone()
                    if row:selected.append(row)
            accepted=rejected=0
            for line,data in sorted(selected):
                try:r=make_record(a,line,data,header)
                except ValueError:rejected+=1;continue
                dest.write(canonical(r)+'\n');accepted+=1
            reports.append({'artifact':a['id'],'read':read,'eligible':eligible,'selected':accepted,'selected_rejected':rejected,'limit_applied':eligible>len(selected)})
            print(a['id'],accepted,flush=True)
        db.close()
    manifest={'source_lock_sha256':file_hash(lock_path),'seeds_sha256':file_hash(seeds_path),'selector_sha256':file_hash(__file__),
        'records_sha256':file_hash(out/'records.ndjson'),'limit_per_artifact':limit,'uder_radius':radius,'reports':reports}
    (out/'SELECTION.json').write_text(canonical(manifest)+'\n',encoding='utf-8');return out

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['lock','raw-root','seeds','output']:p.add_argument('--'+n,required=True)
    a=p.parse_args();select(a.lock,a.raw_root,a.seeds,a.output)

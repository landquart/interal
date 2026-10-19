#!/usr/bin/env python3
"""Query immutable graph snapshots without source corpora or production writes."""
import argparse
from pathlib import Path
import tempfile
from graph import Graph,canonical,lookup,ref

def query(snapshot,family,language,word,max_depth=3,manifest_sha256=None):
    with tempfile.TemporaryDirectory(prefix='graph-query-') as tmp:
        g=Graph.open_snapshot(snapshot,Path(tmp)/'query.sqlite',manifest_sha256)
        try:
            guard=g.guard(family,language,word);rows=g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(language,lookup(word))).fetchall();results=[]
            if guard['status'] not in {'hold','blocked'}:
                for id, in rows[:12]:results.append({'lexeme_ref':ref(g.get(id)),**g.paths(id,max_depth=max_depth,max_paths=10,max_expansions=500,family=family)})
            return {'family_guard':guard,'source_lexeme_matches':len(rows),'lookup_identity_established':False,'query_start_truncated':len(rows)>12,'queries':results,'establishes_membership':False}
        finally:g.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['snapshot','family','language','word']:p.add_argument('--'+n,required=True)
    p.add_argument('--max-depth',type=int,default=3);p.add_argument('--manifest-sha256');a=p.parse_args();print(canonical(query(a.snapshot,a.family,a.language,a.word,a.max_depth,a.manifest_sha256)))

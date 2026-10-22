"""Reuse the certified native index without spelling bridges or new morphology rules."""
import base64
import copy
from pathlib import Path
import sys
from contract import file_hash,sha
HERE=Path(__file__).resolve().parents[1]
for n in ('candidate_search','evidence_graph','importers'):sys.path.insert(0,str(HERE/n))
from mass_source import Source,checked
from scale_index import bid

class NativeSource:
    def __init__(self,path,expected):
        receipt=checked(path,Path(path).parent/'INDEX.json')
        if receipt['database_sha256']!=expected:raise ValueError('source index/queue mismatch')
        self.source=Source(path,verify=False);self.identity=receipt['database_sha256']
    def enrich(self,q):
        q=copy.deepcopy(q);s=self.source;rows={}
        for lex in q['lexeme_alternatives']:
            native=s.lexeme(bid(lex['id']))
            if any(native.get(k)!=lex.get(k) for k in ('id','lemma','language','pos')):raise ValueError('native assertion mismatch')
        for p in q.get('discovery_paths',[]):
            p['node_languages']=[s.lexeme(bid(n if isinstance(n,str) else n['id']))['language'] for n in p['nodes']]
        for e in q.get('evidence_refs',[]):
            row=s.db.execute('SELECT seq FROM records WHERE eid=?',(bid(e['id']),)).fetchone()
            if not row:raise ValueError('missing source row')
            record=s.record(row[0]);body=record['body']
            raw=base64.b64decode(body['original_line_base64'],validate=True)
            if sha(raw)!=e['raw_locator']['raw_sha256'] or body['raw_locator']!=e['raw_locator']:
                raise ValueError('raw source row mismatch')
            if e.get('revision') and body['revision']!=e['revision']:raise ValueError('source revision mismatch')
            ordinal=e.get('claim_ordinal')
            if ordinal is not None and e.get('claim')!=body['normalized']['claims'][ordinal]:
                raise ValueError('source claim mismatch')
            rows[e['id']]=dict(id=record['id'],revision=body['revision'],artifact=body['artifact'],
              raw_locator=body['raw_locator'],original_line_base64=body['original_line_base64'],raw_text=raw.decode(),
              source_index_sha256=self.identity)
        return q,rows
    def close(self):self.source.close()

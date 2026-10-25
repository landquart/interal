"""Reuse the certified native index without spelling bridges or new morphology rules."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import base64
import copy
from pathlib import Path
import sys
from associativvordes.auto_annotation.contract import file_hash,sha
HERE=Path(__file__).resolve().parents[1]
for n in ('candidate_search','evidence_graph','importers'):pass
from associativvordes.candidate_search.mass_source import Source,checked,readonly
from associativvordes.importers.scale_index import bid

class NativeSource:
    def __init__(self,path,expected,auxiliary=None):
        receipt=checked(path,Path(path).parent/'INDEX.json')
        if receipt['database_sha256']!=expected:raise ValueError('source index/queue mismatch')
        self.source=Source(path,verify=False);self.identity=receipt['database_sha256'];self.aux=None
        if auxiliary:
            aux=checked(auxiliary,Path(auxiliary).parent/'AUX.json')
            if aux['identity']['source']!=expected:raise ValueError('auxiliary/source mismatch')
            self.aux=readonly(auxiliary)
    def enrich(self,q):
        q=copy.deepcopy(q);s=self.source;rows={};inflection_lexemes={}
        import json
        for obs in q.get('inflection_observations',[]):
            if not self.aux:continue
            found=self.aux.execute('SELECT body FROM inflections WHERE eid=?',(obs['evidence_id'],)).fetchone()
            if not found:raise ValueError('missing auxiliary inflection row')
            record=json.loads(found[0]);body=record['body']
            raw=base64.b64decode(body['original_line_base64'],validate=True)
            if body['raw_locator']!=obs['raw_locator'] or sha(raw)!=obs['raw_locator']['raw_sha256']:
                raise ValueError('inflection raw row mismatch')
            if body['normalized']['claims'] or body['normalized']['inflection']['derivational_model']:
                raise ValueError('inflection contamination')
            for native in body['normalized']['lexemes']:inflection_lexemes[native['id']]=native
            q['evidence_refs'].append(dict(id=record['id'],revision=body['revision'],artifact=body['artifact'],
                raw_locator=body['raw_locator'],category='inflection',source=body['source']))
            rows[record['id']]=dict(id=record['id'],revision=body['revision'],artifact=body['artifact'],
                raw_locator=body['raw_locator'],original_line_base64=body['original_line_base64'],raw_text=raw.decode(),
                source_index_sha256=self.identity)

        for lex in q['lexeme_alternatives']:
            native=inflection_lexemes.get(lex['id'])
            if not native:
                if not s.db.execute('SELECT 1 FROM lexemes WHERE id=?',(bid(lex['id']),)).fetchone():
                    # Inflection-only endpoints are intentionally absent from the derivation index.
                    if not self.aux:
                        lex['index_identity_status']='unverified_without_auxiliary';continue
                    raise ValueError('missing native endpoint in index and auxiliary')
                native=s.lexeme(bid(lex['id']))
            if any(native.get(k)!=lex.get(k) for k in ('id','lemma','language','pos')):raise ValueError('native assertion mismatch')
        for p in q.get('discovery_paths',[]):
            p['node_languages']=[s.lexeme(bid(n if isinstance(n,str) else n['id']))['language'] for n in p['nodes']]
        for e in q.get('evidence_refs',[]):
            if e['id'] in rows:continue
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
    def close(self):
        self.source.close()
        if self.aux:self.aux.close()

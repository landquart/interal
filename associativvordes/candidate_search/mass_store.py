"""Transactional family/language checkpoints, review history, streaming exports."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import json
from pathlib import Path
from associativvordes.candidate_search.search import Queue, canonical, sha, lookup

CATEGORIES = ('NEW_MEMBER','EXISTING_MEMBER_AUDIT','CONFLICT','POSSIBLE_BASE',
              'IDENTITY_UNRESOLVED','NEGATIVE_HISTORY','LOW_EVIDENCE')


class Store(Queue):
    def __init__(self, path):
        super().__init__(path)
        self.db.executescript('''CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,fingerprint TEXT,stats TEXT);
           CREATE TABLE IF NOT EXISTS active(unit TEXT,question TEXT,PRIMARY KEY(unit,question));
           CREATE INDEX IF NOT EXISTS active_questions ON active(question,unit);
           CREATE TABLE IF NOT EXISTS discovery_log(unit TEXT,id TEXT,body TEXT,PRIMARY KEY(unit,id));''')

    def import_history(self, path):
        import sqlite3
        old = sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro', uri=True)
        try:
            old.execute('BEGIN')
            with self.db:
                for row in old.execute('SELECT * FROM questions ORDER BY id'):
                    current = self.db.execute('SELECT state FROM questions WHERE id=?', (row[0],)).fetchone()
                    if not current: self.db.execute('INSERT INTO questions VALUES(?,?,?,?,?)',row)
                    else:
                        local_n=self.db.execute('SELECT COALESCE(MAX(sequence),0) FROM history WHERE candidate=?',(row[0],)).fetchone()[0]
                        old_n=old.execute('SELECT COALESCE(MAX(sequence),0) FROM history WHERE candidate=?',(row[0],)).fetchone()[0]
                        if old_n >= local_n: self.db.execute('UPDATE questions SET state=? WHERE id=?',(row[3],row[0]))
                for row in old.execute('SELECT * FROM history ORDER BY candidate,sequence'):
                    current = self.db.execute('SELECT * FROM history WHERE candidate=? AND sequence=?',row[:2]).fetchone()
                    if current and current != row: raise ValueError('review history sequence conflict')
                    self.db.execute('INSERT OR IGNORE INTO history VALUES(?,?,?,?,?,?)',row)
        finally: old.close()

    def with_history_context(self, body):
        context=[]
        for other_id,payload,state in self.db.execute("SELECT id,body,state FROM questions WHERE state!='open' AND json_extract(body,'$.language')=? AND json_extract(body,'$.family')='unassigned' ORDER BY id",(body['language'],)):
            other=json.loads(payload)
            if lookup(other['lemma'])==lookup(body['lemma']):
                history=[list(r) for r in self.db.execute('SELECT sequence,state,reason,actor,basis FROM history WHERE candidate=? ORDER BY sequence',(other_id,))]
                context.append(dict(id=other_id,state=state,history=history,scope='unassigned_prior_base_question',identity='same_spelling_only'))
        return dict(body,prior_unassigned_questions=context)

    def save_unit(self, unit, fingerprint, questions, events, stats, fail_after=None):
        with self.db:
            self.db.execute('DELETE FROM active WHERE unit=?',(unit,))
            self.db.execute('DELETE FROM scopes WHERE scope=?',(unit,))
            self.db.execute('DELETE FROM discovery_log WHERE unit=?',(unit,))
            for i, body in enumerate(questions):
                body=self.with_history_context(body)
                cid, _ = self.upsert(body,unit)
                prior = body.get('guard',{}).get('blockers',[])
                self.scoped_context(cid,prior)
                self.db.execute('INSERT INTO active VALUES(?,?)',(unit,cid))
                if fail_after is not None and i >= fail_after: raise RuntimeError('injected transaction interruption')
            for event in events:
                self.db.execute('INSERT OR IGNORE INTO discovery_log VALUES(?,?,?)',(unit,sha(event),canonical(event)))
            self.db.execute('INSERT OR REPLACE INTO units VALUES(?,?,?)',(unit,fingerprint,json.dumps(stats,sort_keys=True)))

    def export_selected(self, destination, units):
        destination = Path(destination); destination.mkdir(parents=True,exist_ok=True)
        self.db.execute('CREATE TEMP TABLE IF NOT EXISTS selected_units(id TEXT PRIMARY KEY)')
        self.db.execute('DELETE FROM selected_units')
        self.db.executemany('INSERT INTO selected_units VALUES(?)',((u,) for u in units))
        self.db.commit()
        streams = {k: open(destination/(k+'.ndjson'),'w',encoding='utf-8') for k in (*CATEGORIES,'questions','discovery')}
        counts = {k:0 for k in (*CATEGORIES,'questions','discovery')}
        try:
            query = '''SELECT q.id,q.body,q.fingerprint,q.state,q.changed FROM questions q
              WHERE EXISTS(SELECT 1 FROM active a JOIN selected_units u ON a.unit=u.id WHERE a.question=q.id)
              ORDER BY CASE q.state WHEN 'rejected' THEN 2 WHEN 'split_required' THEN 2 WHEN 'reviewed' THEN 1 ELSE 0 END,
              json_extract(q.body,'$.priority.score') DESC,q.id'''
            for cid,raw,fp,state,changed in self.db.execute(query):
                body = json.loads(raw)
                history = [dict(zip(('sequence','state','reason','actor','basis'),r)) for r in self.db.execute(
                    'SELECT sequence,state,reason,actor,basis FROM history WHERE candidate=? ORDER BY sequence',(cid,))]
                scopes = [r[0] for r in self.db.execute('SELECT unit FROM active WHERE question=? ORDER BY unit',(cid,))]
                cats = set(body['categories'])
                if state in {'rejected','split_required'} or any(h['state'] in {'rejected','split_required'} for h in history): cats.add('NEGATIVE_HISTORY')
                body.update(review_state=state,previous_decisions=history,evidence_changed_since_review=bool(changed),
                            active_scopes=scopes,input_fingerprint=fp,categories=sorted(cats),
                            review_rank_policy='new/deferred, reviewed, rejected/split; heuristic priority then stable ID')
                line=canonical(body)+'\n'; streams['questions'].write(line); counts['questions']+=1
                for category in sorted(cats): streams[category].write(line); counts[category]+=1
            for unit, body in self.db.execute('SELECT d.unit,d.body FROM discovery_log d JOIN selected_units u ON d.unit=u.id ORDER BY d.unit,d.id'):
                streams['discovery'].write(canonical(dict(unit=unit,**json.loads(body)))+'\n');counts['discovery']+=1
        finally:
            import os
            for stream in streams.values(): stream.flush();os.fsync(stream.fileno());stream.close()
        return counts

    def reconcile_review_history(self, units):
        """Review edits affect POS alternatives even when source discovery is reused."""
        with self.db:
            for unit in units:
                rows=self.db.execute('SELECT q.body FROM questions q JOIN active a ON a.question=q.id WHERE a.unit=? ORDER BY q.id',(unit,)).fetchall()
                for raw, in rows:
                    body=self.with_history_context(json.loads(raw));self.upsert(body,unit)

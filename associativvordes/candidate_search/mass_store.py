"""Transactional family/language checkpoints, review history, streaming exports."""
import json
from pathlib import Path
from search import Queue, canonical, sha, lookup

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
            with self.db:
                for row in old.execute('SELECT * FROM questions ORDER BY id'):
                    current = self.db.execute('SELECT state FROM questions WHERE id=?', (row[0],)).fetchone()
                    if not current: self.db.execute('INSERT INTO questions VALUES(?,?,?,?,?)',row)
                    else: self.db.execute('UPDATE questions SET state=? WHERE id=?',(row[3],row[0]))
                for row in old.execute('SELECT * FROM history ORDER BY candidate,sequence'):
                    current = self.db.execute('SELECT * FROM history WHERE candidate=? AND sequence=?',row[:2]).fetchone()
                    if current and current != row: raise ValueError('review history sequence conflict')
                    self.db.execute('INSERT OR IGNORE INTO history VALUES(?,?,?,?,?,?)',row)
        finally: old.close()

    def save_unit(self, unit, fingerprint, questions, events, stats, fail_after=None):
        with self.db:
            self.db.execute('DELETE FROM active WHERE unit=?',(unit,))
            self.db.execute('DELETE FROM scopes WHERE scope=?',(unit,))
            self.db.execute('DELETE FROM discovery_log WHERE unit=?',(unit,))
            for i, body in enumerate(questions):
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
                if history or state in {'rejected','split_required'}: cats.add('NEGATIVE_HISTORY')
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

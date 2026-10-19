"""Bounded proposal discovery; persistent review questions, never membership writes."""
import argparse
import json
import math
from pathlib import Path
import sqlite3
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'evidence_graph'))
from graph import Graph, canonical, sha, lookup, ref, file_hash, BLOCKING

DEFAULT_WEIGHTS={'frequency':2,'uncertainty':3,'merge_risk':4,'independent_evidence':2,'model_impact':1,'calculation_impact':1}
STATES={'open','rejected','reviewed','split_required','deferred'}

def priority(features,weights=None):
    weights=DEFAULT_WEIGHTS if weights is None else weights
    if set(weights)!=set(DEFAULT_WEIGHTS) or any(type(x)!=int or not 0<=x<=100 for x in weights.values()):raise ValueError('invalid experimental weights')
    return {'score':sum(features[k]*weights[k] for k in weights),'components':features,'weights':weights,'experimental':True,'methodology_score':False}

class Queue:
    def __init__(self,path):
        self.db=sqlite3.connect(path)
        self.db.executescript('''PRAGMA cache_size=-8192;PRAGMA temp_store=FILE;
        CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,body TEXT,fingerprint TEXT,state TEXT,changed INTEGER);
        CREATE TABLE IF NOT EXISTS history(candidate TEXT,sequence INTEGER,state TEXT,reason TEXT,actor TEXT,basis TEXT,PRIMARY KEY(candidate,sequence));
        CREATE TABLE IF NOT EXISTS scopes(scope TEXT,candidate TEXT,PRIMARY KEY(scope,candidate));
        CREATE INDEX IF NOT EXISTS question_scope ON questions(json_extract(body,'$.family'),json_extract(body,'$.language'),state);
        ''')
    def upsert(self,body,scope):
        # A review question groups spelling alternatives, NOT lexeme identities.
        cid='candidate:'+sha([body['family'],body['language'],lookup(body['lemma']),body['pos']])
        body=dict(body,id=cid);fp=sha(body)
        old=self.db.execute('SELECT fingerprint,state,changed FROM questions WHERE id=?',(cid,)).fetchone()
        if old and old[0]==fp:changed=old[2]
        else:changed=int(bool(old))
        state=old[1] if old else 'open'
        inherited=[]
        for sibling,payload,sibling_state,basis in self.db.execute("SELECT id,body,state,fingerprint FROM questions WHERE json_extract(body,'$.family')=? AND json_extract(body,'$.language')=? AND state IN ('rejected','split_required') ORDER BY id",(body['family'],body['language'])):
            other=json.loads(payload)
            if sibling!=cid and lookup(other['lemma'])==lookup(body['lemma']):
                inherited.append((sibling,sibling_state,basis))
        if inherited:
            state='rejected' if state=='rejected' or any(x[1]=='rejected' for x in inherited) else 'split_required'
        self.db.execute('INSERT OR REPLACE INTO questions VALUES(?,?,?,?,?)',(cid,canonical(body),fp,state,changed))
        for sibling,sibling_state,basis in inherited:
            reason='Conservative prior spelling/POS scope: '+sibling
            if not self.db.execute('SELECT 1 FROM history WHERE candidate=? AND reason=? AND basis=?',(cid,reason,basis)).fetchone():
                n=self.db.execute('SELECT COUNT(*) FROM history WHERE candidate=?',(cid,)).fetchone()[0]+1
                self.db.execute('INSERT INTO history VALUES(?,?,?,?,?,?)',(cid,n,sibling_state,reason,'inherited_queue_prohibition',basis))
        self.db.execute('INSERT OR IGNORE INTO scopes VALUES(?,?)',(scope,cid))
        return cid,not old or old[0]!=fp
    def decide(self,cid,state,reason,actor):
        if state not in STATES or not reason.strip() or not actor.strip():raise ValueError('explicit review state/reason/actor required')
        row=self.db.execute('SELECT fingerprint FROM questions WHERE id=?',(cid,)).fetchone()
        if not row:raise KeyError(cid)
        n=self.db.execute('SELECT COUNT(*) FROM history WHERE candidate=?',(cid,)).fetchone()[0]+1
        self.db.execute('INSERT INTO history VALUES(?,?,?,?,?,?)',(cid,n,state,reason,actor,row[0]))
        self.db.execute('UPDATE questions SET state=?,changed=0 WHERE id=?',(state,cid))
        self.db.commit()
    def scoped_context(self,cid,decisions):
        if not decisions:return
        basis='scoped-context:'+sha(decisions);reason='Prior scoped registry prohibition requires identity/family review'
        if not self.db.execute('SELECT 1 FROM history WHERE candidate=? AND actor=? AND basis=?',(cid,'scoped_registry_context',basis)).fetchone():
            n=self.db.execute('SELECT COUNT(*) FROM history WHERE candidate=?',(cid,)).fetchone()[0]+1
            self.db.execute('INSERT INTO history VALUES(?,?,?,?,?,?)',(cid,n,'deferred',reason,'scoped_registry_context',basis))
        # A scoped prohibition is context, not a rejection in every possible family.
        self.db.execute("UPDATE questions SET state='deferred' WHERE id=? AND state='open'",(cid,))
    def rows(self):
        for cid,body,fp,state,changed in self.db.execute('SELECT * FROM questions ORDER BY id'):
            scopes=[x[0] for x in self.db.execute('SELECT scope FROM scopes WHERE candidate=? ORDER BY scope',(cid,))]
            history=[dict(zip(['sequence','state','reason','actor','basis'],x)) for x in self.db.execute('SELECT sequence,state,reason,actor,basis FROM history WHERE candidate=? ORDER BY sequence',(cid,))]
            yield dict(json.loads(body),review_state=state,evidence_changed_since_review=bool(changed),active_scopes=scopes,previous_decisions=history,input_fingerprint=fp,establishes_membership=False)
    def export(self,path):
        self.db.commit()
        with open(path,'w',encoding='utf-8') as f:
            for x in self.rows():f.write(canonical(x)+'\n')
    def close(self):self.db.close()

def frequency_index(records):
    result={}
    for x in records:
        if sha(x['record_json'])!=x['record_sha256'] or not x['locators']:raise ValueError('frequency integrity')
        row=json.loads(x['record_json']); k=(x['language'],lookup(row['word']))
        result.setdefault(k,[]).append(x)
    return result

def collect(g,family,max_starts=12,max_depth=2):
    if not 1<=max_starts<=50 or not 1<=max_depth<=3:raise ValueError('pilot bounds')
    fs=g.resolve_family(family)
    if len(fs)!=1:raise ValueError('unknown/ambiguous family')
    family=fs[0];starts={};stats={'seed_matches':0,'blocked_seeds':0,'queries':0,'expanded':0,'truncated_queries':0,'known_paths_excluded':0}
    # Exact project correspondences only; aliases do not establish lexical identity.
    for lang,word,head in g.db.execute('SELECT language,word,head FROM known WHERE family=? ORDER BY language,word,head',(family,)):
        for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(lang,word)):
            stats['seed_matches']+=1;starts.setdefault(lid,[]).append({'head':head,'language':lang,'word':word})
    def productive(lid):
        return bool(g.db.execute("SELECT 1 FROM arcs a JOIN relations r ON r.id=a.relation WHERE a.src=? AND r.direction='directed' AND r.type IN ('derivation_direct','derivation_indirect','shared_base','compounding') LIMIT 1",(lid,)).fetchone())
    buckets={}
    for lid in starts:buckets.setdefault(g.get(lid)['body']['language'],[]).append(lid)
    for values in buckets.values():values.sort(key=lambda lid:(not productive(lid),lid))
    ordered=[]
    for i in range(max(map(len,buckets.values()),default=0)):
        for language in sorted(buckets):
            if i<len(buckets[language]):ordered.append(buckets[language][i])
    stats['available_starts']=len(ordered);stats['selected_starts']=min(len(ordered),max_starts)
    groups={}
    for lid in ordered[:max_starts]:
        b=g.get(lid)['body'];guard=g.guard(family,b['language'],b['lemma'])
        if guard['status'] in {'blocked','hold'}:stats['blocked_seeds']+=1;continue
        q=g.paths(lid,max_depth=max_depth,max_paths=20,max_expansions=300,family=family)
        stats['queries']+=1;stats['expanded']+=q['expanded'];stats['truncated_queries']+=int(q['truncated'])
        for p in q['paths']:
            target=g.resolve(p['nodes'][-1]);b=target['body'];guard=g.guard(family,b['language'],b['lemma'])
            if guard['status'] in {'blocked','hold'}:continue
            if guard.get('known_records'):stats['known_paths_excluded']+=1;continue
            k=(b['language'],lookup(b['lemma']),b['pos'])
            item=groups.setdefault(k,{'family':family,'language':b['language'],'lemma':b['lemma'],'pos':b['pos'],'lexemes':{},'paths':{},'bases':{},'guards':[]})
            item['lexemes'][target['id']]=ref(target);item['paths'][sha(p)]=p
            item['bases'][lid]={'lexeme_ref':ref(g.get(lid)),'project_correspondences':starts[lid]}
    return groups,stats

def _build(g,queue,families,frequencies,weights=None,max_starts=12,max_depth=2):
    if not 1<=len(families)<=7 or len(set(families))!=len(families):raise ValueError('explicit pilot scope: 1..7 distinct families')
    freq=frequency_index(frequencies);summary={};all_groups={}
    for family in families:
        groups,stats=collect(g,family,max_starts,max_depth);summary[family]=stats
        for k,x in groups.items():all_groups[(x['family'],*k)]=x
    task_index={}
    relevant={s['relation_ref']['id'] for x in all_groups.values() for p in x['paths'].values() for s in p['steps']}
    for payload, in g.db.execute("SELECT payload FROM entities WHERE kind='ReviewTask' ORDER BY id"):
        task=json.loads(payload)
        for target in task['body'].get('trigger_refs',[]):
            if target['id'] in relevant:task_index.setdefault(target['id'],[]).append(ref(task))
    claims={}
    for fam,lang,word,pos in all_groups:claims.setdefault((lang,word,pos),set()).add(fam)
    for family in families:
        resolved=g.resolve_family(family)[0];scope=resolved
        # Scope-local reconcile; history/questions are never deleted.
        queue.db.execute('DELETE FROM scopes WHERE scope=?',(scope,))
        changed=0;count=0
        for (fam,lang,word,pos),x in sorted(all_groups.items(),key=lambda item:canonical(list(item[0]))):
            if fam!=resolved:continue
            paths=[x['paths'][k] for k in sorted(x['paths'])];sources=set();lineages=[]
            for p in paths:
                for step in p['steps']:
                    for s in step['sources']:
                        sources.add(g.resolve(s['source_revision_ref'])['body']['source_id']);lineages.append(s['source_lineage'])
            # Correlation is conservative: GLeMM/MorphyNet never counted independently here.
            independent=min(2,len({('uder' if 'uder' in s.lower() else 'glemm_morphynet') for s in sources}))
            f=freq.get((lang,word),[]);ranks=[json.loads(v['record_json']).get('rank') for v in f];ranks=[v for v in ranks if isinstance(v,int) and v>0]
            freq_band=max(0,6-int(math.log10(min(ranks)))) if ranks else 0
            competing=sorted(claims[(lang,word,pos)]-{fam})
            task_refs={canonical(t) for p in paths for s in p['steps'] for t in task_index.get(s['relation_ref']['id'],[])}
            conflict_refs=[json.loads(t) for t in sorted(task_refs)]
            features={'frequency':freq_band,'uncertainty':2+int(bool(conflict_refs)),'merge_risk':2+int(bool(competing)),'independent_evidence':independent,'model_impact':0,'calculation_impact':0}
            body={'family':fam,'language':lang,'lemma':x['lemma'],'pos':pos,'lexeme_alternatives':list(x['lexemes'].values()),'proposed_bases':[x['bases'][k] for k in sorted(x['bases'])],
              'discovery_paths':paths,'evidence_refs':[json.loads(e) for e in sorted({canonical(e) for p in paths for s in p['steps'] for e in s['evidence_refs']})],
              'sense_description':None,'sense_status':'unresolved','frequency_observations':f,'frequency_identity_status':'same_language_spelling_lookup_only',
              'match_kind':'exact_project_seed_then_morphological_path','allomorph_status':'no_new_allomorph_authorized',
              'uncertainty_reasons':['source_claim_not_reviewed','sense_identity_unresolved','project_pos_unavailable'],
              'conflicts':{'other_proposed_families':competing,'graph_review_tasks':conflict_refs},'source_lineages':sorted({canonical(v) for v in lineages}),
              'priority':priority(features,weights),'impact_status':'not_measured_no_calculation_simulation',
              'group_key':sha([fam,lang,pos,sorted({s['type'] for p in paths for s in p['steps']})]),'question_groups_spelling_not_identity':True}
            _,c=queue.upsert(body,scope);changed+=c;count+=1
        summary[family].update(candidates=count,changed=changed)
    return summary

def build(g,queue,families,frequencies,weights=None,max_starts=12,max_depth=2):
    with queue.db:
        return _build(g,queue,families,frequencies,weights,max_starts,max_depth)

def match_real_lexeme(g,lexeme_id,family,language,base,lemma_id=None,proposed=False):
    """Classify lookup hypothesis using finite approved allomorph scopes."""
    import difflib
    b=g.get(lexeme_id)['body']
    if b['language']!=language:return {'kind':'no_match','establishes_membership':False}
    guard=g.guard(family,language,b['lemma'],lemma_id)
    if guard['status'] in {'blocked','hold'}:return {'kind':'blocked','guard':guard,'establishes_membership':False}
    if lookup(b['lemma'])==lookup(base):kind='exact'
    else:
        kind='no_match'
        for proof,body in g.db.execute("SELECT e.proof,e.body FROM context_links c JOIN existing e ON c.dst=e.id WHERE c.type='scoped_allomorph' AND c.src=?",(guard['family_id'],)):
            rule=json.loads(body)
            if rule.get('status')=='accepted' and rule.get('language')==language and lemma_id and g.db.execute('SELECT 1 FROM known WHERE family=? AND language=? AND word=? AND lemma=?',(guard['family_id'],language,lookup(b['lemma']),lemma_id)).fetchone() and lemma_id in rule.get('finite_scope_lemma_ids',[]) and lookup(base)==lookup(rule.get('realization','')):
                return {'kind':'allowed_allomorph','rule_ref':json.loads(proof),'finite_lemma_id':lemma_id,'establishes_membership':False}
        if kind=='no_match' and difflib.SequenceMatcher(None,lookup(base),lookup(b['lemma'])).ratio()>=0.65:
            kind='proposed_new_allomorph' if proposed else 'formal_similarity'
    return {'kind':kind,'hypothesis_only':kind in {'formal_similarity','proposed_new_allomorph'},'establishes_membership':False}

def reverse(g,frequencies,limit=20):
    """Real corpus records -> native lexemes -> finite incoming morphological bases."""
    if not 1<=limit<=100:raise ValueError('bounded reverse limit')
    frequency_index(frequencies)
    result=[]
    for observation in frequencies:
        row=json.loads(observation['record_json']);lang=observation['language']
        for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(lang,lookup(row['word']))):
            for rid,src in g.db.execute('SELECT relation,src FROM arcs WHERE dst=? ORDER BY relation,src',(lid,)):
                relation=g.get(rid)['body']
                if relation['type_id'] not in {'derivation_direct','shared_base','compounding'} or relation['direction']['state']!='directed':continue
                review=g.db.execute('SELECT status FROM reviews WHERE relation=?',(rid,)).fetchone()
                if review and review[0]=='rejected':continue
                result.append({'language':lang,'lemma':row['word'],'pos':g.get(lid)['body']['pos'],'sense_description':None,'lexeme_ref':ref(g.get(lid)),
                  'proposed_base':ref(g.get(src)),'relation_ref':ref(g.get(rid)),'relation_type':relation['type_id'],'direction':relation['direction'],'frequency':observation,'status':'hypothesis_only','creates_canonical_root':False,'establishes_membership':False})
                if len(result)>=limit:return result
    return result

def enqueue_reverse(g,queue,frequencies,limit=20,weights=None):
    """Persistent new-base questions; unassigned is a workflow label, never a root."""
    hits=reverse(g,frequencies,limit);groups={}
    for h in hits:
        k=(h['language'],lookup(h['lemma']),h['pos'])
        groups.setdefault(k,[]).append(h)
    with queue.db:
        queue.db.execute("DELETE FROM scopes WHERE scope='reverse:new_base'")
        for k,items in sorted(groups.items(),key=lambda x:canonical(list(x[0]))):
            h=items[0];lex={canonical(i['lexeme_ref']) for i in items};bases={canonical(i['proposed_base']) for i in items};relations={i['relation_ref']['id']:i['relation_ref'] for i in items}
            evidence={canonical(ref(g.get(e))) for rid in relations for e, in g.db.execute('SELECT evidence FROM supports WHERE relation=? ORDER BY evidence',(rid,))}
            ranks=[json.loads(i['frequency']['record_json']).get('rank') for i in items];ranks=[r for r in ranks if type(r)==int and r>0]
            prior=[]
            for family,lemma,head,status,authority,proof,reason in g.db.execute('SELECT family,lemma,head,status,authority,proof,reason FROM decisions WHERE language=? AND word=? ORDER BY family,id',(h['language'],lookup(h['lemma']))):
                if status in BLOCKING:
                    prior.append({'family':family,'lemma_id':lemma,'head_id':head,'status':status,'authority':authority,'ref':json.loads(proof),'reason':reason,'identity_overlap':'same_language_spelling_lookup_only'})
            known_families={x[0] for x in g.db.execute('SELECT DISTINCT family FROM known WHERE language=? AND word=?',(h['language'],lookup(h['lemma'])))}|{x['family'] for x in prior}
            for family in sorted(known_families):
                control=g.db.execute('SELECT status,proof FROM family_controls WHERE family=?',(family,)).fetchone()
                if control and control[0] in BLOCKING:prior.append({'family':family,'status':control[0],'ref':json.loads(control[1]),'scope':'family_control'})
            body={'family':'unassigned','language':h['language'],'lemma':h['lemma'],'pos':h['pos'],
              'lexeme_alternatives':[json.loads(x) for x in sorted(lex)],'proposed_bases':[json.loads(x) for x in sorted(bases)],
              'evidence_refs':[json.loads(x) for x in sorted(evidence)],'discovery_paths':[{k:i[k] for k in ['lexeme_ref','proposed_base','relation_ref','relation_type','direction']} for i in items],
              'frequency_observations':[json.loads(x) for x in sorted({canonical(i['frequency']) for i in items})],
              'sense_description':None,'sense_status':'unresolved','match_kind':'real_project_word_incoming_relation',
              'uncertainty_reasons':['new_base_not_reviewed','sense_identity_unresolved'],'conflicts':{'family_assignment':'unassigned','prior_scoped_decisions':prior},
              'priority':priority({'frequency':max(0,6-int(math.log10(min(ranks)))) if ranks else 0,'uncertainty':2,'merge_risk':2,'independent_evidence':0,'model_impact':0,'calculation_impact':0},weights),
              'priority_status':'experimental_reverse_source_independence_not_measured','group_key':sha(['reverse',h['language'],h['pos']]),
              'creates_canonical_root':False,'allomorph_status':'no_new_allomorph_authorized'}
            cid,_=queue.upsert(body,'reverse:new_base');queue.scoped_context(cid,prior)
    return hits

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['snapshot','queue','frequencies','frequency-lock','output']:p.add_argument('--'+name,required=True)
    p.add_argument('--families',nargs='+',required=True);p.add_argument('--weights');a=p.parse_args()
    out=Path(a.output)
    if out.resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('outputs must be outside repository')
    out.mkdir(parents=True,exist_ok=True)
    if Path(a.queue).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('queue must be outside repository')
    tmp=tempfile.TemporaryDirectory(prefix='candidate-index-');g=Graph.open_snapshot(a.snapshot,Path(tmp.name)/'graph.sqlite');q=Queue(a.queue)
    try:
        lock=json.loads(Path(a.frequency_lock).read_text())
        if file_hash(a.frequencies)!=lock['frequencies_sha256']:raise ValueError('frequency selection checksum')
        f=json.loads(Path(a.frequencies).read_text());summary=build(g,q,a.families,f,json.loads(Path(a.weights).read_text()) if a.weights else None)
        q.export(out/'queue.ndjson');(out/'summary.json').write_text(canonical(summary)+'\n')
        rq=Queue(str(a.queue)+'.reverse')
        try:
            hits=enqueue_reverse(g,rq,f,weights=json.loads(Path(a.weights).read_text()) if a.weights else None);rq.export(out/'reverse-queue.ndjson')
            (out/'reverse.json').write_text(canonical(hits)+'\n')
        finally:rq.close()
        manifest={'schema':'candidate-review-run/1','graph_manifest_sha256':file_hash(Path(a.snapshot)/'GRAPH-MANIFEST.json'),
          'frequencies_sha256':file_hash(a.frequencies),'frequency_lock_sha256':file_hash(a.frequency_lock),
          'families':a.families,'weights':json.loads(Path(a.weights).read_text()) if a.weights else DEFAULT_WEIGHTS,
          'code_sha256':file_hash(__file__),'outputs':{n:file_hash(out/n) for n in ['queue.ndjson','summary.json','reverse.json','reverse-queue.ndjson']},'establishes_membership':False}
        (out/'RUN-MANIFEST.json').write_text(canonical(manifest)+'\n')
    finally:q.close();g.close();tmp.cleanup()

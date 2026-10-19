"""Bounded proposal discovery; persistent review questions, never membership writes."""
import argparse
import json
import math
from pathlib import Path
import sqlite3
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'evidence_graph'))
from graph import Graph, canonical, sha, lookup, ref, file_hash

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
        CREATE TABLE IF NOT EXISTS runs(scope TEXT PRIMARY KEY,fingerprint TEXT);
        ''')
    def upsert(self,body,scope):
        # A review question groups spelling alternatives, NOT lexeme identities.
        cid='candidate:'+sha([body['family'],body['language'],lookup(body['lemma']),body['pos']])
        body=dict(body,id=cid);fp=sha(body)
        old=self.db.execute('SELECT fingerprint,state,changed FROM questions WHERE id=?',(cid,)).fetchone()
        if old and old[0]==fp:changed=old[2]
        else:changed=int(bool(old))
        state=old[1] if old else 'open'
        self.db.execute('INSERT OR REPLACE INTO questions VALUES(?,?,?,?,?)',(cid,canonical(body),fp,state,changed))
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
    ordered=sorted(starts,key=lambda x:(not bool(g.db.execute('SELECT 1 FROM arcs WHERE src=? LIMIT 1',(x,)).fetchone()),x))
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

def build(g,queue,families,frequencies,weights=None,max_starts=12,max_depth=2):
    if not 1<=len(families)<=7 or len(set(families))!=len(families):raise ValueError('explicit pilot scope: 1..7 distinct families')
    freq=frequency_index(frequencies);summary={};all_groups={}
    for family in families:
        groups,stats=collect(g,family,max_starts,max_depth);summary[family]=stats
        for k,x in groups.items():all_groups[(x['family'],*k)]=x
    claims={}
    for fam,lang,word,pos in all_groups:claims.setdefault((lang,word,pos),set()).add(fam)
    for family in families:
        resolved=g.resolve_family(family)[0];scope=resolved
        # Scope-local reconcile; history/questions are never deleted.
        queue.db.execute('DELETE FROM scopes WHERE scope=?',(scope,))
        changed=0;count=0
        for (fam,lang,word,pos),x in sorted(all_groups.items()):
            if fam!=resolved:continue
            paths=[x['paths'][k] for k in sorted(x['paths'])];sources=set();lineages=[]
            for p in paths:
                for step in p['steps']:
                    for s in step['sources']:
                        sources.add(s['source_revision_ref']['id']);lineages.append(s['source_lineage'])
            # Correlation is conservative: GLeMM/MorphyNet never counted independently here.
            independent=min(2,len({('uder' if 'uder' in s.lower() else 'glemm_morphynet') for s in sources}))
            f=freq.get((lang,word),[]);ranks=[json.loads(v['record_json']).get('rank') for v in f];ranks=[v for v in ranks if isinstance(v,int) and v>0]
            freq_band=max(0,6-int(math.log10(min(ranks)))) if ranks else 0
            competing=sorted(claims[(lang,word,pos)]-{fam})
            features={'frequency':freq_band,'uncertainty':2,'merge_risk':2+int(bool(competing)),'independent_evidence':independent,'model_impact':0,'calculation_impact':0}
            body={'family':fam,'language':lang,'lemma':x['lemma'],'pos':pos,'lexeme_alternatives':list(x['lexemes'].values()),'proposed_bases':[x['bases'][k] for k in sorted(x['bases'])],
              'discovery_paths':paths,'evidence_refs':sorted({canonical(e) for p in paths for s in p['steps'] for e in s['evidence_refs']}),
              'sense_description':None,'sense_status':'unresolved','frequency_observations':f,'frequency_identity_status':'same_language_spelling_lookup_only',
              'match_kind':'exact_project_seed_then_morphological_path','allomorph_status':'no_new_allomorph_authorized',
              'uncertainty_reasons':['source_claim_not_reviewed','sense_identity_unresolved','project_pos_unavailable'],
              'conflicts':competing,'source_lineages':sorted({canonical(v) for v in lineages}),
              'priority':priority(features,weights),'impact_status':'not_measured_no_calculation_simulation',
              'group_key':sha([fam,lang,pos,sorted({s['type'] for p in paths for s in p['steps']})]),'question_groups_spelling_not_identity':True}
            _,c=queue.upsert(body,scope);changed+=c;count+=1
        summary[family].update(candidates=count,changed=changed)
    queue.db.commit();return summary

def reverse(g,frequencies,limit=20):
    """Real corpus records -> native lexemes -> finite incoming morphological bases."""
    if not 1<=limit<=100:raise ValueError('bounded reverse limit')
    result=[]
    for observation in frequencies:
        row=json.loads(observation['record_json']);lang=observation['language']
        for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(lang,lookup(row['word']))):
            for rid,src in g.db.execute('SELECT relation,src FROM arcs WHERE dst=? ORDER BY relation,src',(lid,)):
                relation=g.get(rid)['body']
                if relation['type_id'] not in {'derivation_direct','shared_base','compounding'} or relation['direction']['state']!='directed':continue
                result.append({'language':lang,'lemma':row['word'],'pos':g.get(lid)['body']['pos'],'sense_description':None,'lexeme_ref':ref(g.get(lid)),
                  'proposed_base':ref(g.get(src)),'relation_ref':ref(g.get(rid)),'frequency':observation,'status':'hypothesis_only','creates_canonical_root':False,'establishes_membership':False})
                if len(result)>=limit:return result
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['snapshot','queue','frequencies','output']:p.add_argument('--'+name,required=True)
    p.add_argument('--families',nargs='+',required=True);a=p.parse_args()
    out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    if Path(a.queue).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('queue must be outside repository')
    g=Graph.open_snapshot(a.snapshot,out/'graph.sqlite');q=Queue(a.queue)
    try:
        f=json.loads(Path(a.frequencies).read_text());summary=build(g,q,a.families,f)
        q.export(out/'queue.ndjson');(out/'summary.json').write_text(canonical(summary)+'\n')
        (out/'reverse.json').write_text(canonical(reverse(g,f))+'\n')
    finally:q.close();g.close()

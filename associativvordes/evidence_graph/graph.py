"""Immutable, isolated morphological evidence graph. No family writer."""
import hashlib
import json
import sqlite3
import unicodedata
from collections import deque
from pathlib import Path

SCHEMA='external-morphology-graph/1'
TYPES={'derivation_direct','derivation_indirect','shared_base','compounding','inflection','allomorphy',
       'orthographic_variant','borrowing','etymological_relation','surface_similarity','ext:core:morphological_relatedness@1'}
BLOCKING={'rejected','excluded','split_required','blocked_from_runtime','uncertain','pending','needs_review','insufficient_data'}
LABELS={'derivation_direct':'Подтверждаемая прямая деривация','derivation_indirect':'Подтверждаемая косвенная деривация',
 'shared_base':'Общая основа','compounding':'Словосложение','inflection':'Словоизменение',
 'orthographic_variant':'Орфографическое соответствие','surface_similarity':'Только формальное сходство',
 'insufficient_evidence':'Недостаточно доказательств','existing_decision_conflict':'Противоречие существующему решению'}
REQUIRED={
 'SourceRevision':{'source_id','release_label','canonical_url','artifacts','native_key_policy','license_records','lineage_declarations','availability_status','registration_status','acquisition_receipt_ref'},
 'Lexeme':{'source_id','source_revision_ref','native_lexeme_key','native_key_policy','language','lemma','pos','identity_resolution','origin_evidence_refs'},
 'LexemeSense':{'lexeme_ref','source_revision_ref','native_sense_key','definition','definition_language','resolution','origin_evidence_refs'},
 'Relation':{'type_id','participants','direction','semantic_parameters','analysis_scope','proposition_only'},
 'Evidence':{'source_revision_ref','raw_locator','raw_record_sha256','evidence_kind','related_lexeme_refs','interpretations','source_lineage','extraction','initial_status','rationale'},
 'CorpusAlignment':{'source_lexeme_ref','sense_scope','corpus_ref','proposed_head_ref','component_slot','link_role','segmentation','evidence_refs','initial_status'},
 'Verdict':{'subject','scope','status','authority','rationale','reason_codes','basis_refs','dependency_lock','policy_ref','reviewed_at','revokes_verdict_refs'},
 'ReviewTask':{'subject','scope','question_type','trigger_refs','blockers','queue_state','priority_components','input_manifest_ref'}}

def canonical(x):
    """JCS-compatible safe subset; native numeric observations stay raw JSON strings."""
    if x is None or isinstance(x,bool):return json.dumps(x)
    if isinstance(x,int):
        if abs(x)>9007199254740991:raise ValueError('unsafe integer')
        return str(x)
    if isinstance(x,str):
        x.encode('utf-8');return json.dumps(x,ensure_ascii=False,separators=(',',':'))
    if isinstance(x,list):return '['+','.join(canonical(v) for v in x)+']'
    if isinstance(x,dict) and all(isinstance(k,str) for k in x):
        return '{'+','.join(canonical(k)+':'+canonical(x[k]) for k in sorted(x,key=lambda k:k.encode('utf-16-be')))+'}'
    raise ValueError('unsupported canonical value')

def sha(x):return hashlib.sha256(canonical(x).encode()).hexdigest()
def key(kind,x):return kind+':'+sha(x)
def lookup(s):return unicodedata.normalize('NFC',s).casefold()
def file_hash(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
    return h.hexdigest()
def json_rows(path):
    with open(path,encoding='utf-8') as f:
        for line in f:yield json.loads(line)
def envelope(kind,id,body,revision=1,supersedes=None):
    x={'entity':kind,'id':id,'body':body,'revision':revision,'supersedes':supersedes}
    return {'schema_version':SCHEMA,**x,'content_sha256':sha(x)}
def ref(x):return {k:x[k] for k in ['entity','id','revision','content_sha256']}

class IntegrityConflict(ValueError):pass

TABLES={
 'arcs':('relation TEXT,src TEXT,dst TEXT,UNIQUE(relation,src,dst)',['relation','src','dst']),
 'supports':('relation TEXT,evidence TEXT,UNIQUE(relation,evidence)',['relation','evidence']),
 'aliases':('alias TEXT,family TEXT,UNIQUE(alias,family)',['alias','family']),
 'decisions':('id TEXT PRIMARY KEY,family TEXT,language TEXT,word TEXT,lemma TEXT,head TEXT,status TEXT,authority TEXT,proof TEXT,reason TEXT',['id','family','language','word','lemma','head','status','authority','proof','reason']),
 'known':('family TEXT,language TEXT,word TEXT,lemma TEXT,head TEXT,proof TEXT,UNIQUE(family,language,lemma,head)',['family','language','word','lemma','head','proof']),
 'bindings':('head TEXT,lexeme TEXT,alignment TEXT,UNIQUE(head,lexeme,alignment)',['head','lexeme','alignment']),
 'reviews':('relation TEXT PRIMARY KEY,status TEXT,proof TEXT',['relation','status','proof']),
 'context_links':('type TEXT,src TEXT,dst TEXT,proof TEXT,UNIQUE(type,src,dst,proof)',['type','src','dst','proof']),
 'observations':('lexeme TEXT,record TEXT,locator TEXT,UNIQUE(lexeme,record)',['lexeme','record','locator']),
 'family_controls':('family TEXT PRIMARY KEY,status TEXT,proof TEXT',['family','status','proof'])}

class Graph:
    def __init__(self,path=':memory:'):
        self.db=sqlite3.connect(path);self.trusted_snapshots=set();self.trusted_manual_refs=set()
        self.db.executescript('''PRAGMA cache_size=-8192;PRAGMA temp_store=FILE;
         CREATE TABLE IF NOT EXISTS entities(id TEXT,revision INTEGER,kind TEXT,payload TEXT,PRIMARY KEY(id,revision));
         CREATE TABLE IF NOT EXISTS existing(id TEXT PRIMARY KEY,kind TEXT,body TEXT,proof TEXT);
         CREATE TABLE IF NOT EXISTS lexemes(id TEXT PRIMARY KEY,language TEXT,word TEXT,pos TEXT,search TEXT);
         CREATE INDEX IF NOT EXISTS lexical_lookup ON lexemes(language,search,pos);
         CREATE TABLE IF NOT EXISTS relations(id TEXT PRIMARY KEY,type TEXT,direction TEXT,body TEXT);
         CREATE TABLE IF NOT EXISTS integrity_conflicts(id TEXT,revision INTEGER,old TEXT,new TEXT);''')
        for table,(ddl,_) in TABLES.items():self.db.execute('CREATE TABLE IF NOT EXISTS '+table+'('+ddl+')')
        self.db.execute('CREATE INDEX IF NOT EXISTS arcs_src ON arcs(src)')
        self.db.execute('CREATE INDEX IF NOT EXISTS decision_scope ON decisions(family,language,word)')
    def close(self):self.db.close()
    def commit(self):self.db.commit()
    def put(self,r):
        if r!=envelope(r['entity'],r['id'],r['body'],r['revision'],r['supersedes']):raise IntegrityConflict('invalid envelope')
        kind=r['entity'];b=r['body'];payload=canonical(r)
        if kind not in REQUIRED or not REQUIRED[kind]<=b.keys():raise ValueError('unknown or incomplete entity')
        if kind in {'Evidence','CorpusAlignment'} and b.get('initial_status')!='needs_review':raise ValueError('import cannot accept')
        if kind=='Lexeme' and (not b['lemma'].strip() or not b['language'] or unicodedata.normalize('NFC',b['lemma'])!=b['lemma']):raise ValueError('invalid lexical identity')
        if kind=='Lexeme' and b['pos'] is None and b['identity_resolution']!='unresolved':raise ValueError('unknown POS requires unresolved identity')
        if kind=='Evidence' and not b.get('interpretations'):raise ValueError('empty evidence interpretations')
        if kind=='Relation' and r['id']!=key('relation',[b['type_id'],b['participants'],b['direction'],b['semantic_parameters'],b['analysis_scope']]):raise IntegrityConflict('relation identity mismatch')
        old=self.db.execute('SELECT payload FROM entities WHERE id=? AND revision=?',(r['id'],r['revision'])).fetchone()
        if old:
            if old[0]!=payload:
                self.db.execute('INSERT INTO integrity_conflicts VALUES(?,?,?,?)',(r['id'],r['revision'],old[0],payload));self.commit()
                raise IntegrityConflict('same identity/revision conflict; both payloads retained')
            return ref(r)
        previous=self.db.execute('SELECT payload FROM entities WHERE id=? ORDER BY revision DESC LIMIT 1',(r['id'],)).fetchone()
        if previous:
            p=json.loads(previous[0])
            if r['revision']!=p['revision']+1 or r['supersedes']!=ref(p):raise IntegrityConflict('stale predecessor')
            if kind=='Lexeme' and any(p['body'].get(k)!=b.get(k) for k in ['language','lemma','pos','source_id','native_lexeme_key']):raise IntegrityConflict('identity change requires new ID')
        elif r['revision']!=1 or r['supersedes'] is not None:raise IntegrityConflict('missing predecessor')
        self.db.execute('INSERT INTO entities VALUES(?,?,?,?)',(r['id'],r['revision'],kind,payload))
        if kind=='Lexeme':self.db.execute('INSERT OR IGNORE INTO lexemes VALUES(?,?,?,?,?)',(r['id'],b['language'],b['lemma'],b.get('pos'),lookup(b['lemma'])))
        return ref(r)
    def get(self,id):
        row=self.db.execute('SELECT payload FROM entities WHERE id=? ORDER BY revision DESC LIMIT 1',(id,)).fetchone()
        if not row:raise KeyError(id)
        return json.loads(row[0])
    def resolve(self,r):
        row=self.db.execute('SELECT payload FROM entities WHERE id=? AND revision=?',(r['id'],r['revision'])).fetchone()
        if not row or ref(json.loads(row[0]))!=r:raise IntegrityConflict('unresolved exact Ref')
        return json.loads(row[0])
    def existing(self,kind,id,body,snapshot):
        proof={'entity':kind,'id':id,'snapshot_sha256':snapshot,'object_sha256':sha(body)}
        if 'version' in body:proof['version']=body['version']
        old=self.db.execute('SELECT body,proof FROM existing WHERE id=?',(id,)).fetchone()
        if old and old!=(canonical(body),canonical(proof)):raise IntegrityConflict('existing object collision')
        self.db.execute('INSERT OR IGNORE INTO existing VALUES(?,?,?,?)',(id,kind,canonical(body),canonical(proof)))
        return proof
    def relation(self,kind,participants,direction,parameters=None,sense_scope=None,analysis_key='unresolved'):
        if kind not in TYPES:raise ValueError('unregistered relation type')
        if len(participants)<2 or kind!='compounding' and len(participants)!=2:raise ValueError('wrong arity')
        state=direction['state'];slots={p['slot'] for p in participants}
        if len(slots)!=len(participants) or state not in {'directed','unknown','undirected'}:raise ValueError('invalid slots/direction')
        if state=='directed':
            a=set(direction['from_slots']);z=set(direction['to_slots'])
            if not a or not z or a&z or not (a|z)<=slots:raise ValueError('invalid directed slots')
        elif direction['from_slots'] or direction['to_slots']:raise ValueError('unknown direction cannot imply arrow')
        if state!='directed' and all(p['kind']=='lexeme' and 'role' not in p for p in participants):
            participants=[dict(p,slot='p'+str(i)) for i,p in enumerate(sorted(participants,key=lambda p:canonical(p['ref'])))]
        for p in participants:
            if p['kind'] in {'lexeme','sense'}:self.resolve(p['ref'])
            elif p['kind']=='form':self.resolve(p['form']['owner_lexeme_ref'])
            elif p['kind'] in {'head','allomorph'}:
                row=self.db.execute('SELECT proof FROM existing WHERE id=?',(p['ref']['id'],)).fetchone()
                if not row or json.loads(row[0])!=p['ref']:raise IntegrityConflict('unresolved existing endpoint')
            else:raise ValueError('unknown participant kind')
        if kind=='inflection':
            lex=[p for p in participants if p['kind']=='lexeme'];forms=[p for p in participants if p['kind']=='form']
            if len(lex)!=1 or len(forms)!=1 or lex[0]['ref']!=forms[0]['form']['owner_lexeme_ref']:raise ValueError('inflection owner mismatch')
        scope={'level':'formal_only' if kind=='surface_similarity' else 'whole_lexeme','analysis_key':analysis_key,
               'sense_scope':sense_scope or {'mode':'unresolved','sense_refs':[],'analysis_refs':[],'coverage_reason':'source sense identity unknown'}}
        body={'type_id':kind,'participants':participants,'direction':direction,'semantic_parameters':parameters or {},'analysis_scope':scope,'proposition_only':True}
        rid=key('relation',[kind,participants,direction,parameters or {},scope]);rr=self.put(envelope('Relation',rid,body))
        self.db.execute('INSERT OR IGNORE INTO relations VALUES(?,?,?,?)',(rid,kind,state,canonical(body)))
        endpoints={p['slot']:p['ref']['id'] for p in participants if p['kind']=='lexeme'}
        pairs=[(endpoints[a],endpoints[z]) for a in direction['from_slots'] for z in direction['to_slots'] if a in endpoints and z in endpoints] if state=='directed' else [(a,z) for a in endpoints.values() for z in endpoints.values() if a!=z]
        for a,z in pairs:self.db.execute('INSERT OR IGNORE INTO arcs VALUES(?,?,?)',(rid,a,z))
        return rr
    def add_support(self,r,e):
        self.resolve(r);self.resolve(e);self.db.execute('INSERT OR IGNORE INTO supports VALUES(?,?)',(r['id'],e['id']))
    def add_decision(self,family,language,word,status,proof,lemma=None,head=None,authority='prior_confirmed',reason=''):
        row=self.db.execute('SELECT proof FROM existing WHERE id=?',(proof.get('id'),)).fetchone()
        if proof.get('snapshot_sha256') not in self.trusted_snapshots or not row or json.loads(row[0])!=proof:raise ValueError('decision outside pinned registry')
        if authority not in {'prior_confirmed','manual_verified'} or authority=='manual_verified' and canonical(proof) not in self.trusted_manual_refs:raise ValueError('manual authority requires trusted grant Ref')
        if not family or not language or not word:raise ValueError('empty decision scope')
        id=key('decision',[family,language,word,lemma,head,status,proof])
        self.db.execute('INSERT OR IGNORE INTO decisions VALUES(?,?,?,?,?,?,?,?,?,?)',(id,family,language,lookup(word),lemma,head,status,authority,canonical(proof),reason))
    def resolve_family(self,q):
        return [r[0] for r in self.db.execute('SELECT DISTINCT family FROM aliases WHERE alias=? ORDER BY family',(lookup(q.removeprefix('family:')),))]
    def guard(self,family,language,word,lemma=None,heads=(),channel='direct'):
        if channel not in {'direct','alias','fallback','path'}:raise ValueError('unknown channel')
        fs=self.resolve_family(family)
        result={'establishes_membership':False,'blockers':[]}
        if len(fs)!=1:return dict(result,status='hold',reasons=['unknown_or_ambiguous_family'])
        family=fs[0];result['family_id']=family
        control=self.db.execute('SELECT status,proof FROM family_controls WHERE family=?',(family,)).fetchone()
        if control and control[0] in BLOCKING:return dict(result,status='blocked',blockers=[{'status':control[0],'ref':json.loads(control[1])}],reasons=['family_runtime_prohibition'])
        matches=[]
        for id,w,l,h,status,authority,proof,reason in self.db.execute('SELECT id,word,lemma,head,status,authority,proof,reason FROM decisions WHERE family=? AND language=? ORDER BY id',(family,language)):
            if w==lookup(word) or lemma and l==lemma or h and h in heads:
                matches.append({'id':id,'status':status,'authority':authority,'ref':json.loads(proof),'reason':reason,'exact_record':bool(lemma and l==lemma)})
        blocks=[m for m in matches if m['status'] in BLOCKING];manual=[m for m in blocks if m['authority']=='manual_verified'];positive=[m for m in matches if m['authority']=='manual_verified' and m['status']=='accepted']
        if positive and not manual:return dict(result,status='prior_record_only' if any(m['exact_record'] for m in positive) else 'hold',reasons=['finite_manual_permission_requires_identity'],manual_refs=[m['ref'] for m in positive])
        if blocks:return dict(result,status='blocked' if any(m['status'] in {'rejected','excluded','split_required','blocked_from_runtime'} for m in blocks) else 'hold',blockers=blocks,reasons=['manual_prohibition' if manual else 'existing_nonaccepted_decision'])
        known=[{'lemma_id':l,'head_id':h,'ref':json.loads(p)} for l,h,p in self.db.execute('SELECT lemma,head,proof FROM known WHERE family=? AND language=? AND word=? ORDER BY lemma,head',(family,language,lookup(word)))]
        return dict(result,status='prior_record_only' if known else 'proposal_only',known_records=known,reasons=['finite_existing_records_do_not_extend'])
    def review_relation(self,r,v,grants):
        rb=self.resolve(r)['body'];b=self.resolve(v)['body'];grant=b.get('authority',{}).get('authorization_ref')
        if canonical(grant) not in {canonical(g) for g in grants}:raise ValueError('untrusted grant')
        if b['subject']['domain']!='relation' or b['subject']['target_ref']!=r:raise ValueError('wrong review domain/scope')
        if b['status'] not in {'accepted','rejected','needs_review','split_required','insufficient_data'} or not b.get('basis_refs') or not b.get('dependency_lock') or not b.get('rationale'):raise ValueError('incomplete review')
        for basis in b['basis_refs']:
            if 'revision' in basis:self.resolve(basis)
        if b['status']=='accepted':
            scope=b['scope']['sense_scope']
            if scope['mode']!='exact' or not scope.get('sense_refs'):raise ValueError('exact reviewed sense identities required')
            senses=[self.resolve(s) for s in scope['sense_refs']]
            for s in senses:
                if s['entity']!='LexemeSense':raise ValueError('not a sense')
                self.resolve(s['body']['lexeme_ref']);self.resolve(s['body']['source_revision_ref'])
            if not {p['ref']['id'] for p in rb['participants'] if p['kind']=='lexeme'}<={s['body']['lexeme_ref']['id'] for s in senses}:raise ValueError('sense scope incomplete')
            if not self.db.execute('SELECT 1 FROM supports WHERE relation=?',(r['id'],)).fetchone() or rb['direction']['state']=='unknown':raise ValueError('missing evidence/direction')
            kind=rb['type_id'];params=rb['semantic_parameters']
            if kind=='compounding' and not params.get('recipe') or kind=='shared_base' and not params.get('base_ref'):raise ValueError('missing recipe/base')
            if kind=='ext:core:morphological_relatedness@1':raise ValueError('unclassified relatedness cannot be proof')
            if kind=='derivation_indirect':
                chain=[]
                for partref in params.get('asserted_path_refs',[]):
                    p=self.resolve(partref)['body'];review=self.db.execute('SELECT status FROM reviews WHERE relation=?',(partref['id'],)).fetchone()
                    if p['type_id']!='derivation_direct' or p['direction']['state']!='directed' or not review or review[0]!='accepted':raise ValueError('unreviewed indirect segment')
                    ep={x['slot']:x['ref'] for x in p['participants']};di=p['direction']
                    if len(di['from_slots'])!=1 or len(di['to_slots'])!=1:raise ValueError('nonlinear chain')
                    a=ep[di['from_slots'][0]];z=ep[di['to_slots'][0]]
                    if chain and chain[-1]!=a:raise ValueError('disconnected chain')
                    if not chain:chain.append(a)
                    chain.append(z)
                ep={x['slot']:x['ref'] for x in rb['participants']};di=rb['direction']
                if len(chain)<3 or len({n['id'] for n in chain})!=len(chain) or chain[1:-1]!=params.get('intermediate_refs') or chain[0]!=ep[di['from_slots'][0]] or chain[-1]!=ep[di['to_slots'][0]]:raise ValueError('indirect chain mismatch')
        old=self.db.execute('SELECT status,proof FROM reviews WHERE relation=?',(r['id'],)).fetchone()
        if old and old!=(b['status'],canonical(v)):
            self.db.execute('UPDATE reviews SET status=?,proof=? WHERE relation=?',('needs_review',canonical({'competing':[json.loads(old[1]),v]}),r['id']));self.commit();raise IntegrityConflict('competing reviews retained; effective hold')
        self.db.execute('INSERT OR IGNORE INTO reviews VALUES(?,?,?)',(r['id'],b['status'],canonical(v)))
    def classify(self,r,family=None,target=None):
        b=self.resolve(r)['body'];kind=b['type_id'];es=[ref(self.get(e)) for e, in self.db.execute('SELECT evidence FROM supports WHERE relation=? ORDER BY evidence',(r['id'],))]
        review=self.db.execute('SELECT status,proof FROM reviews WHERE relation=?',(r['id'],)).fetchone();guard=self.guard(family,*target,channel='path') if family and target else None
        accepted=bool(review and review[0]=='accepted' and es)
        if guard and guard['status']=='blocked':category='existing_decision_conflict';status='blocked'
        elif kind=='surface_similarity':category=kind;status='retrieval_only'
        elif kind=='inflection':category=kind;status='accepted_relation_only' if accepted else 'needs_review'
        elif accepted and kind in LABELS:category=kind;status='accepted_relation_only'
        else:category='insufficient_evidence';status='rejected' if review and review[0]=='rejected' else 'needs_review'
        return {'classification':category,'label':LABELS[category],'proposed_category':kind,'validation_status':status,'relation_ref':r,'evidence_refs':es,
                'verdict_ref':json.loads(review[1]) if review else None,'family_guard':guard,'uncertainties':[] if accepted else ['sense_identity_unresolved','source_claim_not_reviewed'],
                'explanation':'Source assertion, exact identity and review are separate. A relation/path does not imply membership.','establishes_membership':False}
    def paths(self,start,target=None,max_depth=3,max_paths=30,max_expansions=2000,include_uncertain=False,family=None):
        if not 0<=max_depth<=6 or not 1<=max_paths<=1000 or not 1<=max_expansions<=100000:raise ValueError('unbounded search')
        self.get(start);queue=deque([([start],[])]);found=[];blocked=[];expanded=0
        while queue and len(found)<max_paths and expanded<max_expansions:
            nodes,steps=queue.popleft();current=nodes[-1]
            if family:
                b=self.get(current)['body'];guard=self.guard(family,b['language'],b['lemma'],channel='path')
                if guard['status'] in {'blocked','hold'}:blocked.append({'node':current,'guard':guard});continue
            if steps and (target is None or current==target):found.append({'nodes':[ref(self.get(n)) for n in nodes],'steps':steps,'validation_status':'reviewed_relations_only' if all(s['confirmed'] for s in steps) else 'hypothesis_only','proposed_category':'derivation_indirect' if len(steps)>1 else steps[0]['type'],'establishes_membership':False})
            if len(steps)>=max_depth or current==target:continue
            for rid,dst in self.db.execute('SELECT relation,dst FROM arcs WHERE src=? ORDER BY relation,dst',(current,)):
                expanded+=1
                if expanded>max_expansions:break
                if dst in nodes:continue
                r=self.get(rid);b=r['body'];kind=b['type_id'];state=b['direction']['state']
                if kind in {'inflection','surface_similarity','orthographic_variant','allomorphy','etymological_relation','borrowing'}:continue
                if (state!='directed' or kind=='ext:core:morphological_relatedness@1') and not include_uncertain:continue
                review=self.db.execute('SELECT status FROM reviews WHERE relation=?',(rid,)).fetchone()
                if review and review[0]=='rejected':continue
                es=[ref(self.get(e)) for e, in self.db.execute('SELECT evidence FROM supports WHERE relation=? ORDER BY evidence',(rid,))]
                sources=[{k:self.resolve(e)['body'][k] for k in ['source_revision_ref','raw_locator','source_lineage']} for e in es]
                step={'relation_ref':ref(r),'type':kind,'direction':b['direction'],'from_node':current,'to_node':dst,'evidence_refs':es,'sources':sources,'component_only':kind=='compounding',
                      'confirmed':bool(review and review[0]=='accepted'),'uncertainties':[] if review and review[0]=='accepted' else ['source_claim_not_reviewed','sense_identity_unresolved']}
                queue.append((nodes+[dst],steps+[step]))
        return {'paths':found,'blocked_nodes':blocked,'expanded':expanded,'truncated':bool(queue) or expanded>max_expansions,'establishes_membership':False}
    def export(self,out):
        out=Path(out);out.mkdir(parents=True,exist_ok=True)
        with open(out/'entities.ndjson','w',encoding='utf-8') as f:
            for payload, in self.db.execute('SELECT payload FROM entities ORDER BY kind,id,revision'):f.write(payload+'\n')
        with open(out/'existing.ndjson','w',encoding='utf-8') as f:
            for body,proof in self.db.execute('SELECT body,proof FROM existing ORDER BY kind,id'):f.write('{"body":'+body+',"ref":'+proof+'}\n')
        for table,(_,cols) in TABLES.items():
            with open(out/(table+'.ndjson'),'w',encoding='utf-8') as f:
                for row in self.db.execute('SELECT '+','.join(cols)+' FROM '+table+' ORDER BY '+','.join(cols)):f.write(canonical(list(row))+'\n')
    @classmethod
    def open_snapshot(cls,directory,db_path=':memory:',expected_manifest_sha256=None):
        directory=Path(directory);mp=directory/'GRAPH-MANIFEST.json';m=json.loads(mp.read_text())
        if expected_manifest_sha256 and file_hash(mp)!=expected_manifest_sha256:raise IntegrityConflict('manifest checksum')
        if sha(m['identity'])!=m['build_id']:raise IntegrityConflict('build identity')
        for name,h in m['outputs'].items():
            p=(directory/name).resolve()
            if p.parent!=directory.resolve() or file_hash(p)!=h:raise IntegrityConflict('output checksum')
        g=cls(db_path)
        try:
            for x in json_rows(directory/'entities.ndjson'):g.put(x)
            for x in json_rows(directory/'existing.ndjson'):
                r=x['ref']
                if g.existing(r['entity'],r['id'],x['body'],r['snapshot_sha256'])!=r:raise IntegrityConflict('existing ref mismatch')
            for table,(_,cols) in TABLES.items():
                for x in json_rows(directory/(table+'.ndjson')):g.db.execute('INSERT INTO '+table+' VALUES('+','.join('?' for _ in cols)+')',x)
            for payload, in g.db.execute("SELECT payload FROM entities WHERE kind='Relation'"):
                r=json.loads(payload);b=r['body'];g.db.execute('INSERT INTO relations VALUES(?,?,?,?)',(r['id'],b['type_id'],b['direction']['state'],canonical(b)))
            g.commit();return g
        except BaseException:g.close();raise

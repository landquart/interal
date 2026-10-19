"""Freeze real, unannotated membership questions before evaluating predictions."""
import argparse
from gold import new_release_directory
from collections import Counter,defaultdict
import json
import tempfile
from pathlib import Path
from gold import canonical,sha,file_hash,case_hash,validate_cases,assignments
from prepare_inputs import ROOTS
from graph import Graph,lookup,ref

SEED='interal-phase06-preregistered-1'
LANGS=['en','de','fr','es','it','ru']

def make_case(family,language,lemma,lexeme_id,origin,record,head=None,pos=None,tags=()):
    identity=[family,language,lexeme_id]
    cid='pilot-case:'+sha(identity)
    return {'schema':'pilot-case/1','id':cid,'family':family,'language':language,
      'target':{'lemma':lemma,'lexeme_id':lexeme_id,'pos_observed':pos,'sense_scope':'unresolved','head_id':head},
      'origin':origin,'hypothesis_tags_not_gold':list(tags),'provenance':[record],'gold_status':'unannotated'}

def sample(snapshot,graph,output,per_cell=20):
    if not 14<=per_cell<=27:raise ValueError('pilot size 1008..1944 target slots')
    output=new_release_directory(output);s=json.loads(Path(snapshot).read_text());work=tempfile.TemporaryDirectory(prefix="pilot-sampling-");g=Graph.open_snapshot(graph,Path(work.name)/"graph.sqlite");snapshot_hash=file_hash(snapshot);graph_hash=file_hash(Path(graph)/'GRAPH-MANIFEST.json')
    pool={};members={};bylookup=defaultdict(list)
    def add(c):
        if c['id'] in pool:
            old=pool[c['id']];old['provenance'].extend(p for p in c['provenance'] if p not in old['provenance'])
            old['hypothesis_tags_not_gold']=sorted(set(old['hypothesis_tags_not_gold'])|set(c['hypothesis_tags_not_gold']))
            if c['origin']=='prior_decision_requires_audit':old['origin']=c['origin']
        else:pool[c['id']]=c
    for m in s['memberships']:
        proof={'kind':'existing_membership_not_gold','snapshot_sha256':snapshot_hash,'object_sha256':sha(m),'object':m}
        c=make_case(m['family_id'],m['language'],m['word'],m['lemma_id'],'project_record',proof,m['head_id']);add(c)
        members[(m['family_id'],m['language'],lookup(m['word']))]=m;bylookup[(m['language'],lookup(m['word']))].append(m)
    for c in s['corrections']:
        add(make_case(c['family_id'],c['language'],c['word'],c['lemma_id'],'prior_decision_requires_audit',{'kind':'current_correction_not_gold','snapshot_sha256':snapshot_hash,'object_sha256':sha(c),'object':c},tags=['negative_or_uncertain_prior_decision']))
    for h in s['heads']:
        # Finite historical evidence is retained as prior decisions, never certified by status alone.
        for e in h.get('evidence',[]):
            if not isinstance(e,dict) or not e.get('word') or not e.get('lemma_id') or not e.get('root'):continue
            family='family:'+e['root']
            if family not in {'family:'+r for r in ROOTS}:continue
            add(make_case(family,e.get('language',h['language']),e['word'],e['lemma_id'],'prior_decision_requires_audit',{'kind':'historical_evidence_not_gold','snapshot_sha256':snapshot_hash,'head_id':h['id'],'object_sha256':sha(e),'object':e},h['id'],tags=['historical_analysis_requires_audit']))
    # Finite morphology from actual project correspondences, source-native lexemes never merged by spelling.
    external_counts=Counter()
    for family in ['family:'+r for r in ROOTS]:
        starts=defaultdict(set)
        for (fam,lang,word),m in members.items():
            if fam!=family:continue
            for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(lang,word)):starts[lang].add(lid)
        for language,ids in sorted(starts.items()):
            for lid in sorted(ids,key=lambda x:sha([SEED,x]))[:8]:
                paths=g.paths(lid,max_depth=2,max_paths=12,max_expansions=150,include_uncertain=True) # diagnostic pool includes negative cases; no membership guard bypass into production
                for path in paths['paths']:
                    t=g.resolve(path['nodes'][-1]);b=t['body'];tags=sorted({step['type'] for step in path['steps']})
                    add(make_case(family,b['language'],b['lemma'],t['id'],'external_path',{'kind':'source_hypothesis_not_gold','graph_manifest_sha256':graph_hash,'path':path},pos=b['pos'],tags=tags));external_counts[family]+=1
    g.close();work.cleanup();cells=defaultdict(list)
    for c in pool.values():cells[(c['family'],c['language'])].append(c)
    chosen=[];coverage=[]
    for family in ['family:'+r for r in ROOTS]:
        for language in LANGS:
            buckets=defaultdict(list)
            for c in cells[(family,language)]:buckets[c['origin']].append(c)
            for v in buckets.values():v.sort(key=lambda c:sha([SEED,c['id']]))
            selected=[];order=['prior_decision_requires_audit','project_record','external_path']
            while len(selected)<per_cell and any(buckets.values()):
                for k in order:
                    if buckets[k] and len(selected)<per_cell:selected.append(buckets[k].pop(0))
            chosen.extend(selected);coverage.append({'family':family,'language':language,'target':per_cell,'available':len(cells[(family,language)]),'selected':len(selected),'shortfall':max(0,per_cell-len(selected))})
    # Conservative leakage grouping: same spelling is grouped for splitting ONLY, never lexical identity.
    parent={}
    def find(k):
        parent.setdefault(k,k)
        while parent[k]!=k:parent[k]=parent[parent[k]];k=parent[k]
        return k
    def union(a,b):
        x,y=find(a),find(b)
        if x!=y:parent[max(x,y)]=min(x,y)
    for c in chosen:
        word='split-spelling:'+canonical([c['language'],lookup(c['target']['lemma'])]);identity='split-lexeme:'+c['target']['lexeme_id'];union(word,identity)
        if c['target']['head_id']:union(identity,'split-head:'+c['target']['head_id'])
    for c in chosen:
        group='group:'+sha(find('split-lexeme:'+c['target']['lexeme_id']));c['leakage_group']=group;c['split']='development' if int(sha([SEED,group])[:8],16)%5==0 else 'evaluation'
        c['double_review']=c['origin']=='prior_decision_requires_audit' or int(sha([SEED,c['id']])[:8],16)%5==0
        c['content_sha256']=case_hash(c)
    chosen.sort(key=lambda c:c['id']);validate_cases(chosen)
    with open(output/'cases.ndjson','w') as f:
        for c in chosen:f.write(canonical(c)+'\n')
    with open(output/'annotation-tasks.ndjson','w') as f:
        for c in assignments(chosen):f.write(canonical(c)+'\n')
    (output/'raters.json').write_text('{}\n');(output/'judgments.ndjson').write_text('');(output/'adjudications.ndjson').write_text('')
    manifest={'schema':'pilot-sampling/1','seed':SEED,'target':12*6*per_cell,'actual':len(chosen),'case_set_sha256':sha(chosen),'cases_file_sha256':file_hash(output/'cases.ndjson'),
      'registry_sha256':snapshot_hash,'graph_manifest_sha256':graph_hash,'code_sha256':file_hash(__file__),'annotation_contract_sha256':file_hash(Path(__file__).with_name('gold.py')),
      'coverage':coverage,'origins':dict(Counter(c['origin'] for c in chosen)),'splits':dict(Counter(c['split'] for c in chosen)),
      'double_review_cases':sum(c['double_review'] for c in chosen),'external_pool_path_observations':dict(external_counts),'verified_human_labels':0,'automatic_labels_are_gold':False}
    (output/'SAMPLING-MANIFEST.json').write_text(canonical(manifest)+'\n')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['registry','graph','output']:p.add_argument('--'+n,required=True)
    p.add_argument('--per-cell',type=int,default=20);a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('output outside checkout')
    sample(a.registry,a.graph,a.output,a.per_cell)

"""Bounded deterministic pilot views, competing analyses and review tasks."""
from collections import Counter,defaultdict
import json
from graph import canonical,envelope,ref,key,sha,lookup

def report(g,snapshot,out):
    alignments=defaultdict(list)
    for payload, in g.db.execute("SELECT payload FROM entities WHERE kind='CorpusAlignment' ORDER BY id"):
        a=json.loads(payload);alignments[a['body']['extensions']['family_id']].append(a)
    roots=[]
    for name in ['OCUL','PEDE','ALTER','REGUL','CREAT','NAT','INTER']:
        fs=g.resolve_family(name);fid=fs[0] if len(fs)==1 else None;aa=alignments[fid]
        ids={e['head_id'] for e in snapshot['edges'] if e['family_id']==fid};heads=[h for h in snapshot['heads'] if h['id'] in ids]
        starts=sorted({a['body']['source_lexeme_ref']['id'] for a in aa},key=lambda id:(not bool(g.db.execute('SELECT 1 FROM arcs WHERE src=? LIMIT 1',(id,)).fetchone()),g.get(id)['body']['source_id']!='source:uder',id))
        searches=[];validations=[]
        for id in starts[:12]:
            q=g.paths(id,max_depth=3,max_paths=8,max_expansions=200,family=fid)
            if q['paths'] or q['blocked_nodes']:searches.append({'start':ref(g.get(id)),**q})
        for id in starts[:5]:
            b=g.get(id)['body']
            for rid, in g.db.execute('SELECT DISTINCT relation FROM arcs WHERE src=? ORDER BY relation LIMIT 3',(id,)):validations.append(g.classify(ref(g.get(rid)),fid,(b['language'],b['lemma'])))
        negatives=[]
        for language,word,lemma,head in g.db.execute("SELECT language,word,lemma,head FROM decisions WHERE family=? AND status!='accepted' ORDER BY id LIMIT 8",(fid,)):
            negatives.append({'language':language,'word':word,'lemma_id':lemma,'channels':{c:g.guard(fid,language,word,lemma,[head] if head else [],c) for c in ['direct','alias','fallback','path']}})
        roots.append({'requested_root':name,'family_id':fid,'existing_heads':len(heads),'reviewed_nonlegacy_heads':sum(h['identity_kind']!='legacy_exact_record' for h in heads),
          'known_finite_links':sum(l['family_id']==fid for l in snapshot['links']),'alignments':len(aa),'languages':dict(Counter(g.get(a['body']['source_lexeme_ref']['id'])['body']['language'] for a in aa)),
          'pos_checks':dict(Counter(a['body']['extensions']['pos_check'] for a in aa)),'sense_checks':dict(Counter(a['body']['extensions']['sense_check'] for a in aa)),
          'blocked_alignments':sum(a['body']['extensions']['guard']['status'] in {'hold','blocked'} for a in aa),'search_start_limit':12,
          'path_queries':searches,'negative_probes':negatives,'relation_validations':validations,'establishes_membership':False})
    (out/'PILOT-RESULTS.json').write_text(canonical({'roots':roots,'establishes_membership':False})+'\n',encoding='utf-8')
    groups=defaultdict(list)
    for rid,kind,direction,payload in g.db.execute('SELECT id,type,direction,body FROM relations ORDER BY id'):
        if kind=='inflection':continue
        b=json.loads(payload);ps=b['participants']
        if len(ps)!=2 or any(p['kind']!='lexeme' for p in ps):continue
        lex=[g.get(p['ref']['id'])['body'] for p in ps]
        if lex[0]['language']!=lex[1]['language']:continue
        forms=[[lookup(l['lemma']),l['pos']] for l in lex];group=sha([lex[0]['language'],sorted(forms,key=canonical)]);evidence=[]
        for eid, in g.db.execute('SELECT evidence FROM supports WHERE relation=? ORDER BY evidence',(rid,)):
            e=g.get(eid);eb=e['body'];s=g.resolve(eb['source_revision_ref'])['body']
            evidence.append({'evidence_ref':ref(e),'source':s['source_id'],'source_revision_ref':eb['source_revision_ref'],'raw_locator':eb['raw_locator'],'raw_fields':eb['extensions']['raw_fields']})
        groups[group].append({'relation_ref':ref(g.get(rid)),'language':lex[0]['language'],'type':kind,'direction':direction,'ordered_forms':forms,'parameters':b['semantic_parameters'],'evidence':evidence})
    conflicts=[];other=0
    for group,analyses in sorted(groups.items()):
        if len({e['source'] for a in analyses for e in a['evidence']})<2:continue
        directed=[a for a in analyses if a['direction']=='directed'];kinds=[]
        if any(a['ordered_forms']==list(reversed(b['ordered_forms'])) and a['ordered_forms'][0]!=a['ordered_forms'][1] and {e['source'] for e in a['evidence']}!={e['source'] for e in b['evidence']} for a in directed for b in directed):kinds.append('opposed_direction_at_lemma_pos_lookup')
        if len({a['type'] for a in analyses}-{'ext:core:morphological_relatedness@1'})>1:kinds.append('different_process_types')
        if len({canonical(a['parameters']['segmentation']) for a in analyses if a['parameters'].get('segmentation')})>1:kinds.append('different_source_segmentations')
        if not kinds:other+=1;continue
        conflicts.append({'comparison_key':group,'kinds':kinds,'analyses':analyses,'status':'needs_review','lexical_identity_established':False,'contradiction_established':False,
          'explanation':'Opposing source analyses at the same lemma/POS lookup; exact homonym/sense identity remains unresolved.'})
        task={'subject':{'domain':'relation_analysis','key':group},'scope':{'language':analyses[0]['language'],'identity':'unresolved'},'question_type':'competing_source_analyses',
          'trigger_refs':[a['relation_ref'] for a in analyses],'blockers':['external_identity_review_missing'],'queue_state':'open','priority_components':{'analyses':len(analyses)},'input_manifest_ref':{'v6_files_sha256':sha(snapshot['files'])}}
        g.put(envelope('ReviewTask','review-task:'+group,task))
    (out/'SOURCE-CONFLICTS.json').write_text(canonical({'potential_conflicts':conflicts,'underspecified_or_compatible_overlap_groups':other,'establishes_membership':False})+'\n',encoding='utf-8')

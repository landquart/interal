#!/usr/bin/env python3
"""Routing coverage, never linguistic recall or membership certification."""
import gzip, hashlib, json, sys, unicodedata
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv)>1 else 'audit/associative-family-v6/prompt08-coverage-20261005/research-coverage')
OUT.mkdir(parents=True, exist_ok=True)
locks, artifacts = {}, {}
def digest(b): return hashlib.sha256(b).hexdigest()
def encoded(x): return (json.dumps(x, ensure_ascii=False, separators=(',', ':'), sort_keys=True)+'\n').encode()
def read(p):
    p=Path(p); b=p.read_bytes(); locks[str(p)]=digest(b)
    return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
def write(name,x):
    b=encoded(x)
    if name.endswith('.gz'): b=gzip.compress(b, compresslevel=9, mtime=0)
    (OUT/name).write_bytes(b); artifacts[name]=digest(b)
def norm(x): return unicodedata.normalize('NFC',x).lower()
packets=read('audit/associative-family-v6/candidate-root-clusters-20261003/clusters.json.gz')
packet_links=read('audit/associative-family-v6/candidate-root-clusters-20261003/candidate-links.json.gz')
node_packet={}; packet_map={p['candidate_cluster_id']:p for p in packets}
transitive=[]
for p in packets:
    ids=p['evidence_cluster_ids']; assert len(set(ids))==len(ids)
    assert p['canonical_decision'] is None and p['associative_family_id'] is None
    for id in ids: assert id not in node_packet; node_packet[id]=p['candidate_cluster_id']
    graph={id:set() for id in ids}
    for e in p['grouping_signal_edges']:
        if e['candidate_grouping_authorized']:
            assert e['shared_proposed_bases'] and e['shared_declared_source_terms']
            assert not e['linguistic_identity_established'] and not e['family_merge_authorized']
            graph[e['left']].add(e['right']); graph[e['right']].add(e['left'])
    visited=set(); todo=[ids[0]]
    while todo:
        id=todo.pop()
        if id not in visited: visited.add(id); todo.extend(graph[id]-visited)
    assert visited==set(ids)
    ns={n['id']:n for n in p['evidence_clusters']}
    for i,a in enumerate(ids):
        for b in ids[i+1:]:
            direct=bool(set(ns[a]['proposed_bases'])&set(ns[b]['proposed_bases']) and set(ns[a]['declared_source_terms'])&set(ns[b]['declared_source_terms']))
            if not direct: transitive.append({'packet_id':p['candidate_cluster_id'],'left':a,'right':b,'linguistic_identity_established':False})
assert len(node_packet)==20755 and len(packets)==16055
metadata={}
surface_candidates=0
for file in sorted(Path('associativvordes/family-index-v5/families').glob('*.gz')):
    rows=read(file)
    for id,f in rows.items():
        if id.startswith('ety:'): metadata[id]=f
        elif id.startswith('surface:'): surface_candidates+=1
assert set(metadata)==set(node_packet) and surface_candidates==2435769
for p in packets:
    for n in p['evidence_clusters']:
        f=metadata[n['id']]
        assert sorted(k for k,v in f['language_support'].items() if v>0)==n['languages']
        assert sorted(set(e['sourceLang']+':'+norm(e['term']) for e in f.get('relation_evidence',[]) if e.get('sourceLang') and e.get('term')))==n['declared_source_terms']
heads=read('audit/associative-family-v6/prompt08-coverage-20261005/research-inputs/heads.json.gz')
links=read('audit/associative-family-v6/prompt08-coverage-20261005/research-inputs/lemma-head-links.json.gz')
corpus=read('audit/associative-family-v6/corpus-enumeration.json')
selected={'en':{'atom','atoms','atomic','anatomy','particle','system','splinter','off-season'},'de':{'atom','atombombe','atomar','system','systeme','tennis-profi'},'ru':{'атом','частица','состав','загс'},'it':{'attimo','atomo','mente'},'fr':{'atome','ennuyeux'},'es':{'átomo','óseo','zapote'}}
for h in heads:
    if h['identity_kind']=='lexical_head': selected[h['language']].add(h['normalized_head'])
coverage={}; exact=[]; samples=[]; bound_coverage=[]; route_sets={id:set() for id in node_packet}; distributions={id:{} for id in node_packet}
for language in ['de','en','es','fr','it','ru']:
    root=Path('associativvordes/family-index-v5/members')/language
    ety,surface,allids=set(),set(),set(); occurrences={'ety':0,'surface':0,'other':0}
    for file in sorted(root.glob('*.gz')):
        for route,rows in read(file).items():
            kind='ety' if route.startswith('ety:') else 'surface' if route.startswith('surface:') else 'other'
            assert len({r['lemma_id'] for r in rows})==len(rows)
            occurrences[kind]+=len(rows)
            ids={r['lemma_id'] for r in rows}; allids.update(ids)
            if kind=='ety':
                assert route in node_packet; ety.update(ids);route_sets[route].update(language+'\0'+id for id in ids);distributions[route][language]=len(rows)
            if kind=='surface':surface.update(ids)
    only=surface-ety; other=allids-(surface|ety)
    expected=corpus['languages'][language];assert len(allids)==expected['materialized_ids']
    sample_by_id={}; chosen=[]; exact_by_id={}
    # A deterministic, bounded rank sample plus independent already-proved heads.
    for file in sorted(root.glob('*.gz')):
        for route,rows in read(file).items():
            for r in rows:
                id=r['lemma_id']
                is_selected=r['word'] in selected[language]
                eligible=id in only and route.startswith('surface:') and r['word'].replace('-','').isalpha() and len(r['word'])>=4
                key=(r.get('rank',10**12),id)
                enters_sample=eligible and id not in sample_by_id and (len(sample_by_id)<100 or key<max(sample_by_id.values(),key=lambda a:a[0])[0])
                if not is_selected and not enters_sample:continue
                rec={'language':language,'lemma_id':id,'word':r['word'],'source_locator':{'path':str(file),'family_id':route,'snapshot_sha256_python_compact':digest(json.dumps(r,ensure_ascii=False,separators=(',',':')).encode())},'source_record':r,'packet_id':node_packet.get(route),'ety_packet_covered':id in ety,'surface_only':id in only}
                if is_selected:
                    exact_by_id.setdefault(id,[]).append(rec)
                if enters_sample:
                    sample_by_id[id]=(key,rec)
                    if len(sample_by_id)>100:del sample_by_id[max(sample_by_id,key=lambda id:sample_by_id[id][0])]
    exact.extend(v for rows in exact_by_id.values() for v in rows)
    samples.extend(v[1] for v in sorted(sample_by_id.values(),key=lambda x:x[0]))
    for l in links:
        if l['language']==language: bound_coverage.append({'language':language,'lemma_id':l['lemma_id'],'head_id':l['head_id'],'family_id':l['family_id'],'link_role':l.get('link_role'),'ety_packet_covered':l['lemma_id'] in ety,'surface_only':l['lemma_id'] in only,'source_locator':l['evidence'][0]['source']})
    coverage[language]={'materialized_unique_ids':len(allids),'ety_packet_unique_ids':len(ety),'surface_route_unique_ids':len(surface),'surface_only_unique_ids':len(only),'other_only_unique_ids':len(other),'ety_surface_overlap':len(ety&surface),'original_occurrences':occurrences,'zero_v5_membership':expected['without_v5_membership'],'rank_sample':len(sample_by_id)}
    write('coverage-ids-'+language+'.json.gz',{k:{'count':len(v),'ordered_ids_sha256':digest(encoded(sorted(v)))} for k,v in {'ety_packet_ids':ety,'surface_only_ids':only,'other_only_ids':other}.items()})
    print(language,json.dumps(coverage[language]),flush=True)
duplicates=[]
for e in packet_links:
    if e.get('exact_duplicate_member_set_sha256'):
        a,b=route_sets[e['left']],route_sets[e['right']]; assert a==b
        duplicates.append({'left':e['left'],'right':e['right'],'unique_ids':len(a),'language_distribution':distributions[e['left']],'saved_exact_set_hash':e['exact_duplicate_member_set_sha256'],'routes_retained_separately':True})
assert len(duplicates)==4904
for id,f in metadata.items(): assert {k:v for k,v in f['language_support'].items() if v}==distributions[id]
zero=[]
for r in corpus['zero_membership_source_records']:
    word=r['word']; tags=[]
    if '-' in word:tags.append('hyphenated_component_question')
    if len(word)<=3:tags.append('short_form_needs_identity')
    if not word.replace('-','').isalpha():tags.append('encoding_or_symbol_question')
    if not tags:tags.append('full_word_needs_dictionary')
    zero.append({**r,'triage_tags':tags,'state':'unreviewed','membership_authorized':False,'low_priority_is_not_exclusion':True})
write('zero-v5-triage.json.gz',zero)
write('surface-only-rank-sample.json.gz',samples)
write('selected-exact-routes.json.gz',exact)
write('proved-bindings-routing-coverage.json.gz',bound_coverage)
selected_packets=[p for p in packets if set(p['proposed_bases'])&{'atom','anis','tower','system','sistem'}]
write('selected-packet-scopes.json.gz',[{'packet_id':p['candidate_cluster_id'],'packet_snapshot_sha256_python_compact':digest(encoded(p)),'routes':[{"route_id":id,"corpus_keys":sorted(route_sets[id])} for id in p['evidence_cluster_ids']]} for p in selected_packets])
write('packet-routing-audit.json.gz',{'transitive_pairs_without_direct_shared_signal':transitive,'exact_duplicate_routes':duplicates,'packet_language_distribution':{str(n):sum(len(p['languages'])==n for p in packets) for n in range(1,7)},'actual_route_distribution':distributions})
write('coverage-report.json',{'schema_version':6,'production_enabled':False,'linguistic_recall_measured':False,'surface_candidates':surface_candidates,'etymological_clusters':len(node_packet),'packets':len(packets),'languages':coverage,'source_ids':sum(v['materialized_unique_ids']+v['zero_v5_membership'] for v in coverage.values()),'surface_only_unique_ids':sum(v['surface_only_unique_ids'] for v in coverage.values()),'ety_packet_unique_ids':sum(v['ety_packet_unique_ids'] for v in coverage.values()),'zero_v5_membership':len(zero),'proved_finite_bindings_without_ety_packet':sum(not v['ety_packet_covered'] for v in bound_coverage),'transitive_pairs_without_direct_signal':len(transitive),'sample_policy':'Per language: lowest (unchanged rank, lemma_id) 100 distinct surface-only alphabetic/hyphenated words of length >=4. Review priority only; exact selected heads/components are a separate census.','limitations':['No gold linguistic head/component inventory: routing coverage is measurable, true-family recall is not.','Rank/form sample is not representative statistical inference or a membership rule.','Surface candidates remain retrieval containers; low rank/short/spelling scores never permanently remove a candidate.','Unobserved heads/components and zero-v5 membership need independent dictionaries and frequency locators; no synthetic aggregate scores.']})
write('input-lock.json',locks)
write('manifest.json',{'schema_version':6,'artifacts':dict(artifacts),'script_sha256':digest(Path(__file__).read_bytes()),'full_dictionary_complete':False})

"""Independent audit controls, not functional code or linguistic gold.
Run with --out outside repository. FAIL observations deliberately remain visible.
"""
import argparse, base64, gzip, hashlib, json, sys, tempfile, time, resource
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
for d in ['evidence_graph','candidate_search','pilot_evaluation','importers']:
    sys.path.insert(0,str(ROOT/'associativvordes'/d))
from graph import Graph,envelope,key,sha,canonical,file_hash
from search import Queue,enqueue_reverse,match_real_lexeme
from run import predictions_from_sources,capture_baseline
from gold import compile_gold,validate_cases,new_release_directory
from morphology_import import run as import_run
from build_graph import build
R=[]
def check(name,expected,actual,detail=None):
    R.append({'check':name,'status':'PASS' if actual==expected else 'FAIL','expected':expected,'actual':actual,'detail':detail})
def graph():
    g=Graph();s=g.put(envelope('SourceRevision','fixture:source',{'source_id':'source:uder','release_label':'fixture-only','canonical_url':'https://example.invalid','artifacts':[],'native_key_policy':'fixture','license_records':[],'lineage_declarations':[],'availability_status':'fixture','registration_status':'fixture','acquisition_receipt_ref':None}))
    for a in ['pilot','alias']:g.db.execute('INSERT INTO aliases VALUES(?,?)',(a,'family:pilot'))
    return g,s

def lex(g,s,id,word,lang='en',pos='NOUN'):
    return g.put(envelope('Lexeme',id,{'source_id':'source:uder','source_revision_ref':s,'native_lexeme_key':id,'native_key_policy':'fixture','language':lang,'lemma':word,'pos':pos,'identity_resolution':'unresolved','origin_evidence_refs':[]}))

def rel(g,s,a,b,kind='derivation_direct',params=None):
    r=g.relation(kind,[{'slot':'a','kind':'lexeme','ref':a},{'slot':'b','kind':'lexeme','ref':b}],{'state':'directed','from_slots':['a'],'to_slots':['b']},params)
    e=g.put(envelope('Evidence',key('fixture:evidence',r),{'source_revision_ref':s,'raw_locator':{'fixture_only':True},'raw_record_sha256':'0'*64,'evidence_kind':'algorithmic_hypothesis','related_lexeme_refs':[a,b],'interpretations':[{'relation_ref':r,'stance':'supports'}],'source_lineage':{'fixture_only':True},'extraction':{},'initial_status':'needs_review','rationale':'Independent adversarial control, never corpus or gold.'}))
    g.add_support(r,e);return r

def main():
    g,s=graph();a=lex(g,s,'a','start');b=lex(g,s,'b','bank');b2=lex(g,s,'b2','bank');z=lex(g,s,'z','end');rel(g,s,a,b);rel(g,s,b2,z)
    check('homonym_no_bridge',0,len(g.paths('a','z')['paths']))
    rel(g,s,a,z,'surface_similarity');check('formal_similarity_not_bridge',0,len(g.paths('a','z')['paths']));g.close()
    g,s=graph();a=lex(g,s,'a','start');b=lex(g,s,'b','middle');z=lex(g,s,'z','end');rel(g,s,a,b);rel(g,s,b,z);p=g.paths('a','z')['paths'][0]
    check('indirect_keeps_intermediates',['a','b','z'],[n['id'] for n in p['nodes']]);check('path_not_membership',False,p['establishes_membership']);check('missing_link_not_skipped',0,len(g.paths('a','z',max_depth=1)['paths']));g.close()
    g,s=graph();a=lex(g,s,'a','start');b=lex(g,s,'b','compound');z=lex(g,s,'z','derived');rel(g,s,a,b,'compounding');rel(g,s,b,z);p=g.paths('a','z')['paths'][0]
    check('IV004_mixed_chain_not_indirect',False,p['proposed_category']=='derivation_indirect',p);check('compound_scope_preserved',True,p['steps'][0]['component_only']);g.close()
    g,s=graph();a=lex(g,s,'a','enword');z=lex(g,s,'z','dewort','de');rel(g,s,a,z);p=g.paths('a','z')['paths'];check('IV003_cross_language_requires_proof',0,len(p),p);g.close()
    g,s=graph();a=lex(g,s,'a','start');z=lex(g,s,'z','prohibited');rel(g,s,a,z)
    snapshot='1'*64;g.trusted_snapshots.add(snapshot);proof=g.existing('ManualDecision','fixture:negative',{'word':'prohibited','status':'rejected'},snapshot);g.trusted_manual_refs.add(canonical(proof));g.add_decision('family:pilot','en','prohibited','rejected',proof,authority='manual_verified',reason='Fixture-only prohibition')
    for channel in ['direct','alias','fallback','path']:check('negative_'+channel,'blocked',g.guard('alias','en','prohibited',channel=channel)['status'])
    check('negative_forward_path',0,len(g.paths('a','z',family='alias')['paths']))
    with tempfile.TemporaryDirectory() as d:
        q=Queue(Path(d)/'queue.sqlite');obs=json.dumps({'word':'prohibited','rank':123},sort_keys=True);f=[{'language':'en','record_json':obs,'record_sha256':sha(obs),'locators':[{'fixture_only':True}]}];enqueue_reverse(g,q,f);rows=list(q.rows());bad=[r for r in rows if r['review_state']=='open' and not r['previous_decisions']]
        check('IV002_reverse_surfaces_family_prohibition',0,len(bad),rows)
        cid=rows[0]['id'];q.decide(cid,'rejected','Independent fixture rejection','fixture-reviewer');enqueue_reverse(g,q,f);again=list(q.rows());check('reverse_own_history_persists','rejected',again[0]['review_state']);check('repeat_no_duplicate',1,len(again));q.close()
    g.close()
    g,s=graph();a=lex(g,s,'a','base');b=lex(g,s,'b','variant');g.db.execute('INSERT INTO aliases VALUES(?,?)',('alias','family:other'));check('ambiguous_family_alias_hold','hold',g.guard('alias','en','base')['status'])
    r1=rel(g,s,a,b,'allomorphy',{'analysis':'one'});r2=rel(g,s,a,b,'allomorphy',{'analysis':'two'});check('competing_allomorphs_retained',True,r1['id']!=r2['id']);check('allomorph_not_bridge',0,len(g.paths('a','b')['paths']));check('language_scoped_lookup','no_match',match_real_lexeme(g,'a','pilot','de','base')['kind']);g.close()
    g,s=graph();a=lex(g,s,'a','start');n=lex(g,s,'noun','bank');v=lex(g,s,'verb','bank',pos='VERB');rel(g,s,a,n);g.db.execute('INSERT INTO known VALUES(?,?,?,?,?,?)',('family:pilot','en','start','corpus:start','head:start','{}'))
    cases=[{'id':'case:'+id,'content_sha256':id,'family':'family:pilot','language':'en','target':{'lemma':'bank','lexeme_id':id,'pos_observed':pos,'head_id':'head:'+id}} for id,pos in [('noun','NOUN'),('verb','VERB')]]
    predictions,_=predictions_from_sources(g,cases,['uder']);check('IV001_prediction_not_copied_to_homonym','abstain',predictions[1]['decision'],predictions);check('no_automatic_allomorph','formal_similarity',match_real_lexeme(g,'noun','pilot','en','banks')['kind']);g.close()
    base=ROOT/'audit/associative-external-preparation/pilot-validation'
    with gzip.open(base/'CASES.ndjson.gz','rt') as f:cases=[json.loads(x) for x in f]
    validate_cases(cases);gold=compile_gold(cases,[],{});check('real_cases_no_automatic_gold',len(cases),gold['counts']['unannotated'])
    try:compile_gold(cases,[{'case_id':cases[0]['id'],'case_content_sha256':cases[0]['content_sha256'],'mode':'model'}],{})
    except ValueError:check('model_label_rejected',True,True)
    else:check('model_label_rejected',True,False)
    with tempfile.TemporaryDirectory() as d:
        p=Path(d);(p/'human.json').write_text('preserve')
        try:new_release_directory(p)
        except FileExistsError:check('manual_release_not_overwritten','preserve',(p/'human.json').read_text())
        else:check('manual_release_not_overwritten',True,False)
    check('missing_baseline_not_imputed','actual_algorithm_capture_missing',capture_baseline(None,cases)[1])
    replay={};start=time.perf_counter()
    with tempfile.TemporaryDirectory(prefix='verify08-replay-') as d:
        work=Path(d);imp=ROOT/'associativvordes/importers/fixtures';gf=ROOT/'associativvordes/evidence_graph/fixtures';source=ROOT/'data/morphology-evidence/sources/source-lock.json'
        aa=import_run(imp/'source-lock.json',imp,work/'ia');bb=import_run(imp/'source-lock.json',imp,work/'ib')
        fixture_lock=json.loads((imp/'source-lock.json').read_text());inputs={a['id']:a for a in fixture_lock['artifacts']}
        columns={'derinet2':['id','lemid','lemma','pos','feats','segmentation','parent_id','reltype','otherrels','annotations'],
                 'morphynet_derivation':['source','target','source_pos','target_pos','affix','operation'],
                 'morphynet_inflection':['lemma','form','features','segmentation']}
        verified=0
        with gzip.open(aa/'records.ndjson.gz','rt') as f:
            for record in map(json.loads,f):
                b=record['body'];a=inputs[b['artifact']];raw=base64.b64decode(b['original_line_base64'])
                assert hashlib.sha256(raw).hexdigest()==b['raw_locator']['raw_sha256']
                fields=raw.decode().rstrip('\n').removesuffix('\r').split('\t')
                names=columns.get(a['format'],['lemma1','cat1','lemma2','cat2','stem','exponent1','exponent2']+(['definition2','lemmatized_definition2'] if a['format']=='glemm_defs' else []))
                assert dict(zip(names,fields))==b['raw_fields']
                assert b['establishes_membership'] is False and b['review_status']=='unreviewed'
                verified+=1
        check('independent_raw_fields_and_provenance',257,verified)
        ga=build(gf/'records.ndjson',source,gf/'v6.json.gz',gf/'v6-lock.json',work/'ga');gb=build(gf/'records.ndjson',source,gf/'v6.json.gz',gf/'v6-lock.json',work/'gb')
        for name,a,b,m in [('import',aa,bb,'manifest.json'),('graph',ga,gb,'GRAPH-MANIFEST.json')]:
            x=json.loads((a/m).read_text());check(name+'_fresh_manifest_replay',(a/m).read_bytes().hex(),(b/m).read_bytes().hex());check(name+'_fresh_output_replay',True,all(file_hash(a/n)==file_hash(b/n)==h for n,h in x['outputs'].items()));replay[name]={'manifest_sha256':file_hash(a/m),'output_files':len(x['outputs']),'output_bytes':sum((a/n).stat().st_size for n in x['outputs'])}
        for failure in ['missing','checksum']:
            lock=json.loads((imp/'source-lock.json').read_text());lock['artifacts'][0]['path' if failure=='missing' else 'sha256']='absent-file' if failure=='missing' else '0'*64;p=work/(failure+'.json');p.write_text(json.dumps(lock))
            try:import_run(p,imp,work/failure)
            except (FileNotFoundError,ValueError):check('import_'+failure+'_fail_closed',False,(work/failure).exists())
            else:check('import_'+failure+'_fail_closed',True,False)
        t=time.perf_counter();g=Graph.open_snapshot(ga,work/'index.sqlite',file_hash(ga/'GRAPH-MANIFEST.json'));replay['graph']['index_seconds']=time.perf_counter()-t;t=time.perf_counter()
        for _ in range(200):assert g.guard('CREAT','en','creel',channel='fallback')['status']=='blocked'
        replay['graph']['negative_guard_200_seconds']=time.perf_counter()-t;check('real_negative_creel','blocked',g.guard('CREAT','en','creel')['status']);check('no_external_accepted_reviews',0,g.db.execute("SELECT COUNT(*) FROM reviews WHERE status='accepted'").fetchone()[0]);g.close()
    # Remove verbose equal-manifest hex values from the receipt; hashes are above.
    for r in R:
        if r['check'].endswith('_fresh_manifest_replay'):r['expected']=r['actual']='identical; SHA in replay'
    return {'fixture_only_graph_controls':True,'automatic_gold':0,'results':R,'summary':{s:sum(x['status']==s for x in R) for s in ['PASS','FAIL']},'replay':replay,'real_cases':len(cases),'replay_seconds':time.perf_counter()-start,'peak_rss_bytes_linux':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',required=True,type=Path);a=p.parse_args();r=main();a.out.write_text(json.dumps(r,ensure_ascii=False,sort_keys=True,indent=2)+'\n');print(json.dumps(r['summary']))

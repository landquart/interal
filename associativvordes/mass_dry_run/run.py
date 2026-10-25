#!/usr/bin/env python3
"""Staged mass dry-run on certified full inputs. Never applies memberships or decisions."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from collections import Counter
import gzip
import json
import os
from pathlib import Path
import platform
import shutil
import sqlite3
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
for name in ('auto_annotation','candidate_search','evidence_graph','importers','pilot_evaluation'):
    None
# Restore our worker's imports to the existing annotation modules.
None
from associativvordes.auto_annotation.contract import canonical,sha,file_hash,scrub
from associativvordes.auto_annotation.storage import Store as AnnotationStore,backup,restore,atomic
from associativvordes.auto_annotation.pipeline import code_version,rows
from associativvordes.auto_annotation.providers import configuration
None
from associativvordes.mass_dry_run.audit import build_snapshot,compare,samples

PROTOCOL=json.loads((HERE/'protocol06.json').read_text())
def write(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    atomic(path,(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode())
def disk(path):
    ps=[p for p in Path(path).rglob('*') if p.is_file()]
    return dict(logical_bytes=sum(p.stat().st_size for p in ps),
                allocated_bytes=sum(p.stat().st_blocks*512 for p in ps),files=len(ps))
def readonly(path):
    return sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
def registry_state(path):
    db=readonly(path)
    try:
        tables=('aliases','decisions','known','family_controls','family_fingerprints','registry_documents')
        logical={}
        for name in tables:
            values=[list(r) for r in db.execute('SELECT * FROM '+name)]
            logical[name]={'rows':len(values),'sha256':sha(sorted(values,key=canonical))}
        kinds={k:n for k,n in db.execute('SELECT kind,COUNT(*) FROM existing GROUP BY kind')}
        protected={}
        for kind in ('LexicalHead','Membership','HeadFamilyEdge','LemmaHeadLink','CorrectionVerdict','PriorManualEvidence'):
            values=[list(r) for r in db.execute('SELECT id,body,proof FROM existing WHERE kind=? ORDER BY id',(kind,))]
            protected[kind]={'rows':len(values),'sha256':sha(values)}
        families=[r[0] for r in db.execute('SELECT family FROM family_fingerprints ORDER BY family')]
        aliases=[dict(alias=a,family=f) for a,f in db.execute('SELECT alias,family FROM aliases ORDER BY alias,family')]
        if any(a['family'] not in families for a in aliases):raise ValueError('orphan family alias')
        decisions={s:n for s,n in db.execute('SELECT status,COUNT(*) FROM decisions GROUP BY status')}
        return dict(families=families,aliases=aliases,tables=logical,protected_entities=protected,
             entity_counts=kinds,decision_status_counts=decisions,creates_canonical_roots=False)
    finally:db.close()
def measured(output,name,arguments,allowed=(0,)):
    folder=Path(output)/'jobs';folder.mkdir(parents=True,exist_ok=True)
    log=folder/(name+'.stdout');err=folder/(name+'.stderr');measurement=folder/(name+'.resources.json')
    started=time.monotonic()
    with open(log,'w') as out,open(err,'w') as stderr:
        child=subprocess.Popen(list(map(str,arguments)),cwd=ROOT,stdout=out,stderr=stderr)
        pid,status,usage=os.wait4(child.pid,0)
        child.returncode=os.waitstatus_to_exitcode(status)
    resource=dict(wall_seconds=round(time.monotonic()-started,6),max_rss_kib=usage.ru_maxrss,
        user_seconds=usage.ru_utime,system_seconds=usage.ru_stime,returncode=child.returncode,
        command=list(map(str,arguments)))
    write(measurement,resource)
    if child.returncode not in allowed:
        raise RuntimeError(name+' failed: '+err.read_text()[-3000:])
    resource['stdout_sha256']=file_hash(log);resource['stderr_sha256']=file_hash(err)
    return resource,json.loads(log.read_text()) if log.stat().st_size else None

def freeze(a,output):
    inputs={}
    database_paths={n:Path(getattr(a,n)) for n in ('registry','index','aux','project','prior_queue')}
    for name,path in database_paths.items():
        if not path.is_file():raise ValueError('missing frozen '+name)
        inputs[name]={'path':str(path.resolve()),'sha256':file_hash(path),'bytes':path.stat().st_size}
        if name!='prior_queue':
            receipt=path.parent/({'index':'INDEX','registry':'REGISTRY','aux':'AUX','project':'PROJECT'}[name]+'.json')
            value=json.loads(receipt.read_text())
            if value.get('status','PASS')!='PASS' or value['database_sha256']!=inputs[name]['sha256']:
                raise ValueError('certified database mismatch: '+name)
            inputs[name]['receipt']=value
    lock=json.loads(Path(a.source_lock).read_text())
    checkpoint=json.loads((Path(a.release)/'CHECKPOINT.json').read_text())
    if checkpoint.get('status')!='PASS':raise ValueError('uncertified corpus')
    if checkpoint['catalog']['build_id']!=inputs['index']['receipt']['catalog_build_id']:raise ValueError('catalog/source index mismatch')
    # Freeze all normalized snapshots, catalog and manifests actually used; never reacquire raw data.
    release_files={p.relative_to(a.release).as_posix():{'sha256':file_hash(p),'bytes':p.stat().st_size}
         for p in sorted(Path(a.release).rglob('*')) if p.is_file() and p.name not in {'.build-lock'}}
    history={p.relative_to(a.review_ledger).as_posix():file_hash(p) for p in sorted(Path(a.review_ledger).rglob('*'))
       if p.is_file() and p.name!='LOCK' and not p.name.startswith('.pending-')}
    tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    protected={p:file_hash(ROOT/p) for p in tracked if p and (ROOT/p).is_file()}
    registry=registry_state(a.registry)
    hashes={p.relative_to(ROOT).as_posix():file_hash(p) for folder in ('auto_annotation','candidate_search','evidence_graph','importers','review','pilot_evaluation','mass_dry_run')
        for p in sorted((ROOT/'associativvordes'/folder).glob('*.py')) if not p.name.startswith('test_')}
    runtime={'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'platform':platform.platform()}
    value=dict(schema='mass06-frozen-inputs/1',project_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
       databases=inputs,source_lock={'sha256':file_hash(a.source_lock),'value':lock},catalog_checkpoint=checkpoint,
       release_files=release_files,manual_review_ledger={'path':str(Path(a.review_ledger).resolve()),'files':history},
       prior_queue_history=queue_history(a.prior_queue),registry=registry,tracked_protected_files=protected,
       algorithm_modules=hashes,annotation_algorithm_sha256=code_version(),protocol_sha256=file_hash(HERE/'protocol06.json'),
       llm_config=configuration(PROTOCOL['llm_config']),budgets=PROTOCOL['stage_gates'],runtime=runtime)
    write(Path(output)/'FROZEN-INPUTS.json',value);return value
def queue_history(path):
    db=readonly(path)
    try:return {'rows':[list(r) for r in db.execute('SELECT * FROM history ORDER BY candidate,sequence')],
                'states':[list(r) for r in db.execute("SELECT id,state FROM questions WHERE state!='open' ORDER BY id")]}
    finally:db.close()
def unchanged(a,frozen,full=False):
    for n in ('registry','prior_queue'):
        if file_hash(getattr(a,n))!=frozen['databases'][n]['sha256']:raise ValueError('mutated input '+n)
    if registry_state(a.registry)!=frozen['registry']:raise ValueError('changed heads/membership/aliases/decisions')
    if queue_history(a.prior_queue)!=frozen['prior_queue_history']:raise ValueError('prior queue history changed')
    current={p.relative_to(a.review_ledger).as_posix():file_hash(p) for p in sorted(Path(a.review_ledger).rglob('*'))
       if p.is_file() and p.name!='LOCK' and not p.name.startswith('.pending-')}
    if current!=frozen['manual_review_ledger']['files']:raise ValueError('manual review history changed')
    for p,h in frozen['tracked_protected_files'].items():
        if file_hash(ROOT/p)!=h:raise ValueError('production/formula/tracked input changed: '+p)
    if full:
        for n in ('index','aux','project'):
            if file_hash(getattr(a,n))!=frozen['databases'][n]['sha256']:raise ValueError('full graph changed')
        for p,value in frozen['release_files'].items():
            if file_hash(Path(a.release)/p)!=value['sha256']:raise ValueError('catalog snapshot changed')
    return {'status':'PASS','protected_files':len(frozen['tracked_protected_files']),
            'history_unchanged':True,'registry_unchanged':True,'full_graph_checked':full}

def search_command(a,output,stage,extra=()):
    cmd=[sys.executable,str(ROOT/'associativvordes/candidate_search/mass_run.py')]
    for k in ('index','registry','aux','project','source_lock','prior_queue'):
        cmd.extend(['--'+k.replace('_','-'),getattr(a,k)])
    cmd+=['--output',str(output)]
    if stage.get('families'):cmd+=['--families',*stage['families']]
    else:cmd+=['--all']
    if stage.get('languages'):cmd+=['--languages',*stage['languages']]
    if stage.get('limits'):cmd+=['--limits',canonical(stage['limits'])]
    return [*cmd,*extra]
def release_at(output):
    pointer=json.loads((Path(output)/'CURRENT.json').read_text());return Path(pointer['path'])
def annotation_command(a,release,store,config,extra=()):
    return [sys.executable,str(HERE/'worker.py'),'--input',str(release),'--registry',a.registry,
       '--index',a.index,'--aux',a.aux,'--store',str(store),'--config',str(config),*extra]
def collect(store,questions,identity):
    s=AnnotationStore(store)
    with s.lease():
        plan=s.get(s.runs['mass06'])
        cs={k:s.get(v)['card'] for k,v in s.cards.items() if k in set(plan['cards'])}
        from associativvordes.auto_annotation.pipeline import result_key
        ps=[s.latest(result_key(cs[k],plan['recipe_sha256'])) for k in plan['cards']]
        if any(p is None for p in ps):raise ValueError('incomplete annotations')
        snapshot,stats=build_snapshot(questions,ps,cs,identity)
        return snapshot,stats,s.accounting()
def stage_run(a,output,stage,frozen):
    folder=Path(output)/'stages'/stage['name'];folder.mkdir(parents=True,exist_ok=True)
    config=Path(output)/'CONFIG.json';search=folder/'search';metrics=[]
    m,receipt=measured(folder,'discovery',search_command(a,search,stage));metrics.append(m)
    if receipt['status']!='PASS':raise ValueError('discovery did not finish')
    release=release_at(search);qs=list(rows(release/'questions.ndjson'))
    store=folder/'annotation'
    m,result=measured(folder,'annotation',annotation_command(a,release,store,config));metrics.append(m)
    identity={'input_lock_sha256':file_hash(Path(output)/'FROZEN-INPUTS.json'),
      'source_release_version':receipt['version'],'protocol_sha256':file_hash(HERE/'protocol06.json')}
    snapshot,stats,accounting=collect(store,qs,identity)
    if accounting['requests'] or accounting['budget_exposure_microusd']:raise ValueError('unexpected API cost')
    # Actual process kill after committed results; fresh state, same original frozen inputs.
    interrupted=folder/'interrupted-annotation'
    kill_n=min(5,len(snapshot['proposals']))
    if not kill_n:raise ValueError('empty representative stage cannot exercise recovery')
    m,_=measured(folder,'annotation-sigkill',annotation_command(a,release,interrupted,config,['--kill-after',str(kill_n)]),allowed=(-9,));metrics.append(m)
    if m['returncode']==0:raise ValueError('fault injector did not kill process')
    m,resume=measured(folder,'annotation-resume',annotation_command(a,release,interrupted,config,['--resume']));metrics.append(m)
    if resume['counts'].get('already_completed')!=kill_n:raise ValueError('lost/duplicated committed interrupted results')
    resumed,resumed_stats,acc=collect(interrupted,qs,identity)
    recovery=compare(snapshot,resumed)
    # Discovery checkpoints: partial search must not publish a completed release.
    interrupted_search=folder/'interrupted-search'
    m,partial=measured(folder,'discovery-checkpoint',search_command(a,interrupted_search,stage,['--stop-after','1']));metrics.append(m)
    if partial['status']!='CHECKPOINT' or (interrupted_search/'CURRENT.json').exists():raise ValueError('partial discovery published')
    m,recovered=measured(folder,'discovery-resume',search_command(a,interrupted_search,stage,['--resume']));metrics.append(m)
    if recovered['version']!=receipt['version']:raise ValueError('discovery checkpoint not deterministic')
    protection=unchanged(a,frozen)
    resources={'jobs':metrics,'disk':disk(folder),'max_rss_kib':max(m['max_rss_kib'] for m in metrics),
      'wall_seconds':round(sum(m['wall_seconds'] for m in metrics),3)}
    gates=PROTOCOL['stage_gates']
    if resources['max_rss_kib']>gates['max_rss_kib'] or resources['disk']['logical_bytes']>gates['max_output_bytes']:
        raise ValueError('resource gate exceeded')
    result=dict(name=stage['name'],engineering_gate='PASS',quality_gate='BLOCKED_INDEPENDENT_HUMAN_GOLD',
       selected_families=receipt['identity']['families'],family_fraction=len(receipt['identity']['families'])/len(frozen['registry']['families']),
       languages=receipt['identity']['languages'],limits=receipt['identity']['limits'],discovery=receipt,
       annotation=result,statistics=stats,resources=resources,history=protection,
       recovery={'annotation_sigkill':recovery,'committed_before_kill':kill_n,
         'already_completed_after_resume':resume['counts'].get('already_completed'),
         'discovery_partial_not_published':True,'discovery_version_equal':True},
       snapshot_sha256=sha(snapshot),membership_writes=0)
    write(folder/'STAGE.json',result);write(folder/'SNAPSHOT.json',snapshot)
    print(canonical({'stage':stage['name'],'engineering':'PASS','questions':stats['questions'],
       'native_candidates':stats['native_candidates'],'max_rss_kib':resources['max_rss_kib'],
       'wall_seconds':resources['wall_seconds']}),flush=True)
    return result,snapshot

def quality(snapshot,a):
    None
    from associativvordes.pilot_evaluation.gold import compile_gold
    from associativvordes.pilot_evaluation.metrics04 import zero_error_requirement,summary
    cases=list(rows(ROOT/'audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz'))
    js=list(rows(a.judgments)) if a.judgments else []
    roster=json.loads(Path(a.roster).read_text()) if a.roster else {}
    gold=compile_gold(cases,js,roster)
    gates=json.loads((ROOT/'associativvordes/pilot_evaluation/protocol04.json').read_text())['gates']
    sample=samples(snapshot,PROTOCOL['seed'],PROTOCOL['new_quality_samples']['random'],PROTOCOL['new_quality_samples']['risk_oriented'])
    # No automatic gold projection by spelling or prior accepted status.
    measured=sum(r.get('label') is not None and r['label']['decision']!='uncertain' for r in gold['rows'])
    blockers=[
      {'id':'NO_REAL_LLM_OUTPUTS','effect':'No stochastic LLM comparison or calibrated confidence; both planned stages are explicitly unconfigured.'},
      {'id':'UNCALIBRATED_SEMANTIC_CLASSES','effect':'All proposals require human review. No addition, exclusion, relation change or family merge may be applied.'},
      {'id':'FROZEN_V6_SCOPE_ONLY','effect':'All 19 canonical families in the certified shadow v6 registry covered; production v5 million-family inventory is neither switched nor claimed covered.'}]
    if not measured:blockers.insert(0,{'id':'NO_INDEPENDENT_HUMAN_GOLD','effect':'Precision/recall/false merges cannot be estimated. First fixed pilot cohort needs 360 independent reviews of 180 cases; full pilot at least 1787.'})
    blockers.append({'id':'NEW_MASS_SAMPLE_UNREVIEWED','effect':str(sample['required_reviews'])+' independent reviews needed for '+str(sample['unique_cases'])+' distinct random/risk sampled proposals, plus arbitration.'})
    mass_index={(p['family_id'],p['language'],p['lexeme']['id']):p for p in snapshot['proposals']}
    gg={g['case_id']:g for g in gold['rows']};observations=[]
    for c in cases:
        p=mass_index.get((c['family'],c['language'],c['target']['lexeme_id']))
        if p:
            observations.append((c,gg[c['id']],{'decision':{'ABSTAIN':'abstain','PROPOSE_INCLUDE':'yes','PROPOSE_EXCLUDE':'no'}[p['proposed_decision']],
               'relation_prediction':p['relation_type'],'merged_families':None}))
    frozen_metrics=summary(observations)
    n=zero_error_requirement(gates['false_merge_upper_bound'],gates['familywise_alpha']/gates['predeclared_strata'])
    return dict(schema='mass06-quality/1',status='BLOCKED',gold_counts=gold['counts'],gold_sha256=gold['content_sha256'],
      independent_gold_usable=measured,exact_native_matched_frozen_cases=len(observations),frozen_matched_scope_metrics=frozen_metrics,thresholds=gates,thresholds_passed=False,
      precision={'value':None,'numerator':None,'denominator':0,'ci95':None},
      false_family_merge={'value':None,'errors':None,'denominator':0,'ci95':None},
      note='Structural non-application of merges is not measured semantic false-merge precision.',
      exact_zero_error_minimum_for_merge_gate_per_preregistered_stratum=n,
      new_mass_sample=sample,blockers=blockers,allowed_now=gates['permitted_now'],
      semantic_application_allowed=False)

def run(a):
    output=Path(a.output).resolve()
    if output.is_relative_to(ROOT) or output.exists():raise ValueError('fresh dry-run output outside repository required')
    for name in ('registry','index','aux','project','release','review_ledger','prior_queue'):
        p=Path(getattr(a,name)).resolve()
        if output==p or output.is_relative_to(p) or p.is_relative_to(output):raise ValueError('output overlaps input')
    output.mkdir(parents=True,mode=0o700)
    lock=open(output/'LOCK','a');import fcntl;fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    config=configuration(PROTOCOL['llm_config']);write(output/'CONFIG.json',config)
    frozen=freeze(a,output);stages=[];snapshot=None
    for stage in PROTOCOL['stages']:
        result,snapshot=stage_run(a,output,stage,frozen);stages.append(result)
        write(output/'CHECKPOINT.json',{'completed_stages':[s['name'] for s in stages],
           'last_stage_sha256':file_hash(output/'stages'/stage['name']/'STAGE.json')})
    # Full process replay is independent: fresh search DB, annotation store and separate subprocesses.
    independent=dict(PROTOCOL['stages'][-1],name='independent-full')
    replay,other=stage_run(a,output,independent,frozen)
    repeat=compare(snapshot,other)
    first_release=release_at(output/'stages/all/search');other_release=release_at(output/'stages/independent-full/search')
    first_manifest=json.loads((first_release/'MANIFEST.json').read_text())
    other_manifest=json.loads((other_release/'MANIFEST.json').read_text())
    if first_manifest!=other_manifest:raise ValueError('full discovery manifests differ')
    repeat['discovery_manifest_identical']=True;repeat['prior_history_identical']=stages[-1]['statistics']['preserved_input_history_sha256']==replay['statistics']['preserved_input_history_sha256']
    write(output/'REPEAT.json',repeat)
    q=quality(snapshot,a);write(output/'QUALITY.json',q)
    final_check=unchanged(a,frozen,full=True);write(output/'INTEGRITY.json',final_check)
    final=output/'final';final.mkdir()
    write(final/'SNAPSHOT.json',snapshot)
    for group,ids in snapshot['groups'].items():
        selected={p['candidate_id']:p for p in snapshot['proposals']}
        write(final/(group.upper()+'.json'),dict(schema='mass06-proposal-group/1',group=group,
          proposals=[selected[i] for i in ids],semantic_status='UNVALIDATED_REVIEW_HYPOTHESES',production_writes=0))
    write(final/'REGISTRY-STATE.json',frozen['registry'])
    # Versioned authoritative annotation backup and actual full restore, not just exported proposals.
    s=AnnotationStore(output/'stages/all/annotation')
    with s.lease():backup_receipt=backup(s,output/'ANNOTATION-BACKUP.zip')
    restored=restore(output/'ANNOTATION-BACKUP.zip',output/'restored-annotation')
    write(output/'RESTORE.json',dict(status='PASS',backup_sha256=backup_receipt['backup_sha256'],
       backup_bytes=(output/'ANNOTATION-BACKUP.zip').stat().st_size,restored=restored))
    # Reuse human review interface in a fresh research ledger, never the frozen live ledger.
    s=AnnotationStore(output/'stages/all/annotation')
    from associativvordes.auto_annotation.pipeline import export
    with s.lease():handoff=export(s,'mass06',output/'review-handoff',True)
    import importlib.util
    spec=importlib.util.spec_from_file_location('phase06_review_store',ROOT/'associativvordes/review/store.py')
    review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
    ledger=review.Ledger(output/'review-ledger');ledger.import_queue(output/'review-handoff')
    if ledger.events:raise ValueError('handoff wrote human decisions')
    report=dict(schema='mass06-cycle/1',status='DRY_RUN_COMPLETE_SEMANTIC_APPLICATION_BLOCKED',
      stages=stages,independent=replay,repeat=repeat,quality=q,integrity=final_check,
      scope={'families':frozen['registry']['families'],'production_v5_included':False},
      output_statistics=stages[-1]['statistics'],api_generation_requests=0,api_cost_usd=0,
      infrastructure_cost_usd=None,production_writes=0,formulas_changed=False,canonical_roots_created=False,
      handoff={'questions':len(ledger.questions),'proposals':sum(len(x.get('automated_proposals',[])) for x in ledger.questions.values()),'human_decision_events':0},
      restored=restored,final_disk=disk(output),input_lock_sha256=file_hash(output/'FROZEN-INPUTS.json'))
    write(output/'CYCLE.json',report)
    # Archive all proposal rows, source rows, groups and new blinded QC tasks for durable publication.
    from associativvordes.pilot_evaluation.archive04 import pack,unpack
    files={'SNAPSHOT.json':str(final/'SNAPSHOT.json'),'QUALITY.json':str(output/'QUALITY.json'),
           'REGISTRY-STATE.json':str(final/'REGISTRY-STATE.json')}
    archive=output/'PACKED-PROPOSALS.json.gz';receipt=pack(files,archive)
    restored_dir=output/'archive-roundtrip';unpack(archive,restored_dir)
    for name,path in files.items():
        if (restored_dir/name).read_bytes()!=Path(path).read_bytes():raise ValueError('published archive differs')
    write(output/'ARCHIVE.json',dict(receipt,roundtrip='PASS_EXACT_JSON_BYTES',
      files={k:file_hash(v) for k,v in files.items()},snapshots_complete=True))
    print(canonical({'status':report['status'],'families':len(report['scope']['families']),
       'questions':report['output_statistics']['questions'],'native_candidates':report['output_statistics']['native_candidates'],
       'repeat':repeat['status'],'quality':'BLOCKED','archive_bytes':receipt['bytes']}),flush=True)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ('index','registry','aux','project','source-lock','release','prior-queue','review-ledger','output'):p.add_argument('--'+n,required=True)
    p.add_argument('--judgments');p.add_argument('--roster')
    try:run(p.parse_args())
    except Exception as e:
        print('DRY_RUN_BLOCKED: '+str(e),file=sys.stderr);raise

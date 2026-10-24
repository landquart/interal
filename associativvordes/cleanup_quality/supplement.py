"""Add exact documentary allomorph/borrowing contexts without inventing v5 IDs."""
import argparse,json,shutil
from pathlib import Path
from associativvordes.family_boundary.core import ROOT,read,save,digest,sha,stream
from .prepare import HERE,sanitized
from .evaluate import release,rows

def run(source,output):
    source=Path(source);out=Path(output).resolve();cases,old=release(source)
    if out.exists() or out.is_relative_to(ROOT):raise ValueError('fresh external frozen release required')
    registry=ROOT/'audit/associative-national-correspondences/NATIONAL-CORRESPONDENCE-REGISTRY.json';reg=read(registry);protocol=read(HERE/'protocol.json');ph=digest(protocol)
    added=[]
    for e in reg['entries']:
        lex=e['lexeme'];c=dict(dataset='challenge',split='holdout',case_kind='DOCUMENTARY_CONTEXT_NOT_CORPUS_MEMBERSHIP',family_id=e['canonical_root_id'],family_canonical=e['normative_form'],language=e['language'],lemma_id='dictionary-context:'+e['id'],word=lex['lemma'],pos=None,sense_id=None,source_record=dict(word=lex['lemma'],context=e.get('context'),national_form=e['national_form'],source_refs=e['evidence_refs']),documentary_registry_path=str(registry.relative_to(ROOT)),documentary_entry_id=e['id'],documentary_entry_sha256=digest(e),corpus_lexical_binding=None,source_record_status='DOCUMENTARY_ENTRY_ONLY_NOT_BOUND_TO_V5',risk_flags=['HISTORICAL_ALLOMORPH_OR_NATIONAL_CORRESPONDENCE',e['relation_kind']],protocol_sha256=ph,historical_exposure_flags=['PREVIOUSLY_PUBLISHED_DOCUMENTARY_CONTEXT'])
        c['id']='quality-case:'+digest(['documentary-challenge',e['id'],digest(e)]);c['cluster']='statistical-cluster:documentary:'+digest(e['canonical_root_id']);c['content_sha256']=digest(c);added.append(c)
    cases+=added;out.mkdir(parents=True)
    for p in source.iterdir():
        if p.is_file() and p.name!='MANIFEST.json':shutil.copyfile(p,out/p.name)
    stream(out/'CHALLENGE.ndjson.gz',(c for c in cases if c['dataset']=='challenge'))
    for role in ['A','B']:
        cards=rows(source/f'BLIND-{role}.ndjson.gz')
        for c in added:
            cards.append(dict(task_id='blind-task:'+digest([role,c['id']]),role=role,case_id=c['id'],case_sha256=c['content_sha256'],protocol_sha256=ph,language=c['language'],family_id=c['family_id'],family_canonical=c['family_canonical'],lemma_id=c['lemma_id'],word=c['word'],pos=None,sense_id=None,source_record=sanitized(c['source_record']),historical_scope_only=True,collection_status='NOT_RELEASED_PENDING_CALIBRATION_AND_RECRUITMENT'))
        cards.sort(key=lambda c:digest([protocol['seed'],role,c['task_id']]));stream(out/f'BLIND-{role}.ndjson.gz',cards)
    preds=rows(source/'PREDICTIONS.ndjson.gz')
    for cfg in protocol['configurations']:
        for c in added:preds.append(dict(case_id=c['id'],case_sha256=c['content_sha256'],configuration=cfg,prediction='NOT_RUN' if cfg=='llm_assisted' else 'ABSTAIN',authority='ALGORITHM_NOT_GOLD',reason='Documentary context has no corpus native/sense binding; never materialized as a v5 membership'))
    stream(out/'PREDICTIONS.ndjson.gz',preds)
    design=read(out/'SAMPLING-DESIGN.json');design['frame']=sum(s['N'] for s in design['strata'].values());save(out/'SAMPLING-DESIGN.json',design)
    h=read(out/'HOLDOUT.json');h.update(challenge=h['challenge']+len(added),known_historical_exposure_units=h['known_historical_exposure_units']+len(added),heldout_case_hashes_sha256=digest([c['content_sha256'] for c in cases]));save(out/'HOLDOUT.json',h)
    save(out/'DOCUMENTARY-SUPPLEMENT.json',dict(source_manifest_sha256=sha(source/'MANIFEST.json'),registry_path=str(registry.relative_to(ROOT)),registry_sha256=sha(registry),contexts=len(added),new_v5_memberships=0,authority='REVIEW_TASKS_NOT_HUMAN_GOLD',supplement_code_sha256=sha(__file__)))
    save(out/'MANIFEST.json',dict(old,identity=dict(old['identity'],supplement_code_sha256=sha(__file__),documentary_registry_sha256=sha(registry)),case_set_sha256=digest(cases),challenge_cases=old['challenge_cases']+len(added),files=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(out.iterdir()) if p.is_file()]))
    return dict(status='DOCUMENTARY_CONTEXTS_ADDED_WITHOUT_CORPUS_BINDING',contexts=len(added))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(run(a.source,a.output)))

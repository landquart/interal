"""Prepare a provisional separate calibration reserve, never a certified gold.

Bounded pools use real original memberships and pinned morphology observations.
All discoveries/risks and original algorithmic analyses stay coordinator-only.
"""
import argparse,collections,gzip,hashlib,json,sqlite3,zipfile
from pathlib import Path
from ..identity_mapping.model import canonical,digest,lookup
from ..evidence_registry.view import sha
HERE=Path(__file__).parent
ROOT=HERE.parents[1]

def load_lines(path):
    with gzip.open(path,'rt') as f:
        for line in f:yield json.loads(line)

def holdout_exposure(folder,db,baseline):
    folder=Path(folder)
    for item in json.loads((folder/'ARCHIVE-CONTENTS.json').read_bytes())['files']:
        path=folder/item['path']
        if sha(path)!=item['sha256'] or path.stat().st_size!=item['bytes']:raise ValueError('held-out archive member mismatch')
    held=[];families=set();words=set();lemmas=set();records=set();etymons=set();aliases=set();raw=set();native=set()
    for name in ['PROBABILITY.ndjson.gz','CHALLENGE.ndjson.gz']:
        held.extend(load_lines(folder/'release'/name))
    with zipfile.ZipFile(folder/'historical-kit/v5-probability-kit-v2.zip') as z:
        old=[json.loads(x) for x in z.read('gold-sample.jsonl').splitlines()]
    for c in held+old:
        if c.get('family_id'):families.add(c['family_id'])
        if c.get('word'):words.add((c['language'],lookup(c['word'])))
        if c.get('lemma_id'):lemmas.add((c['language'],c['lemma_id']))
        if c.get('record_sha256'):records.add(c['record_sha256'])
    files=[]
    for p in sorted((Path(baseline)/'families').glob('*.gz')):
        data=json.load(gzip.open(p,'rt'));files.append(dict(path='families/'+p.name,sha256=sha(p)))
        for fid in families.intersection(data):
            meta=data[fid];aliases.update(lookup(x) for x in meta.get('aliases',[]) if isinstance(x,str));etymons.update(meta.get('etymon_keys',[]))
    # Exclude every native candidate/observation reachable from known held-out
    # words, not merely the currently preferred alternative.
    for lang,word in sorted(words):
        for (cid,) in db.execute('SELECT id FROM candidates WHERE language=? AND lookup=?',(lang,word)):
            native.add(cid)
            raw.update(x[0] for x in db.execute('SELECT raw_sha256 FROM occurrences WHERE candidate=?',(cid,)))
    return dict(held=held,old=old,families=families,words=words,lemmas=lemmas,records=records,aliases=aliases,etymons=etymons,raw=raw,native=native,family_files=files)

def discover_flags(meta,word,candidates):
    # Hypothesis flags only; never expected answers or category certification.
    flags=[];rt=set(meta.get('relation_types',[]));paths=meta.get('relation_evidence',[])
    if 'direct_descendant' in rt:flags.append('DIRECT_PATH')
    if any('borrow' in str(x).lower() for x in rt):flags.append('BORROWING')
    if any('compound' in str(x).lower() for x in rt):flags.append('COMPOUND')
    if len({c['pos'] for c in candidates if c['pos']})>1:flags.append('HOMONYMY')
    if len(meta.get('etymon_keys',[]))>1:flags.append('ALTERNATIVE_ORIGIN')
    if len({str(x.get('term')) for x in paths})>1:flags.append('HISTORICAL_PATH_CONFLICT')
    root=lookup(meta.get('canonical',''));w=lookup(word)
    if root and root not in w:flags.extend(['ALLOMORPH','OPAQUE_DERIVATION'])
    if root and len(root)<=4 and w.endswith(root):flags.append('FALSE_ENDING')
    return sorted(set(flags))

def prepare(baseline,registry,native,holdout,output):
    baseline=Path(baseline);registry=Path(registry);native=Path(native);output=Path(output)
    if output.exists():raise ValueError('fresh immutable preparation folder required')
    output.mkdir(parents=True);protocol=json.loads((HERE/'protocol.json').read_bytes());ph=digest(protocol)
    reg=json.loads((registry/'REGISTRY.json').read_bytes());nr=json.loads((native/'NATIVE-REPORT.json').read_bytes())
    if sha(registry/'REGISTRY.json')!=json.loads((ROOT/'audit/evidence-registry-20261025/EVIDENCE-REGISTRY.json').read_bytes())['parent_registry_sha256']:raise ValueError('exact parent mapping registry required')
    if sha(native/'NATIVE-REPORT.json')!=reg['native_report_sha256']:raise ValueError('native report version mismatch')
    if sha(native/'native.sqlite')!=reg['native_database_sha256']:raise ValueError('native database bytes mismatch')
    db=sqlite3.connect((native/'native.sqlite').resolve().as_uri()+'?mode=ro&immutable=1',uri=True);db.row_factory=sqlite3.Row;db.execute('PRAGMA cache_size=-32768')
    ex=holdout_exposure(holdout,db,baseline);selected=[];used_families=set();used_words=set();used_raw=set();used_aliases=set();used_etymons=set();pool_summary={};checked={};rejections=collections.Counter()
    for lang in protocol['languages']:
        pool=[];pool_families=set();pool_words=set();buckets=sorted([p for p in reg['parts'] if p['language']==lang],key=lambda p:digest([protocol['selection_seed'],lang,p['bucket']]))
        for part in buckets[:protocol['maximum_buckets_per_language']]:
            p=registry/part['file'];assert sha(p)==part['sha256'];meta=json.load(gzip.open(baseline/'families'/(part['bucket']+'.json.gz'),'rt'));checked[str(p.relative_to(registry))]=part['sha256']
            for row in load_lines(p):
                fid,lid,ordinal,word,rh=row[:5];w=(lang,lookup(word));fm=meta.get(fid,{})
                if fid in ex['families'] or fid in used_families or fid in pool_families or w in ex['words'] or w in used_words or w in pool_words or (lang,lid) in ex['lemmas'] or rh in ex['records']:
                    rejections['family_or_lexeme_or_record']+=1;continue
                if fid.startswith('surface:') or not word.isalpha() or len(word)<3 or len(word)>40 or not fm.get('canonical'):
                    rejections['no_usable_observed_form_or_family']+=1;continue
                aliases={lookup(x) for x in fm.get('aliases',[]) if isinstance(x,str)};ety=set(fm.get('etymon_keys',[]))
                if aliases & (ex['aliases']|used_aliases) or ety & (ex['etymons']|used_etymons):
                    rejections['known_family_alias_or_etymon']+=1;continue
                cs=[dict(x) for x in db.execute('SELECT c.*,a.source_id,a.body artifact_body FROM candidates c JOIN artifacts a ON a.id=c.artifact WHERE language=? AND lookup=? ORDER BY c.id',(lang,lookup(word)))]
                if not cs or any(c['id'] in ex['native'] for c in cs):continue
                evidence=[];hashes=set();definitions=[]
                for c in cs:
                    for o in db.execute('SELECT * FROM occurrences WHERE candidate=? ORDER BY artifact,line,role',(c['id'],)):
                        hashes.add(o['raw_sha256'])
                        if o['definition']:
                            art=json.loads(c['artifact_body']);definitions.append(dict(source_id=c['source_id'],source_version=art.get('revision') or art.get('resource'),source_url=art.get('url'),source_sha256=art['sha256'],license=art.get('license'),source_row=o['line'],role=o['role'],raw_sha256=o['raw_sha256'],lemma=c['lemma'],pos=c['pos'],definition=o['definition']))
                        evidence.append(dict(candidate=c['id'],artifact=o['artifact'],line=o['line'],role=o['role'],raw_sha256=o['raw_sha256']))
                if not definitions:rejections['no_observed_dictionary_context']+=1;continue
                if hashes & (ex['raw']|used_raw):rejections['known_shared_native_evidence']+=1;continue
                origin=dict(family_id=fid,language=lang,lemma_id=lid,ordinal=ordinal,word=word,record_sha256=rh,path='associativvordes/family-index-v5/'+part['source']['path'],source_file_sha256=part['source']['sha256'],source_commit=reg['source_commit'])
                case=dict(id='calibration:'+digest([protocol['id'],origin]),language=lang,origin=origin,family=dict(id=fid,proposed_form=fm['canonical'],normative_element=None,normative_status='NOT_CERTIFIED'),dictionary_context=definitions,source_occurrences=evidence,source_alternatives=[{k:c[k] for k in ('id','source_id','lemma','pos','native_lexical_id','sense_id','kind')} for c in cs],category_hypotheses=discover_flags(fm,word,cs),aliases=sorted(aliases),etymon_keys=sorted(ety),source_raw_hashes=sorted(hashes),mapping_status=row[8],lexical_scope_status='CORPUS_SENSE_UNRESOLVED',protocol_sha256=ph,status='PROVISIONAL_NOT_RELEASED',production_application_authorized=False)
                pool.append(case);pool_families.add(fid);pool_words.add(w)
                if len(pool)>=protocol['candidate_pool_per_language']:break
            if len(pool)>=protocol['candidate_pool_per_language']:break
        if len(pool)<protocol['cases_per_language']:raise ValueError('insufficient distinct context-backed cases for '+lang)
        ordered=sorted(pool,key=lambda c:digest([protocol['selection_seed'],c['id']]));chosen=[];local_raw=set();local_alias=set();local_ety=set()
        def add(c):
            if c in chosen or set(c['source_raw_hashes'])&local_raw or set(c['aliases'])&local_alias or set(c['etymon_keys'])&local_ety:return False
            chosen.append(c);local_raw.update(c['source_raw_hashes']);local_alias.update(c['aliases']);local_ety.update(c['etymon_keys']);return True
        for category in protocol['category_targets']:
            for c in ordered:
                if category in c['category_hypotheses'] and add(c):break
        for c in ordered:
            if len(chosen)>=protocol['cases_per_language']:break
            add(c)
        if len(chosen)!=protocol['cases_per_language']:raise ValueError('insufficient mutually disjoint reserve cases for '+lang)
        selected.extend(chosen);used_families.update(c['origin']['family_id'] for c in chosen);used_words.update((lang,lookup(c['origin']['word'])) for c in chosen);used_raw.update(local_raw);used_aliases.update(local_alias);used_etymons.update(local_ety)
        pool_summary[lang]=dict(pool=len(pool),selected=len(chosen),category_hypotheses=dict(collections.Counter(x for c in chosen for x in c['category_hypotheses'])),category_certification='BLOCKED; discovery flags do not prove known positives, negatives or conflict paths')
    db.close();selected.sort(key=lambda c:c['id'])
    for c in selected:c['content_sha256']=digest(c)
    def write(name,value):
        (output/name).write_text(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
    def ndjson(name,rows):
        with (output/name).open('w') as f:
            for row in rows:f.write(canonical(row).decode()+'\n')
    ndjson('COORDINATOR-CASES.ndjson',selected)
    for role in ['A','B']:
        tasks=[]
        for c in sorted(selected,key=lambda c:digest([protocol['selection_seed'],'blind-order',role,c['id']])):
            # Whitelist: no case hash/origin locator encoding former membership,
            # category flags, expected answers, native signatures or old verdicts.
            q=dict(question_id=c['id'],language=c['language'],lexeme=c['origin']['word'],proposed_family_form=c['family']['proposed_form'],normative_root=None,national_correspondence=None,pos=None,sense=None,dictionary_context=c['dictionary_context'],task='Independently identify the intended lexeme/POS/sense and assess the proposed root relation; use UNCERTAIN if exact scope or evidence is insufficient.',protocol_sha256=ph,instructions_sha256=sha(HERE/'INSTRUCTIONS.md'),release_status='PROVISIONAL_NOT_RELEASED')
            q['question_sha256']=digest(q);tasks.append(q)
        ndjson('PREVIEW-'+role+'.ndjson',tasks)
    write('ROSTER.json',{});write('ASSIGNMENTS.json',[]);ndjson('RAW-HUMAN-REVIEWS.ndjson',[]);ndjson('RAW-ARBITRATIONS.ndjson',[]);ndjson('HUMAN-GOLD.ndjson',[])
    write('PROTOCOL.json',protocol)
    write('INDEPENDENCE.json',dict(status='BLOCKED',known_family_overlaps=0,known_lexeme_overlaps=0,known_native_observation_overlaps=0,heldout_cases=len(ex['held']),old_study_cases=len(ex['old']),excluded_families=len(ex['families']),excluded_language_words=len(ex['words']),excluded_native_candidates=len(ex['native']),excluded_native_row_hashes=len(ex['raw']),exclusion_policy='Exact families, language/word, legacy IDs, record hashes, family aliases, etymon keys and ALL native observations reachable from held-out spellings. Unknown transitive relations are not declared independent.',unknown_cross_version_sense_and_source_dependencies=True,shared_containers_not_counted_as_independent_evidence=True,holdout_files_modified=False))
    write('PREPARATION.json',dict(schema='interal-calibration-preparation/1',status='PROVISIONAL_NOT_RELEASED',parent_commit=protocol['parent_implementation'],preparation_code_sha256=sha(__file__),instructions_sha256=sha(HERE/'INSTRUCTIONS.md'),protocol_sha256=ph,registry_sha256=sha(registry/'REGISTRY.json'),native_database_sha256=reg['native_database_sha256'],source_lock_sha256=reg['source_lock_sha256'],holdout_archive_sha256='07ef8c73370861b40091fb88d13e364310bc27085b38994b25b1fd6e628c8d6f',cases=len(selected),preview_tasks=2*len(selected),languages=pool_summary,verified_registry_parts=checked,rejections=dict(rejections),family_file_checks=ex['family_files'],registered_humans=0,real_responses=0,real_arbitrations=0,human_gold_rows=0,main_annotation_allowed=False,production_writes=0))
    files=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(output.iterdir()) if p.is_file()]
    write('MANIFEST.json',dict(schema='interal-frozen-calibration-reserve/1',files=files,cases=len(selected),protocol_sha256=ph,immutable=True,release_status='PROVISIONAL_NOT_RELEASED'))
    return len(selected)
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for k in ['baseline','registry','native','holdout','output']:p.add_argument('--'+k,required=True)
    a=p.parse_args();print(prepare(**vars(a)))

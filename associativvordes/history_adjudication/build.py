"""Classify every frozen history source and preserve exact materialized events.

A raw claim never becomes a verified linguistic decision. Resolved engineering
facts certify only the old operation. Unknown scope keeps its potential hold.
"""
import argparse,collections,functools,gzip,hashlib,json,sqlite3,subprocess,zlib
from pathlib import Path
from associativvordes.history_registry.registry import History,canonical,sha,walk,document
SCHEMA='interal-history-adjudication/1'
SEMANTIC={'accepted','accept','included','include','excluded','exclude','rejected','reject','removed','remove','keep','retain','retained','quarantined','uncertain','unresolved','confirmed_member','confirmed_nonmember','conflict','valid','invalid'}
IDENTITY={'family_id','canonical_family_id','lemma_id','lemma_ids','affected_lemma_ids','lexeme_id','sense_id','head_id'}

def selected(x):
 return any(k in x for k in ('decision','verdict','status','rejected_memberships','retained','keep','quarantined_families','supersedes')) and any(k in x for k in ('family_id','canonical_family_id','head_id','lemma_id','lemma_ids','affected_lemma_ids','records','decisions','rejected_memberships','retained','keep','alias','scope'))
def classify(x):
 # A boolean/count/aggregate is not a separate linguistic decision.
 value=next((x[k] for k in ('decision','verdict','status') if isinstance(x.get(k),str)),None)
 marker=value.lower() if value else ''
 semantic=marker in SEMANTIC or any(isinstance(x.get(k),(list,dict)) and bool(x[k]) for k in ('rejected_memberships','retained','keep','quarantined_families'))
 if x.get('supersedes'):return 'SUPERSESSION_CLAIM_UNVERIFIED','QUARANTINED_UNRESOLVED','explicit authority/scope proof absent; date is not supersession'
 if semantic:return 'RESEARCH_HYPOTHESIS','QUARANTINED_UNRESOLVED','source claim retained without independently verified authority'
 if any(k in x for k in IDENTITY) or isinstance(x.get('scope'),dict):
  if {'actual','expected','check'}<=x.keys():return 'ENGINEERING_ASSERTION','RESOLVED_INVALID','test assertion is not a linguistic restriction'
  return 'SCOPE_OR_AUTHORITY_UNRESOLVED','QUARANTINED_UNRESOLVED','native/context identity present but decision authority/scope not certified'
 if isinstance(x.get('records'),(list,dict)) or isinstance(x.get('decisions'),(list,dict)):
  return 'AGGREGATE_CONTAINER','RESOLVED_INVALID','container retained; nested observations are separately indexed; not an independent decision'
 return 'ENGINEERING_REPORT','RESOLVED_INVALID','operational measurement/status without lexical identity or linguistic verdict; raw bytes retained'

def ids(x):
 s=x.get('scope') if isinstance(x.get('scope'),dict) else {}
 family=x.get('family_id',x.get('canonical_family_id',s.get('family_id')))
 language=x.get('language',s.get('language'))
 lids=x.get('lemma_ids',x.get('affected_lemma_ids',s.get('lemma_ids')))
 if not isinstance(lids,list):lids=[x.get('lemma_id',s.get('lemma_id'))]
 lids=sorted({v for v in lids if isinstance(v,str) and v})
 return family if isinstance(family,str) and family else None,language if isinstance(language,str) and language else None,lids

def build(repo,restored,out):
 repo=Path(repo).resolve();restored=Path(restored).resolve();out=Path(out).resolve()
 if out.exists():raise ValueError('fresh adjudication output required')
 if out.is_relative_to(repo):raise ValueError('research output outside checkout required')
 out.mkdir(parents=True);snapshot=restored/'REGISTRY.json';raw=snapshot.read_bytes();snapshot_hash=sha(raw);h=History(repo,snapshot,snapshot_hash,restored/'objects');verified=h.verify();s=h.snapshot
 db=sqlite3.connect(out/'history.sqlite');db.execute('PRAGMA journal_mode=DELETE')
 db.executescript('''CREATE TABLE observations(id TEXT PRIMARY KEY,source TEXT,pointer TEXT,payload_sha256 TEXT,kind TEXT,resolution TEXT,family TEXT,language TEXT,lemma_ids TEXT,polarity TEXT,authority_claim TEXT) WITHOUT ROWID;
 CREATE INDEX observation_scope ON observations(family,language);
 CREATE TABLE constraints(id TEXT PRIMARY KEY,body TEXT) WITHOUT ROWID;
 CREATE TABLE events(decision_id TEXT,family TEXT,language TEXT,lemma TEXT,direction TEXT,source_version TEXT,source_blob TEXT,record_hash TEXT,body TEXT,PRIMARY KEY(decision_id,lemma,direction)) WITHOUT ROWID;
 CREATE INDEX event_scope ON events(family,language,lemma);
 CREATE TABLE quarantine_scope(source TEXT,family TEXT,language TEXT,kind TEXT,PRIMARY KEY(source,family,language,kind)) WITHOUT ROWID;''')
 ledger=[];by_observation={r['source_blob']:r for r in s['observations']};by_source={r['blob']:r for r in s['sources']}
 totals=collections.Counter();known_families=set()
 for ordinal,c in enumerate(s['conflicts'],1):
  source=by_source[c['source']];data=h.blob(c['source']);source_ref=dict(blob=c['source'],sha256=source['sha256'],bytes=source['bytes'],commit=source['commit'],path=source['path'])
  if c['reason']=='UNPARSED_SOURCE':
   # Three documents are complete engineering-error JSON followed by literal \\n.
   parsed=None;detail=None
   try:
    b=gzip.decompress(data) if source['path'].endswith('.gz') else data
    text=b.decode();obj,end=json.JSONDecoder().raw_decode(text);tail=text[end:]
    if tail.strip()=='\\n' and isinstance(obj,dict) and set(obj)<={'schema_version','verdict','exit_code','error_log'} and obj.get('verdict')=='error':parsed=obj
   except (ValueError,OSError,UnicodeError,zlib.error) as exc:detail=type(exc).__name__+': '+str(exc)
   resolved='RESOLVED_INVALID' if parsed is not None else 'QUARANTINED_UNRESOLVED'
   scope=dict(kind='ENGINEERING_ERROR_ONLY',domain='observation') if parsed is not None else dict(kind='GLOBAL_UNKNOWN_POTENTIAL',domain='membership_and_alias',reason='corrupt research snapshot may contain unobservable restrictions; family scope cannot be proven')
   if parsed is None:db.execute('INSERT INTO quarantine_scope VALUES(?,?,?,?)',(c['source'],'*','*','GLOBAL_UNKNOWN_POTENTIAL'))
   ledger.append(dict(id='conflict:'+c['source'],original=c,source=source_ref,classification='DAMAGED_HISTORICAL_OBJECT',resolution=resolved,scope=scope,interpretation_proof=dict(adapter='COMPLETE_ERROR_JSON_PLUS_LITERAL_NEWLINE' if parsed is not None else 'NO_SAFE_DECODING',raw_object_modified=False,error=detail),authority='NO_NEW_AUTHORITY',supersession_chain=[],semantic_certified=False));totals[resolved]+=1;continue
  data=document(data,source['path']);count=0;hashes=hashlib.sha256();hashes.update(b'[');classes=collections.Counter();states=collections.Counter();families=set();languages=set();quarantined=0;unbound=0;authorities=collections.Counter()
  for pointer,x in walk(data):
   if not selected(x):continue
   env=dict(id='observation:'+sha(canonical([c['source'],pointer])),source_blob=c['source'],pointer=pointer,payload_sha256=sha(canonical(x)),classification='UNINTERPRETED_SOURCE_OBSERVATION')
   if count:hashes.update(b',')
   hashes.update(canonical(env));count+=1;kind,state,reason=classify(x);classes[kind]+=1;states[state]+=1
   family,lang,lids=ids(x)
   if family:families.add(family);known_families.add(family)
   if lang:languages.add(lang)
   polarity='unknown';v=str(x.get('decision',x.get('verdict',x.get('status','')))).lower()
   if v in {'accepted','include','included','confirmed_member','valid','keep','retained'}:polarity='positive_claim'
   elif v in {'exclude','excluded','rejected','reject','removed','confirmed_nonmember','invalid'}:polarity='negative_claim'
   claim=x.get('authority',x.get('author',x.get('actor_id')));authorities[str(claim)[:200]]+=1
   db.execute('INSERT INTO observations VALUES(?,?,?,?,?,?,?,?,?,?,?)',(env['id'],c['source'],pointer,env['payload_sha256'],kind,state,family,lang,canonical(lids).decode(),polarity,canonical(claim).decode()))
   if state=='QUARANTINED_UNRESOLVED':
    quarantined+=1;unbound+=int(family is None)
    db.execute('INSERT OR IGNORE INTO quarantine_scope VALUES(?,?,?,?)',(c['source'],family or '*',lang or '*','EXPLICIT_FAMILY_POTENTIAL' if family else 'UNBOUND_SCOPE_POTENTIAL'))
  hashes.update(b']');expected=by_observation[c['source']]
  if count!=expected['count'] or hashes.hexdigest()!=expected['entries_sha256']:raise ValueError('source observation replay differs: '+c['source'])
  resolution='QUARANTINED_UNRESOLVED' if quarantined else 'RESOLVED_INVALID'
  ledger.append(dict(id='conflict:'+c['source'],original=c,source=source_ref,classification='MIXED_DOCUMENT' if len(classes)>1 else next(iter(classes)),resolution=resolution,observation_count=count,observation_classes=dict(classes),observation_resolutions=dict(states),observation_index_sha256=hashes.hexdigest(),scope=dict(kind='SOURCE_INDEXED_POTENTIAL' if quarantined else 'OBSERVATION_ONLY',explicit_family_ids=sorted(families),explicit_languages=sorted(languages),unbound_quarantined_observations=unbound,exact_records='history.sqlite observations, bound to source blob + JSON pointer + payload hash',scope_widened_from_spelling=False),authority_claim_counts=dict(authorities),authority='UNVERIFIED_SOURCE_CLAIMS_ONLY',supersession_chain=[],semantic_certified=False))
  totals[resolution]+=1;db.commit()
  if ordinal%25==0:print('classified source problems',ordinal,flush=True)
 # Explicitly preserve all 545 prior restrictions. Actual removed rows are tombstones,
 # not accepted heads and not new linguistic exclusions.
 counts=collections.Counter();constraints=[]
 @functools.lru_cache(maxsize=4)
 def bucket(blob):return document(h.blob(blob),'bucket.json.gz') if blob else {}
 with gzip.GzipFile(filename='',fileobj=(out/'materialized-events.ndjson.gz').open('wb'),mode='wb',mtime=0) as gz:
  for d in h.decisions:
   scope=d['scope'];sel=scope.get('selector');kind='ENGINEERING_FIX' if d['authority']=='ENGINEERING_CHECK' else 'RESEARCH_HYPOTHESIS';resolution='RESOLVED_CONFIRMED' if kind=='ENGINEERING_FIX' else 'QUARANTINED_UNRESOLVED'
   normalized=dict(original_decision=d,resolution=resolution,classification=kind,certification_scope='EXACT_HISTORICAL_OPERATION_ONLY' if kind=='ENGINEERING_FIX' else 'RESEARCH_BASELINE_HOLD',linguistic_decision='UNRESOLVED',author_verified=False,authority_source='locked Git operation and release manifest' if kind=='ENGINEERING_FIX' else 'locked research dossier; not independent gold',supersession_chain=[],restoration_requires_new_independent_proof=True)
   constraints.append(normalized);db.execute('INSERT INTO constraints VALUES(?,?)',(d['id'],canonical(normalized).decode()))
   if not sel:continue
   aa=bucket(sel.get('before')).get(scope['family_id'],[]);bb=bucket(sel.get('after')).get(scope['family_id'],[]);a={r['lemma_id'] for r in aa};b={r['lemma_id'] for r in bb};chosen=sorted(a-b if sel['direction']=='removed' else b-a)
   if len(chosen)!=sel['count'] or sha(canonical(chosen))!=sel['ids_sha256']:raise ValueError('selector differs from locked history')
   rows=aa if sel['direction']=='removed' else bb;raws=collections.defaultdict(list);chosen_set=set(chosen)
   for i,r in enumerate(rows):
    if r['lemma_id'] in chosen_set:raws[r['lemma_id']].append(dict(ordinal=i,record=r))
   for lid in chosen:
    entry=dict(decision_id=d['id'],family_id=scope['family_id'],language=scope['language'],lemma_id=lid,lexeme_id=None,sense_id=scope.get('sense_id'),relation_status=d['relation_status'],direction=sel['direction'],source_version=d['data_version'],source_blob=sel['before'] if sel['direction']=='removed' else sel['after'],exact_rows=raws[lid],historical_status='REMOVED' if sel['direction']=='removed' else 'ADDED_OPERATION_ONLY',accepted_in_current_registry=False)
    body=canonical(entry);db.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)',(d['id'],scope['family_id'],scope['language'],lid,sel['direction'],d['data_version'],entry['source_blob'],sha(canonical(raws[lid])),body.decode()));gz.write(body+b'\n');counts[sel['direction']]+=1
  db.commit()
 release_bytes=subprocess.check_output(['git','-C',str(repo),'show',s['roots']['main']+':associativvordes/family-index-v5/repository-provenance.json']);release=json.loads(release_bytes);expected_removed=sum(r.get('removed_memberships',0) for r in release['repository_repairs']);expected_added=sum(r.get('added_memberships',0) for r in release['repository_repairs'])
 if counts['removed']!=expected_removed or counts['added']!=expected_added:raise ValueError('history differs from source release manifest; no count adjustment allowed')
 unique_removed=db.execute("SELECT count(*) FROM (SELECT DISTINCT family,language,lemma FROM events WHERE direction='removed')").fetchone()[0]
 stats=dict(problem_sources=len(ledger),problem_resolution_counts=dict(totals),observations_indexed=db.execute('SELECT count(*) FROM observations').fetchone()[0],prior_constraints=len(constraints),removed_operation_events=counts['removed'],unique_removed_edge_scopes=unique_removed,added_operation_events=counts['added'],source_release_removed=expected_removed,source_release_added=expected_added,source_release_manifest_sha256=sha(release_bytes),quarantine_scope_rows=db.execute('SELECT count(*) FROM quarantine_scope').fetchone()[0],global_potential_scope_rows=db.execute("SELECT count(*) FROM quarantine_scope WHERE family='*'").fetchone()[0],sources_verified=verified,semantic_certification_complete=False,production_writes=0)
 if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]:raise ValueError('history database integrity')
 db.close()
 report=dict(schema=SCHEMA,source_snapshot_sha256=snapshot_hash,coverage=dict(all358_classified=len(ledger)==len(s['conflicts']),all_observations_replayed=True,all_previous_restrictions_preserved=True,semantic_certification_complete=False,mutation_authorization=False),stats=stats,conflict_resolution_ledger=ledger,previous_constraints=constraints,databases=dict(history=dict(file='history.sqlite',sha256=sha((out/'history.sqlite').read_bytes()),bytes=(out/'history.sqlite').stat().st_size)),event_archive=dict(file='materialized-events.ndjson.gz',sha256=sha((out/'materialized-events.ndjson.gz').read_bytes()),bytes=(out/'materialized-events.ndjson.gz').stat().st_size),supersession_policy='No last-write-wins; no proof-backed supersession was inferred automatically')
 (out/'REGISTRY.json').write_bytes(canonical(report)+b'\n');(out/'COVERAGE.json').write_bytes(canonical(stats)+b'\n');print(json.dumps(stats),flush=True);return report

def main():
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--restored',required=True);p.add_argument('--output',required=True);a=p.parse_args();build(a.repo,a.restored,a.output)
if __name__=='__main__':main()

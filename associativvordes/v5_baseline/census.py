"""Independent read-only v5 census. Python stdlib; disk-backed exact ID accounting."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import argparse, collections, contextlib, gzip, hashlib, json, math, os, pathlib, resource, shutil, sqlite3, subprocess, sys, tarfile, tempfile, time
VERSION='v5-baseline-1.0.0'
LANGS=('en','de','fr','es','it','ru')
PREFIX='associativvordes/family-index-v5'
ORIGINAL='ee6637b266f4bbb4acd77cccf597ed75b2b44aef'
def canonical(x): return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def sha_file(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def atomic_json(p,x):
 p=pathlib.Path(p);p.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.NamedTemporaryFile(dir=p.parent,prefix=p.name+'.',delete=False) as f:
  tmp=pathlib.Path(f.name);f.write(json.dumps(x,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False).encode()+b'\n');f.flush();os.fsync(f.fileno())
 os.replace(tmp,p)
 fd=os.open(p.parent,os.O_RDONLY);os.fsync(fd);os.close(fd)
def load(p): return json.loads(pathlib.Path(p).read_text())
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])
def bucket(s):
 h=2166136261
 # Existing v5 builder uses for-of + codePointAt(0), i.e. Unicode code points.
 for ch in s:h=((h^ord(ch))*16777619)&0xffffffff
 return f'{h%256:02x}'
def pairs(path):
 """Incremental top-level object parser; retains at most one value, never a bucket tree."""
 decoder=json.JSONDecoder();buf='';pos=0;eof=False
 with gzip.open(path,'rt',encoding='utf-8') as f:
  def fill():
   nonlocal buf,pos,eof
   buf=buf[pos:];pos=0;c=f.read(65536);buf+=c;eof=not c
  def ws():
   nonlocal pos
   while True:
    while pos<len(buf) and buf[pos].isspace():pos+=1
    if pos<len(buf) or eof:return
    fill()
  def char(expected):
   nonlocal pos
   ws()
   if pos>=len(buf) or buf[pos]!=expected:raise ValueError('Expected '+expected)
   pos+=1
  def value():
   nonlocal pos
   while True:
    ws()
    try:v,end=decoder.raw_decode(buf,pos);pos=end;return v
    except json.JSONDecodeError:
     if eof:raise
     fill()
  fill();char('{');ws()
  if pos<len(buf) and buf[pos]=='}':pos+=1
  else:
   while True:
    key=value()
    if not isinstance(key,str):raise ValueError('Non-string object key')
    char(':');v=value();yield key,v;ws()
    if pos<len(buf) and buf[pos]=='}':pos+=1;break
    char(',')
  ws()
  if pos!=len(buf):raise ValueError('Trailing JSON bytes')
  # Read to gzip EOF to verify CRC/trailer, including concatenated members.
  if not eof:
   tail=f.read()
   if tail.strip():raise ValueError('Trailing JSON content')

def extract_git(repo,commit,paths,destination):
 destination=pathlib.Path(destination);destination.mkdir(parents=True,exist_ok=True)
 proc=subprocess.Popen(['git','-C',str(repo),'archive','--format=tar',commit,*paths],stdout=subprocess.PIPE)
 try:
  with tarfile.open(fileobj=proc.stdout,mode='r|') as tar:
   for m in tar:
    p=pathlib.PurePosixPath(m.name)
    if p.is_absolute() or '..' in p.parts or not (m.isfile() or m.isdir()):raise ValueError('Unsafe Git archive entry')
    target=destination.joinpath(*p.parts)
    if m.isdir():target.mkdir(parents=True,exist_ok=True);continue
    target.parent.mkdir(parents=True,exist_ok=True)
    with tar.extractfile(m) as inp,open(str(target)+'.partial','wb') as out:shutil.copyfileobj(inp,out,1024*1024);out.flush();os.fsync(out.fileno())
    os.replace(str(target)+'.partial',target)
 finally:
  proc.stdout.close()
 if proc.wait()!=0:raise RuntimeError('Git archive failed')
def tracked_paths(repo,commit):
 candidates=git(repo,'ls-tree','-r','--name-only',commit).decode().splitlines()
 return [p for p in candidates if p.startswith(PREFIX+'/') or p.startswith('audit/associative-family-v5/') or
  p.startswith('associativvordes/v5_baseline/') or p.startswith('audit/associative-family-v5-baseline/') or
  p in ('package.json','package-lock.json','.github/workflows/build-associative-exhaustive-families.yml','.github/workflows/materialize-associative-family-v5-repository.yml') or
  p.startswith('scripts/') and ('associative-family' in p or 'associative-exhaustive' in p or 'associative-etymology' in p or 'associative-index-core' in p)]
def inventory(root):
 return [{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':sha_file(p)} for p in sorted(pathlib.Path(root).rglob('*')) if p.is_file() and p!=pathlib.Path(root)/'SNAPSHOT.json']
def prepare(repo,work,commit):
 work=pathlib.Path(work);work.mkdir(parents=True,exist_ok=True);final=work/'snapshot'
 if final.exists():raise ValueError('Snapshot already exists; never overwrite')
 stage=work/'snapshot.partial'
 if stage.exists():raise ValueError('Incomplete prepare; use a new work directory')
 generation='3d71828f9bfa7ce6ea5f1814442a6604cb180c96'
 for required in (ORIGINAL,generation):
  if subprocess.run(['git','-C',str(repo),'cat-file','-e',required+'^{commit}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
   subprocess.run(['git','-C',str(repo),'fetch','--no-tags','origin',required],check=True)
  if git(repo,'rev-parse',required+'^{commit}').decode().strip()!=required:raise ValueError('pinned commit acquisition mismatch')
 head=git(repo,'rev-parse',commit+'^{commit}').decode().strip()
 extract_git(repo,head,tracked_paths(repo,head),stage/'current')
 extract_git(repo,ORIGINAL,[PREFIX],stage/'original')
 generation='3d71828f9bfa7ce6ea5f1814442a6604cb180c96'
 extract_git(repo,generation,['scripts','associativvordes/js','shared','package.json','package-lock.json','.github/workflows/build-associative-exhaustive-families.yml'],stage/'generation')
 # Explicitly include census code from the development checkout, separately from pinned production.
 shutil.copytree(pathlib.Path(repo)/'associativvordes/v5_baseline',stage/'tool',ignore=shutil.ignore_patterns('__pycache__'))
 files=inventory(stage)
 receipt={'schema_version':1,'tool_version':VERSION,'production_commit':head,'original_materialization_commit':ORIGINAL,'generation_commit':generation,
  'files':files,'inventory_sha256':hashlib.sha256(canonical(files)).hexdigest(),'source_assignments_available':False,
  'source_recovery':'original_git_materialized_member_rows_not_original_assignments'}
 atomic_json(stage/'SNAPSHOT.json',receipt);os.replace(stage,final)
 # Mode protection complements content hashes; owner can still change modes, so verification remains mandatory.
 for p in final.rglob('*'):
  if p.is_file():p.chmod(0o444)
 print(json.dumps({'prepared':str(final),'files':len(files),'bytes':sum(x['bytes'] for x in files),'inventory_sha256':receipt['inventory_sha256']}),flush=True)
 return receipt

def connect(path):
 db=sqlite3.connect(path);db.execute('pragma journal_mode=WAL');db.execute('pragma synchronous=FULL');db.execute('pragma cache_size=-32768');db.execute('pragma temp_store=FILE')
 db.executescript('''create table if not exists checkpoints(task text primary key,sha text not null,stats text not null) without rowid;
 create table if not exists families(id text primary key,canonical text,support integer,bucket text) without rowid;
 create table if not exists family_aliases(alias text,family text,primary key(alias,family)) without rowid;
 create table if not exists alias_targets(alias text,family text,primary key(alias,family)) without rowid;
 create table if not exists aliases(alias text primary key,bucket text) without rowid;
 create table if not exists current_lemmas(language text,id text,word text,normalized text,n integer,mismatch integer,primary key(language,id)) without rowid;
 create table if not exists source_lemmas(language text,id text,word text,normalized text,mismatch integer,primary key(language,id)) without rowid;
 create table if not exists issues(kind text,scope text,detail text);''');db.commit();return db

def run(snapshot,work,stop_after=None,crash_after=None):
 start=time.monotonic();snapshot=pathlib.Path(snapshot);work=pathlib.Path(work);work.mkdir(parents=True,exist_ok=True)
 lock=verify_snapshot(snapshot);expected={r['path']:r for r in lock['files']}
 if hashlib.sha256(canonical(lock['files'])).hexdigest()!=lock['inventory_sha256']:raise ValueError('Inventory lock mismatch')
 # DB identity cannot be reused against another snapshot or changed implementation.
 identity={'snapshot':sha_file(snapshot/'SNAPSHOT.json'),'implementation':sha_file(__file__),'version':VERSION}
 ident=work/'IDENTITY.json'
 if not ident.exists() and (work/'census.sqlite').exists():raise ValueError('Existing census database without identity')
 if ident.exists() and load(ident)!=identity:raise ValueError('Checkpoint belongs to other snapshot/code')
 atomic_json(ident,identity);db=connect(work/'census.sqlite');processed=0;skipped=0
 existing=work/'segments.json'
 segments=load(existing) if existing.exists() else []
 root=snapshot/'current'/PREFIX;original=snapshot/'original'/PREFIX
 def issue(kind,scope,detail):db.execute('insert into issues values(?,?,?)',(kind,scope,str(detail)[:1600]))
 def readpairs(path):
  try:
   yield from pairs(path)
  except (ValueError,EOFError,OSError) as error:
   issue('corrupt_shard',path.relative_to(snapshot).as_posix(),repr(error))
 def validate_row(row,scope):
  if not isinstance(row,dict) or not isinstance(row.get('lemma_id'),str) or not row['lemma_id'] or not isinstance(row.get('word'),str) or not row['word'] or not isinstance(row.get('normalized'),str):issue('invalid_lemma',scope,str(row));return False
  if not row.get('sources') or not row.get('components'):issue('missing_lexical_evidence',scope,row['lemma_id'])
  v=row.get('frequency_score')
  if not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=100:issue('invalid_frequency',scope,row['lemma_id'])
  components=row.get('components',[])
  if not isinstance(components,list):issue('invalid_component',scope,row['lemma_id']);return False
  for comp in components:
   if not isinstance(comp,dict) or not comp.get('canonical_candidate') or not isinstance(comp.get('evidence'),list) or not comp['evidence'] or any(not isinstance(e,dict) for e in comp['evidence']):
    issue('invalid_component',scope,row['lemma_id']);return False
  return True
 def checked(path):
  key=path.relative_to(snapshot).as_posix();record=expected.get(key)
  if not record or path.stat().st_size!=record['bytes'] or sha_file(path)!=record['sha256']:raise ValueError('Changed source bytes '+key)
  return record['sha256']
 tasks=[]
 for bi in range(256):tasks.append(('current',f'{bi:02x}',[root/'families'/f'{bi:02x}.json.gz',*[root/'members'/l/f'{bi:02x}.json.gz' for l in LANGS]]))
 for bi in range(256):tasks.append(('aliases',f'{bi:02x}',[root/'aliases'/f'{bi:02x}.json.gz']))
 for bi in range(256):tasks.append(('original',f'{bi:02x}',[original/'members'/l/f'{bi:02x}.json.gz' for l in LANGS]))
 try:
  for phase,b,paths in tasks:
   task=phase+':'+b;task_sha=hashlib.sha256(canonical([checked(p) for p in paths])).hexdigest()
   prior=db.execute('select sha from checkpoints where task=?',(task,)).fetchone()
   if prior:
    if prior[0]!=task_sha:raise ValueError('Changed completed bucket')
    skipped+=1;continue
   stats={'phase':phase,'bucket':b,'families':0,'memberships':0,'aliases':0,'family_relations':{},'member_evidence_types':{},'by_language':{},'heads_observed':0}
   with db:
    if phase=='current':
     local={};counts=collections.defaultdict(collections.Counter);aggregate={};family_rel=collections.Counter();member_rel=collections.Counter()
     for fid,f in readpairs(paths[0]):
      if fid in local:issue('duplicate_family',task,fid);continue
      stats['families']+=1
      if not isinstance(f,dict):issue('invalid_family_record',fid,type(f).__name__);continue
      local[fid]=f
      if not isinstance(f,dict) or f.get('id')!=fid or bucket(fid)!=b:issue('invalid_family_identity',fid,b)
      if not f.get('canonical') or not f.get('aliases') or not isinstance(f.get('support'),int) or f.get('support',0)<=0:issue('invalid_family',fid,'canonical/aliases/support')
      db.execute('insert or ignore into families values(?,?,?,?)',(fid,f.get('canonical'),f.get('support'),b))
      for alias in f.get('aliases',[]):
       if not isinstance(alias,str) or not alias:issue('invalid_family_alias',fid,alias);continue
       if db.execute('insert or ignore into family_aliases values(?,?)',(alias,fid)).rowcount==0:issue('duplicate_family_alias',fid,alias)
      family_rel.update(f.get('relation_types',[]));stats['heads_observed']+=bool(f.get('head_id') or f.get('lexical_head_id'))
     for lang,path in zip(LANGS,paths[1:]):
      seen_groups=set();stats['by_language'][lang]=0
      for fid,rows in readpairs(path):
       if fid in seen_groups:issue('duplicate_member_group',lang+':'+fid,b)
       seen_groups.add(fid)
       if fid not in local:issue('orphan_member_family',lang+':'+fid,b)
       if bucket(fid)!=b:issue('wrong_member_bucket',lang+':'+fid,b)
       if not isinstance(rows,list) or not rows:issue('empty_or_invalid_members',lang+':'+fid,b);continue
       seen=set()
       for row in rows:
        scope=lang+':'+fid
        if not validate_row(row,scope):continue
        lid=row['lemma_id']
        if lid in seen:issue('duplicate_membership',scope,lid)
        seen.add(lid);counts[fid][lang]+=1;stats['memberships']+=1;stats['by_language'][lang]+=1
        if row.get('family_id',fid)!=fid:issue('incompatible_member_family_reference',scope,lid)
        if row.get('head_id') or row.get('lexical_head_id'):issue('unverifiable_head_reference_v5',scope,lid)
        key=(lang,lid);old=aggregate.get(key)
        if old:
         if old[0]!=row['word'] or old[1]!=row['normalized']:issue('lemma_identity_collision',scope,lid)
         old[2]+=1
        else:aggregate[key]=[row['word'],row['normalized'],1]
        for comp in row.get('components',[]):member_rel.update(e.get('type','UNKNOWN') for e in comp.get('evidence',[]))
     for fid,f in local.items():
      actual=sum(counts[fid].values())
      if actual==0:issue('empty_family',fid,0)
      if f.get('support')!=actual:issue('support_mismatch',fid,[f.get('support'),actual])
      if any(counts[fid][l]!=f.get('language_support',{}).get(l,0) for l in LANGS):issue('language_support_mismatch',fid,dict(counts[fid]))
     db.executemany('''insert into current_lemmas values(?,?,?,?,?,0) on conflict(language,id) do update set
      n=n+excluded.n,mismatch=mismatch+(word!=excluded.word or normalized!=excluded.normalized)''',[(l,i,*v) for (l,i),v in aggregate.items()])
     stats['family_relations']=dict(family_rel);stats['member_evidence_types']=dict(member_rel)
    elif phase=='aliases':
     for alias,targets in readpairs(paths[0]):
      stats['aliases']+=1
      if bucket(alias)!=b:issue('wrong_alias_bucket',alias,b)
      if db.execute('insert or ignore into aliases values(?,?)',(alias,b)).rowcount==0:issue('duplicate_alias',alias,b)
      if not isinstance(targets,list) or not targets:issue('empty_or_invalid_alias',alias,b);continue
      if targets!=sorted(set(targets)):issue('unsorted_or_duplicate_alias_targets',alias,targets)
      for fid in targets:
       if not isinstance(fid,str) or not fid:issue('invalid_alias_target',alias,str(fid));continue
       db.execute('insert or ignore into alias_targets values(?,?)',(alias,fid))
    else:
     aggregate={}
     for lang,path in zip(LANGS,paths):
      for fid,rows in readpairs(path):
       if not isinstance(rows,list):issue('invalid_source_members',lang+':'+fid,type(rows).__name__);continue
       for row in rows:
        if not validate_row(row,lang+':'+fid):continue
        key=(lang,row['lemma_id']);v=(row['word'],row['normalized']);old=aggregate.get(key)
        if old and old!=v:issue('source_lemma_collision',str(key),v)
        aggregate[key]=v;stats['memberships']+=1
     db.executemany('''insert into source_lemmas values(?,?,?,?,0) on conflict(language,id) do update set
       mismatch=mismatch+(word!=excluded.word or normalized!=excluded.normalized)''',[(l,i,*v) for (l,i),v in aggregate.items()])
    # Crash before checkpoint/commit deliberately tests rollback of both writes and receipts.
    if crash_after is not None and processed+1==crash_after:os._exit(75)
    db.execute('insert into checkpoints values(?,?,?)',(task,task_sha,json.dumps(stats)))
   processed+=1
   if processed%16==0:print(json.dumps({'phase':phase,'bucket':b,'new_tasks':processed,'resumed_tasks':skipped}),flush=True)
   if stop_after is not None and processed>=stop_after:break
  elapsed=time.monotonic()-start
  segments.append({'seconds':elapsed,'new_tasks':processed,'resumed_tasks':skipped,'peak_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss})
  atomic_json(existing,segments)
  db.execute('pragma wal_checkpoint(TRUNCATE)')
  if db.execute('select count(*) from checkpoints').fetchone()[0]==len(tasks):
   verify_snapshot(snapshot);finish(db,snapshot,work,lock,segments)
 finally:db.close()
 return {'new_tasks':processed,'resumed_tasks':skipped}

def finish(db,snapshot,work,lock,segments):
 def n(q):return db.execute(q).fetchone()[0]
 def hist(q):return {str(k):v for k,v in db.execute(q)}
 stats=[json.loads(r[0]) for r in db.execute('select stats from checkpoints order by task')]
 source=n('select count(*) from source_lemmas');current=n('select count(*) from current_lemmas')
 unassigned=n('select count(*) from source_lemmas s left join current_lemmas c using(language,id) where c.id is null')
 current_not_source=n('select count(*) from current_lemmas c left join source_lemmas s using(language,id) where s.id is null')
 cross_identity=n('select count(*) from current_lemmas c join source_lemmas s using(language,id) where c.word!=s.word or c.normalized!=s.normalized')
 queries={'alias_orphan_targets':'select count(*) from alias_targets a left join families f on f.id=a.family where f.id is null',
  'missing_reverse_aliases':'select count(*) from family_aliases f left join alias_targets a using(alias,family) where a.family is null',
  'reverse_only_alias_pairs':'select count(*) from alias_targets a left join family_aliases f using(alias,family) where f.family is null',
  'current_identity_collisions':'select count(*) from current_lemmas where mismatch>0','source_identity_collisions':'select count(*) from source_lemmas where mismatch>0'}
 checks={k:n(q) for k,q in queries.items()};checks.update(current_not_in_source=current_not_source,cross_snapshot_identity_mismatches=cross_identity)
 relations=collections.Counter();evidence=collections.Counter();bylang=collections.Counter()
 for s in stats:
  if s['phase']=='current':relations.update(s['family_relations']);evidence.update(s['member_evidence_types']);bylang.update(s['by_language'])
 counts={'canonical_families':n('select count(*) from families'),'aliases':n('select count(*) from aliases'),
  'alias_target_pairs':n('select count(*) from alias_targets'),'memberships':n('select sum(n) from current_lemmas'),
  'source_lemma_records_recovered':source,'materialized_lemmas':current,'unassigned_lemmas':unassigned,
  'multi_family_lemmas':n('select count(*) from current_lemmas where n>1')}
 census={'schema_version':1,'tool_version':VERSION,'snapshot_inventory_sha256':lock['inventory_sha256'],'counts':counts,
  'buckets_visited':{'current':256,'aliases':256,'historical_source':256},'memberships_by_language':dict(bylang),
  'materialized_lemmas_by_language':hist('select language,count(*) from current_lemmas group by language'),
  'source_lemmas_by_language':hist('select language,count(*) from source_lemmas group by language'),
  'families_per_lemma_histogram':hist('select n,count(*) from current_lemmas group by n'),
  'lemmas_per_family_histogram':hist('select support,count(*) from families group by support'),
  'family_relation_type_counts':dict(relations),'member_component_evidence_counts':dict(evidence),
  'head_references':{'schema_has_head_registry':False,'family_heads_observed':sum(s['heads_observed'] for s in stats),'note':'v5 schema has no independent lexical-head registry; no v6 head verification claimed'},
  'source_equation':{'source':source,'materialized':current,'unassigned':unassigned,'holds':source==current+unassigned and current_not_source==0},
  'source_assignments_available':False,'source_kind':'historical materialized carrier rows; not original assignments'}
 damage=hist('select kind,count(*) from issues group by kind');integrity={'schema_version':1,'linguistic_correctness_certified':False,'structural_findings':damage,'cross_reference_checks':checks,
  'blockers':['Original source assignments and original metadata/members ZIP artifacts are unavailable; recovered source carriers do not certify original assignment provenance.'],
  'issue_details_location':'ISSUES.jsonl.gz (complete independent issue export)','samples':dict((k,[dict(scope=s,detail=d) for s,d in db.execute('select scope,detail from issues where kind=? limit 10',(k,))]) for k in damage)}
 if any(damage.values()) or any(v for k,v in checks.items() if k!='reverse_only_alias_pairs'):integrity['blockers'].append('Structural findings or unresolved cross-reference discrepancies require review.')
 historical={'families':2456543,'memberships':10078319,'aliases':1934050,'source':4924980,'materialized':4924281,'unassigned':699}
 actual={'families':counts['canonical_families'],'memberships':counts['memberships'],'aliases':counts['aliases'],'source':source,'materialized':current,'unassigned':unassigned}
 integrity['historical_controls']={k:{'expected':v,'actual':actual[k],'match':actual[k]==v} for k,v in historical.items()}
 integrity['verdict']='BLOCKED' if integrity['blockers'] else 'PASS_STRUCTURAL_ONLY'
 with gzip.open(work/'ISSUES.jsonl.gz','wt',encoding='utf-8') as out:
  for kind,scope,detail in db.execute('select kind,scope,detail from issues order by kind,scope,detail'):
   out.write(json.dumps(dict(kind=kind,scope=scope,detail=detail),ensure_ascii=False)+'\n')
 atomic_json(work/'FULL-CENSUS.json',census);atomic_json(work/'INTEGRITY-REPORT.json',integrity)
 with gzip.open(work/'UNASSIGNED-LEMMAS.jsonl.gz','wt',encoding='utf-8') as out:
  for row in db.execute('select s.language,s.id,s.word,s.normalized from source_lemmas s left join current_lemmas c using(language,id) where c.id is null order by s.language,s.id'):
   out.write(json.dumps(dict(zip(('language','lemma_id','word','normalized'),row)),ensure_ascii=False)+'\n')
 atomic_json(work/'RESOURCE-BENCHMARK.json',{'schema_version':1,'segments':segments,'seconds_total_completed_segments':sum(x['seconds'] for x in segments),
  'peak_rss_kib':max(x['peak_rss_kib'] for x in segments),'database_bytes':(work/'census.sqlite').stat().st_size,
  'snapshot_bytes':sum(x['bytes'] for x in lock['files']),'disk_work_bytes':sum(p.stat().st_size for p in work.rglob('*') if p.is_file()),
  'note':'Segments include source hash revalidation on resume; intentional hard-crash segment measured separately by supervisor.'})
 print(json.dumps({'complete':True,'counts':counts,'verdict':integrity['verdict'],'checks':checks,'findings':damage}),flush=True)

def verify_snapshot(root):
 root=pathlib.Path(root);lock=load(root/'SNAPSHOT.json')
 if hashlib.sha256(canonical(lock['files'])).hexdigest()!=lock['inventory_sha256']:raise ValueError('Invalid inventory digest')
 expected={x['path'] for x in lock['files']};actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p!=pathlib.Path(root)/'SNAPSHOT.json'}
 if expected!=actual:raise ValueError('Inventory path mismatch')
 for r in lock['files']:
  p=root/r['path']
  if p.is_symlink() or p.stat().st_size!=r['bytes'] or sha_file(p)!=r['sha256']:raise ValueError('Snapshot checksum mismatch: '+r['path'])
 return lock

def backup(snapshot,archive):
 snapshot=pathlib.Path(snapshot);archive=pathlib.Path(archive)
 verify_snapshot(snapshot)
 if archive.exists():raise ValueError('Backup already exists')
 with tarfile.open(str(archive)+'.partial','w') as tar:
  for p in sorted(snapshot.rglob('*')):
   if p.is_file():tar.add(p,arcname=p.relative_to(snapshot).as_posix(),recursive=False)
 with open(str(archive)+'.partial','rb') as f:os.fsync(f.fileno())
 os.replace(str(archive)+'.partial',archive)
 fd=os.open(archive.parent,os.O_RDONLY)
 try:os.fsync(fd)
 finally:os.close(fd)
 result={'archive_bytes':archive.stat().st_size,'archive_sha256':sha_file(archive),'snapshot_receipt_sha256':sha_file(snapshot/'SNAPSHOT.json')}
 atomic_json(str(archive)+'.receipt.json',result);return result

def restore(archive,destination,expected_hash):
 archive=pathlib.Path(archive);dest=pathlib.Path(destination)
 if dest.exists():raise ValueError('Restore destination must be new')
 if sha_file(archive)!=expected_hash:raise ValueError('Backup checksum mismatch')
 partial=pathlib.Path(str(dest)+'.partial')
 if partial.exists():raise ValueError('Incomplete restore exists; use new destination')
 partial.mkdir(parents=True);seen=set()
 with tarfile.open(archive,'r:') as tar:
  for m in tar:
   p=pathlib.PurePosixPath(m.name)
   if p.is_absolute() or '..' in p.parts or not m.isfile() or not p.parts or p.as_posix() in seen:raise ValueError('Unsafe/duplicate archive member')
   seen.add(p.as_posix());target=partial.joinpath(*p.parts);target.parent.mkdir(parents=True,exist_ok=True)
   with tar.extractfile(m) as inp,open(str(target)+'.partial','xb') as out:shutil.copyfileobj(inp,out,1024*1024);out.flush();os.fsync(out.fileno())
   os.replace(str(target)+'.partial',target)
 lock=verify_snapshot(partial);os.replace(partial,dest)
 return {'restore_verified':True,'files':len(lock['files']),'inventory_sha256':lock['inventory_sha256'],'restored_path':str(dest)}

def main():
 ap=argparse.ArgumentParser();sub=ap.add_subparsers(dest='command',required=True)
 p=sub.add_parser('prepare');p.add_argument('--repo',required=True);p.add_argument('--work',required=True);p.add_argument('--commit',required=True)
 p=sub.add_parser('census');p.add_argument('--snapshot',required=True);p.add_argument('--work',required=True);p.add_argument('--stop-after',type=int);p.add_argument('--crash-after',type=int)
 p=sub.add_parser('backup');p.add_argument('--snapshot',required=True);p.add_argument('--archive',required=True)
 p=sub.add_parser('restore');p.add_argument('--archive',required=True);p.add_argument('--destination',required=True);p.add_argument('--sha256',required=True)
 a=ap.parse_args()
 if a.command=='prepare':prepare(a.repo,a.work,a.commit)
 elif a.command=='census':run(a.snapshot,a.work,a.stop_after,a.crash_after)
 elif a.command=='backup':print(json.dumps(backup(a.snapshot,a.archive)))
 else:print(json.dumps(restore(a.archive,a.destination,a.sha256)))
if __name__=='__main__':main()


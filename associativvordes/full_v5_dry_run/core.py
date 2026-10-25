"""Pinned read-only sources and fail-closed empty-plan release, version 1."""
import hashlib,importlib.util,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PREFIX='associativvordes/family-index-v5'
MAIN='47723611112610945cb09b34e18588b7bd151911'
PARENT='4a13ffe867e5b9d2a11ecc761e00179ea61625b1'
LANGS=['en','de','fr','es','it','ru']
CATEGORIES=['STRUCTURAL','SCOPED_EXCLUSION','RELATION_CORRECTION','LEXICAL_IDENTITY','FAMILY_SPLIT','ALIAS_CHANGE','UNRESOLVED']
LAYERS=['STRUCTURAL_PILOT','SCOPED_FAMILY_EXCLUSIONS','MORPHOLOGY_CORRECTIONS','AUTHORIZED_LINGUISTIC','FULL_APPLICABLE_SET']
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def load(p):return json.loads(Path(p).read_bytes())
def atomic(p,b):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);fd,name=tempfile.mkstemp(dir=p.parent,prefix='.pending-')
 try:
  with os.fdopen(fd,'wb') as f:f.write(b);f.flush();os.fsync(f.fileno())
  os.replace(name,p);fd=os.open(p.parent,os.O_RDONLY);os.fsync(fd);os.close(fd)
 finally:
  if os.path.exists(name):os.unlink(name)
def save(p,x):atomic(p,canonical(x)+b'\n')
def outside(p):
 p=Path(p).resolve()
 if p==ROOT or p.is_relative_to(ROOT):raise ValueError('research-only destination outside checkout required')
 return p
def pinned(work):
 p=ROOT/'associativvordes/v5_baseline/census.py'
 from associativvordes.v5_contract.versions import capture
 contract=capture()
 target=outside(work);target.mkdir(parents=True,exist_ok=True)
 save(target/'INSTALLED-IMPLEMENTATION.json',contract)
 spec=importlib.util.spec_from_file_location('q12_installed_baseline',p)
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def verify_files(root,lock):
 root=Path(root);expected={r['path'] for r in lock['files']}
 if digest(lock['files'])!=lock['inventory_sha256']:raise ValueError('inventory hash')
 actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p!=root/'SNAPSHOT.json'}
 if actual!=expected:raise ValueError('missing/extra snapshot file')
 for r in lock['files']:
  raw=root/r['path'];p=raw.resolve()
  if not p.is_relative_to(root.resolve()) or raw.is_symlink() or p.stat().st_size!=r['bytes'] or sha(p)!=r['sha256']:raise ValueError('snapshot bytes differ '+r['path'])
def validate_plan(plan):
 body={k:v for k,v in plan.items() if k!='content_sha256'}
 if plan.get('content_sha256')!=digest(body):raise ValueError('immutable operation manifest checksum')
 if plan.get('operations')!=[] or plan.get('nonempty_application_supported') is not False:raise ValueError('NO_NONEMPTY_OR_UNREVIEWED_APPLICATION')
 if plan.get('categories')!={k:[] for k in CATEGORIES} or plan.get('semantic_gate')!='BLOCKED' or plan.get('unknown_proposals_applied')!=0:raise ValueError('invalid category/grant claim')
def inputs(work):
 """Retain all blockers. No automatic grant or nonempty writer exists."""
 from associativvordes.cleanup_quality.prepare import PROPOSALS
 work=outside(work);work.mkdir(parents=True,exist_ok=True);records=[]
 for s in PROPOSALS:
  p=ROOT/s;rs=[json.loads(x) for x in p.read_text().splitlines() if x.strip()]
  records.append(dict(path=s,sha256=sha(p),bytes=p.stat().st_size,rows=len(rs),role='CURRENT'))
  if rs:raise ValueError('NONEMPTY_PLAN_REQUIRES_NEW_EXACT_SCOPE_ADAPTER_AND_GRANTS: '+s)
 # Explicitly retain obsolete morphology manifests without treating them as active.
 for name in ['VERIFIED-RELATION-CORRECTIONS.ndjson','PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson']:
  p=ROOT/'audit/associative-v5-morphology-cleanup'/name
  records.append(dict(path=str(p.relative_to(ROOT)),sha256=sha(p),bytes=p.stat().st_size,rows=len(p.read_text().splitlines()),role='HISTORICAL_V1_NOT_APPLIED'))
 quality=ROOT/'audit/associative-v5-cleanup-quality';g=load(quality/'OPERATION-GATES.json')
 if g['qualified_scopes'] or g['semantic_gate']!='BLOCKED':raise ValueError('qualification changed; re-plan exact operations')
 from associativvordes.history_registry.registry import History
 hp=ROOT/'audit/associative-history-registry';current=load(hp/'CURRENT.json');h=History(ROOT,hp/current['snapshot'],current['sha256'])
 for r in load(quality/'CODE-LOCK.json')['files']:
  if sha(ROOT/r['path'])!=r['sha256']:raise ValueError('stale quality code '+r['path'])
 from associativvordes.v5_contract.versions import capture
 installed=capture()
 norm=dict(files=[dict(path=p,sha256=h) for p,h in installed['normative']['files'].items()])
 for r in norm['files']:
  b=(ROOT/r['path']).read_bytes()
  if hashlib.sha256(b).hexdigest()!=r['sha256']:raise ValueError('normative source mismatch')
  atomic(work/'pinned-normative'/Path(r['path']).name,b)
 paths=[quality/n for n in ['METRICS.json','OPERATION-GATES.json','FROZEN-GOLD-MANIFEST.json','FROZEN-SAMPLE-MANIFEST.json','HOLDOUT.json','VALIDATION.json','CODE-LOCK.json']]+[hp/'CURRENT.json',hp/current['snapshot'],ROOT/'audit/associative-national-correspondences/CURRENT.json',ROOT/'audit/associative-national-correspondences/NATIONAL-CORRESPONDENCE-REGISTRY.json',ROOT/'audit/associative-v5-morphology-cleanup/CURRENT.json',ROOT/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json']
 lock=dict(schema='full-v5-dry-run-inputs/1',implementation_commit=installed['git_commit'],baseline_source_commit=MAIN,baseline_commit=installed['git_commit'],normative_commit=installed['git_commit'],version_contract=installed,proposals=records,quality_gate='BLOCKED',history_snapshot_sha256=current['sha256'],history_coverage_complete=h.snapshot['coverage_complete'],history_decisions=len(h.decisions),history_conflicts=len(h.snapshot['conflicts']),qualified_operation_count=0,files=[dict(path=str(p.relative_to(ROOT)),sha256=sha(p),bytes=p.stat().st_size) for p in paths],normative_sources=norm,code={p.name:sha(p) for p in Path(__file__).parent.glob('*.py')})
 path=work/'SOURCE-LOCK.json'
 if path.exists() and load(path)!=lock:raise ValueError('input/code changed since checkpoint')
 save(path,lock)
 plan=dict(schema='full-v5-shadow-plan/1',source_lock_sha256=sha(path),operations=[],categories={k:[] for k in CATEGORIES},layers=LAYERS,unknown_proposals_applied=0,semantic_gate='BLOCKED',nonempty_application_supported=False,no_production_capability=True)
 save(work/'OPERATION-MANIFEST.json',dict(plan,content_sha256=digest(plan)));atomic(work/'OPERATIONS.ndjson',b'')
 return lock

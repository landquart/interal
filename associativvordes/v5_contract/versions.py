"""One implementation, immutable input versions and explicit research namespaces."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SCHEMA='interal-v5-contract/1'
NAMESPACES={'research-v5','TEST_ONLY-v5'}
COMPONENTS={
 'importers':'importers','pilot_quality':'pilot_evaluation','legacy_dry_run':'mass_dry_run',
 'normative':'normative','baseline':'v5_baseline','history':'history_registry',
 'adapter':'v5_adapter','diagnostics':'v5_diagnostics','structural':'structural_cleanup',
 'surface':'surface_cleanup','morphology':'morphology_cleanup','morphology_review':'morphology_review',
 'national':'national_correspondences','semantic':'semantic_cleanup','boundary':'family_boundary',
 'quality':'cleanup_quality','dry_run':'full_v5_dry_run','release':'release_control',
 'release_package':'v5_release_control','evidence':'evidence_graph','candidates':'candidate_search',
 'review':'review','annotation':'auto_annotation','contract':'v5_contract','integration':'v5_integration'}
# Data-flow dependencies, separate from the mechanically collected Python/JS imports.
DAG={'pilot_quality':['evidence','review'],'legacy_dry_run':['annotation','pilot_quality'],'importers':[],'normative':[],'baseline':['normative'],'history':['baseline','normative'],
 'adapter':['baseline','history'],'diagnostics':['adapter','history'],
 'structural':['baseline','diagnostics','history'],'surface':['diagnostics','structural','history'],
 'morphology':['adapter','surface'],'morphology_review':['morphology','history'],
 'national':['normative','morphology_review'],'semantic':['national','adapter'],
 'boundary':['semantic','diagnostics'],'quality_sample':['boundary','national','semantic'],'quality':['quality_sample','decision'],
 'dry_run':['quality','structural','baseline'],'release':['dry_run','quality','history','normative'],
 'release_package':['release'],'evidence':['adapter','importers'],'candidates':['evidence'],
 'review':['adapter','evidence','candidates'],'review_event':['review'],'decision':['review_event','normative'],'preview':['decision','quality'],'release_gate':['preview','release'],'annotation':['review'],'contract':[],'integration':['contract','release']}
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def file_sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def read(p):
 def pairs(items):
  out={}
  for k,v in items:
   if k in out:raise Blocked('duplicate manifest key: '+k)
   out[k]=v
  return out
 def invalid(v):raise Blocked('nonfinite JSON: '+v)
 return json.loads(Path(p).read_bytes(),object_pairs_hook=pairs,parse_constant=invalid)
class Blocked(ValueError):
 def __init__(self,reason):super().__init__('BLOCKED: '+reason)
def require(ok,reason):
 if not ok:raise Blocked(reason)
def implementation():
 result={}
 for name,folder in COMPONENTS.items():
  base=ROOT/'associativvordes'/folder
  files={str(p.relative_to(ROOT)):file_sha(p) for p in sorted(base.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and not p.name.startswith('test_') and p.suffix in {'.py','.mjs','.js','.json'}}
  require(bool(files),'component absent: '+name);result[name]=files
 return result

def capture(namespace='research-v5',fixture_history=None):
 require(namespace in NAMESPACES,'unsupported namespace; production is not a research capability')
 require(fixture_history is None or namespace=='TEST_ONLY-v5','fixture history cannot enter research/production')
 hp=ROOT/'audit/associative-history-registry';cur=read(hp/'CURRENT.json');hist=read(hp/cur['snapshot']);require(file_sha(hp/cur['snapshot'])==cur['sha256'],'historical snapshot hash')
 if fixture_history is not None:
  require(fixture_history.get('test_only') is True and fixture_history.get('coverage_complete') is True,'complete explicit test history required')
  require(all(r['family_id'].startswith('family:TEST_ONLY:') for r in fixture_history.get('constraints',[])),'foreign fixture history scope')
  history=dict(snapshot_sha256=digest(fixture_history),coverage_complete=True,conflicts=0,fixture=fixture_history)
 else:history=dict(snapshot_sha256=cur['sha256'],coverage_complete=hist['coverage_complete'],conflicts=len(hist['conflicts']),mode='RESEARCH_ONLY; incomplete coverage blocks every nonempty production operation')
 overlay=hp/'ADJUDICATION-CURRENT.json'
 if overlay.exists():
  pointer=read(overlay);relative=Path(pointer['registry'])
  require(not relative.is_absolute() and '..' not in relative.parts and (ROOT/relative).resolve().is_relative_to(ROOT),'unsafe adjudication contract path')
  require(file_sha(ROOT/relative)==pointer['sha256'],'adjudication snapshot hash')
  history['adjudication']=dict(pointer_sha256=file_sha(overlay),registry_sha256=pointer['sha256'],schema=pointer['schema'],mutation_authorization=False)
 norm=ROOT/'associativvordes/normative';baseline_path=ROOT/'audit/pr-review-679-694/FRESH-SHADOW-MANIFEST.json';base=read(baseline_path);source=ROOT/'data/morphology-evidence/sources/source-lock.json';algorithms=implementation()
 sha=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True).strip()
 current_tree=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD:associativvordes/family-index-v5'],text=True).strip()
 baseline_tree=read(Path(__file__).with_name('baseline.json'))['production_tree']
 require(current_tree==baseline_tree or namespace=='TEST_ONLY-v5','baseline data changed; a new certified baseline is required')
 tracked=set(subprocess.check_output(['git','-C',str(ROOT),'ls-files'],text=True).splitlines())
 changed=set(subprocess.check_output(['git','-C',str(ROOT),'diff','HEAD','--name-only'],text=True).splitlines())
 executable={p for files in algorithms.values() for p in files}
 uncommitted=sorted((executable-tracked)|(changed&executable)|{p for p in changed if p.startswith(('associativvordes/family-index-v5/','data/morphology-evidence/','associativvordes/normative/'))})
 import ast
 declared={}
 for component,files in algorithms.items():
  values=set()
  for path in files:
   if not path.endswith('.py'):continue
   tree=ast.parse((ROOT/path).read_text())
   for node in ast.walk(tree):
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in {'SCHEMA','VERSION'} for t in node.targets) and isinstance(node.value,ast.Constant) and isinstance(node.value.value,str):values.add(node.value.value)
    if isinstance(node,ast.keyword) and node.arg=='schema' and isinstance(node.value,ast.Constant) and isinstance(node.value.value,str):values.add(node.value.value)
  declared[component]=sorted(values)
 body=dict(schema=SCHEMA,namespace=namespace,git_commit=sha,uncommitted_source_files=uncommitted,declared_schema_versions=declared,
  normative=dict(version=read(norm/'rules.json')['version'],files={str(p.relative_to(ROOT)):file_sha(p) for p in sorted(norm.iterdir()) if p.is_file()}),
  baseline=dict(version='v5-baseline-1.0.0',inventory_sha256=base['inventory_sha256'],manifest_sha256=file_sha(baseline_path),structural_projection_manifest_sha256=file_sha(ROOT/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json'),source_commit='47723611112610945cb09b34e18588b7bd151911'),
  history=history,sources=dict(manifest='data/morphology-evidence/sources/source-lock.json',sha256=file_sha(source)),algorithms=algorithms,
  schemas={p:h for files in algorithms.values() for p,h in files.items() if p.endswith('.schema.json')},capabilities=dict(production_write=False,research_preview=True,semantic_release=False))
 body['version']=digest(body);return body

def validate(contract,namespace=None):
 require(isinstance(contract,dict) and contract.get('schema')==SCHEMA,'missing/incompatible version contract; no implicit legacy conversion')
 require(contract.get('namespace') in NAMESPACES,'invalid namespace')
 if namespace is not None:require(contract['namespace']==namespace,'cross-namespace input')
 require(all(isinstance(contract.get(k),dict) for k in ['normative','baseline','history','sources','algorithms','schemas']),'malformed version fields')
 body={k:v for k,v in contract.items() if k!='version'};require(contract.get('version')==digest(body),'version contract checksum')
 fixture=contract.get('history',{}).get('fixture');actual=capture(contract['namespace'],fixture)
 require(contract['namespace']=='TEST_ONLY-v5' or not actual['uncommitted_source_files'],'uncommitted implementation is not a research release')
 require(contract==actual,'source, commit, normative, baseline, history, algorithm or schema version drift')
 return contract

def compatible(left,right):
 validate(left);validate(right);require(left==right,'incompatible releases; no silent conversion');return True

def seal(stage,payload,contract,parents=()):
 validate(contract);require(stage in DAG,'unknown stage')
 for parent in parents:open_envelope(parent,contract)
 body=dict(schema='interal-v5-stage/1',stage=stage,version_contract=contract,parents=[p['sha256'] for p in parents],payload=payload)
 return dict(body,sha256=digest(body))
def open_envelope(value,expected):
 require(isinstance(value,dict) and value.get('schema')=='interal-v5-stage/1','unversioned research artifact')
 require(value.get('stage') in DAG,'unknown stage')
 require(value.get('sha256')==digest({k:v for k,v in value.items() if k!='sha256'}),'stage content checksum')
 compatible(value['version_contract'],expected);return value['payload']


def database_binding(path,contract,table):
 """Read-only preflight. Incompatible opens do not mutate even one DB byte."""
 import sqlite3
 if contract is not None:validate(contract)
 if str(path)==':memory:' or not Path(path).exists():return
 db=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
 try:
  tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
  previous=db.execute("SELECT v FROM v5_version_meta WHERE k='contract'").fetchone() if 'v5_version_meta' in tables else None
  if previous:
   require(contract is not None and json.loads(previous[0])==contract,'versioned database requires the exact installed contract')
  elif contract is not None and table in tables:
   require(db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]==0,'legacy database requires a fresh namespace')
 finally:db.close()


def directory_files(folder):
 folder=Path(folder).resolve();records=[]
 for p in sorted(folder.rglob('*')):
  if not p.is_file() or p==folder/'V5-INTEGRATION.json':continue
  require(not p.is_symlink() and p.resolve().is_relative_to(folder),'unsafe research artifact path')
  records.append(dict(path=str(p.relative_to(folder)),bytes=p.stat().st_size,sha256=file_sha(p)))
 return records

def bind_directory(folder,stage,contract,parents=()):
 folder=Path(folder).resolve();require(not folder.is_relative_to(ROOT),'research output outside implementation checkout required')
 receipt=seal(stage,dict(files=directory_files(folder),production_writes=0),contract,parents)
 path=folder/'V5-INTEGRATION.json';require(not path.exists(),'immutable release binding already exists')
 write_receipt(path,canonical(receipt)+b'\n');return receipt

def require_directory(folder,stage,expected=None):
 folder=Path(folder).resolve();path=folder/'V5-INTEGRATION.json'
 require(path.is_file(),'unversioned/archived '+stage+' input; fresh compatible release required')
 receipt=read(path);contract=receipt.get('version_contract');validate(contract)
 compatible(contract,expected if expected is not None else capture('research-v5'))
 require(receipt['stage']==stage,'wrong component input type')
 payload=open_envelope(receipt,contract);require(payload['files']==directory_files(folder),'research source directory changed')
 return receipt


def write_receipt(path,data):
 """Atomic publication without an upward import into release_control."""
 import os,tempfile
 path=Path(path);fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.pending-')
 try:
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.link(tmp,path) # Atomic no-clobber: a concurrent publisher cannot replace a receipt.
  fd=os.open(path.parent,os.O_RDONLY)
  try:os.fsync(fd)
  finally:os.close(fd)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)

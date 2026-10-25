"""Candidate writer inventory and documentary native-ID case cross references."""
from pathlib import Path
import json,hashlib,subprocess,re,gzip,argparse,os
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--restored',required=True);p.add_argument('--output',required=True);a=p.parse_args();os.chdir(a.repo)
pub=Path(a.output);src=Path(a.restored);old=json.loads((src/'REGISTRY.json').read_text());cases=[]
names=['genea-german-decision.json','genea-other-languages-decision.json','sonus-language-decisions.json','nitidus-family-decisions.json','surface-ending-decisions.json']
for s in old['sources']:
 if not any(s['path'].endswith('/'+n) for n in names) and not ('/regul-20261008/decisions/' in s['path'] and s['path'].endswith('.json')):continue
 raw=(src/'objects'/s['blob']).read_bytes()
 if raw[:2]==b'\x1f\x8b':raw=gzip.decompress(raw)
 x=json.loads(raw);families=set()
 def walk(v):
  if isinstance(v,dict):
   for k,z in v.items():
    if k in ['family_id','canonical_family_id','deleted_duplicate_family_id'] and isinstance(z,str):families.add(z)
    walk(z)
  elif isinstance(v,list):
   for z in v:walk(z)
 walk(x)
 cases.append(dict(source=s,native_family_ids=sorted(families),prior_constraint_ids=[d['id'] for d in old['decisions'] if d['scope'].get('family_id') in families],status='DOCUMENTARY_SCOPE_ONLY_SEMANTIC_UNRESOLVED',spelling_expansion=False,automatic_restoration=False,automatic_family_equivalence=False))
(pub/'NEGATIVE-CASE-COVERAGE.json').write_text(json.dumps(cases,indent=2)+'\n')
paths=subprocess.check_output(['git','ls-files'],text=True).splitlines();rows=[]
for p in paths:
 f=Path(p)
 if not f.is_file() or f.suffix not in ['.py','.js','.mjs','.sh','.yml','.yaml']:continue
 t=f.read_text(errors='replace')
 py=f.suffix=='.py' and bool(re.search(r'write_text|write_bytes|sqlite3.connect|shutil\.(copy|move|rmtree)',t))
 js=f.suffix in ['.js','.mjs'] and bool(re.search(r'writeFile|appendFile|createWriteStream|copyFile|\brename\(|\bmkdir\(',t))
 shell=f.suffix in ['.sh','.yml','.yaml'] and bool(re.search(r'git push|family-index-v[56]',t))
 if py or js or shell:rows.append(dict(path=p,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),guard='PYTHON_PACKAGE_AND_BOOTSTRAP' if py and ('mutation_guard' in t or p.startswith('associativvordes/')) else 'NODE_INSTALLED_FENCE' if js and ('installed-history-fence' in t) else 'WORKFLOW_UNCONDITIONAL_BLOCK' if 'Block uncertified historical materialization' in t else 'REVIEW_REQUIRED_OR_RESEARCH_ONLY',production_path_mentioned=bool(re.search(r'family-index-v[56]',t))))
(pub/'WRITER-COVERAGE.json').write_text(json.dumps(dict(schema='interal-writer-coverage/1',method='Tracked source scan and explicit imports; candidate inventory is not proof of arbitrary syscall containment',paths=rows,unclassified_paths_require_review=True,arbitrary_native_processes_fenced=False,certified_production_materializer_available=False,status='BLOCKED_PENDING_COMPLETE_MUTATION_PATH_REVIEW'),indent=2)+'\n');print(len(rows),len(cases))

#!/usr/bin/env python3
"""Complete indexed join of configured tail tokens to the full immutable registry.

This detects exposure to a generation mechanism, never linguistic inflection or
an invalid family. Normalization reproduces legacy routing, not a permitted
national correspondence.
"""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,json,subprocess,sys
from pathlib import Path
from associativvordes.v5_diagnostics.tools.query import open_registry,filehash
pass
from associativvordes.v5_diagnostics.classify import canonical,digest
ROOT=Path(__file__).resolve().parents[3]
JS="""
import {getLanguageConfig} from './associativvordes/js/morphology/languages/index.js';
import {buildSearchForm} from './associativvordes/js/root-matcher.js';
const rows=[];
for(const language of ['en','de','fr','es','it','ru']){
 const c=getLanguageConfig(language);
 for(const role of ['derivationalSuffixes','inflectionalEndings'])for(const t of c[role]||[]){
  rows.push({language,configured_role:role,original_form:t.form,legacy_normalized:buildSearchForm(t.form).replace(/[^a-z0-9]/g,'')});
 }
}
process.stdout.write(JSON.stringify(rows));
"""
def audit(registry):
 db,m=open_registry(registry)
 try:
  tokens=json.loads(subprocess.check_output(['node','--input-type=module','-e',JS],cwd=ROOT,text=True));grouped={}
  for t in tokens:
   if not t['legacy_normalized']:continue
   fid='surface:'+t['language']+':'+t['legacy_normalized'];grouped.setdefault(fid,[]).append(t)
  exposed=[];absent=[];extra_n=0;extra_m=0
  selected={'ENDING_PREFIX_DIVERSITY_PROXY','SURFACE_ONLY_LINK_CLAIM','MIXED_DERIVATION_INFLECTION_CLAIMS','ALLOMORPH_SCOPE_UNVERIFIED','EXACT_DUPLICATE_MEMBER_SET','ALIAS_FANOUT','LARGE_FAMILY','HISTORICAL_EXCLUSION_OVERLAP'}
  roles={};pure={};sources={}
  for fid,inventory in sorted(grouped.items()):
   row=db.execute('SELECT n,body FROM families WHERE id=?',(fid,)).fetchone()
   if not row:absent.append(dict(candidate_family_id=fid,configured_tokens=inventory,status='NOT_MATERIALIZED; not restored'));continue
   n,body=row;f=json.loads(body);flags=[x[0] for x in db.execute('SELECT flag FROM flags WHERE family=? ORDER BY flag',(fid,))];types=sorted({t['configured_role'] for t in inventory})
   for role in types:
    v=roles.setdefault(role,dict(families=0,memberships_in_affected_families=0));v['families']+=1;v['memberships_in_affected_families']+=n
   if not selected.intersection(flags):extra_n+=1;extra_m+=n
   priority=json.loads(db.execute('SELECT body FROM priority WHERE family=?',(fid,)).fetchone()[0])
   exposed.append(dict(family_id=fid,canonical=f['canonical'],configured_tokens=inventory,configured_roles=types,memberships=n,flags=flags,existing_priority=priority,semantic_status='UNRESOLVED',scope='entire current family envelope; not a confirmed inflection relation'))
  for language in ['en','de','fr','es','it','ru']:
   p=ROOT/f'associativvordes/js/morphology/languages/{language}.js';sources[str(p.relative_to(ROOT))]=filehash(p)
  for name in ['associativvordes/js/root-matcher.js','associativvordes/js/morphology/languages/index.js','associativvordes/js/morphology/languages/base.js','associativvordes/js/search-normalizer.js']:
   sources[name]=filehash(ROOT/name)
  coverage=json.loads((Path(registry)/'SUMMARY.json').read_bytes())['selected_signal_union']
  return dict(schema='v5-configured-tail-exposure/1',registry_version=m['version'],registry_sha256=m['database_sha256'],source_code_sha256=sources,configured_tokens=len(tokens),distinct_candidate_family_ids=len(grouped),matched_families=len(exposed),memberships_in_matched_families=sum(x['memberships'] for x in exposed),by_configured_role=roles,roles_overlap_not_additive=True,records=exposed,absent_candidates=absent,
   combined_signal_union=dict(families=coverage['families']+extra_n,memberships_in_affected_families=coverage['memberships_in_affected_families']+extra_m,additional_families_outside_core_signals=extra_n,additional_memberships_outside_core_signals=extra_m),
   semantics='Configured roles are generator settings, not independently validated morphological roles. Legacy string routing does not create a permitted national correspondence.',selection_complete_over_full_registry=True,production_writes=0)
 finally:db.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--registry',required=True);p.add_argument('--output',required=True);a=p.parse_args();r=audit(a.registry);Path(a.output).write_bytes(canonical(r)+b'\n');print(json.dumps({k:r[k] for k in ['matched_families','memberships_in_matched_families','configured_tokens']}))

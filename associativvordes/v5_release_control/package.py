"""Read-only v5 release readiness packages. No materializer or promotion capability.

Reuses release_control canonical hashes, atomic writes and external-store guard.
An integrity-valid BLOCKED package is not a release, approval or verifier verdict.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile

from associativvordes.release_control.control import canonical, digest, atomic, external, require

ROOT = Path(__file__).resolve().parents[2]
AUDIT = 'audit/associative-v5-'
QUALITY = AUDIT+'cleanup-quality/'
DRY = AUDIT+'full-dry-run/'
HISTORY = 'audit/associative-history-registry/'
OUTPUTS = ('RELEASE-MANIFEST.json','BEFORE-AFTER-SUMMARY.json','INTEGRITY-REPORT.json',
           'QUALITY-REPORT.json','ROLLBACK-RECEIPT.json','GATES.json',
           'UNRESOLVED-INDEX.json','SOURCE-LOCK.json','REMOTE-OBSERVATIONS.json',
           'FINAL-CLEANUP-AUDIT.md')

def pairs(items):
 result={}
 for k,v in items:
  require(k not in result,'duplicate JSON key: '+k);result[k]=v
 return result

def loads(raw):
 def invalid(value):raise ValueError('nonfinite JSON '+value)
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=invalid)

def file_sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for part in iter(lambda:f.read(1048576),b''):h.update(part)
 return h.hexdigest()

def safe_file(root,name):
 p=PurePosixPath(name)
 require(not p.is_absolute() and p.parts and all(x not in ('..','.') for x in p.parts),'unsafe input path')
 root=Path(root).resolve();target=root.joinpath(*p.parts)
 require(target.resolve().is_relative_to(root),'input outside repository')
 require(all(not root.joinpath(*p.parts[:i]).is_symlink() for i in range(1,len(p.parts)+1)),'symlink input')
 require(target.is_file(),'missing input: '+name)
 return target

def inventory(repo,config):
 rows=[];seen=set()
 for expected in config['files']:
  name=expected['path'];require(name not in seen,'duplicate input record');seen.add(name)
  p=safe_file(repo,name);row=dict(path=name,bytes=p.stat().st_size,sha256=file_sha(p))
  require(row==expected,'stale or incompatible input: '+name);rows.append(row)
 return rows

def operation_inventory(repo,declared):
 result=[]
 for row in declared['inputs']:
  p=safe_file(repo,row['path']);count=0
  with p.open('rb') as f:
   for raw in f:
    if raw.strip():
     require(isinstance(loads(raw),dict),'invalid operation record');count+=1
  actual=dict(path=row['path'],bytes=p.stat().st_size,sha256=file_sha(p),rows=count)
  require(actual==row,'proposal manifest mismatch: '+row['path']);result.append(actual)
 require(sum(x['rows'] for x in result)==declared['operation_count'],'operation total mismatch')
 return result

def compile_package(repo,observations,config_path=None):
 repo=Path(repo).resolve();cp=Path(config_path) if config_path else ROOT/'associativvordes/v5_release_control/INPUTS.json'
 config=loads(cp.read_bytes());records=inventory(repo,config)
 def read(name):return loads(safe_file(repo,name).read_bytes())
 require(observations['source_commit']==config['source_commit'],'observation/research revision mismatch')
 gates=[]
 def gate(name,ok,reason):gates.append(dict(id=name,status='PASS' if ok else 'BLOCKED',reason=reason))
 baseline=config['production_baseline_commit']
 gate('PRODUCTION_MATCHES_RECORDED_BASELINE',observations['production_main_commit']==baseline and observations['production_v5_tree']==observations['research_v5_tree'],'Point-in-time Git HEAD/tree equality only; no owner approval or live CDN-byte audit implied')
 gate('OWNER_APPROVED_BASELINE',False,'No current signed owner-approved production baseline is available')
 gate('INPUT_ARTIFACT_INTEGRITY',True,'All pinned report and proposed-operation bytes verified against INPUTS.json')
 proposals=operation_inventory(repo,read(QUALITY+'PROPOSAL-INVENTORY.json'));n=sum(x['rows'] for x in proposals)
 gate('NONEMPTY_OPERATION_MANIFEST',n>0,'Empty proposals do not constitute a cleaned release')
 admission=read(QUALITY+'OPERATION-GATES.json');gold=read(QUALITY+'GOLD-STATUS.json');holdout=read(QUALITY+'HOLDOUT.json');metrics=read(QUALITY+'METRICS.json')
 gate('EXACT_SCOPE_QUALITY_QUALIFICATION',False,'No v5 execution adapter accepts grants; current qualified_scopes='+str(len(admission['qualified_scopes'])))
 gate('INDEPENDENT_HUMAN_GOLD',gold['verified_gold_labels']>0 and metrics['human_review_count']>0,'Templates and model predictions are not human decisions')
 gate('INDEPENDENT_HOLDOUT',holdout['independence_certification']=='PASS' and holdout['protocol_calibration']=='PASS','Historical exposure/linkage must be independently resolved')
 hc=read(HISTORY+'COVERAGE.json');hp=read(HISTORY+'CURRENT.json')
 require(hc['snapshot_sha256']==hp['sha256'],'history pointer differs from coverage')
 gate('COMPLETE_HISTORY',hc['status']=='PASS','Known adapters and authority adjudication remain incomplete')
 gate('NO_UNRESOLVED_HISTORY_CONFLICTS',hc['history_conflicts']==0,'Conflicts cannot be resolved by last-entry-wins')
 run=read(DRY+'RUN.json');plan=read(DRY+'OPERATION-MANIFEST.json')
 require(plan['content_sha256']==digest({k:v for k,v in plan.items() if k!='content_sha256'}),'operation plan checksum differs')
 require(plan['source_lock_sha256']==file_sha(safe_file(repo,DRY+'SOURCE-LOCK.json')),'dry-run source lock differs')
 drift=[]
 for row in read(DRY+'CODE-LOCK.json')['files']:
  p=safe_file(repo,row['path']);observed=file_sha(p)
  if observed!=row['sha256']:drift.append(dict(path=row['path'],executed_sha256=row['sha256'],current_sha256=observed))
 gate('CURRENT_FULL_DRY_RUN',False,'Historical full empty-plan run is not a fresh execution after completion-gate patch; code drift='+str(len(drift)))
 gate('NONEMPTY_FULL_DRY_RUN',run.get('nonempty_cleanup_validated') is True and run.get('applied_operations',0)>0,'Identical baseline replay cannot certify a changed v5 materialization')
 gate('V5_MATERIALIZER',False,'PR 678 STATE/graph/registry adapters do not generate or promote full static v5 buckets; no v5 writer implemented here')
 gate('EXACT_OWNER_APPROVAL',False,'No approved exact release exists; prompt authorizes development, not production changes')
 gate('INDEPENDENT_VERIFIER_ATTESTATION',False,'No signed checks for a nonempty production v5 materialization')
 rollback=read(DRY+'ROLLBACK-VALIDATION.json');backup=read(DRY+'BACKUP-RESTORE-REPORT.json');integrity=read(DRY+'BEFORE-INTEGRITY-REPORT.json')
 gate('CHANGED_RELEASE_BACKUP_ROLLBACK',False,'Historical empty-plan restoration is retained; nonempty staged rollback untested')
 gate('ORIGINAL_SOURCE_PROVENANCE',not integrity['blockers'],'Original assignments and original generation ZIPs remain unavailable')
 gate('CALCULATOR_SEMANTIC_INPUTS',False,'A/P, verified support senses and scored model bindings are absent; FAv is unknown')
 gate('STAGED_RUNTIME_BROWSER_CALCULATION',False,'No changed v5 staging exists; old regression results do not certify nonempty changes')
 gate('POST_PUBLICATION_AUDIT',False,'NOT_RUN: publication is blocked')
 gate('APPLY_TIME_HEAD_CAS',False,'Only a recorded remote observation is available; promotion remains unsupported')
 blocked=[x['id'] for x in gates if x['status']!='PASS']
 source=dict(schema='v5-release-source-lock/1',research_commit=config['source_commit'],production_observation=observations,
             input_config_sha256=file_sha(cp),inputs=records,proposals=proposals,executed_dry_run_code_drift=drift,
             compiler_sha256=file_sha(__file__),release_controller_sha256=file_sha(ROOT/'associativvordes/release_control/control.py'),
             completion_validator_sha256=file_sha(ROOT/'associativvordes/full_v5_dry_run/completion.py'))
 manifest=dict(schema='v5-controlled-release-package/1',status='BLOCKED_NO_RELEASE_CANDIDATE',approved_release_id=None,
   production_head=observations['production_main_commit'],recorded_baseline=baseline,approved_baseline=None,
   operation_manifests=proposals,proposed_operation_count=n,applied_operation_ids=[],approved_operation_ids=[],
   before_inventory=backup['inventory_sha256'],after_inventory=None,
   source_lock_sha256=digest(canonical(source)+b'\n'),gates_sha256=digest(canonical(gates)+b'\n'),
   publication_allowed=False,owner_approval=None,verifier_attestation=None,materializer_implemented=False,
   data_release_pr_created=False,data_release_pr_reason='No approved operations or staged changed v5; an empty PR would imply a nonexistent release',
   production_writes=0,blockers=blocked)
 counts=run['counts']
 summary=dict(schema='v5-cleanup-before-after/1',counts_kind='Historical full census, linked to equal Git v5 trees; no new full recount',
   before=counts,current_unchanged=counts,after_cleaned_release=None,families_before=counts['canonical_families'],
   families_remaining_unchanged=counts['canonical_families'],memberships_removed=0,memberships_corrected=0,
   families_split=0,families_merged=0,unassigned_lemmas_preserved=counts['unassigned_lemmas'],
   concrete_proposed_operations=n,concrete_blocked_operations=n,blocked_gates=len(blocked),
   hypothetical_candidate_operations_not_counted=True,production_writes=0)
 qreport=dict(schema='v5-final-quality/1',status='BLOCKED',human_gold=gold,holdout=holdout,admission=admission,
              precision=None,false_removal_rate=None,recall=None,inter_annotator_agreement=None,
              semantic_certification=False,reason='No independent human labels; zero operations is not zero risk')
 irept=dict(schema='v5-final-integrity/1',status='BLOCKED_FOR_RELEASE',pinned_inputs_verified=True,
   production_git_tree_equal=observations['production_v5_tree']==observations['research_v5_tree'],
   historical_structural_checks=integrity,historical_dry_run=run,full_current_recount_performed=False,
   fresh_completion_validation_performed=False,live_production_bytes_verified=False,
   linguistic_correctness_certified=False,post_publication_checks='NOT_RUN_NO_PUBLICATION')
 rreport=dict(schema='v5-final-rollback/1',status='NOT_EXECUTED_NO_RELEASE',historical_backup=backup,
   historical_rollback=rollback,current_nonempty_rollback_verified=False,rollback_operation_ids=[],production_writes=0)
 morph=read(AUDIT+'morphology-cleanup/semantic-review-v2/SUMMARY.json');surface=read(AUDIT+'surface-cleanup/SUMMARY.json')
 semantic=read(AUDIT+'semantic-cleanup/COVERAGE.json');boundary=read(AUDIT+'family-boundary/SUMMARY.json');diagnostic=read(AUDIT+'diagnostics/SUMMARY.json')
 queue_paths=[AUDIT+'diagnostics/REGISTRY-MANIFEST.json',AUDIT+'surface-cleanup/COMPLETE-RUN-MANIFEST.json',
   AUDIT+'morphology-cleanup/semantic-review-v2/QUEUE-MANIFEST.json',AUDIT+'semantic-cleanup/SCOPE-MANIFEST.json',
   AUDIT+'semantic-cleanup/RELEASE-MANIFEST.json',AUDIT+'family-boundary/RELEASE-MANIFEST.json',
   AUDIT+'family-boundary/ARCHIVE-VOLUMES.json',HISTORY+'CURRENT.json',HISTORY+'COVERAGE.json',
   'audit/associative-national-correspondences/UNRESOLVED-CONFLICTS.ndjson',AUDIT+'structural-cleanup/REVIEW-REQUIRED.ndjson']
 unresolved=dict(schema='v5-unresolved-index/1',scopes_overlap=True,total_distinct_union=None,
   complete_union_not_recomputed=True,large_id_sets_referenced_not_copied=True,large_artifacts_reopened_this_stage=False,
   source_commit=config['source_commit'],manifests=[r for r in records if r['path'] in queue_paths],
   all_registry_semantic_memberships_unresolved=diagnostic['semantic']['unresolved_memberships'],
   surface_candidate_families=surface['totals']['candidate_families'],surface_candidate_memberships=surface['totals']['candidate_memberships'],
   morphology_unresolved_memberships=morph['statuses']['INSUFFICIENT_EVIDENCE'],
   semantic_priority_memberships=semantic['priority_memberships'],sense_splits=semantic['split_required_rows'],
   boundary_candidate_groups=boundary['candidate_groups'],boundary_distinct_families=boundary['distinct_candidate_families'],
   boundary_memberships=boundary['memberships_in_distinct_candidate_families'],history_conflicts=hc['history_conflicts'],
   uninterpreted_history_observations=hc['uninterpreted_observations'],full_human_review_tasks=gold['required_main_independent_reviews'])
 files={'RELEASE-MANIFEST.json':manifest,'BEFORE-AFTER-SUMMARY.json':summary,'INTEGRITY-REPORT.json':irept,
   'QUALITY-REPORT.json':qreport,'ROLLBACK-RECEIPT.json':rreport,'GATES.json':gates,'UNRESOLVED-INDEX.json':unresolved,
   'SOURCE-LOCK.json':source,'REMOTE-OBSERVATIONS.json':observations}
 result={k:canonical(v)+b'\n' for k,v in files.items()}
 result['FINAL-CLEANUP-AUDIT.md']=report(manifest,summary,unresolved).encode()
 return result

def report(m,s,u):
 return f'''# Итоговый аудит допуска очистки v5

Статус: **BLOCKED_NO_RELEASE_CANDIDATE**. Production не изменён. Этап 13 не
завершён контролируемым выпуском: готового к утверждению очищенного выпуска нет.
Этот пакет фиксирует проверенные причины отказа, а не разрешение публикации.

PR №678 объединён в main `{m['production_head']}`. Он предоставляет подписанные
точные операции, immutable STATE версии, checks, verifier/owner approvals,
atomic CURRENT, backup и компенсирующий rollback исследовательского store.
Его STATE/graph/mass-registry пакет не материализует static production v5 и не
разрешает merge или переключение runtime. Эти ограничения сохранены.

Исторический полный dry-run пересчитал пустой план. После исправления completion
gate в PR №693 текущий код не прошёл новый полный обход. Утверждений о полном
непустом применении, свежем staging, rollback или аудите опубликованных bytes нет.

| Показатель | Значение |
|---|---:|
| Семьи до / текущий неизменённый реестр | {s['families_before']} |
| Memberships текущего реестра | {s['before']['memberships']} |
| Aliases | {s['before']['aliases']} |
| Удалено memberships | 0 |
| Исправлено memberships | 0 |
| Разделено / объединено семей | 0 / 0 |
| Сохранено лексем без семьи | {s['unassigned_lemmas_preserved']} |
| Конкретных proposed / blocked операций | {s['concrete_proposed_operations']} / {s['concrete_blocked_operations']} |
| Не пройдено gates | {s['blocked_gates']} |

Числа корпуса взяты из прежнего полного census и связаны с наблюдаемым равным
Git subtree. Новый recount и проверка фактических CDN bytes здесь не выполнены.
Нулевое число blocked операций означает отсутствие конкретных proposed operations,
а не отсутствие рисков или разрешение будущих исключений.

Полные причины — GATES.json. Нет независимого human gold, сертифицированного
holdout, полной истории и точных scope grants, owner approval и verifier
attestation. Историческое OWNER_ACCEPTED_AT_RISK не использовано. Вопросы
исходного provenance, A/P и FAv остаются нерешёнными. Неизвестные метрики
качества и after очищенного выпуска сохранены null.

## Неопределённые случаи

Полные ID-наборы остаются в закреплённых manifests и прежних исследовательских
архивах; UNRESOLVED-INDEX.json содержит точные refs, версии и SHA-256.
В этом этапе большие архивы не переоткрывались, полнота их хранения заново не
сертифицирована. Очереди пересекаются; их размеры нельзя складывать:

- В полном реестре {u['all_registry_semantic_memberships_unresolved']} memberships
  не получили независимой семантической сертификации.
- Формальные кандидаты: {u['surface_candidate_families']} семей,
  {u['surface_candidate_memberships']} memberships.
- Морфологическая очередь: {u['morphology_unresolved_memberships']} memberships.
- Семантический приоритет: {u['semantic_priority_memberships']} memberships,
  {u['sense_splits']} требуемых sense splits.
- Границы: {u['boundary_candidate_groups']} групп,
  {u['boundary_distinct_families']} различных семей и
  {u['boundary_memberships']} memberships в этих семьях.
- History: {u['history_conflicts']} конфликтов,
  {u['uninterpreted_history_observations']} неинтерпретированных наблюдений.

## Следующий цикл

1. Разобрать authority/scope конфликтов и исходный provenance; сохранить точные
   отрицательные решения и защиту национальных соответствий.
2. Квалифицированные независимые разметчики выполняют reviewer/blind задания,
   затем арбитраж разногласий. Имеются {u['full_human_review_tasks']} заданий;
   незаполненные шаблоны не являются ответами. Устранить exposure holdout и
   закрепить протокол до калибровки. Вероятностный и challenge наборы раздельны.
3. Подготовить конечные before/after операции, exact grants и независимые
   интервальные оценки по фактическим v5/v6 порогам, не меняя формул.
4. Отдельно реализовать bounded-memory v5 materializer и связь всех изменённых
   records, aliases, counts, source lemmas и scoped negatives с operation IDs.
5. Повторить полный patched dry-run, реальные непустые recovery/rollback и
   runtime/browser/calculator regressions на шести языках, без искусственных A/P.
6. Получить независимую verifier attestation и точное owner approval только
   для проверенного digest выпуска. Затем создать отдельный Data release PR,
   повторить HEAD/CAS перед применением и фактический аудит после публикации.

Пока эти условия не выполнены, Data release PR не создаётся. Этот Implementation
PR не является разрешением на изменение production и автоматически не сливается.
'''

def write_package(destination,files):
 target=external(destination);require(not target.exists(),'fresh package destination required')
 target.parent.mkdir(parents=True,exist_ok=True)
 stage=Path(tempfile.mkdtemp(prefix='.v5-readiness-',dir=target.parent))
 try:
  for name,raw in files.items():atomic(stage/name,raw)
  index=dict(schema='v5-readiness-package-index/1',status='INTEGRITY_ONLY_NOT_RELEASE_APPROVAL',files=[dict(path=n,bytes=len(files[n]),sha256=digest(files[n])) for n in sorted(files)])
  atomic(stage/'PACKAGE-INDEX.json',canonical(dict(index,content_sha256=digest(index)))+b'\n')
  os.rename(stage,target);fd=os.open(target.parent,os.O_RDONLY)
  try:os.fsync(fd)
  finally:os.close(fd)
 finally:
  if stage.exists():shutil.rmtree(stage)

def verify_package(directory):
 root=Path(directory);index=loads((root/'PACKAGE-INDEX.json').read_bytes())
 body={k:v for k,v in index.items() if k!='content_sha256'}
 require(index['content_sha256']==digest(body),'package index checksum differs')
 require({r['path'] for r in index['files']}==set(OUTPUTS) and len(index['files'])==len(OUTPUTS),'incomplete/duplicate package inventory')
 require({p.name for p in root.iterdir()}==set(OUTPUTS)|{'PACKAGE-INDEX.json'},'unexpected package files')
 for row in index['files']:
  p=safe_file(root,row['path']);require(p.stat().st_size==row['bytes'] and file_sha(p)==row['sha256'],'package bytes differ: '+row['path'])
 m=loads((root/'RELEASE-MANIFEST.json').read_bytes())
 require(m['source_lock_sha256']==file_sha(root/'SOURCE-LOCK.json') and m['gates_sha256']==file_sha(root/'GATES.json'),'release evidence binding differs')
 require(m['status']=='BLOCKED_NO_RELEASE_CANDIDATE' and m['publication_allowed'] is False and m['approved_release_id'] is None,'unsupported release qualification')
 return dict(status='PASS_PACKAGE_INTEGRITY_ONLY',release_status=m['status'],publication_allowed=False,files=len(OUTPUTS))

def require_applicable(directory):
 verify_package(directory)
 raise ValueError('BLOCKED: no full v5 materializer/promotion capability; integrity is not approval')

def replay(directory,repo,destination):
 verify_package(directory)
 observations=loads((Path(directory)/'REMOTE-OBSERVATIONS.json').read_bytes())
 files=compile_package(repo,observations);write_package(destination,files)
 verify_package(destination)
 require(all((Path(directory)/name).read_bytes()==(Path(destination)/name).read_bytes() for name in (*OUTPUTS,'PACKAGE-INDEX.json')),'independent package replay differs')
 return dict(status='PASS_BLOCKED_PACKAGE_REPLAY',publication_allowed=False,files=len(OUTPUTS)+1)

def main():
 p=argparse.ArgumentParser(description=__doc__);s=p.add_subparsers(dest='command',required=True)
 a=s.add_parser('prepare');a.add_argument('--repo',required=True);a.add_argument('--observations',required=True);a.add_argument('--destination',required=True)
 a=s.add_parser('verify');a.add_argument('--package',required=True)
 a=s.add_parser('replay');a.add_argument('--package',required=True);a.add_argument('--repo',required=True);a.add_argument('--destination',required=True)
 a=s.add_parser('check-application');a.add_argument('--package',required=True)
 args=p.parse_args()
 if args.command=='prepare':write_package(args.destination,compile_package(args.repo,loads(Path(args.observations).read_bytes())));result=verify_package(args.destination)
 elif args.command=='verify':result=verify_package(args.package)
 elif args.command=='replay':result=replay(args.package,args.repo,args.destination)
 else:require_applicable(args.package)
 print(canonical(result).decode())

if __name__=='__main__':main()

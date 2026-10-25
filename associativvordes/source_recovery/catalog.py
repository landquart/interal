"""Build a current source catalogue from newly observed recovery receipts.

An archive's former PASS is not accepted as a new observation. Callers must
supply the receipts produced by restore.py in this run. Availability, legal
provenance, redundant storage and full-pipeline replay remain separate fields.
"""
import argparse,datetime,hashlib,json,subprocess
from collections import Counter
from pathlib import Path
from .restore import hash_file

def build(repo,evidence,plans,out):
 repo=Path(repo).resolve();evidence=Path(evidence);plans=Path(plans);out=Path(out);out.mkdir(parents=True,exist_ok=True)
 now=datetime.datetime.now(datetime.timezone.utc).isoformat();commit=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip()
 def read(p):return json.loads(Path(p).read_text())
 def save(name,value):(out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 expected={p.stem:read(p) for p in plans.glob('*.json')};archives=[];members=[];missing=[]
 raw_backup_verified=any(x.get('status')=='VERIFIED' and x.get('file')=='raw-independent-readback.zip' and x.get('sha256')=='b0b27f47a7fe28d799eebb0c54525921e6e68522cadf41fa46a318d228b9054b' for x in read(evidence/'EXTERNAL-READBACK.json'))
 for label,plan in sorted(expected.items()):
  p=evidence/(label+'.json')
  if not p.exists():missing.append(label);continue
  r=read(p)
  if r['status']!='BYTES_AND_SEQUENTIAL_COLD_RESTORE_VERIFIED' or r['sha256']!=plan['sha256']:raise ValueError('uncertified recovery receipt: '+label)
  locator=[dict(library_file_id=x.get('library_file_id'),file=x['file'],bytes=x['bytes'],sha256=x['sha256']) for x in r['parts']]
  archives.append(dict(id=label,name=r['archive'],bytes=r['bytes'],sha256=r['sha256'],schema=r['schema'],parts=locator,physical_availability='ALL_PARTS_NEWLY_DOWNLOADED_AND_HASHED',license_ref='archive-mixed',independent_backup='VERIFIED_DRIVE_COPY' if label=='raw' and raw_backup_verified else 'NOT_ESTABLISHED',cold_restore='SEQUENTIAL_PHYSICAL_FILES_AND_SQLITE_INTEGRITY',receipt='evidence/'+p.name,sqlite_databases=r['sqlite_databases']))
  for row in r['members']:members.append(dict(archive_id=label,**row,source_ref=label,license_ref='archive-mixed',backup_ref=label,restore_command_ref='RECOVERY-COMMANDS.md'))
 repo_objects=[]
 selected=set((repo/'associativvordes/normative').glob('*'))|set((repo/'data/morphology-evidence/sources').rglob('*'))
 for p in (repo/'audit').rglob('*'):
  if p.is_file() and ('LOCK' in p.name or 'MANIFEST' in p.name or p.name in {'CURRENT.json','ANNOTATION-PROTOCOL.json'}):selected.add(p)
 for p in sorted(selected):
  if not p.is_file() or '__pycache__' in p.parts:continue
  rel=p.relative_to(repo).as_posix();repo_objects.append(dict(path=rel,bytes=p.stat().st_size,sha256=hash_file(p),schema='JSON' if p.suffix=='.json' else 'text-or-source',source_ref=commit,license_ref='project-or-source-declared',primary_locator='https://github.com/landquart/interal/blob/'+commit+'/'+rel,independent_backup='SOURCE_CAPSULE_REQUIRED',restore_command_ref='RECOVERY-COMMANDS.md'))
 source_lock=read(repo/'data/morphology-evidence/sources/source-lock.json');sources=[];licenses=[]
 for a in source_lock['artifacts']:
  if a['source']=='GLeMM':license_path=repo/'data/morphology-evidence/sources/GLeMM-LICENSE.txt'
  elif a['source']=='MorphyNet':license_path=repo/'data/morphology-evidence/sources/MorphyNet-README.md'
  else:license_path=repo/'data/morphology-evidence/sources/UDer'/a['resource']/'LICENSE'
  license_text=license_path.read_text();declared=a['license'];nc='NC' in declared;sa='SA' in declared
  sources.append(dict(id=a['id'],path=a['path'],bytes=a['bytes'],sha256=a['sha256'],schema=a['format'],source=a['source'],revision=a['revision'],license=declared,primary_locator=a['url'],container=a.get('container'),recovery_archive='raw',independent_backup='VERIFIED_RAW_ARCHIVE_IN_DRIVE' if raw_backup_verified else 'NOT_ESTABLISHED',cold_restore='EXACT_LOCKED_MEMBER_HASH_VERIFIED'))
  licenses.append(dict(id=a['id'],declared=declared,evidence_path=license_path.relative_to(repo).as_posix(),evidence_sha256=hash_file(license_path),license_text_present=bool(license_text.strip()),noncommercial_restriction=nc,sharealike_condition=sa,permission_for_unrestricted_public_or_commercial_release='NOT_CERTIFIED',upstream_lineage_warning='GLeMM/MorphyNet overlap does not provide independent votes' if a['source']=='GLeMM' else None))
 inventory=dict(schema='interal-artifact-inventory/1',observed_at=now,source_commit=commit,status='BLOCKED_FOR_MASS_RELEASE',archives=archives,members=members,repository_objects=repo_objects,morphology_artifacts=sources,missing_archive_receipts=missing,license_references={'archive-mixed':'Mixed source rights; original v5 per-source attribution is incomplete. Private verified retention is not public redistribution approval.','project-or-source-declared':'See LICENSE-AUDIT.json; project files do not establish rights in underlying corpora.'})
 old_assignment=read(repo/'audit/associative-family-v5/input-lock.json')['v4_artifacts']['assignments']
 inventory['missing_historical_objects']=[
  dict(id='original-v5-assignments',bytes=None,sha256=None,schema='historical assignments',status='UNRECOVERED',primary_locator=None,license='UNKNOWN',independent_backup='NOT_ESTABLISHED',cold_restore='BLOCKED'),
  dict(id='historical-v4-assignments-artifact-10550262690',bytes=old_assignment['bytes'],sha256=old_assignment['sha256'],schema='GitHub Actions archive',status='404_RECHECKED',primary_locator='https://api.github.com/repos/landquart/interal/actions/artifacts/10550262690/zip',license='UNKNOWN',independent_backup='NOT_ESTABLISHED',cold_restore='BLOCKED'),
  dict(id='original-Kaikki',bytes=None,sha256='42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9',schema='gzip JSONL',status='UNRECOVERED',primary_locator='https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz',license='PER_SOURCE_MANIFEST_UNRECOVERED',independent_backup='NOT_ESTABLISHED',cold_restore='BLOCKED',warning='Mutable URL is not the historical snapshot'),
  dict(id='original-candidate-index',bytes=None,sha256='2fa23e5690cbdcb80e27708f950a3c3935d87a566030221327c06eabbab0f2f6',hash_kind='historical tree digest',schema='generation-specific candidate index',status='UNRECOVERED',primary_locator=None,license='UNKNOWN',independent_backup='NOT_ESTABLISHED',cold_restore='BLOCKED')]
 inventory['nested_archive_catalog']=[];inventory['nested_members']=[]
 nested_parents={'annotation_kit':('quality','historical-kit/v5-probability-kit-v2.zip'),'annotation_backup':('semantic','annotation-backup.zip'),'morphynet_nested':('raw','raw/MorphyNet/rus/rus.inflectional.v1.zip')}
 for label,(parent,path) in nested_parents.items():
  p=evidence/('NESTED-'+label+'.json')
  if not p.exists():continue
  nested=read(p);entry=next(x for x in members if x['archive_id']==parent and x['path']==path)
  if entry['sha256']!=nested['sha256']:raise ValueError('nested archive differs from verified parent')
  inventory['nested_archive_catalog'].append(dict(id=label,parent_archive=parent,parent_path=path,bytes=nested['bytes'],sha256=nested['sha256'],license_ref='archive-mixed',source_ref=parent,cold_restore='VERIFIED',independent_backup='NOT_ESTABLISHED'))
  inventory['nested_members'].extend(dict(archive_id=label,**row,source_ref=label,license_ref='archive-mixed',backup_ref=label,restore_command_ref='RECOVERY-COMMANDS.md') for row in nested['members'])
 save('ARTIFACT-INVENTORY.json',inventory)
 gaps=[dict(id='ORIGINAL_ASSIGNMENTS',status='UNRECOVERED',impact='Original generation mapping and original assignment evidence cannot be certified.',new_attestation='Exact language/lemma/POS/sense/root relation may be independently re-established; label NEW_INDEPENDENT_ATTESTATION, never ORIGINAL_ASSIGNMENT_RECOVERED.'),dict(id='ORIGINAL_KAIKKI',status='UNRECOVERED',expected_sha256='42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9',impact='Original extraction coverage, record lineage and generation replay remain unknown.',new_attestation='New timestamped dictionary evidence may validate a finite relation; it cannot certify the old snapshot, missing negative evidence or former frequencies.'),dict(id='ORIGINAL_CANDIDATE_INDEX',status='UNRECOVERED',expected_tree_sha256='2fa23e5690cbdcb80e27708f950a3c3935d87a566030221327c06eabbab0f2f6',impact='Cannot certify the historical candidate universe, recall or source counts.',new_attestation='Rebuild a separately versioned candidate universe from available locked sources; never replace the original identity.'),dict(id='INITIAL_V5_LICENSE_LINEAGE',status='NOT_CERTIFIED',impact='Original v5 materialization has no complete per-source licensing lineage; public/commercial data release blocked.'),dict(id='INDEPENDENT_BACKUPS',status='INCOMPLETE',impact='Raw morphology has a byte-verified Drive copy. Independent copies of all large research archives are not established; the upload route has a 100 MiB file limit.',remedy='Create authenticated chunks under 100 MiB in an approved second store, then redownload and hash every chunk before removing this blocker.'),dict(id='SIMULTANEOUS_COLD_ENVIRONMENT',status='NOT_RUN',impact='Every archive member is restored and verified sequentially; a simultaneous full environment and complete production-corpus pipeline replay are not certified.'),dict(id='HISTORICAL_AUTHORITY',status='BLOCKED',impact='Recovered source bytes do not resolve 358 historical scope/authority conflicts or create human gold/approvals.')]
 if missing:gaps.append(dict(id='ARCHIVE_RECOVERY_INCOMPLETE',status='BLOCKED',archives=missing))
 save('PROVENANCE-GAPS.json',dict(schema='interal-provenance-gaps/1',observed_at=now,status='BLOCKED',gaps=gaps,prohibited=['mass membership deletion','mass family merge/split','claim that reconstructed carriers are original assignments','publication under an assumed common corpus license']))
 sqlite=sum(a['sqlite_databases'] for a in archives)
 save('COLD-RESTORE-REPORT.json',dict(schema='interal-cold-restore-summary/1',observed_at=now,status='ALL_AVAILABLE_ARCHIVE_BYTES_VERIFIED_WITH_LIMITATIONS' if not missing else 'BLOCKED_INCOMPLETE_ARCHIVES',archives_verified=len(archives),archives_expected=len(expected),archive_parts_verified=sum(len(a['parts']) for a in archives),archive_members_physically_restored=len(members),restored_member_bytes=sum(r['bytes'] for r in members),sqlite_databases_integrity_ok=sqlite,sqlite_unique_database_hashes=len({m['sha256'] for m in members if m['schema']=='SQLite3'}),sqlite_count_is_archive_instances=True,archive_checksums_verified=True,simultaneous_full_environment=False,full_production_pipeline_replay=False,key_engineering_replay='evidence/KEY-REPLAY.log',production_writes=0,missing=missing))
 save('LICENSE-AUDIT.json',dict(schema='interal-license-audit/1',observed_at=now,status='DECLARATIONS_PRESERVED_RELEASE_RIGHTS_INCOMPLETE',artifacts=licenses,not_imported=['UDer CELEX payloads; only licensing documents and harmonisation scripts are present'],original_v5_per_source_license_manifest='UNRECOVERED',public_data_archive_created=False,private_keys_or_credentials_archived=False))
 return dict(archives=len(archives),members=len(members),sqlite=sqlite,repo_objects=len(repo_objects),missing=missing)
def main():
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--evidence',required=True);p.add_argument('--plans',required=True);p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(build(a.repo,a.evidence,a.plans,a.output)))
if __name__=='__main__':main()

"""Validate finite v5 questions against actual projection and native source rows."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
from pathlib import Path
from associativvordes.v5_adapter.common import *
from associativvordes.v5_adapter.adapter import Adapter
from associativvordes.v5_adapter.bridge import history_reader

def load_queue(path,projection,external_folder=None):
 path=Path(path);m=read(path/'MANIFEST.json')
 if m.get('schema')!='v5-review-projection/1' or not 0<=m['counts']['questions']<=10000:raise ValueError('finite v5 queue schema')
 for name,h in m['outputs'].items():
  p=(path/name).resolve()
  if p.parent!=path.resolve() or filehash(p)!=h:raise ValueError('v5 queue output checksum')
 if (path/'questions.ndjson').stat().st_size>32*1024*1024:raise ValueError('finite queue byte budget')
 if not projection:raise ValueError('actual --registry projection directory required for v5')
 h,history_sha=history_reader()
 if m['identity']['history']!=history_sha:raise ValueError('stale history snapshot')
 obj=Adapter(projection,history=h.check)
 try:
  if m['identity']['adapter']!=obj.manifest['version'] or m['identity']['adapter_manifest_sha256']!=filehash(obj.folder/'MANIFEST.json'):raise ValueError('projection dependency mismatch')
  external=None
  if m['identity']['external']:
   if not external_folder:raise ValueError('--v5-external index required for source-enriched v5 questions')
   from associativvordes.v5_adapter.external import External
   external=External(external_folder,ROOT/'data/morphology-evidence/sources/source-lock.json')
   if external.identity!=m['identity']['external']:raise ValueError('external index dependency mismatch')
  qs=[]
  with (path/'questions.ndjson').open() as f:
   for line in f:
    q=__import__('json').loads(line)
    rows=list(obj.rows(q['source_family_id'],q['language'],q['source_lemma_id']))
    if len(rows)!=1:raise ValueError('ambiguous source membership')
    expected=obj.question(*rows[0])
    if external:expected=external.enrich(expected)
    fields=['id','family','source_family_id','language','lemma','pos','sense_scope','source_lemma_id',
      'lexeme_alternatives','original_record_ref','independence','history_check','evidence_refs']
    if external:fields+=['external_rows','external_rows_omitted','native_lexeme_alternatives','source_availability','external_alignment_status']
    if q!=expected:raise ValueError('question differs from locked source or legacy identity scope')
    qs.append(q)
  if len(qs)!=m['counts']['questions'] or len({q['id'] for q in qs})!=len(qs):raise ValueError('v5 question count/IDs')
  return qs,dict(kind='v5',manifest_sha256=filehash(path/'MANIFEST.json'),input_sha256=m['outputs']['questions.ndjson'],
   source_version=obj.manifest['version'],external=m['identity']['external'],history=history_sha,source=m['identity'])
 finally:obj.close()

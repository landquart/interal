"""Unbounded-in-count, bounded-in-memory candidate/evidence iteration."""
import argparse,json,sqlite3
from pathlib import Path
from .model import lookup

def candidates(native,language,word):
 db=sqlite3.connect(Path(native).resolve().as_uri()+'?mode=ro&immutable=1',uri=True);db.row_factory=sqlite3.Row
 try:
  for row in db.execute('SELECT c.*,a.source_id,a.body artifact_body FROM candidates c JOIN artifacts a ON a.id=c.artifact WHERE language=? AND lookup=? ORDER BY c.id',(language,lookup(word))):
   value=dict(row);value['artifact_body']=json.loads(value['artifact_body']);value['sense_confirmed']=False;value['lexical_identity']=value.pop('native_lexical_id');yield value
 finally:db.close()
def evidence(native,candidate_id):
 db=sqlite3.connect(Path(native).resolve().as_uri()+'?mode=ro&immutable=1',uri=True);db.row_factory=sqlite3.Row
 try:
  for row in db.execute('SELECT * FROM occurrences WHERE candidate=? ORDER BY artifact,line,role',(candidate_id,)):yield dict(row)
 finally:db.close()

def mappings(registry,language,family_id,lemma_id):
 """Locate every physical occurrence, preserving duplicates and source ordinals."""
 import gzip
 from .project import hash_file
 from associativvordes.v5_adapter.common import bucket
 registry=Path(registry);meta=json.loads((registry/'REGISTRY.json').read_bytes());part=next(p for p in meta['parts'] if p['language']==language and p['bucket']==bucket(family_id));path=registry/part['file']
 if hash_file(path)!=part['sha256']:raise ValueError('mapping registry part changed')
 with gzip.open(path,'rt') as f:
  for line in f:
   row=json.loads(line)
   if row[0]!=family_id or row[1]!=lemma_id:continue
   yield dict(origin=dict(source_commit=meta['source_commit'],path=part['source']['path'],source_file_sha256=part['source']['sha256'],family_id=row[0],language=language,lemma_id=row[1],ordinal=row[2],word=row[3],record_sha256=row[4]),status=row[-4],alternative_signatures=row[-3],pos_alternatives=row[-2],mapping_authorized=row[-1],alternative_lookup=dict(language=language,word=row[3],native_database_sha256=meta['native_database_sha256']),target_identity=None)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native');p.add_argument('--registry');p.add_argument('--language');p.add_argument('--word');p.add_argument('--family');p.add_argument('--lemma');p.add_argument('--evidence-for',type=int);a=p.parse_args()
 if a.registry:
  if not all([a.language,a.family,a.lemma]):p.error('mapping lookup requires language, family and lemma')
  rows=mappings(a.registry,a.language,a.family,a.lemma)
 else:
  if not a.native:p.error('native database required')
  if a.evidence_for is None and not (a.language and a.word):p.error('candidate lookup requires language and word')
  rows=evidence(a.native,a.evidence_for) if a.evidence_for is not None else candidates(a.native,a.language,a.word)
 for row in rows:print(json.dumps(row,ensure_ascii=False))

"""Frozen documentary senses are alternatives, never legacy corpus bindings."""
import argparse,hashlib,json,shutil,sqlite3
from pathlib import Path
from .model import canonical,digest,lookup

def add(native,repo):
 native=Path(native);repo=Path(repo);packet=repo/'audit/associative-v5-semantic-cleanup/LEXICAL-SENSES.json';sources=repo/'audit/associative-v5-semantic-cleanup/DICTIONARY-SOURCES.json';raw=packet.read_bytes();version=hashlib.sha256(raw).hexdigest();rows=json.loads(raw)['senses'];db=sqlite3.connect(native/'native.sqlite')
 if db.execute('SELECT 1 FROM artifacts WHERE source_id=?',('frozen-dictionary-senses',)).fetchone():raise ValueError('dictionary packet already installed')
 aid=db.execute('SELECT max(id)+1 FROM artifacts').fetchone()[0];a=dict(id='frozen-dictionary-senses',source='FROZEN_DICTIONARY_PACKET',resource='semantic-senses',revision=version,sha256=version,format='frozen_dictionary_senses',path='dictionary-senses.json',sources_path='dictionary-sources.json',sources_sha256=hashlib.sha256(sources.read_bytes()).hexdigest(),license='Original publisher rights; documentary research retention, no unrestricted redistribution approval',scope='Documentary source senses only, no v5 native identity')
 db.execute('INSERT INTO artifacts VALUES(?,?,?)',(aid,a['id'],json.dumps(a)))
 for line,s in enumerate(rows,1):
  key=json.dumps(['dictionary_sense',s['id']],separators=(',',':'));lexid='documentary-lexeme:'+digest([version,s['language'],s['lemma'],s['pos'],s['id']]);db.execute('INSERT INTO candidates(artifact,lexkey,language,lookup,lemma,pos,native_lexical_id,sense_id,kind) VALUES(?,?,?,?,?,?,?,?,?)',(aid,key,s['language'],lookup(s['lemma']),s['lemma'],s['pos'],lexid,s['id'],'FROZEN_DICTIONARY_SENSE_NOT_CORPUS_IDENTITY'));cid=db.execute('SELECT last_insert_rowid()').fetchone()[0]
  db.execute('INSERT INTO occurrences VALUES(?,?,?,?,?,?,?)',(aid,line,0,cid,digest(s),lexid,s['gloss']))
 db.executescript('DROP TABLE lookup_sets;CREATE TABLE lookup_sets AS SELECT language,lookup,count(*) alternatives,count(DISTINCT pos) pos_alternatives,count(DISTINCT artifact) source_artifacts FROM candidates GROUP BY language,lookup;CREATE UNIQUE INDEX lookup_identity ON lookup_sets(language,lookup);');db.commit();assert db.execute('PRAGMA integrity_check').fetchall()==[('ok',)];db.close();shutil.copyfile(packet,native/a['path']);shutil.copyfile(sources,native/a['sources_path'])
 report=json.loads((native/'NATIVE-REPORT.json').read_bytes());report['dictionary_packet']=dict(artifact=a,senses=len(rows),corpus_bindings_confirmed=0);report['all_input_source_artifacts']=36;(native/'NATIVE-REPORT.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['dictionary_packet']))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',required=True);p.add_argument('--repo',required=True);a=p.parse_args();add(a.native,a.repo)

"""Real source excerpts; explicit adversarial registry edits are never corpus data."""
import gzip
import json
from pathlib import Path
import sqlite3
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib
from mass_discovery import Discovery, path_kind, negative_context
from mass_registry import Graph, LANGUAGES, canonical, sha, local_content
from mass_source import owner_key, checked, prepare as prepare_auxiliary
from mass_run import run, parser, dependency
from mass_store import Store
from mass_recover import rollback
from scale_index import Index
from build_graph import load_registry
from prepare_registry import read
from morphology_import import hash_file, digest
from certify_corpus import atomic_json

HERE = Path(__file__).parent
LOCK = HERE.parents[1]/'data/morphology-evidence/sources/source-lock.json'


class Inputs:
    def __init__(self, root):
        self.root=root;self.lock=json.loads(LOCK.read_text())
        records={}
        for path in [HERE/'fixtures/records.ndjson',HERE.parent/'evidence_graph/fixtures/records.ndjson']:
            for row in map(json.loads,path.read_text().splitlines()): records[row['id']]=row
        self.records=records
        snapshot=root/'snapshot';snapshot.mkdir()
        data=snapshot/'records.ndjson.gz'
        data.write_bytes(gzip.compress(('\n'.join(json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=False) for r in records.values())+'\n').encode(),mtime=0))
        atomic_json(snapshot/'manifest.json',dict(outputs={'records.ndjson.gz':hash_file(data)},reports=[dict(accepted=len(records))]))
        self.source=root/'source/index.sqlite';index=Index(self.source)
        try:index.ingest('REAL-EXCERPTS-TEST-ONLY',snapshot,self.lock)
        finally:index.close()
        atomic_json(self.source.parent/'INDEX.json',dict(status='PASS',database_sha256=hash_file(self.source),catalog_build_id='TEST-EXCERPTS-NOT-FULL-CORPUS'))
        self.registry=root/'registry/registry.sqlite';self.registry.parent.mkdir()
        g=Graph(self.registry);load_registry(g,read(HERE/'fixtures/v6.json.gz'))
        g.db.executescript('''CREATE TABLE seeds(family,language,word,head,role,proof,PRIMARY KEY(family,language,word,head,role));
             CREATE TABLE family_fingerprints(family PRIMARY KEY,value);''')
        g.db.execute("INSERT OR IGNORE INTO seeds SELECT family,language,word,head,'member',proof FROM known")
        for f, in g.db.execute("SELECT id FROM existing WHERE kind='Family'").fetchall():
            g.db.execute('INSERT INTO family_fingerprints VALUES(?,?)',(f,digest(f)))
        g.commit();g.close()
        self.aux=root/'aux/aux.sqlite';self.aux.parent.mkdir()
        db=sqlite3.connect(self.aux)
        db.executescript('''CREATE TABLE ranges(first INTEGER PRIMARY KEY,last INTEGER,artifact,source);
              CREATE TABLE incoming(dst BLOB,src BLOB,seq,ordinal,slot,type,direction,PRIMARY KEY(dst,src,seq,ordinal,slot));
              CREATE TABLE inflections(language,owner,eid PRIMARY KEY,body);
              CREATE INDEX owner_lookup ON inflections(language,owner,eid);''')
        index=Index(self.source)
        try:
            for seq, in index.db.execute('SELECT seq FROM records'):
                b=index.record(seq)['body'];db.execute('INSERT INTO ranges VALUES(?,?,?,?)',(seq,seq,b['artifact'],b['source']))
            db.executemany('INSERT INTO incoming VALUES(?,?,?,?,?,?,?)',index.db.execute("SELECT a.dst,a.src,a.seq,a.ordinal,a.slot,a.type,a.direction FROM arcs a JOIN lexemes s ON s.id=a.src JOIN lexemes d ON d.id=a.dst WHERE direction='directed'"))
        finally:index.close()
        for r in records.values():
            n=r['body']['normalized']
            if 'inflection' in n:
                lex=n['lexemes'][0];db.execute('INSERT INTO inflections VALUES(?,?,?,?)',(lex['language'],lex['lookup'],r['id'],canonical(r)))
        db.commit();db.close()
        self.project=root/'project/project.sqlite';self.project.parent.mkdir()
        db=sqlite3.connect(self.project)
        db.executescript('''CREATE TABLE seeds(family,language,word,lemma,file,ordinal,raw_sha BLOB,frequency);
            CREATE INDEX word_seeds ON seeds(language,word,family);CREATE TABLE frequencies(id PRIMARY KEY,body BLOB);
            CREATE TABLE files(id PRIMARY KEY,path,sha);''')
        for i,f in enumerate(json.loads((HERE/'fixtures/frequencies.json').read_text())):
            row=json.loads(f['record_json']);loc=f['locators'][0]
            obs={k:row[k] for k in ['rank','frequency_score','category_breakdown','sources'] if k in row}
            db.execute('INSERT INTO files VALUES(?,?,?)',(i,loc['file'],loc['sha256']))
            db.execute('INSERT INTO frequencies VALUES(?,?)',(i,zlib.compress(json.dumps(obs).encode())))
            db.execute('INSERT INTO seeds VALUES(?,?,?,?,?,?,?,?)',(loc['family_key'],f['language'],row['word'].casefold(),row['lemma_id'],i,loc.get('ordinal',0),bytes.fromhex(digest(row)),i))
        db.commit();db.close();atomic_json(self.project.parent/'PROJECT.json',dict(status='PASS',database_sha256=hash_file(self.project)))
        self.receipts()

    def receipts(self):
        db=sqlite3.connect(self.registry);owners=owner_key(db);db.close()
        atomic_json(self.registry.parent/'REGISTRY.json',dict(database_sha256=hash_file(self.registry)))
        atomic_json(self.aux.parent/'AUX.json',dict(status='PASS',database_sha256=hash_file(self.aux),identity=dict(
            owners=owners,source=hash_file(self.source),catalog='TEST-EXCERPTS-NOT-FULL-CORPUS',source_lock=hash_file(LOCK),policy='TEST-EXCERPTS-NOT-PRODUCTION')))

    def seed(self, family, language, word):
        # Explicit test-only project anchor, never a synthetic source observation.
        db=sqlite3.connect(self.registry)
        db.execute('DELETE FROM seeds WHERE family=? AND language=?',(family,language))
        db.execute('INSERT INTO seeds VALUES(?,?,?,?,?,?)',(family,language,word,'test-only-anchor','head','{}'))
        db.execute('UPDATE family_fingerprints SET value=? WHERE family=?',(digest([family,word]),family))
        db.commit();db.close();self.receipts()

    def engine(self):return Discovery(self.source,self.registry,self.aux,self.project,self.lock)

    def args(self, output, *extra):
        args=[]
        for k,v in dict(index=self.source,registry=self.registry,aux=self.aux,project=self.project,source_lock=LOCK,output=output).items():args.extend(['--'+k.replace('_','-'),str(v)])
        return parser().parse_args(args+list(extra))


class MassTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.inputs=Inputs(self.root)
    def tearDown(self):self.tmp.cleanup()
    def discover(self,family,lang):
        e=self.inputs.engine()
        try:return e.unit(family,lang)
        finally:e.close()

    def test_real_native_chain_and_provenance(self):
        self.inputs.seed('family:ocul','es','ocular')
        questions,events,stats=self.discover('family:ocul','es')
        words={q['lemma']:q for q in questions}
        self.assertIn('inocular',words);self.assertIn('inoculador',words)
        self.assertTrue(any(p['category']=='indirect derivation' for p in words['inoculador']['discovery_paths']))
        for q in questions:
            self.assertFalse(q['establishes_membership']);self.assertFalse(q['creates_canonical_root'])
            for p in q['discovery_paths']:
                for s in p['steps']:
                    self.assertGreater(s['evidence']['raw_locator']['line'],0)
                    self.assertIn(s['evidence']['id'],self.inputs.records)

    def test_no_substring_expansion(self):
        self.inputs.seed('family:inter','en','inter')
        questions,_,_=self.discover('family:inter','en')
        self.assertNotIn('interact',{q['lemma'] for q in questions})

    def test_unknown_direction_stays_one_hop_and_correlated(self):
        self.inputs.seed('family:inter','en','a')
        questions,_,_=self.discover('family:inter','en')
        uncertain=[p for q in questions for p in q['discovery_paths'] if any(s['direction']=='unknown' for s in p['steps'])]
        self.assertTrue(uncertain)
        self.assertTrue(all(len(p['steps'])==1 and p['category']=='unresolved' for p in uncertain))
        self.assertTrue(all(q['independence']['status']=='unknown' and q['priority']['calibrated_probability'] is None for q in questions))
        self.assertTrue(all(q['frequency']['rank'] is None for q in questions if q['frequency']['status']=='unknown'))

    def test_inflection_observations_do_not_enter_paths(self):
        record=next(r for r in self.inputs.records.values() if 'inflection' in r['body']['normalized'])
        lex=record['body']['normalized']['lexemes'][0]
        self.inputs.seed('family:ocul',lex['language'],lex['lookup'])
        questions,_,_=self.discover('family:ocul',lex['language'])
        self.assertTrue(any(q['inflection_observations'] for q in questions))
        self.assertFalse(any(s['type']=='inflection' for q in questions for p in q['discovery_paths'] for s in p['steps']))

    def test_real_compound_and_reverse_base_keep_native_evidence(self):
        self.inputs.seed('family:nat','ru','-валентный')
        questions,_,_=self.discover('family:nat','ru')
        q=next(q for q in questions if q['lemma']=='одновалентный')
        self.assertTrue(any(p['category']=='compound' for p in q['discovery_paths']))
        self.inputs.seed('family:nat','ru','одновалентный')
        questions,_,_=self.discover('family:nat','ru')
        q=next(q for q in questions if q['lemma']=='-валентный')
        self.assertIn('POSSIBLE_BASE',q['categories'])
        self.assertTrue(q['proposed_bases']);self.assertFalse(q['creates_canonical_root'])

    def test_existing_negative_is_a_question_but_not_a_frontier(self):
        db=sqlite3.connect(self.inputs.registry)
        negative=db.execute("SELECT family,language,word FROM decisions WHERE status IN ('rejected','excluded','split_required','blocked_from_runtime') ORDER BY id").fetchall();db.close()
        native={(l['language'],l['lookup']) for r in self.inputs.records.values() for l in r['body']['normalized']['lexemes']}
        match=next((x for x in negative if x[1:] in native),None)
        if match is None:
            # Adversarial registry prohibition on a real source chain. No source row is invented.
            family,lang,word='family:ocul','es','ocular'
            db=sqlite3.connect(self.inputs.registry)
            db.execute('INSERT INTO decisions VALUES(?,?,?,?,?,?,?,?,?,?)',
                ('test-only-prohibition',family,lang,word,None,None,'rejected','prior_confirmed','{}','explicit adversarial fixture decision'))
            db.commit();db.close()
        else:family,lang,word=match
        self.inputs.seed(family,lang,word)
        questions,events,_=self.discover(family,lang)
        self.assertTrue(any('NEGATIVE_HISTORY' in q['categories'] for q in questions))
        self.assertTrue(any(e['reason']=='negative_seed_not_expanded' for e in events))

    def test_scope_replay_resume_dry_run_and_independent_export(self):
        args=self.inputs.args(self.root/'run','--families','OCUL','PEDE','--languages','en','es')
        args.stop_after=1;self.assertEqual(run(args)['status'],'CHECKPOINT')
        self.assertFalse((self.root/'run/CURRENT.json').exists())
        args.stop_after=None;args.resume=True
        first=run(args);self.assertEqual(first['reused'],1);self.assertEqual(first['selected_units'],4)
        before=json.loads((self.root/'run/CURRENT.json').read_text())
        second=run(args);self.assertEqual(second['reused'],4);self.assertEqual(second['processed'],0)
        fresh=run(self.inputs.args(self.root/'fresh','--families','OCUL','PEDE','--languages','en','es'))
        self.assertEqual(first['version'],fresh['version'])
        self.assertEqual(first['mode'],'dry_run');self.assertEqual(first['membership_writes'],0)
        self.assertEqual(before,json.loads((self.root/'run/CURRENT.json').read_text()))
        (self.root/'run/CURRENT.json').write_text('damaged pointer')
        self.assertEqual(rollback(self.root/'run')['status'],'PASS')
        self.assertEqual(before,json.loads((self.root/'run/CURRENT.json').read_text()))

    def test_checksum_failure_and_unknown_canonical_id(self):
        with self.assertRaisesRegex(ValueError,'unknown/ambiguous'):
            run(self.inputs.args(self.root/'run','--family','new-unregistered-base'))
        with self.inputs.aux.open('ab') as f:f.write(b'corruption')
        with self.assertRaisesRegex(ValueError,'integrity'):run(self.inputs.args(self.root/'run'))

    def test_auxiliary_native_checkpoint_resumes_without_duplicate_arcs(self):
        release=self.root/'release';snapshot=release/'snapshots/REAL-EXCERPTS-TEST-ONLY/test-only-excerpts'
        shutil.copytree(self.root/'snapshot',snapshot)
        atomic_json(release/'CHECKPOINT.json',dict(status='PASS',catalog=dict(build_id='TEST-EXCERPTS-NOT-FULL-CORPUS'),
            partitions={'REAL-EXCERPTS-TEST-ONLY':dict(build_id='test-only-excerpts',manifest_sha256=hash_file(snapshot/'manifest.json'))}))
        destination=self.root/'built-aux'
        with patch('mass_source.gzip.open',side_effect=RuntimeError('injected interruption after native transaction')):
            with self.assertRaises(RuntimeError):
                prepare_auxiliary(self.inputs.source,release,self.inputs.registry,LOCK,destination)
        db=sqlite3.connect(destination/'aux.sqlite')
        self.assertEqual(db.execute("SELECT COUNT(*) FROM progress WHERE name='native'").fetchone()[0],1)
        initial=db.execute('SELECT COUNT(*) FROM incoming').fetchone()[0];db.close()
        result=prepare_auxiliary(self.inputs.source,release,self.inputs.registry,LOCK,destination)
        self.assertEqual(result['counts']['incoming'],initial)
        again=prepare_auxiliary(self.inputs.source,release,self.inputs.registry,LOCK,destination)
        self.assertTrue(again['reused']);self.assertEqual(result['database_sha256'],again['database_sha256'])
        command=[sys.executable,str(HERE/'mass_source.py'),'--index',str(self.inputs.source),'--release',str(release),
                 '--registry',str(self.inputs.registry),'--source-lock',str(LOCK),'--destination',str(destination)]
        result=subprocess.run(command,check=True,capture_output=True,text=True)
        self.assertEqual(json.loads(result.stdout)['status'],'PASS')

    def test_same_catalog_different_partition_manifest_is_rejected(self):
        release=self.root/'release'
        snapshot=release/'snapshots/REAL-EXCERPTS-TEST-ONLY/test-only-excerpts'
        shutil.copytree(self.root/'snapshot',snapshot)
        manifest=json.loads((snapshot/'manifest.json').read_text())
        manifest['test_only_provenance_delta']='different staging release, identical normalized catalog'
        atomic_json(snapshot/'manifest.json',manifest)
        atomic_json(release/'CHECKPOINT.json',dict(status='PASS',
            catalog=dict(build_id='TEST-EXCERPTS-NOT-FULL-CORPUS'),
            partitions={'REAL-EXCERPTS-TEST-ONLY':dict(build_id='test-only-excerpts',
                manifest_sha256=hash_file(snapshot/'manifest.json'))}))
        with self.assertRaisesRegex(ValueError,'source partition identity mismatch'):
            prepare_auxiliary(self.inputs.source,release,self.inputs.registry,LOCK,self.root/'bad-aux')
        self.assertFalse((self.root/'bad-aux/aux.sqlite').exists())

    def test_negative_head_without_exact_word_guard_is_not_expanded(self):
        self.inputs.seed('family:ocul','es','ocular')
        db=sqlite3.connect(self.inputs.registry)
        db.execute("UPDATE seeds SET role='negative' WHERE family='family:ocul' AND language='es'")
        db.commit();db.close();self.inputs.receipts()
        engine=self.inputs.engine()
        try:
            self.assertNotIn(engine.g.guard('family:ocul','es','ocular')['status'],{'blocked','hold'})
            questions,events,_=engine.unit('family:ocul','es')
        finally:engine.close()
        words={q['lemma'] for q in questions}
        self.assertIn('ocular',words)
        self.assertNotIn('inocular',words)
        self.assertNotIn('inoculador',words)
        self.assertTrue(any(e['reason']=='negative_seed_not_expanded' for e in events))

    def test_preparation_registry_reuse_checks_policy_and_database(self):
        from mass_ci import prepare_registry_input, LEGACY
        import mass_registry
        path=self.inputs.registry.parent/'REGISTRY.json'
        receipt=json.loads(path.read_text())
        receipt.update(commit=mass_registry.COMMIT,legacy_revision=LEGACY,
                       policy_sha256=hash_file(mass_registry.__file__))
        atomic_json(path,receipt)
        before=hash_file(self.inputs.registry)
        self.assertEqual(prepare_registry_input(self.root),receipt)
        self.assertEqual(hash_file(self.inputs.registry),before)
        atomic_json(path,dict(receipt,policy_sha256='test-only-incompatible-policy'))
        with self.assertRaisesRegex(ValueError,'checkpoint dependency mismatch'):
            prepare_registry_input(self.root)
        atomic_json(path,receipt)
        with self.inputs.registry.open('ab') as stream:stream.write(b'test-only-corruption')
        with self.assertRaisesRegex(ValueError,'integrity'):
            prepare_registry_input(self.root)

    def test_nonaccepted_head_is_not_a_bridge_from_another_seed(self):
        self.inputs.seed('family:ocul','es','ocular')
        db=sqlite3.connect(self.inputs.registry)
        db.execute('INSERT INTO seeds VALUES(?,?,?,?,?,?)',
                   ('family:ocul','es','inocular','test-only-nonaccepted-head','negative','{}'))
        db.commit();db.close();self.inputs.receipts()
        questions,events,_=self.discover('family:ocul','es')
        words={q['lemma']:q for q in questions}
        self.assertIn('inocular',words)
        self.assertTrue(words['inocular']['nonaccepted_head_context'])
        self.assertNotIn('inoculador',words)
        self.assertTrue(any(e['reason']=='negative_target_not_expanded' for e in events))

    def test_incremental_own_and_competing_family_dependencies(self):
        db=sqlite3.connect(self.inputs.registry)
        a=dependency(db,'family:ocul','en',['ocular']);b=dependency(db,'family:ped','en',[])
        db.execute("UPDATE family_fingerprints SET value='test-only-delta' WHERE family='family:ocul'")
        self.assertNotEqual(a,dependency(db,'family:ocul','en',['ocular']))
        self.assertEqual(b,dependency(db,'family:ped','en',[]))
        before=dependency(db,'family:ped','en',['ocular'])
        db.execute("INSERT INTO known VALUES('family:ocul','en','ocular','test-lemma','test-head','{}')")
        self.assertNotEqual(before,dependency(db,'family:ped','en',['ocular']));db.close()

    def test_changed_only_recomputes_only_changed_family_units(self):
        args=self.inputs.args(self.root/'run','--families','OCUL','PEDE','--languages','en','es')
        run(args)
        db=sqlite3.connect(self.inputs.registry)
        # Explicit test-only dependency delta, not a new corpus or linguistic decision.
        db.execute("UPDATE family_fingerprints SET value='test-only-family-delta' WHERE family='family:ocul'")
        db.commit();db.close();self.inputs.receipts()
        args.changed_only=True;result=run(args)
        self.assertEqual(result['processed'],2);self.assertEqual(result['reused'],2)

    def test_categories_preserve_alternatives_and_unchecked_pos(self):
        self.inputs.seed('family:inter','en','a')
        questions,_,_=self.discover('family:inter','en')
        self.assertTrue(all(q['sense_status']=='unresolved' and q['pos_status']!='verified' for q in questions))
        self.assertTrue(all('IDENTITY_UNRESOLVED' in q['categories'] for q in questions))

    def test_multiple_meanings_and_conflicting_family_stay_separate(self):
        self.inputs.seed('family:ocul','es','ocular')
        db=sqlite3.connect(self.inputs.registry)
        # Explicit adversarial project memberships exercise homonym/sense conflicts.
        for family,lemma,head in [('family:ocul','test-sense-1','test-head-1'),
                                  ('family:ocul','test-sense-2','test-head-2'),
                                  ('family:ped','test-other-family','test-other-head')]:
            db.execute('INSERT INTO known VALUES(?,?,?,?,?,?)',(family,'es','ocular',lemma,head,'{}'))
        db.commit();db.close();self.inputs.receipts()
        questions,_,_=self.discover('family:ocul','es')
        q=next(q for q in questions if q['lemma']=='ocular')
        self.assertIn('CONFLICT',q['categories']);self.assertIn('EXISTING_MEMBER_AUDIT',q['categories'])
        self.assertIn('family:ped',q['conflicts']['competing_families'])
        self.assertGreaterEqual(len(q['existing_memberships']),3);self.assertEqual(q['sense_status'],'unresolved')

    def test_cross_language_native_endpoint_is_excluded(self):
        self.inputs.seed('family:ocul','es','ocular');e=self.inputs.engine()
        original=e.source.lexeme
        def adversarial(identifier):
            value=original(identifier)
            return dict(value,language='en') if value['lemma']=='inocular' else value
        e.source.lexeme=adversarial
        try:questions,events,_=e.unit('family:ocul','es')
        finally:e.close()
        self.assertNotIn('inoculador',{q['lemma'] for q in questions})
        self.assertTrue(any(v['reason']=='cross_language_excluded' for v in events))

    def test_prior_queue_is_read_only_and_refusal_survives_mass_rebuild(self):
        self.inputs.seed('family:ocul','es','ocular')
        a=self.inputs.args(self.root/'write','--family','OCUL','--language','es','--write-queue')
        run(a);path=self.root/'write/review.sqlite';q=Store(path)
        cid=q.db.execute('SELECT id FROM questions ORDER BY id LIMIT 1').fetchone()[0]
        q.decide(cid,'rejected','test-only reviewer refusal','test reviewer');q.close()
        before=hash_file(path)
        preview=run(self.inputs.args(self.root/'dry','--family','OCUL','--language','es','--prior-queue',str(path)))
        self.assertEqual(before,hash_file(path))
        current=json.loads((self.root/'dry/CURRENT.json').read_text())
        rows=[json.loads(s) for s in (Path(current['path'])/'questions.ndjson').read_text().splitlines()]
        question=next(r for r in rows if r['id']==cid)
        self.assertEqual(question['review_state'],'rejected');self.assertEqual(len(question['previous_decisions']),1)
        self.assertIn('NEGATIVE_HISTORY',question['categories'])

    def test_relation_classes(self):
        def s(k,d='directed'):return dict(type=k,direction=d)
        self.assertEqual(path_kind([s('compounding')]),'compound')
        self.assertEqual(path_kind([s('direct_derivation'),s('compounding')]),'mixed path')
        self.assertEqual(path_kind([s('orthographic_variant','unknown')]),'orthographic variant')
        self.assertEqual(path_kind([s('orthographic_variant')]),'orthographic variant')
        self.assertEqual(path_kind([s('direct_derivation'),s('conversion')]),'indirect derivation')


class StoreTests(unittest.TestCase):
    def test_full_runner_rejects_incompatible_runtime_before_build(self):
        from mass_ci import runtime_preflight
        with patch('mass_ci.platform.python_version',return_value='0.0.0-test-only'):
            with self.assertRaisesRegex(ValueError,'certified runtime mismatch'):
                runtime_preflight()

    def test_review_history_and_pending_identity_are_not_negative_verdicts(self):
        self.assertFalse(negative_context(dict(status='hold',blockers=[dict(status='pending')]),[]))
        self.assertFalse(negative_context(dict(status='hold',manual_refs=[{}]),[]))
        self.assertTrue(negative_context(dict(status='blocked',blockers=[dict(status='rejected')]),[]))
        self.assertTrue(negative_context(dict(status='blocked',reasons=['family_runtime_prohibition']),[]))
        with tempfile.TemporaryDirectory() as root:
            root=Path(root);q=Store(root/'queue.sqlite')
            body=dict(family='family:ocul',language='en',lemma='ocular',pos=None,categories=['IDENTITY_UNRESOLVED'],priority=dict(score=1))
            q.save_unit('u','a',[body],[],{})
            cid=q.db.execute('SELECT id FROM questions').fetchone()[0]
            q.decide(cid,'reviewed','test completed review, no membership verdict','test reviewer')
            q.export_selected(root/'export',['u'])
            row=json.loads((root/'export/questions.ndjson').read_text())
            self.assertTrue(row['previous_decisions']);self.assertNotIn('NEGATIVE_HISTORY',row['categories'])
            q.close()

    def test_later_refusal_reconciles_existing_pos_without_source_discovery(self):
        with tempfile.TemporaryDirectory() as root:
            q=Store(Path(root)/'queue.sqlite')
            body=dict(family='family:ocul',language='en',lemma='ocular',pos=None,categories=['IDENTITY_UNRESOLVED'],priority=dict(score=1))
            q.save_unit('u','a',[body,dict(body,pos='NOUN')],[],{})
            cid='candidate:'+sha(['family:ocul','en','ocular',None])
            other='candidate:'+sha(['family:ocul','en','ocular','NOUN'])
            q.decide(cid,'rejected','test later refusal','test reviewer')
            q.reconcile_review_history(['u'])
            self.assertEqual(q.db.execute('SELECT state FROM questions WHERE id=?',(other,)).fetchone()[0],'rejected')
            q.close()

    def test_transaction_history_and_rejected_rediscovery(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root);q=Store(root/'queue.sqlite')
            body=dict(family='family:ocul',language='en',lemma='ocular',pos=None,categories=['IDENTITY_UNRESOLVED'],priority=dict(score=1))
            with self.assertRaises(RuntimeError):q.save_unit('u','a',[body],[],{},fail_after=0)
            self.assertEqual(q.db.execute('SELECT COUNT(*) FROM questions').fetchone()[0],0)
            self.assertEqual(q.db.execute('SELECT COUNT(*) FROM units').fetchone()[0],0)
            q.save_unit('u','a',[body],[],{})
            cid=q.db.execute('SELECT id FROM questions').fetchone()[0];q.decide(cid,'rejected','explicit test refusal','test reviewer')
            q.save_unit('u','b',[dict(body,pos='NOUN')],[],{})
            q.export_selected(root/'export',['u'])
            row=json.loads((root/'export/questions.ndjson').read_text())
            self.assertEqual(row['review_state'],'rejected');self.assertTrue(row['previous_decisions'])
            self.assertIn('NEGATIVE_HISTORY',row['categories'])
            q.save_unit('u','c',[],[],{})
            self.assertEqual(q.db.execute('SELECT COUNT(*) FROM history').fetchone()[0],2)
            q.close()

    def test_snapshot_provenance_does_not_invalidate_other_families(self):
        a=dict(snapshot_sha256='a',object_sha256='same',body=dict(word='ocular'))
        self.assertEqual(local_content(a),local_content(dict(a,snapshot_sha256='b')))
        self.assertNotEqual(local_content(a),local_content(dict(a,object_sha256='different')))


if __name__=='__main__':unittest.main()

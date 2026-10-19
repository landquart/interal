"""Real official probes plus explicitly test-only adversarial controls."""
import base64
import copy
import json
from pathlib import Path
import tempfile
import unittest
from graph import Graph,IntegrityConflict,canonical,envelope,ref,key,file_hash
from records import read_json
from build_graph import load_registry,ingest,align,build
from query_graph import query

HERE=Path(__file__).parent
REGISTRY=HERE.parents[1]/'data/morphology-evidence/sources/source-lock.json'

class GraphTests(unittest.TestCase):
    def setUp(self):
        self.g=Graph();self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.sr=self.g.put(envelope('SourceRevision','source:test',{'source_id':'test-only','release_label':'test','canonical_url':'https://example.invalid',
          'artifacts':[],'native_key_policy':'test','license_records':[],'lineage_declarations':[],'availability_status':'test','registration_status':'test','acquisition_receipt_ref':None}))
    def tearDown(self):self.g.close();self.tmp.cleanup()
    def lex(self,id,word,pos='NOUN',language='en'):
        return self.g.put(envelope('Lexeme',id,{'source_id':'test-only','source_revision_ref':self.sr,'native_lexeme_key':id,'native_key_policy':'test',
          'language':language,'lemma':word,'pos':pos,'identity_resolution':'unresolved','origin_evidence_refs':[]}))
    def rel(self,a,b,kind='derivation_direct',state='directed',params=None):
        return self.g.relation(kind,[{'slot':'a','kind':'lexeme','ref':a},{'slot':'b','kind':'lexeme','ref':b}],
          {'state':state,'from_slots':['a'] if state=='directed' else [],'to_slots':['b'] if state=='directed' else []},params)
    def evidence(self,r):
        b={'source_revision_ref':self.sr,'raw_locator':{'test_only':True},'raw_record_sha256':'a'*64,'evidence_kind':'algorithmic_hypothesis','related_lexeme_refs':[],
          'interpretations':[{'relation_ref':r,'stance':'supports','proposed_analysis':{'kind':'test_only'}}],'source_lineage':{},'extraction':{'test_only':True},'initial_status':'needs_review','rationale':'adversarial control only'}
        er=self.g.put(envelope('Evidence',key('evidence',r),b));self.g.add_support(r,er);return er
    def trusted(self,word,status='rejected',authority='manual_verified'):
        snapshot='b'*64;self.g.trusted_snapshots.add(snapshot)
        p=self.g.existing('ManualDecision',key('existing',[word,status]),{'word':word,'status':status},snapshot);self.g.trusted_manual_refs.add(canonical(p))
        for alias in ['test','alias']:self.g.db.execute('INSERT OR IGNORE INTO aliases VALUES(?,?)',(alias,'family:test'))
        self.g.add_decision('family:test','en',word,status,p,authority=authority,reason='finite test-only decision')
    def verdict(self,r,status='accepted',id='review:1',domain='relation'):
        senses=[]
        for p in self.g.resolve(r)['body']['participants']:
            if p['kind']!='lexeme':continue
            senses.append(self.g.put(envelope('LexemeSense','sense:'+p['ref']['id'],{'lexeme_ref':p['ref'],'source_revision_ref':self.sr,
              'native_sense_key':'test','definition':'test-only scope','definition_language':'en','resolution':'source_identified','origin_evidence_refs':[]})))
        grant={'test_grant':'explicit-fixture-only'}
        b={'subject':{'domain':domain,'key':r['id'],'target_ref':r},'scope':{'sense_scope':{'mode':'exact','sense_refs':senses,'analysis_refs':[]}},'status':status,
           'authority':{'tier':'manual_verified','authorization_ref':grant},'rationale':'test-only review','reason_codes':['test'],'basis_refs':[r],
           'dependency_lock':{'source':self.sr},'policy_ref':{'id':'test'},'reviewed_at':'fixed-test-time','revokes_verdict_refs':[]}
        return self.g.put(envelope('Verdict',id,b)),grant
    def actual(self):
        snapshot=read_json(HERE/'fixtures/v6.json.gz');load_registry(self.g,snapshot);return snapshot

    def test_real_records_have_exact_evidence_and_no_accepted_verdicts(self):
        self.actual();c=ingest(self.g,HERE/'fixtures/records.ndjson',read_json(REGISTRY));self.assertEqual(c['records'],70);self.assertGreater(c['claims'],0);self.assertGreater(c['inflections'],0)
        self.assertEqual(self.g.db.execute('SELECT COUNT(*) FROM reviews').fetchone()[0],0)
        for payload, in self.g.db.execute("SELECT payload FROM entities WHERE kind='Evidence'"):
            e=json.loads(payload);self.assertEqual(e['body']['initial_status'],'needs_review');self.g.resolve(e['body']['source_revision_ref'])
            self.assertTrue(base64.b64decode(e['body']['extensions']['original_line_base64']))
            for a in e['body']['interpretations']:self.g.resolve(a['relation_ref'])
        self.assertEqual(self.g.resolve_family('PEDE'),['family:ped'])
    def test_actual_correction_survives_every_retrieval_channel(self):
        s=self.actual();c=next(x for x in s['corrections'] if x['status']!='accepted')
        for channel in ['direct','alias','fallback','path']:
            q=self.g.guard('regule',c['language'],c['word'],c['lemma_id'],channel=channel)
            self.assertIn(q['status'],['blocked','hold']);self.assertTrue(q['blockers']);self.assertFalse(q['establishes_membership'])
    def test_manual_negative_dominates_permission_and_alternative_paths(self):
        self.trusted('blocked','accepted');self.trusted('blocked','rejected')
        for channel in ['direct','alias','fallback','path']:self.assertEqual(self.g.guard('alias','en','blocked',channel=channel)['status'],'blocked')
        a=self.lex('a','safe');b=self.lex('b','blocked');c=self.lex('c','other');self.rel(a,b);self.rel(a,c);self.rel(c,b)
        self.assertEqual(self.g.paths('a','b',family='alias')['paths'],[])
    def test_negative_states_and_untrusted_manual_claim(self):
        for status in ['split_required','excluded','blocked_from_runtime','uncertain','pending','insufficient_data']:
            self.trusted(status,status);self.assertIn(self.g.guard('test','en',status)['status'],['blocked','hold'])
        with self.assertRaises(ValueError):self.g.add_decision('family:test','en','spoof','accepted',{'id':'spoof','snapshot_sha256':'x','object_sha256':'x'},authority='manual_verified')
    def test_homonymous_spelling_does_not_bridge(self):
        a=self.lex('a','alpha');h1=self.lex('h1','bank');h2=self.lex('h2','bank');z=self.lex('z','omega');self.rel(a,h1);self.rel(h2,z)
        self.assertEqual(self.g.paths('a','z')['paths'],[]);self.assertEqual(self.g.db.execute("SELECT COUNT(*) FROM lexemes WHERE word='bank'").fetchone()[0],2)
    def test_finite_chain_keeps_intermediates_direction_sources(self):
        a=self.lex('a','a');b=self.lex('b','b');c=self.lex('c','c')
        for x,z in [(a,b),(b,c),(c,a)]:self.evidence(self.rel(x,z))
        paths=self.g.paths('a','c')['paths'];self.assertEqual(len(paths),1);p=paths[0];self.assertEqual([n['id'] for n in p['nodes']],['a','b','c'])
        self.assertTrue(all(s['sources'] and s['uncertainties'] and not s['confirmed'] for s in p['steps']));self.assertFalse(p['establishes_membership'])
        self.assertEqual(self.g.paths('a','c',max_depth=1)['paths'],[])
        with self.assertRaises(ValueError):self.g.paths('a',max_depth=99)
    def test_unknown_direction_requires_explicit_hypothesis_query(self):
        a=self.lex('a','a');b=self.lex('b','b');self.evidence(self.rel(a,b,'ext:core:morphological_relatedness@1','unknown'))
        self.assertEqual(self.g.paths('b','a')['paths'],[]);p=self.g.paths('b','a',include_uncertain=True)['paths'][0]
        self.assertEqual(p['steps'][0]['direction']['state'],'unknown');self.assertEqual(p['validation_status'],'hypothesis_only')
    def test_inflection_is_a_form_not_a_lexical_bridge(self):
        a=self.lex('a','walk','VERB');r=self.g.relation('inflection',[{'slot':'a','kind':'lexeme','ref':a},{'slot':'f','kind':'form','form':{'owner_lexeme_ref':a,'text':'walked','grammatical_features':'V;PST','native_form_key':'test','script':'Latn'}}],{'state':'directed','from_slots':['a'],'to_slots':['f']})
        self.evidence(r);self.assertEqual(self.g.classify(r)['classification'],'inflection');self.assertEqual(self.g.db.execute('SELECT COUNT(*) FROM lexemes').fetchone()[0],1);self.assertEqual(self.g.paths('a')['paths'],[])
    def test_review_requires_grant_exact_senses_and_correct_domain(self):
        a=self.lex('a','a');b=self.lex('b','b');r=self.rel(a,b);self.evidence(r);self.assertEqual(self.g.classify(r)['classification'],'insufficient_evidence')
        v,grant=self.verdict(r)
        with self.assertRaises(ValueError):self.g.review_relation(r,v,[])
        self.g.review_relation(r,v,[grant]);self.assertEqual(self.g.classify(r)['classification'],'derivation_direct');self.assertFalse(self.g.classify(r)['establishes_membership'])
        wrong,_=self.verdict(r,id='review:wrong',domain='membership')
        with self.assertRaises(ValueError):self.g.review_relation(r,wrong,[grant])
    def test_competing_reviews_create_hold_not_latest_wins(self):
        a=self.lex('a','a');b=self.lex('b','b');r=self.rel(a,b);self.evidence(r);v,grant=self.verdict(r);self.g.review_relation(r,v,[grant]);v2,_=self.verdict(r,'rejected','review:2')
        with self.assertRaises(IntegrityConflict):self.g.review_relation(r,v2,[grant])
        self.assertEqual(self.g.classify(r)['classification'],'insufficient_evidence');self.assertFalse(self.g.paths('a','b')['paths'][0]['steps'][0]['confirmed'])
    def test_revision_conflicts_preserve_both_payloads(self):
        a=self.lex('a','alpha');old=self.g.get('a');b=copy.deepcopy(old['body']);b['lemma']='different'
        with self.assertRaises(IntegrityConflict):self.g.put(envelope('Lexeme','a',b))
        self.assertEqual(self.g.get('a'),old);self.assertEqual(self.g.db.execute('SELECT COUNT(*) FROM integrity_conflicts').fetchone()[0],1)
        self.g.put(envelope('Lexeme','a',old['body'],2,a))
        with self.assertRaises(IntegrityConflict):self.g.put(envelope('Lexeme','a',old['body'],3,a))
    def test_indirect_acceptance_requires_complete_reviewed_direct_chain(self):
        a=self.lex('a','a');b=self.lex('b','b');c=self.lex('c','c');ab=self.rel(a,b);bc=self.rel(b,c)
        for r in [ab,bc]:self.evidence(r)
        indirect=self.rel(a,c,'derivation_indirect',params={'asserted_path_refs':[ab,bc],'intermediate_refs':[b]});self.evidence(indirect);v,grant=self.verdict(indirect,id='review:i')
        with self.assertRaises(ValueError):self.g.review_relation(indirect,v,[grant])
        for i,r in enumerate([ab,bc]):
            rv,_=self.verdict(r,id='review:s'+str(i));self.g.review_relation(r,rv,[grant])
        self.g.review_relation(indirect,v,[grant]);self.assertEqual(self.g.classify(indirect)['classification'],'derivation_indirect')
    def test_typed_alternatives_and_formal_similarity(self):
        a=self.lex('a','a');b=self.lex('b','b');rs=[self.rel(a,b,k,'undirected' if k in {'shared_base','surface_similarity','orthographic_variant'} else 'directed') for k in ['derivation_direct','shared_base','compounding','orthographic_variant','surface_similarity','etymological_relation']]
        self.assertEqual(len({r['id'] for r in rs}),6)
        for r in rs:self.evidence(r)
        self.assertEqual(self.g.classify(rs[4])['classification'],'surface_similarity');self.trusted('b');self.assertEqual(self.g.classify(rs[0],'alias',('en','b'))['classification'],'existing_decision_conflict')
    def test_canonical_unicode_subset_and_unknown_type(self):
        self.assertEqual(canonical({'\U0001f600':1,'\ufffd':2}),'{"😀":1,"�":2}')
        for x in [float('nan'),1.2,2**60]:
            with self.assertRaises(ValueError):canonical(x)
        with self.assertRaises(ValueError):self.g.relation('unregistered',[],{'state':'unknown','from_slots':[],'to_slots':[]})
    def test_modified_raw_or_normalized_fields_fail_closed(self):
        self.actual();r=json.loads((HERE/'fixtures/records.ndjson').read_text().splitlines()[0]);r['body']['normalized']['lexemes'][0]['lemma']='forged';p=self.root/'forged.ndjson';p.write_text(json.dumps(r)+'\n')
        with self.assertRaisesRegex(ValueError,'extraction differs'):ingest(self.g,p,read_json(REGISTRY))
    def test_pos_mismatch_is_not_a_reviewed_alignment(self):
        s=read_json(HERE/'fixtures/v6.json.gz');l=s['links'][0];h=next(h for h in s['heads'] if h['id']==l['head_id']);h['pos']='VERB';load_registry(self.g,s)
        self.lex('test:pos',l['word'],'NOUN',l['language']);align(self.g,s)
        rows=[json.loads(r[0]) for r in self.g.db.execute("SELECT payload FROM entities WHERE kind='CorpusAlignment'")]
        self.assertTrue(any(a['body']['extensions']['pos_check']=='conflict' for a in rows));self.assertTrue(all(a['body']['initial_status']=='needs_review' for a in rows))
    def test_fresh_build_replay_cached_checks_and_snapshot_query(self):
        args=[HERE/'fixtures/records.ndjson',REGISTRY,HERE/'fixtures/v6.json.gz',HERE/'fixtures/v6-lock.json']
        a=build(*args,self.root/'a');b=build(*args,self.root/'b');self.assertEqual((a/'GRAPH-MANIFEST.json').read_bytes(),(b/'GRAPH-MANIFEST.json').read_bytes())
        for name,h in read_json(a/'GRAPH-MANIFEST.json')['outputs'].items():self.assertEqual(file_hash(b/name),h)
        q=query(a,'CREAT','en','creel',manifest_sha256=file_hash(a/'GRAPH-MANIFEST.json'));self.assertEqual(q['family_guard']['status'],'blocked');self.assertFalse(q['queries'])
        self.assertEqual(build(*args,self.root/'a'),a);(a/'entities.ndjson').write_text('corrupt')
        with self.assertRaises(ValueError):build(*args,self.root/'a')
        with self.assertRaises(ValueError):build(*args,HERE/'forbidden')
    def test_input_lock_mismatch_and_missing_input(self):
        lock=read_json(HERE/'fixtures/v6-lock.json');lock['snapshot_sha256']='0'*64;p=self.root/'lock.json';p.write_text(json.dumps(lock))
        with self.assertRaises(ValueError):build(HERE/'fixtures/records.ndjson',REGISTRY,HERE/'fixtures/v6.json.gz',p,self.root/'out')
        with self.assertRaises(FileNotFoundError):build(self.root/'missing',REGISTRY,HERE/'fixtures/v6.json.gz',HERE/'fixtures/v6-lock.json',self.root/'out')

if __name__=='__main__':unittest.main()

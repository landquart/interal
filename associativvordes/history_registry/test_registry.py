import copy
import gzip
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from registry import History, SCHEMA, atomic, canonical, check, import_decisions, restore, sha


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.repo=self.root/'repo';self.repo.mkdir()
        subprocess.run(['git','init','-q',str(self.repo)],check=True)
        self.before=self.blob(gzip.compress(canonical({'f':[
            {'lemma_id':'l1','word':'bank'},{'lemma_id':'l2','word':'banks'}]}),mtime=0),'before.gz')
        self.after=self.blob(gzip.compress(canonical({'f':[{'lemma_id':'l2','word':'banks'}]}),mtime=0),'after.gz')
        self.d=dict(id='d1',source=dict(commit='pinned',sha256='locked'),date=None,
            operation='removed',scope=dict(domain='membership',family_id='f',language='en',
                pos=None,sense_id=None,selector=dict(before=self.before['blob'],after=self.after['blob'],
                direction='removed',count=1,ids_sha256=sha(canonical(['l1'])))),
            previous_status='member',decision='CONFIRMED_NONMEMBER',explanation='finite historical operation',
            evidence_refs=[],authority='BOUNDED_OPERATION',data_version='pinned',supersedes=[],
            evidence_status='locked',lexical_identity_status='unknown',sense_status='unknown',
            relation_status='historical',association_status='not_evaluated')
        self.s=dict(schema=SCHEMA,coverage_complete=True,decisions=[self.d],sources=[self.before,self.after],conflicts=[])
        self.path=self.root/'snapshot.json';self.save()
        self.p=dict(operation='restore',family_id='f',language='en',lemma_ids=['l1'])

    def blob(self,b,path):
        result=subprocess.run(['git','-C',str(self.repo),'hash-object','-w','--stdin'],input=b,capture_output=True,check=True)
        return dict(blob=result.stdout.decode().strip(),sha256=sha(b),bytes=len(b),path=path,commit='pinned')

    def save(self):
        atomic(self.path,canonical(self.s));self.digest=sha(self.path.read_bytes())

    def result(self,p=None):return check(self.repo,self.path,self.digest,p or self.p)

    def test_scoped_negative(self):self.assertFalse(self.result()['allowed'])
    def test_other_family(self):self.assertTrue(self.result(dict(self.p,family_id='other'))['allowed'])
    def test_other_language(self):self.assertTrue(self.result(dict(self.p,language='de'))['allowed'])
    def test_other_lemma_no_substring_expansion(self):self.assertTrue(self.result(dict(self.p,lemma_ids=['l2']))['allowed'])
    def test_known_sense_is_not_other_homonym(self):
        self.d['scope']['sense_id']='river';self.save()
        self.assertTrue(self.result(dict(self.p,sense_id='finance'))['allowed'])
        self.assertFalse(self.result()['allowed'])
    def test_unknown_scope_requires_review_not_all_senses_negative(self):
        self.assertEqual(self.result(dict(self.p,sense_id='new'))['status'],'HISTORY_REVIEW_REQUIRED')
    def test_idempotent_import(self):self.assertEqual(import_decisions([self.d,self.d]),[self.d])
    def test_conflicting_id_not_last_wins(self):
        d=copy.deepcopy(self.d);d['decision']='CONFIRMED_MEMBER'
        with self.assertRaisesRegex(ValueError,'HISTORY_CONFLICT'):import_decisions([self.d,d])
    def test_contradiction_not_last_wins(self):
        d=copy.deepcopy(self.d);d.update(id='newer',decision='CONFIRMED_MEMBER',date='2099-01-01')
        self.s['decisions'].append(d);self.save()
        self.assertEqual(self.result()['status'],'HISTORY_CONFLICT')
    def test_supersession_is_not_automatic(self):
        self.d['supersedes']=['old'];self.save();self.assertFalse(self.result()['allowed'])
    def test_incomplete_coverage(self):
        self.s['coverage_complete']=False;self.save()
        self.assertEqual(self.result()['status'],'HISTORY_UNAVAILABLE')
    def test_coverage_flag_cannot_bypass_conflicts(self):
        self.s['conflicts']=[{'type':'HISTORY_CONFLICT'}];self.save()
        self.assertFalse(self.result()['allowed'])

    def test_every_retired_repair_is_fenced(self):
        root=Path(__file__).resolve().parents[2]
        scripts=[p for p in (root/'scripts').glob('*.mjs') if 'assertHistoricalRepairAllowed();' in p.read_text()]
        self.assertEqual(len(scripts),17)
        for script in scripts:
            r=subprocess.run(['node',str(script),str(self.root/'must-not-be-written')],capture_output=True,text=True)
            self.assertNotEqual(r.returncode,0)
            self.assertIn('HISTORY_CONFLICT',r.stderr)
        self.assertFalse((self.root/'must-not-be-written').exists())

    def test_partial_journal(self):
        self.path.write_bytes(self.path.read_bytes()[:20]);self.assertFalse(self.result()['allowed'])
    def test_missing_snapshot(self):self.path.unlink();self.assertFalse(self.result()['allowed'])
    def test_missing_source(self):
        s=self.before['blob'];(self.repo/'.git/objects'/s[:2]/s[2:]).unlink()
        self.assertFalse(self.result()['allowed'])
    def test_corrupt_source_hash(self):
        self.before['sha256']='bad';self.save();self.assertFalse(self.result()['allowed'])
    def test_corrupt_selector_count(self):
        self.d['scope']['selector']['count']=2;self.save();self.assertFalse(self.result()['allowed'])
    def test_lexeme_is_not_corpus_lemma(self):
        self.assertFalse(self.result(dict(self.p,lemma_ids=[]))['allowed'])
    def test_merge_requires_finite_scope(self):
        self.assertFalse(self.result(dict(operation='merge',family_id='f'))['allowed'])
    def test_alias_negative_is_not_membership_negative(self):
        self.d['scope']=dict(domain='alias',family_id='f',alias='net');self.save()
        self.assertTrue(self.result()['allowed'])
        self.assertFalse(self.result(dict(operation='change_alias',family_id='f',alias='net'))['allowed'])
    def test_real_restore_idempotent_destination_protection(self):
        dest=self.root/'restore';restore(self.repo,self.path,self.digest,dest)
        self.assertEqual((dest/'REGISTRY.json').read_bytes(),self.path.read_bytes())
        self.assertEqual(len(list((dest/'objects').iterdir())),2)
        self.assertEqual(History('/nonexistent',dest/'REGISTRY.json',self.digest,dest/'objects').verify(),2)
        with self.assertRaises(ValueError):restore(self.repo,self.path,self.digest,dest)
    def test_snapshot_changed_requires_new_pin(self):
        self.s['decisions']=[];atomic(self.path,canonical(self.s));self.assertFalse(self.result()['allowed'])


if __name__=='__main__':unittest.main()

import copy, gzip, hashlib, json, pathlib, tempfile, unittest
from common import *
from shadow import apply, rollback, prove, decode, bucket

class Cleanup(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.work = pathlib.Path(self.temp.name); self.repo = self.work / 'repo'; self.repo.mkdir()
        self.before = self.work / 'before'; self.root = self.before / 'current' / PREFIX
        self.fid = 'surface:en:test'; self.b = bucket(self.fid)
        self.rel = 'families/' + self.b + '.json.gz'
        self.row = dict(lemma_id='lemma:test', word='test', normalized='test', sources=[dict(id='source-a')], components=[dict(evidence=['witness-a'])])
        self.write(self.root / self.rel, {self.fid: dict(id=self.fid, support=99, language_support={'en':1}, aliases=['test'], independent_field='retained')})
        for lang in LANGS:
            self.write(self.root / 'members' / lang / (self.b + '.json.gz'), {self.fid:[self.row]} if lang == 'en' else {})
        self.write(self.root / 'report.json', dict(largest_families=[dict(id=self.fid, support=99, language_support={'en':1})]))
        self.write(self.before / 'original' / 'unassigned.json', {'lemma:unassigned':dict(word='lonely', source='preserved')})
        self.lock(); self.history(); self.plan = self.work / 'SAFE-FIXES.ndjson'

    def write(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = canonical(value)
        path.write_bytes(gzip.compress(raw, mtime=0) if str(path).endswith('.gz') else raw)

    def lock(self):
        fs = inventory(self.before)
        self.manifest = dict(files=fs, inventory_sha256=hashlib.sha256(canonical(fs)).hexdigest(), production_commit=MAIN)
        save(self.before / 'SNAPSHOT.json', self.manifest)

    def history(self, complete=True):
        root = self.repo / 'audit/associative-history-registry'; root.mkdir(parents=True, exist_ok=True)
        data = canonical(dict(schema='interal-history/1', sources=[], decisions=[], coverage_complete=complete, conflicts=[], observations=[]))
        atomic(root / 'snapshot.json', data)
        save(root / 'CURRENT.json', dict(schema='interal-history/1', snapshot='snapshot.json', sha256=hashlib.sha256(data).hexdigest()))

    def fix(self):
        return dict(id='fix:1', classification='SAFE_STRUCTURAL_FIX', rule='FAMILY_SUPPORT',
            object=dict(path=self.rel, pointer='/' + self.fid + '/support'), before=99, after=1,
            impact=dict(semantic_memberships=0, source_evidence_records=0, source_lemmas=0),
            source_version=MAIN, source_inventory_sha256=self.manifest['inventory_sha256'],
            source_file_sha256=sha_file(self.root / self.rel))

    def trial(self, fixes=None):
        atomic(self.plan, b''.join(canonical(x)+b'\n' for x in ([self.fix()] if fixes is None else fixes)))
        target = self.work / 'after'
        return apply(self.before, self.plan, target, self.repo), target

    def test_safe_count_changes_no_membership_or_evidence(self):
        r, target = self.trial(); self.assertEqual(r['status'], 'SHADOW_ONLY')
        actual = decode(target / 'current' / PREFIX / self.rel)
        self.assertEqual(actual[self.fid]['support'], 1)
        self.assertEqual(actual[self.fid]['independent_field'], 'retained')
        member = pathlib.Path('current') / PREFIX / 'members/en' / (self.b+'.json.gz')
        self.assertEqual((self.before/member).read_bytes(), (target/member).read_bytes())
        self.assertEqual(apply(self.before, self.plan, target, self.repo)['status'], 'ALREADY_APPLIED')

    def test_real_inverse_restores_exact_bytes(self):
        _, target = self.trial(); destination = self.work / 'rollback'
        rollback(self.before, target, destination, self.repo)
        self.assertEqual(inventory(destination), inventory(self.before))

    def test_unassigned_source_not_deleted(self):
        _, target = self.trial()
        self.assertEqual((target/'original/unassigned.json').read_bytes(), (self.before/'original/unassigned.json').read_bytes())

    def test_unknown_history_blocks_nonempty(self):
        self.history(False)
        with self.assertRaisesRegex(ValueError, 'HISTORY_UNAVAILABLE'): self.trial()

    def test_missing_history_blocks_even_empty_initial_application(self):
        (self.repo/'audit/associative-history-registry/snapshot.json').unlink()
        with self.assertRaises(FileNotFoundError): self.trial([])

    def test_changed_history_rejects_resume(self):
        _, target = self.trial([]); self.history(False)
        with self.assertRaises(ValueError): apply(self.before, self.plan, target, self.repo)

    def test_empty_proposal_preserves_all_data_bytes(self):
        self.history(False); _, target = self.trial([])
        self.assertEqual(inventory(target), inventory(self.before))

    def test_forged_after_not_trusted(self):
        fix = self.fix(); fix['after'] = 2
        with self.assertRaisesRegex(ValueError, 'forged'): self.trial([fix])

    def test_membership_delete_never_accepted(self):
        fix = self.fix(); fix['rule'] = 'DELETE_MEMBER'
        with self.assertRaises(ValueError): self.trial([fix])

    def test_provenance_different_rows_never_deduplicated(self):
        other = dict(self.row, sources=[dict(id='source-b')])
        self.write(self.root/'members/en'/(self.b+'.json.gz'), {self.fid:[self.row, other]}); self.lock()
        with self.assertRaisesRegex(ValueError, 'duplicate'): self.trial()

    def test_exact_duplicate_still_requires_history_review(self):
        self.write(self.root/'members/en'/(self.b+'.json.gz'), {self.fid:[self.row, self.row]}); self.lock()
        with self.assertRaisesRegex(ValueError, 'duplicate'): self.trial()

    def test_alias_change_is_not_count_fix(self):
        fix = self.fix(); fix['object']['pointer'] = '/' + self.fid + '/aliases'; fix['after'] = []
        with self.assertRaisesRegex(ValueError, 'scope'): self.trial([fix])

    def test_snapshot_changed_input_fails_closed(self):
        self.write(self.root/self.rel, {})
        with self.assertRaises(ValueError): self.trial()

    def test_duplicate_nested_json_keys_are_rejected(self):
        p = self.work/'bad.json'; p.write_text('{"a":{"sense":1,"sense":2}}')
        with self.assertRaisesRegex(ValueError, 'duplicate JSON key'): decode(p)

    def test_partial_gzip_rejected(self):
        p = self.work/'bad.json.gz'; p.write_bytes(gzip.compress(b'{"a":1}')[:-5])
        with self.assertRaises((EOFError, OSError)): decode(p)

    def test_non_finite_serialization_rejected(self):
        p = self.work/'bad.json'; p.write_text('{"a":NaN}')
        with self.assertRaises(ValueError): decode(p)

    def test_production_destination_rejected(self):
        atomic(self.plan, b'')
        with self.assertRaises(ValueError): apply(self.before, self.plan, self.repo/'production', self.repo)

    def test_duplicate_fix_id_is_not_last_wins(self):
        with self.assertRaises(ValueError): self.trial([self.fix(), self.fix()])

    def test_forged_source_file_hash_rejected(self):
        fix = self.fix(); fix['source_file_sha256'] = '0'*64
        with self.assertRaises(ValueError): self.trial([fix])

    def test_record_identity_not_extended_to_other_family(self):
        fix = self.fix(); fix['object']['pointer'] = '/family:other/support'
        with self.assertRaises(ValueError): self.trial([fix])

if __name__ == '__main__': unittest.main()

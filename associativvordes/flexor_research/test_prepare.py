import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('flexor_prepare', Path(__file__).with_name('prepare.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class ResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = p.prepare()

    def test_real_external_provenance_and_unique_cases(self):
        cases = self.plan['cases']
        self.assertEqual(len(cases), 40)
        self.assertEqual(len({c['case_id'] for c in cases}), 40)
        for case in cases:
            self.assertTrue(any(x['kind'] == 'source_hypothesis_not_gold' for x in case['provenance']))
            self.assertIsNone(case['human_gold'])
            self.assertFalse(case['category_verified'])
            self.assertIsNone(case['context'])

    def test_language_and_question_quotas(self):
        for lang in ('en', 'de'):
            for group in p.SELECTION[lang]:
                self.assertEqual(sum(c['language'] == lang and c['screening_question'] == group
                                     for c in self.plan['cases']), 4)

    def test_replay_is_byte_identical_and_does_not_mutate_cases(self):
        original = p.CASES.read_bytes()
        self.assertEqual(p.encode(self.plan), p.encode(p.prepare()))
        self.assertEqual(p.CASES.read_bytes(), original)

    def test_no_fabricated_flexor_measurements(self):
        r = p.blocked_result(self.plan)
        self.assertEqual(r['model'], 'Flexor')
        self.assertEqual(r['inference_runs'], 0)
        self.assertTrue(all(v is None for v in r['metrics'].values()))
        self.assertEqual(r['case_counts'], {'en': 20, 'de': 20})
        self.assertIn('weights_not_located', r['blockers'])

    def test_missing_file_is_error(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(FileNotFoundError):
                p.prepare(Path(d) / 'missing.gz')

    def test_corrupted_input_is_error(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / 'bad.gz'
            f.write_bytes(b'not a gzip')
            with self.assertRaises(OSError):
                p.prepare(f)

    def test_missing_attested_lemma_is_not_generated(self):
        old = copy.deepcopy(p.SELECTION)
        try:
            p.SELECTION['en']['rare_derivative'][0] = '__not_a_real_lexeme__'
            with self.assertRaises(ValueError):
                p.prepare()
        finally:
            p.SELECTION.clear()
            p.SELECTION.update(old)

class HanTaArtifactTests(unittest.TestCase):
    def test_wrong_wheel_checksum_rejected_before_deserialization(self):
        spec = importlib.util.spec_from_file_location('hanta_probe', Path(__file__).with_name('hanta_probe.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / 'fake.whl'
            f.write_bytes(b'not the official wheel')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                module.run(f, Path(d) / 'not-read.json')


if __name__ == '__main__':
    unittest.main()

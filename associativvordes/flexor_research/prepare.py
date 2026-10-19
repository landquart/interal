"""Prepare an offline, bounded research plan; never run or imitate Flexor."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASES = ROOT / 'audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz'
# These are screening questions, not gold categories or claims of rarity/etymology.
SELECTION = {
    'en': {
        'rare_derivative': ['biregularity', 'createdness', 'ocularist', 'creatress'],
        'internationalism': ['operation', 'regulation', 'naturalize', 'libertarianism'],
        'compound': ['visuomanual', 'liberticide', 'quadripedal', 'intercorrelate'],
        'opaque_structure': ['internment', 'internship', 'permute', 'irregular'],
        'boundary_ambiguity': ['inalterable', 'semimanual', 'nonirregular', 'reoperable'],
    },
    'de': {
        'rare_derivative': ['Naturhaftigkeit', 'bimanuell', 'überaltern', 'regulierbar'],
        'internationalism': ['Regulation', 'Nationalismus', 'korrelativ', 'kreationismus'],
        'compound': ['internetseite', 'internetzeitung', 'opernhaus', 'altersjahr'],
        'opaque_structure': ['operette', 'naturell', 'alter', 'neoliberal'],
        'boundary_ambiguity': ['Deregulierung', 'liberalisieren', 'übernational', 'unkreativ'],
    },
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def prepare(cases_path=CASES):
    raw = Path(cases_path).read_bytes()  # Only the already bounded pilot, not full corpora.
    rows = [json.loads(line) for line in gzip.decompress(raw).decode().splitlines()]
    selected = []
    for language, groups in SELECTION.items():
        for group, lemmas in groups.items():
            for lemma in lemmas:
                matches = sorted((r for r in rows if r['language'] == language
                                  and r['origin'] == 'external_path'
                                  and r['target']['lemma'] == lemma), key=lambda r: r['id'])
                if not matches:
                    raise ValueError(f'Missing externally attested case: {language}/{lemma}')
                case = matches[0]
                if not any(p['kind'] == 'source_hypothesis_not_gold' for p in case['provenance']):
                    raise ValueError(f'Missing external provenance: {case["id"]}')
                selected.append({
                    'case_id': case['id'], 'language': language, 'lemma_original': lemma,
                    'family_hypothesis': case['family'], 'target': case['target'],
                    'screening_question': group, 'category_verified': False,
                    'provenance': case['provenance'], 'pilot_content_sha256': case['content_sha256'],
                    'context': None, 'context_source': None, 'human_gold': None,
                    'frequency': None, 'status': 'awaiting_context_and_independent_annotation',
                })
    return {'schema': 'flexor-research-plan/1', 'input_sha256': digest(raw),
            'policy': 'No model execution, no membership writes, screening tags are not gold.',
            'cases': selected}


def blocked_result(plan):
    return {'schema': 'flexor-research-readiness/1', 'plan_sha256': digest(encode(plan)),
            'status': 'blocked', 'model': 'Flexor', 'inference_runs': 0,
            'blockers': ['official_code_not_located', 'weights_not_located',
                         'code_and_weight_licenses_unconfirmed', 'runtime_contract_unavailable',
                         'real_sentence_contexts_missing', 'independent_manual_gold_missing'],
            'case_counts': {lang: sum(c['language'] == lang for c in plan['cases'])
                            for lang in SELECTION},
            'metrics': {key: None for key in ['corrected_source_errors', 'new_correct_analyses',
                        'false_segmentations', 'precision', 'boundary_f1', 'peak_memory_bytes',
                        'tokens_per_second', 'context_effect']}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=Path, default=CASES)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    plan = prepare(args.cases)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'PLAN.json').write_bytes(encode(plan))
    (args.out / 'READINESS.json').write_bytes(encode(blocked_result(plan)))


if __name__ == '__main__':
    main()

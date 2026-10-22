"""Capture native memberships and verified existing frequency rows for replay.

No LLM analyses are available in mass06: neither A nor P is invented. Resulting
calculator runs can demonstrate missing inputs, never certify semantic safety.
"""
import argparse
import gzip
import json
from pathlib import Path
import subprocess
from collections import OrderedDict
from control import atomic, canonical, digest, LANGUAGES


def capture(state, repo, destination):
    destination = Path(destination); destination.mkdir(parents=True, exist_ok=False)
    cache = OrderedDict(); found = 0; missing = 0; outputs = []
    for family in state['data']['catalog']['families']:
        languages = {language: [] for language in LANGUAGES}
        for m in state['data']['memberships']:
            if m['family_id'] != family['id']: continue
            record = None
            for proof in m.get('source_proof', []):
                src = proof.get('source', {}); path = src.get('path')
                if not path or not path.startswith('associativvordes/family-index-v5/members/'): continue
                if path not in cache:
                    raw = subprocess.check_output(['git', 'show', state['source_commit']+':'+path], cwd=repo)
                    cache[path] = json.loads(gzip.decompress(raw))
                    if len(cache) > 8: cache.popitem(last=False)
                else: cache.move_to_end(path)
                for candidate in cache[path].get(src.get('family_id'), []):
                    if candidate.get('lemma_id') != m['lemma_id']: continue
                    # Native v6 records use the original JSON.stringify insertion
                    # order, not our sorted release canonicalization.
                    original_hash = digest(json.dumps(candidate, ensure_ascii=False, separators=(',', ':')).encode())
                    if original_hash == src.get('record_sha256'):
                        record = candidate; break
            row = dict(word=m['word'], lemma_id=m['lemma_id'], head_id=m['head_id'], model_key=m['head_id'],
                       family_id=m['family_id'], frequency_status='unknown', final_score=None,
                       association_score=None, selected=True, analysis=dict(status='missing',
                       review_required=True, reason='No independently verified semantic calculator analysis'))
            if record:
                for name in ('sources', 'category_breakdown', 'frequency_score', 'rank'):
                    if name in record: row[name] = record[name]
                row['frequency_status'] = 'observed' if row.get('sources') else 'unknown'
                row['frequency_record_sha256'] = digest(record); found += 1
            else: missing += 1
            languages[m['language']].append(row)
        value = dict(schema='release07-calculator-recording/1', state_sha256=digest(state),
                     input=dict(root=family['canonical'], meaning='', maxModels=5), languages=languages,
                     semantic_analysis='MISSING_NOT_SYNTHESIZED')
        path = destination/(family['id'].replace(':', '_')+'.json')
        atomic(path, canonical(value)); outputs.append(str(path))
    return dict(recordings=outputs, matched_frequency_records=found, unknown_frequency_records=missing,
                external_analysis_calls=0, semantic_analysis_available=False)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('state', 'repo', 'destination', 'receipt'): p.add_argument('--'+name, required=True)
    a = p.parse_args(); result = capture(json.loads(Path(a.state).read_bytes()), a.repo, a.destination)
    atomic(Path(a.receipt), canonical(result)); print(canonical(result).decode())

"""Reproducible, exact-ID continuation of the frozen observ/inform review.

This stage reviews lexical membership only. Positive decisions require a later
additive materialization preflight; no runtime shard or historic ledger changes.
"""
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

BASE = Path('audit/associative-family-v5')
SOURCE = BASE / 'reflex-checkpoint-20261001'
OUT = BASE / 'reflex-continuation-20261002'
sha = lambda data: hashlib.sha256(data).hexdigest()

# Finite whole-word selections, not open substring or suffix acceptance rules.
# Morphological extensions below are explicitly inspected lexical inferences.
groups = [
    ('de', 'inform', 'excluded', 'informal',
     'informal informale informalen informaler informalisierung informalität',
     'Negative in- + formal and its explicitly reviewed inflections/derivatives. '
     'The visible inform letters are not the information component.',
     ['https://www.duden.de/rechtschreibung/informal']),
    ('fr', 'inform', 'excluded', 'informel / informal',
     'informal informalité informel informellement',
     'The informal/formless lexical branch and explicitly reviewed derivatives; '
     'not informer or information. The derivative decisions are morphological inferences.',
     ['https://www.dictionnaire-academie.fr/article/A9I1224',
      'https://www.duden.de/rechtschreibung/informal']),
    ('es', 'inform', 'excluded', 'informal',
     'informal informalidad informalmente superinformal',
     'The nonformal adjective, its quality noun, adverb and super- compound. '
     'The last two analyses are transparent morphological inferences.',
     ['https://dle.rae.es/informal', 'https://dle.rae.es/informalidad']),
    ('it', 'inform', 'excluded', 'informale',
     'informale informalità informalmente',
     'Negative in- + formale; the noun and adverb remain in that branch. '
     'This is not the informare component.',
     ['https://www.treccani.it/vocabolario/informale/']),
    ('it', 'inform', 'excluded', 'informicolarsi / informicolirsi',
     'informicolando informicolati informicoliscono informicolita informicolite informicoliti',
     'Reviewed verb forms and participles of the formicola/tingling branch. '
     'Their information-like letters do not establish informare membership.',
     ['https://www.treccani.it/vocabolario/informicolarsi/']),
    ('de', 'inform', 'accepted', 'Informator', 'informator',
     'German dictionary head meaning a person who supplies information.',
     ['https://www.duden.de/rechtschreibung/Informator']),
    ('de', 'inform', 'accepted', 'informatorisch', 'informatorisch',
     'German dictionary adjective for an informational purpose; recognizable inform component.',
     ['https://www.duden.de/rechtschreibung/informatorisch']),
    ('fr', 'inform', 'accepted', 'informatique', 'mathématiques-informatique',
     'The hyphenated coordinate compound retains the independently attested informatique head. '
     'The exact compound analysis is an inference, not a dictionary compound citation.',
     ['https://www.dictionnaire-academie.fr/article/A9I1219']),
    ('de', 'observ', 'accepted', 'Observatorium',
     'johnson-ridge-observatorium yerkes-observatorium',
     'A named prefix is joined by a hyphen to the complete German Observatorium head. '
     'Acceptance covers the observation component, not any proposed etymology of the name.',
     ['https://www.duden.de/rechtschreibung/Observatorium']),
    ('it', 'observ', 'accepted', 'osservatorio', 'inaf-osservatorio',
     'The acronym prefix is joined by a hyphen to the Italian osservatorio head, derived '
     'from osservare. National realization is osserv, not a literal observ substring.',
     ['https://www.treccani.it/vocabolario/osservatorio/']),
    ('de', 'inform', 'uncertain', 'informell (two homonymous branches)',
     'informell informelle informelleren',
     'Duden distinguishes the information adjective from the nonformal adjective. '
     'The aggregate corpus member lacks sense-disambiguating contexts. Keep uncertain '
     'rather than exclude all forms from the information family.',
     ['https://www.duden.de/rechtschreibung/informell_formlos',
      'https://www.duden.de/rechtschreibung/informell_informierend']),
]

def main():
    decision_bytes = (SOURCE / 'linguistic-decisions.json').read_bytes()
    candidate_bytes = (SOURCE / 'candidates.json.gz').read_bytes()
    old = json.loads(decision_bytes)
    candidates = json.loads(gzip.decompress(candidate_bytes))
    unresolved = {(lang, root, row['lemma_id']): row
                  for lang, roots in old['decisions'].items()
                  for root, rows in roots.items() for row in rows
                  if row['status'] == 'uncertain'}
    assert len(unresolved) == 762
    selected = []
    records = []
    used = set()
    for lang, root, status, head, words, reason, refs in groups:
        for word in words.split():
            matches = [(key, row) for key, row in unresolved.items()
                       if key[:2] == (lang, root) and row['word'] == word]
            assert len(matches) == 1, (lang, root, word, matches)
            key, prior = matches[0]
            assert key not in used
            used.add(key)
            source = [m for m in candidates[lang][root] if m['lemma_id'] == key[2]]
            assert len(source) == 1 and source[0]['word'] == word
            assert source[0]['source_family_ids'] == prior['source_family_ids']
            selected.append({**prior, 'language': lang, 'canonical_root': root,
                             'previous_status': 'uncertain', 'status': status,
                             'lexical_head': head, 'reason': reason,
                             'source_references': refs,
                             'runtime_applied': False})
            records.append({'language': lang, 'canonical_root': root,
                            'member': source[0]})
    pending = [{**row, 'language': key[0], 'canonical_root': key[1],
                'previous_status': 'uncertain', 'status': 'pending_review',
                'reason': 'Not adjudicated in this continuation; prior decision remains immutable.'}
               for key, row in unresolved.items() if key not in used]
    counts = dict(Counter(row['status'] for row in selected))
    counts['pending_review'] = len(pending)
    assert sum(counts.values()) == len(unresolved)
    files = {
        'decisions.json': {'schema_version': 1, 'source_run_id': old['source_run_id'],
                           'base_commit': '63ffcb701b89358ce00ed320159547db46a31620',
                           'runtime_changes': False, 'full_family_certification': False,
                           'counts': counts, 'decisions': selected,
                           'limitations': ['Positive decisions are reviewed selections awaiting materialization.',
                                           'No historic accepted or excluded decision is overwritten.',
                                           'Pending records have not been adjudicated in this stage.']},
        'pending-review.json': {'schema_version': 1, 'count': len(pending), 'records': pending},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for name, payload in files.items():
        (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    proof = json.dumps({'schema_version': 1, 'records': records}, ensure_ascii=False,
                       sort_keys=True).encode()
    (OUT / 'source-records.json.gz').write_bytes(gzip.compress(proof, mtime=0))
    hashes = {name: sha((OUT / name).read_bytes())
              for name in [*files, 'source-records.json.gz']}
    inventory = {'schema_version': 1, 'source_run_id': old['source_run_id'],
                 'source_checkpoint': str(SOURCE),
                 'source_decision_sha256': sha(decision_bytes),
                 'source_candidate_sha256': sha(candidate_bytes),
                 'counts': counts, 'source_unresolved_count': len(unresolved),
                 'reviewed_record_count': len(selected), 'artifact_sha256': hashes,
                 'runtime_changes': False, 'full_family_certification': False}
    (OUT / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(inventory, ensure_ascii=False))

if __name__ == '__main__':
    main()

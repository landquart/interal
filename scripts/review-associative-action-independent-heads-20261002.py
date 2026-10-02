"""Frozen whole-form action exclusions, composed after the Italian stage.

Do not generalize these lists into runtime substring rules. In particular the
letters 'action' inside fraction/attraction are not an independent action head.
"""
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

B = Path('audit/associative-family-v5')
PREVIOUS = B / 'action-italian-stage-20261002'
OUT = B / 'action-independent-heads-20261002'
sha = lambda b: hashlib.sha256(b).hexdigest()
MW = 'https://www.merriam-webster.com/dictionary/'
ACA = 'https://www.dictionnaire-academie.fr/article/'

# Explicitly reviewed standard headwords, transparent derivatives/inflections,
# and compounds. Dictionary URLs establish the head; extended morphology is
# recorded as an inference, not a claim that every surface form has an entry.
GROUPS = [
    ('en', 'exact', 'exact exacting exactingly exaction exactitude exactness exactor exactly inexact inexactitude inexactitudes inexactly', MW+'exact',
     'Recognizable exact/exaction precision or demand branch. Its historical exigere/agere connection alone does not establish the modern act component.'),
    ('en', 'faction', 'faction factional factionalise factionalised factionalism factionalist factionalized factionism factionist factionists factionless factions', MW+'faction',
     'Recognizable faction/group branch, not action with a detachable prefix.'),
    ('en', 'factual', 'factual factualism factuality factually counterfactual counterfactually counterfactuals unfactual artefactual artifactual', MW+'factual',
     'The fact/factual head is independent of act; prefixes and the artifact compound preserve that distinction.'),
    ('en', 'fraction', 'fraction fractional fractionalisation fractionally fractionals fractionate fractionation fractionator fractioned fractioning fractionize fractions unfractionated unfractioned biofraction', MW+'fraction',
     'The fraction/breaking branch and its selected derivatives. Internal action letters are not the action head.'),
    ('en', 'traction', 'traction tractionless tractive countertraction', MW+'traction',
     'The tract/drawing lexical head, independent of act.'),
    ('en', 'abstraction', 'abstraction abstractionism abstractionist abstractionists abstractivism', MW+'abstraction',
     'The abstract/tract branch; action-like nominal letters do not supply an independent action constituent.'),
    ('en', 'attraction', 'attraction attractions attractive attractively attractiveness attractivity unattractive unattractively unattractiveness', MW+'attraction',
     'The attract/tract branch, including negative un- and selected derivatives.'),
    ('en', 'contract', 'contraction contractional contractionary contractive contractual contractualism contractually contractuals non-contractual extracontractual', MW+'contract',
     'The contract/tract branch remains independent in these selected nouns, adjectives and compounds.'),
    ('en', 'extraction', 'extraction extractions extractive', MW+'extraction',
     'The extract/tract branch, not lexical action.'),
    ('en', 'distraction', 'distraction distractionary distractions distractive', MW+'distraction',
     'The distract/tract branch, not lexical action.'),
    ('en', 'practitioner', 'practitioner practitioner-led practitioners generalpractitioner', MW+'practitioner',
     'The practice/practitioner branch; the compound preserves that head, not act.'),
    ('en', 'liquefaction', 'liquefaction liquefactions liquefactive', MW+'liquefaction',
     'Independent liquefy/liquefaction lexical branch. Fact and nominal morphology do not create a lexical act constituent.'),
    ('en', 'putrefaction', 'putrefaction putrefactive', MW+'putrefaction',
     'Independent putrefy/putrefaction branch, not lexical action.'),
    ('en', 'satisfaction', 'satisfaction dissatisfaction insatisfaction unsatisfaction self-satisfaction', MW+'satisfaction',
     'The satisfy/satisfaction head is independent; negative prefixes and self- do not turn its internal letters into lexical act.'),
    ('fr', 'caractère', 'caractère caractères caractériel caractérisation caractérisé caractériser caractéristique caractéristiques', ACA+'A9C0722',
     'The character/mark lexical branch and its selected derivatives, independent of act.'),
    ('fr', 'fraction', 'fraction fractionnable fractionnaire fractionnaires fractionnateur fractionné fractionnelle fractionnement fractionnements fractionner fractions', ACA+'A9F1478',
     'The fract/breaking branch and selected nominal, adjectival and verbal derivatives.'),
    ('fr', 'exact', 'exact exactement exactitude inexact inexactement inexactitude', ACA+'A9E3191',
     'The exact/precision branch. An exigere/agere ancestry does not establish the present lexical acte head.'),
    ('fr', 'abstraction', 'abstraction abstractionnisme abstractionniste', ACA+'A9A0185',
     'The abstraire/tract branch; there is no independent action head inside abstraction.'),
    ('fr', 'distraction', 'distraction distractive', ACA+'A9D2812',
     'The distraire/tract branch, not lexical action.'),
]

def main():
    base_path = B / 'action-continuation-20261002/linguistic-decisions.json.gz'
    raw = base_path.read_bytes()
    base = json.loads(gzip.decompress(raw))
    prior_bytes = (PREVIOUS / 'decisions.json').read_bytes()
    prior = json.loads(prior_bytes)
    inv = json.loads((PREVIOUS / 'inventory.json').read_text())
    assert sha(prior_bytes) == inv['decision_sha256']
    assert sha(raw) == prior['previous_decision_sha256']
    used = {(r['language'], r['lemma_id']) for r in prior['decisions']}
    rows = {(lang, row['word']): row for lang, rs in base['decisions'].items()
            for row in rs}
    source = {}
    for lang in ['en', 'fr']:
        data = json.loads(gzip.decompress((B / 'action-reflex-checkpoint-20261001' /
                                         (lang+'-candidates.json.gz')).read_bytes()))['act']
        source[lang] = {m['lemma_id']: m for m in data}
    delta = []
    proof = []
    for lang, head, words, url, reason in GROUPS:
        for word in words.split():
            row = rows[(lang, word)]
            assert row['status'] == 'pending_review', (lang, word, row['status'])
            key = (lang, row['lemma_id'])
            assert key not in used, key
            used.add(key)
            m = source[lang][row['lemma_id']]
            assert m['word'] == word and m['source_family_ids'] == row['source_family_ids']
            delta.append({'language': lang, 'lemma_id': row['lemma_id'], 'word': word,
                          'previous_status': 'pending_review', 'status': 'excluded',
                          'lexical_head': head, 'branch': 'independent_lexical_head',
                          'reason': reason + ' Decision applies only to this saved whole form; original components and routes are retained.',
                          'source_family_ids': row['source_family_ids'],
                          'source_references': [url], 'runtime_applied': False})
            proof.append({'language': lang, 'member': m})
    counts = {lang: dict(cs) for lang, cs in prior['counts'].items()}
    by_lang = Counter(row['language'] for row in delta)
    for lang, n in by_lang.items():
        counts[lang]['pending_review'] -= n
        counts[lang]['excluded'] += n
        assert counts[lang]['pending_review'] >= 0
    assert sum(sum(cs.values()) for cs in counts.values()) == 52277
    OUT.mkdir(parents=True, exist_ok=True)
    payload = {'schema_version': 1, 'source_run_id': 35647932153, 'canonical_root': 'act',
               'base_commit': '7359b8e3c1190aeae15f18ff216f80036c3383c9',
               'previous_checkpoint': str(PREVIOUS),
               'previous_decision_sha256': sha(prior_bytes),
               'initial_continuation_sha256': sha(raw), 'runtime_changes': False,
               'runtime_applied_record_count': 2098, 'full_family_certification': False,
               'decisions': delta, 'counts': counts,
               'limitations': ['Only finite whole-form selections are adjudicated.',
                               'OCR fragments, fused phrases, names and other unlisted records remain pending.',
                               'Dictionary head evidence plus explicitly stated morphology is not a corpus-sense frequency allocation.']}
    (OUT / 'decisions.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n')
    (OUT / 'source-records.json.gz').write_bytes(gzip.compress(json.dumps(
        {'schema_version': 1, 'records': proof}, ensure_ascii=False, sort_keys=True).encode(), mtime=0))
    inventory = {'schema_version': 1, 'canonical_root': 'act', 'source_run_id': 35647932153,
                 'previous_checkpoint': str(PREVIOUS), 'previous_decision_sha256': sha(prior_bytes),
                 'source_candidate_count': 52277, 'adjudicated_in_this_stage': len(delta),
                 'excluded_added': len(delta), 'accepted_added': 0, 'membership_changes': 0,
                 'counts': counts, 'runtime_changes': False, 'full_family_certification': False,
                 'artifact_sha256': {name: sha((OUT / name).read_bytes())
                                     for name in ['decisions.json', 'source-records.json.gz']}}
    (OUT / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'adjudicated': len(delta), 'by_language': dict(by_lang), 'counts': counts}))

if __name__ == '__main__':
    main()

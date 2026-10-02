"""Exact-record Russian continuation; retain independent routes and metadata."""
import gzip
import hashlib
import json
from pathlib import Path

B = Path('audit/associative-family-v5')
P = B / 'action-independent-heads-20261002'
O = B / 'action-russian-heads-20261002'
sha = lambda b: hashlib.sha256(b).hexdigest()
MW = 'https://www.merriam-webster.com/dictionary/'
G = 'https://gramota.ru/meta/'
GROUPS = [
    ('дидактика', 'автодидакт дидакт дидактик дидактика дидактический',
     [G+'didaktika', G+'avtodidakt', MW+'didactic'],
     'The didactic/teaching head is independent of акт; авто- and noun/adjective morphology do not change that.'),
    ('дактиль / Greek daktylos', 'арахнодактилия брахидактилия дактилический дактилоскопировать дактилоскопист дактилоскопический дактилоскопия дактиль полидактилизм полидактилия синдактилия синдактильный эктродактилия',
     [G+'daktil', G+'daktiloskopiya', G+'polidaktiliya', MW+'dactyl'],
     'The Greek finger/dactyl element is a complete independent component, not a prefix plus акт. Selected technical compounds and derivatives are explicit morphological inferences.'),
    ('птеродактиль', 'птеродактилевидный птеродактиль птеродактильный птеродактильский',
     [MW+'pterodactyl'],
     'Recognizable pterodactyl/finger head and selected Russian derivatives, not lexical action.'),
    ('фракция', 'безфракционник бесфракционный межфракционный мультифракционный нефракционированный фракционер фракционирование фракционность фракционный',
     [G+'fraktsiya', MW+'fraction'],
     'The fraction/fract lexical branch remains independent under these prefixes and derivational endings.'),
    ('пролактин', 'пролактин гиперпролактинемия', [MW+'prolactin'],
     'Prolactin contains the lact/milk branch, not act or Greek ray actin. Hyperprolactinemia preserves that complete hormonal head.'),
    ('тессеракт', 'тессеракт тессерактовый', [MW+'tesseract'],
     'The geometric head contains Greek aktis/ray; the apparent final акт is not the Latin action element.'),
    ('tract/drawing', 'тракция ретракционный экстрактивный экстракционный дистракция',
     [MW+'traction', MW+'extraction', MW+'distraction'],
     'These reviewed national tract/drawing realizations are independent of акт. This does not exclude a compound with a separate true актив component.'),
]

def main():
    prior_bytes = (P / 'decisions.json').read_bytes()
    prior = json.loads(prior_bytes)
    inv = json.loads((P / 'inventory.json').read_text())
    assert sha(prior_bytes) == inv['artifact_sha256']['decisions.json']
    source_path = B / 'action-reflex-checkpoint-20261001/ru-candidates.json.gz'
    source_bytes = source_path.read_bytes()
    source = {m['lemma_id']: m for m in json.loads(gzip.decompress(source_bytes))['act']}
    base_bytes = (B / 'action-continuation-20261002/linguistic-decisions.json.gz').read_bytes()
    base = json.loads(gzip.decompress(base_bytes))
    assert sha(base_bytes) == prior['initial_continuation_sha256']
    rows = {m['word']: m for m in base['decisions']['ru']}
    earlier = json.loads((B / 'action-italian-stage-20261002/decisions.json').read_bytes())
    used = {(m['language'], m['lemma_id']) for m in [*earlier['decisions'], *prior['decisions']]}
    delta = []
    proof = []
    for head, words, refs, reason in GROUPS:
        for word in words.split():
            r = rows[word]
            assert r['status'] == 'pending_review', (word, r['status'])
            key = ('ru', r['lemma_id'])
            assert key not in used
            used.add(key)
            m = source[r['lemma_id']]
            assert m['word'] == word and m['source_family_ids'] == r['source_family_ids']
            delta.append({'language': 'ru', 'lemma_id': r['lemma_id'], 'word': word,
                          'previous_status': 'pending_review', 'status': 'excluded',
                          'lexical_head': head, 'branch': 'independent_lexical_head',
                          'reason': reason, 'source_references': refs,
                          'source_family_ids': r['source_family_ids'], 'runtime_applied': False})
            proof.append(m)
    counts = {lang: dict(cs) for lang, cs in prior['counts'].items()}
    counts['ru']['excluded'] += len(delta)
    counts['ru']['pending_review'] -= len(delta)
    assert sum(sum(cs.values()) for cs in counts.values()) == 52277
    O.mkdir(parents=True, exist_ok=True)
    d = {'schema_version': 1, 'canonical_root': 'act', 'source_run_id': 35647932153,
         'base_commit': 'faf105ccb0ff7c70ed2aad19206511953bcb1f46',
         'previous_checkpoint': str(P), 'previous_decision_sha256': sha(prior_bytes),
         'source_candidate_sha256': sha(source_bytes), 'counts': counts, 'decisions': delta,
         'runtime_changes': False, 'runtime_applied_record_count': 2098,
         'full_family_certification': False,
         'limitations': ['Only the explicitly saved whole forms are adjudicated.',
                         'Other Russian names, OCR forms and ambiguous editor/redactor heads remain pending.',
                         'Dictionary head evidence and morphological inferences do not allocate aggregate corpus frequency to a sense.']}
    (O / 'decisions.json').write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n')
    (O / 'source-records.json.gz').write_bytes(gzip.compress(json.dumps(
        {'schema_version': 1, 'language': 'ru', 'records': proof}, ensure_ascii=False,
        sort_keys=True).encode(), mtime=0))
    inventory = {'schema_version': 1, 'canonical_root': 'act', 'source_run_id': 35647932153,
                 'previous_checkpoint': str(P), 'previous_decision_sha256': sha(prior_bytes),
                 'source_candidate_count': 52277, 'adjudicated_in_this_stage': len(delta),
                 'excluded_added': len(delta), 'accepted_added': 0, 'membership_changes': 0,
                 'counts': counts, 'runtime_changes': False, 'full_family_certification': False,
                 'artifact_sha256': {n: sha((O / n).read_bytes())
                                     for n in ['decisions.json', 'source-records.json.gz']}}
    (O / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'adjudicated': len(delta), 'counts': counts}))

if __name__ == '__main__':
    main()

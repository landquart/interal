"""Independent original-field oracle. Run from repository root; no production helper."""
import collections, gzip, json
from pathlib import Path

generated = Path('associativvordes/family-index-v6/generated')
with gzip.open('audit/associative-family-v6/prompt09-shadow-20261007/generated/hydrated-accepted-corpus-rows.json.gz') as f:
    rows = json.load(f)
with gzip.open(generated / 'lemma-head-links.json.gz') as f:
    links = json.load(f)
index = {(r['language'], r['family_id'], r['lemma_id']): r for r in links}
tasks = collections.defaultdict(list)
for row in rows:
    for membership in row['accepted_memberships']:
        link = index[(row['language'], membership['family_id'], row['lemma_id'])]
        locator = link['evidence'][0]['source']
        tasks[locator['path']].append((row, locator, membership))
fields = ['lemma_id', 'word', 'normalized', 'search_form', 'rank', 'frequency_score', 'category_breakdown', 'sources', 'corpus_quality']
checked = 0
for path, records in tasks.items():
    with gzip.open(path) as f:
        shard = json.load(f)
    source = {fid: {r['lemma_id']: r for r in shard[fid]} for fid in {locator['family_id'] for _, locator, _ in records}}
    for row, locator, membership in records:
        original = source[locator['family_id']][row['lemma_id']]
        for field in fields:
            assert row[field] == original[field], (row['language'], row['lemma_id'], field)
        assert membership['source_proof'][0]['source'] == locator
        checked += 1
assert checked == 21566 and len(rows) == 21371
print(json.dumps({'verdict': 'pass', 'unique_rows': len(rows), 'component_measurement_comparisons': checked, 'fields': fields}))

#!/usr/bin/env python3
"""Freeze the existing tower packet; never materialize memberships."""
import collections
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audit/associative-family-v6'
hashes = {}

def read(path):
    raw = (ROOT / path).read_bytes()
    hashes[path] = hashlib.sha256(raw).hexdigest()
    return json.loads(gzip.decompress(raw) if path.endswith('.gz') else raw)

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

packets = read('audit/associative-family-v6/candidate-root-clusters-20261003/clusters.json.gz')
packet = next(p for p in packets if p['candidate_cluster_id'] == 'candidate-root:b1d1803a0d1c69bf965b3462')
routes, frames, identity_sets = [], [], []
for cluster in packet['evidence_clusters']:
    path, key = cluster['source'], cluster['id']
    family = read(path)[key]
    shard = Path(path).name
    rows, counts = [], {}
    for language in ['en', 'de', 'fr', 'es', 'it', 'ru']:
        mp = f'associativvordes/family-index-v5/members/{language}/{shard}'
        members = read(mp)[key]
        counts[language] = len(members)
        rows.extend({'language': language, 'source_locator': {'path': mp, 'family_id': key}, **r} for r in members)
    ids = sorted({(r['language'], r['lemma_id'], r['word']) for r in rows})
    assert len(ids) == len(rows) == 1083
    identity_sets.append(set(map(tuple, ids)))
    routes.append({'id': key, 'source_family_path': path, 'source_canonical': family['canonical'],
                   'etymon_keys': family['etymon_keys'], 'declared_source_terms': cluster['declared_source_terms'],
                   'route_record_count': len(rows), 'language_counts': counts,
                   'identity_set_sha256': digest(ids), 'whole_container_import_authorized': False})
    frames.append({'route_id': key, 'records': rows})
assert identity_sets[0] == identity_sets[1]
first = frames[0]['records']

def exact(language, word):
    matches = [r for r in first if r['language'] == language and r['word'] == word]
    assert len(matches) == 1, (language, word, len(matches))
    return matches[0]

facts = [
 ('en', 'tower', 'tower_noun_and_denominal_verb', 'https://www.merriam-webster.com/dictionary/tower',
  'Middle English tour/tor through Old English torr and Anglo-French tur/tour continues Latin turris. Dictionary noun and denominal verb share this base. Proper-name tokens are not established by the lowercase aggregate.'),
 ('de', 'turm', 'tower_common_noun', 'https://www.duden.de/rechtschreibung/Turm',
  'Middle and Old High German tower forms continue Latin turris through Old French. Technical and chess uses are metonymies of this noun. Exact corpus case/POS is not supplied.'),
 ('fr', 'tour', 'feminine_tower_noun_only', 'https://www.dictionnaire-academie.fr/article/A9T1596',
  'Feminine tower noun continues Latin turris. Masculine lathe tour instead continues tornus; masculine turn/trip tour is deverbal from tourner. Untagged tour cannot inherit a single common associative base.'),
 ('es', 'torre', 'tower_and_chess_rook_common_noun', 'https://dle.rae.es/torre',
  'RAE derives the tower noun from Latin turris; chess and other metonymies preserve the base. A dictionary row does not resolve proper-name occurrences in the source aggregate.'),
 ('it', 'torre', 'tower_common_noun', 'https://www.treccani.it/vocabolario/torre/',
  'Treccani derives the tower noun from Latin turris and records its use in place names. Proper-name aggregation needs independent context, not lowercase spelling.'),
 ('ru', 'тура', 'chess_rook_borrowing_only', 'https://lexicography.online/etymology/vasmer/т/тура',
  'Vasmer separates the chess borrowing through French feminine tour and Latin turris from peat and sea-plant homonyms with different routes. Untagged source тура cannot receive the chess-family edge for all readings.'),
 ('en', 'turret', 'small_tower_diminutive_branch', 'https://www.merriam-webster.com/dictionary/turret',
  'Anglo-French turette/tourette is a diminutive of tur/tour. This is a separate national lexical head and derivational branch; the final derivational material is not the international canonical base.')]
heads = [{'language': lang, 'head': word, 'sense': sense, 'dictionary_identity_status': 'supported_research_only',
          'sources': [url], 'finding': finding, 'exact_source_record': exact(lang, word),
          'finite_binding_authorized': False, 'general_national_realization_authorized': False}
         for lang, word, sense, url, finding in facts]
controls = [
 ('en', 'tor', 'Modern rocky-hill noun has dictionary history to Old English torr, but the consulted tor entry does not settle its deeper continuity with Latin turris. Retain uncertainty; do not declare unrelated by intuition.'),
 ('en', 'torres', 'Possible personal/place name; source declaration alone does not establish each aggregate token or a plural tower head.'),
 ('fr', 'tours', 'Plural tower, plural masculine turn/lathe and proper place-name readings require context.'),
 ('fr', 'demi-tour', 'A turn-around lexical candidate cannot be admitted by tower substring overlap.'),
 ('en', 'acceptor', 'Shared terminal letters are retrieval evidence only; no reviewed tower head or edge.'),
 ('en', 'agricultor', 'Shared terminal letters do not prove a tower component.'),
 ('ru', 'аббревиатура', 'The final тура substring is not proof of the chess lexeme or tower continuity.'),
 ('ru', 'адвокатура', 'The final тура substring is not proof of the chess lexeme or tower continuity.'),
 ('it', 'torremolinos', 'Geographic-name route needs independent lexical and token evidence.'),
 ('de', 'bismarckturm', 'A possible finite tower component must be explicitly segmented and reviewed before any binding; no whole-container admission.')]
negative = [{'language': lang, 'word': word, 'source_record': exact(lang, word), 'finding': finding,
             'decision': 'no_membership_authorization_from_packet', 'linguistic_exclusion_asserted': False}
            for lang, word, finding in controls]
frame_name = 'tower-promotion-source-frame-20261003.json.gz'
frame_raw = gzip.compress((json.dumps(frames, ensure_ascii=False, sort_keys=True, indent=2)+'\n').encode(), compresslevel=9, mtime=0)
(OUT / frame_name).write_bytes(frame_raw)
document = {'schema_version': 6, 'stage': 'tower-promotion-research-20261003',
 'source_head': 'b93a919750d1d8be7967255dde87c7a212e26e02', 'production_enabled': False,
 'candidate_packet_id': packet['candidate_cluster_id'], 'promotion_status': 'deferred_boundary_and_corpus_sense_adjudication',
 'binding_authorized': False, 'accepted_membership_authorized': False,
 'canonical_decision': {'canonical': None, 'status': 'deferred_explicit_linguistic_boundary_decision',
  'finding': 'Latin turris and its mediated national tower rows are supported. Source canonical torres is an automatic alias choice and is rejected as authority. The competing tor/torr/tur/turr boundaries need an explicit canonical decision; shortest alias, translation and removal of arbitrary final letters cannot choose it.'},
 'source_clusters': routes, 'route_record_incidences': 2166, 'unique_source_identities': 1083,
 'duplicate_identity_sets': True, 'independent_national_heads': heads,
 'negative_and_withheld_controls': negative, 'unadjudicated_unique_pool_records': 1076,
 'source_frame': 'audit/associative-family-v6/'+frame_name, 'source_frame_sha256': hashlib.sha256(frame_raw).hexdigest(),
 'input_sha256': hashes, 'additional_boundary_sources': [
  'https://www.dictionnaire-academie.fr/article/A9T1597', 'https://www.dictionnaire-academie.fr/article/A9T1598',
  'https://www.dictionnaire-academie.fr/article/A9T1645', 'https://www.merriam-webster.com/dictionary/tor'],
 'scope_limits': ['No shared modern noun/verb POS is invented for aggregate corpus rows.',
  'French tour and Russian тура sense alternatives remain separate; dictionary identity does not settle token senses.',
  'No whole pool import, unlisted inflection, cross-language substring rule or new family is authorized.',
  'Russian башня is a semantic translation, not evidence of formal continuity; no invented corpus ID.',
  'Deeper pre-Latin tower history and Russian тюрьма are outside the proved frame; neither is asserted.'],
 'next_steps': ['Decide the international canonical boundary independently of source aliases.',
  'Freeze exact context or prove a shared lexical-base reading before binding aggregate core rows.',
  'Review finite German tower compounds and the separate turret branch; leave other 1076 source identities unadjudicated.']}
path = OUT / 'tower-promotion-research-20261003.json'
path.write_text(json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2)+'\n')
print(json.dumps({'routes': len(routes), 'incidences': 2166, 'unique_ids': 1083, 'heads': len(heads),
                  'controls': len(negative), 'promotions': 0, 'memberships': 0}))

"""Finite documentary correspondences; fail-closed preflight, never a membership judge."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import hashlib
import json
from pathlib import Path

SCHEMA = 'interal-national-correspondences/1'
STATUSES = {'SOURCE_DOCUMENTED', 'DIFFERENT_ETYMON', 'UNRESOLVED', 'CONFLICT'}
LANGUAGES = {'en', 'de', 'fr', 'es', 'it', 'ru'}
OPERATIONS = {'delete', 'remove_membership', 'REJECT_ENTIRE_FAMILY', 'REMOVE_EXACT_MEMBERSHIPS', 'merge', 'change_membership'}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def filehash(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate JSON key')
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('nonfinite JSON')))


def validate(registry, receipts):
    if registry['schema'] != SCHEMA or registry['version'] != '1.0.0':
        raise ValueError('unknown registry version')
    if registry['authority'] != 'DOCUMENTARY_RESEARCH_NOT_LINGUISTIC_GOLD':
        raise ValueError('unsupported authority escalation')
    if registry['production_enabled'] is not False or registry['global_rules'] != []:
        raise ValueError('global propagation or production promotion forbidden')
    roots = {r['canonical_root_id']: r for r in registry['roots']}
    sources = {s['id']: s for s in receipts['sources']}
    if len(roots) != len(registry['roots']) or len(sources) != len(receipts['sources']):
        raise ValueError('duplicate root/source')
    mappings = {}
    for root in roots.values():
        if root['element_kind'] not in ('root', 'preposition', 'suffix'):
            raise ValueError('element kind')
        for fid in set(root['legacy_family_ids']):
            if fid in mappings and mappings[fid] != root['canonical_root_id']:
                raise ValueError('ambiguous family mapping')
            mappings[fid] = root['canonical_root_id']
    for source in sources.values():
        if hashlib.sha256(source['excerpt'].encode()).hexdigest() != source['excerpt_sha256']:
            raise ValueError('source capture checksum')
        if not source['url'].startswith('https://') or not source['publisher'] or not source['retrieved_at']:
            raise ValueError('missing bibliographic provenance')
    seen = set()
    for entry in registry['entries']:
        if entry['id'] in seen:
            raise ValueError('duplicate correspondence ID')
        seen.add(entry['id'])
        root = roots[entry['canonical_root_id']]
        if entry['normative_form'] != root['normative_form']:
            raise ValueError('national form cannot rename normative root')
        if entry['language'] not in LANGUAGES or entry['evidence_status'] not in STATUSES:
            raise ValueError('language/evidence status')
        if entry['scope'] != dict(kind='EXACT_LEXEME_SENSE_CONTEXT', propagation='FORBIDDEN', regular_language_rule=False):
            raise ValueError('nonfinite permission')
        lexeme = entry['lexeme']
        if any(not isinstance(lexeme.get(k), str) or not lexeme[k] for k in ('lemma', 'pos', 'sense_id', 'sense_gloss')):
            raise ValueError('missing lexical sense')
        if any(ch in lexeme['lemma'] for ch in '*[]?\\'):
            raise ValueError('pattern lexical scope forbidden')
        if not entry['national_form'] or entry['national_form'] not in lexeme['lemma']:
            raise ValueError('national form is not in the exact carrier')
        if lexeme['corpus_lemma_id'] is not None or entry['membership_status'] != 'UNRESOLVED':
            raise ValueError('unreviewed corpus binding/promotion forbidden in version 1')
        if entry['relation_kind'] in {'COMPOUND_COMPONENT', 'INDIRECT_COMPOUND_COMPONENT', 'PREFIX_COMPONENT'}:
            component = entry.get('component', {})
            if not all(component.get(k) for k in ('role', 'meaning', 'segmentation_status', 'evidence_refs')):
                raise ValueError('component role, meaning and documented segmentation required')
        if entry['association_status'] != 'NOT_ASSESSED' or not entry['context']:
            raise ValueError('association and membership are independent')
        if not entry['evidence_refs'] or not set(entry['evidence_refs']) <= sources.keys():
            raise ValueError('unknown source reference')
        previous = None
        for step in entry['path']:
            if previous is not None and previous != step['from_form']:
                raise ValueError('discontinuous historical path')
            if not step['relation'] or not step['evidence_refs'] or not set(step['evidence_refs']) <= set(entry['evidence_refs']):
                raise ValueError('undocumented historical step')
            previous = step['to_form']
        if previous != entry['language'] + ':' + lexeme['lemma']:
            raise ValueError('path does not end at exact lexical carrier')
    for binding in registry.get('legacy_carriers', []):
        entry = next(e for e in registry['entries'] if e['id'] == binding['entry_id'])
        if (mappings.get(binding['family_id']) != entry['canonical_root_id']
                or binding['language'] != entry['language']
                or binding['source_version'] != registry['production_source_commit']
                or binding['lexical_identity_status'] != 'UNRESOLVED'
                or binding['scope'] != 'EXACT_LEGACY_RECORD_ONLY'
                or not binding['lemma_id'] or not binding['word'] or len(binding['record_sha256']) != 64):
            raise ValueError('invalid finite legacy carrier hold')
    return roots, mappings


class Registry:
    def __init__(self, folder, expected_sha256=None):
        folder = Path(folder)
        lock = read(folder / 'CURRENT.json')
        # The selector is operator-configured, never taken from a proposed operation.
        for key in ('registry', 'sources'):
            if Path(lock[key]).name != lock[key]:
                raise ValueError('selector path escape')
            if filehash(folder / lock[key]) != lock[key + '_sha256']:
                raise ValueError('registry/source checksum')
        if expected_sha256 is not None and lock['registry_sha256'] != expected_sha256:
            raise ValueError('unexpected registry version')
        self.registry = read(folder / lock['registry'])
        self.receipts = read(folder / lock['sources'])
        if self.registry['sources_sha256'] != lock['sources_sha256']:
            raise ValueError('source lock mismatch')
        self.roots, self.mappings = validate(self.registry, self.receipts)
        self.sha256 = lock['registry_sha256']

    def check(self, proposal, history_checker=None, verify_release=None):
        """No listed match is NOT proof of no correspondence.

        A CLEAR preflight requires an external authority's exact content-hash receipt
        covering alternative paths, compound/sense identity and source versions.
        Even CLEAR is not authorization to apply a data patch.
        """
        from associativvordes.normative.resolver import observe
        result = dict(allowed=False, status='CORRESPONDENCE_REVIEW_REQUIRED', matches=[], membership_operation='NONE',normative_evaluation=observe('national_correspondence_guard'),establishes_membership=False)
        try:
            if proposal.get('operation') in {'REJECT_ENTIRE_FAMILY', 'REMOVE_EXACT_MEMBERSHIPS', 'merge'}:
                raise ValueError('full finite scope must be checked separately; a single row cannot authorize a family operation')
            if proposal.get('operation') not in OPERATIONS:
                raise ValueError('unsupported or underspecified operation')
            if any(not isinstance(proposal.get(k), str) or not proposal[k] for k in ('family_id', 'language', 'lemma_id', 'word', 'source_version')):
                raise ValueError('exact corpus scope/version missing')
            if proposal.get('family_namespace', 'v5') != 'v5' or proposal['source_version'] != self.registry['production_source_commit']:
                result['status'] = 'SOURCE_NAMESPACE_OR_VERSION_UNRESOLVED'
                return result
            root = self.mappings.get(proposal['family_id'])
            if root is None:
                result['status'] = 'ROOT_MAPPING_UNRESOLVED'
                return result
            candidates = [e for e in self.registry['entries'] if e['canonical_root_id'] == root and e['language'] == proposal['language'] and e['lexeme']['lemma'] == proposal['word']]
            # A different POS/sense is never certified by a matching spelling. Unknown
            # identity, scope, target or alternatives require review rather than deletion.
            for entry in candidates:
                if entry['evidence_status'] == 'DIFFERENT_ETYMON':
                    continue  # Refuting one path never grants permission to remove a member.
                known_other_pos = proposal.get('pos') and proposal['pos'] != entry['lexeme']['pos']
                known_other_sense = proposal.get('dictionary_sense_id') and proposal['dictionary_sense_id'] != entry['lexeme']['sense_id']
                if not known_other_pos and not known_other_sense:
                    result['matches'].append(entry['id'])
            for binding in self.registry.get('legacy_carriers', []):
                if all(proposal.get(k) == binding[k] for k in ('family_id', 'language', 'lemma_id', 'word', 'source_version')):
                    result['matches'].append(binding['entry_id'] + ':EXACT_LEGACY_IDENTITY_HOLD')
            if result['matches']:
                result['status'] = 'BLOCKED_DOCUMENTED_OR_UNRESOLVED_CORRESPONDENCE'
                return result
            if self.roots[root]['target_binding'] == 'UNRESOLVED':
                result['status'] = 'TARGET_SENSE_UNRESOLVED'
                return result
            if history_checker is None:
                result['status'] = 'HISTORY_UNAVAILABLE'
                return result
            history = history_checker(proposal)
            if not (history.get('allowed') and history.get('status') == 'CLEAR'):
                result['status'] = history.get('status', 'HISTORY_UNAVAILABLE')
                return result
            if not proposal.get('pos') or not proposal.get('sense_id'):
                result['status'] = 'SENSE_IDENTITY_UNRESOLVED'
                return result
            payload = dict(proposal=proposal, registry_sha256=self.sha256)
            receipt = verify_release(digest(payload)) if verify_release else None
            if not isinstance(receipt, dict) or receipt.get('payload_sha256') != digest(payload) or receipt.get('authority') not in {'CONFIRMED_MANUAL', 'INDEPENDENT_GOLD'} or receipt.get('status') != 'APPROVED':
                return result
            return dict(result, allowed=True, status='CLEAR')
        except (KeyError, ValueError, TypeError, AttributeError, OSError) as exc:
            return dict(result, status='PREFLIGHT_UNAVAILABLE', reason=str(exc))


def preflight(folder, proposal, history_checker=None, verify_release=None, expected_sha256=None):
    try:
        return Registry(folder, expected_sha256).check(proposal, history_checker, verify_release)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return dict(allowed=False, status='CORRESPONDENCE_REGISTRY_UNAVAILABLE', reason=str(exc), membership_operation='NONE')

def finite_scope_guard(registry, members, expected_count, expected_sha256,
                       history_checker=None, verify_release=None):
    """Stream every exact row of a locked, ordered finite membership manifest.

    A sample, early exhaustion, altered order or duplicate physical row cannot
    replace the complete scope. Expected digest is SHA-256 of canonical NDJSON.
    Returns a proposal preflight receipt, not a linguistic decision.
    """
    h = hashlib.sha256()
    checked = 0
    blocked = 0
    import sqlite3
    import tempfile
    with tempfile.TemporaryDirectory(prefix='interal-correspondence-scope-') as scratch:
        db = sqlite3.connect(Path(scratch) / 'seen.sqlite')
        db.execute('CREATE TABLE scopes (identity BLOB PRIMARY KEY)')
        for member in members:
            h.update(canonical(member) + b'\n')
            checked += 1
            identity = canonical({k: member.get(k) for k in ('family_id', 'language', 'lemma_id', 'source_version', 'pos', 'sense_id')})
            unique = db.execute('INSERT OR IGNORE INTO scopes VALUES (?)', (identity,)).rowcount == 1
            row = dict(member, operation='remove_membership')
            result = registry.check(row, history_checker, verify_release)
            blocked += int(not unique or not result['allowed'])
        db.close()
    complete = checked == expected_count and checked > 0 and h.hexdigest() == expected_sha256
    return dict(allowed=complete and blocked == 0, status='CLEAR' if complete and blocked == 0 else 'FINITE_SCOPE_HELD',
                memberships_checked=checked, blocked_memberships=blocked,
                full_scope_verified=complete, ordered_rows_sha256=h.hexdigest(),
                registry_sha256=registry.sha256, membership_operation='NONE')

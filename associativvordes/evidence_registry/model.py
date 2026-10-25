"""Content-bound research graph validation. Trust is supplied by the caller.

A receipt is an independent review of the exact claim, not a boolean copied
from a proposed case. Installed normative/history/identity gates still apply
when any research result is proposed as an operation.
"""
from ..identity_mapping.model import digest, entity
STATUSES = {'SUPPORTED_MEMBER', 'SUPPORTED_NONMEMBER', 'CONFLICTING_EVIDENCE', 'UNRESOLVED_EVIDENCE'}
SCOPE = {'family_id', 'normative_element', 'target', 'origin', 'input_version'}
REFUTATIONS = {'INCOMPATIBLE_IDENTITY', 'REFUTED_SEGMENTATION', 'DIFFERENT_COMPONENT_ORIGIN'}

def receipt(payload, trust, purpose):
    value = trust.get(purpose, {}).get(digest(payload))
    return isinstance(value, dict) and value.get('payload_sha256') == digest(payload) and value.get('status') == 'APPROVED' and value.get('authority') in {'CONFIRMED_MANUAL', 'INDEPENDENT_GOLD'}

def scope(value):
    if not isinstance(value, dict) or set(value) != SCOPE:
        raise ValueError('closed exact scope required')
    entity(value['target'], complete=True)
    if any(not value[k] for k in ('family_id', 'normative_element', 'input_version')):
        raise ValueError('canonical family/normative element/version missing')
    o = value['origin']
    if not isinstance(o, dict) or not all(o.get(k) for k in ('path', 'record_sha256', 'source_commit', 'lemma_id')) or o.get('family_id') != value['family_id'] or o.get('language') != value['target']['language'] or type(o.get('ordinal')) is not int or o['ordinal'] < 0:
        raise ValueError('exact original membership locator required')
    h = o['record_sha256']
    if len(h) != 64 or set(h) - set('0123456789abcdef'):
        raise ValueError('invalid original record hash')

def documentary(claim, trust):
    refs = claim.get('source_refs')
    if not isinstance(refs, list) or not refs:
        raise ValueError('documentary references missing')
    groups = set()
    for ref in refs:
        if not isinstance(ref, dict):
            raise ValueError('documentary reference object required')
        doc = trust.get('sources', {}).get(ref.get('source_id'))
        if not doc or ref.get('source_sha256') != doc.get('sha256') or not ref.get('locator') or not doc.get('version') or not doc.get('license') or not doc.get('url'):
            raise ValueError('unavailable/unpinned/unlicensed documentary reference')
        if not receipt(ref, trust, 'documentary_reviews'):
            raise ValueError('source must document this exact scoped assertion')
        # Unknown provenance shares one conservative group; never a new vote.
        groups.add(doc.get('dependency_group') or 'UNKNOWN_DEPENDENCE')
    return groups

def validate_analysis(analysis, case_scope, trust):
    if not isinstance(analysis, dict):
        raise ValueError('analysis object required')
    if analysis.get('scope') != case_scope:
        raise ValueError('analysis scope mismatch')
    polarity = analysis.get('polarity')
    if polarity not in {'SUPPORT', 'REFUTE'}:
        raise ValueError('explicit evidence polarity required')
    documentary(analysis, trust)
    if not receipt(analysis, trust, 'analysis_reviews'):
        raise ValueError('independent exact analysis review missing')
    if polarity == 'REFUTE':
        if analysis.get('basis') not in REFUTATIONS or analysis.get('extent') != 'ENTIRE_SCOPED_MEMBERSHIP' or not receipt(analysis, trust, 'exhaustiveness_reviews'):
            raise ValueError('refuted path/absence/another family is not sufficient nonmembership evidence')
        return polarity
    path = analysis.get('path')
    if not isinstance(path, list) or not path:
        raise ValueError('complete morphosemantic path missing')
    previous = case_scope['target']
    for step in path:
        entity(step['from'], complete=True); entity(step['to'], complete=True)
        if step['from'] != previous:
            raise ValueError('discontinuous lexical/sense/context path')
        if step.get('relation') not in {'DERIVATION', 'COMPOUND', 'HISTORICAL_CORRESPONDENCE'} or step.get('direction') != 'FROM_TO':
            raise ValueError('inflection or unproven direction is not derivation')
        if not step.get('segmentation') or not step.get('component_role') or not step.get('meaning_bridge'):
            raise ValueError('segmentation, role and meaning bridge required')
        if step['relation'] == 'COMPOUND' and (not step.get('components') or not receipt(step['components'], trust, 'component_reviews')):
            raise ValueError('all compound components/meaning must be verified')
        if step['relation'] == 'HISTORICAL_CORRESPONDENCE' and (not step.get('correspondence') or not receipt(step['correspondence'], trust, 'correspondence_reviews')):
            raise ValueError('context-limited national correspondence missing')
        if step.get('scope') != case_scope:
            raise ValueError('every step must bind the full application scope')
        documentary(step, trust)
        if not receipt(step, trust, 'step_reviews'):
            raise ValueError('intermediate step proof missing')
        previous = step['to']
    endpoint = analysis.get('normative_endpoint')
    if not isinstance(endpoint, dict) or endpoint.get('element') != case_scope['normative_element'] or endpoint.get('lexical_identity') != previous or not receipt(endpoint, trust, 'endpoint_reviews'):
        raise ValueError('path does not prove relation to the scoped normative element')
    return polarity

def evaluate(case, trust=None):
    trust = trust or {}
    result = dict(schema='interal-research-evidence-result/1', status='UNRESOLVED_EVIDENCE', production_application_authorized=False, reasons=[], accepted_analyses=[], rejected_analyses=[])
    try:
        if not isinstance(case, dict):
            raise ValueError('case object required')
        if case.get('schema') != 'interal-research-evidence-case/1':
            raise ValueError('incompatible evidence schema')
        s = case['scope']; scope(s)
        if case.get('namespace') != 'research' or s['input_version'] != trust.get('input_version'):
            raise ValueError('research namespace and exact compatible input version required')
        if not receipt(s, trust, 'identity_reviews') or not receipt(s, trust, 'normative_reviews') or not receipt(s, trust, 'history_reviews'):
            raise ValueError('verified scoped identity, installed normative and historical review required')
        polarities = set()
        for analysis in case.get('analyses', []):
            try:
                polarities.add(validate_analysis(analysis, s, trust)); result['accepted_analyses'].append(digest(analysis))
            except (ValueError, KeyError, TypeError) as e:
                result['rejected_analyses'].append(dict(sha256=digest(analysis), reason=str(e)))
        if polarities == {'SUPPORT', 'REFUTE'}:
            result['status'] = 'CONFLICTING_EVIDENCE'
        elif result['rejected_analyses'] or not receipt(case, trust, 'case_completeness_reviews'):
            result['reasons'].append('Incomplete chain or unreviewed alternatives; no final inference')
        elif polarities == {'SUPPORT'}:
            result['status'] = 'SUPPORTED_MEMBER'
        elif polarities == {'REFUTE'}:
            result['status'] = 'SUPPORTED_NONMEMBER'
        else:
            result['reasons'].append('Absence of positive evidence is not negative evidence')
    except (ValueError, KeyError, TypeError) as e:
        result['reasons'].append(str(e))
    return result

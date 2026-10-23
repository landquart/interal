"""Morphology review policy v1. Source claims are not corpus identity bindings."""
TYPES=('direct_derivation','indirect_derivation','inflection','compounding','allomorphy','borrowing','historical_inheritance','prefixation','suffixation','unconfirmed')
BITS={x:1<<i for i,x in enumerate(TYPES)}
STATUSES=('CONFIRMED_RELATION','CONFIRMED_WRONG_RELATION','WRONG_RELATION_TYPE','COMPETING_ANALYSES','INSUFFICIENT_EVIDENCE')
def classify(mask):
    # Competing *candidate relation types*, not established contradictory analyses.
    return 'COMPETING_ANALYSES' if mask.bit_count()>1 else 'INSUFFICIENT_EVIDENCE'
def chain_valid(steps):
    if not steps:return False
    for i,s in enumerate(steps):
        if not all(s.get(k) for k in ('evidence_id','source_native','target_native','language','identity_verified','sense_verified')):return False
        if s.get('kind') in ('common_ancestor','unconfirmed'):return False
        if i and (steps[i-1]['target_native']!=s['source_native'] or steps[i-1]['language']!=s['language']):return False
    return True

def disposition(wrong_relation,alternative_verified=False):
    return dict(relation_review=bool(wrong_relation),membership_operation='NONE',alternative_support_preserved=bool(alternative_verified))

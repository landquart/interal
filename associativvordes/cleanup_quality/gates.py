"""Exact engineering qualification, not a semantic or production capability."""
from associativvordes.family_boundary.core import digest
STATUSES={'QUALIFIED_FOR_EXACT_SCOPE','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE','REJECTED_POLICY'}

def qualify(operation, independent_receipt=None):
    out=dict(status='INSUFFICIENT_EVIDENCE',production_operation='NONE',scope_sha256=None)
    if operation.get('basis') in ('MODEL_CONFIDENCE_ONLY','SUBSTRING_ONLY','MISSING_EVIDENCE_ONLY'):return dict(out,status='REJECTED_POLICY')
    if operation.get('operation_class')!='SAFE_STRUCTURAL_FIX':return dict(out,status='HUMAN_REVIEW_REQUIRED')
    if operation.get('rule') not in ('CORRECT_PROVEN_COUNTER','REPAIR_PROVEN_SERIALIZATION_WITH_IDENTICAL_OBJECTS'):return out
    required=['exact_scope','source_version','before_sha256','after_sha256','evidence_refs','inverse_operation']
    if any(not operation.get(k) for k in required):return out
    try:r=independent_receipt(digest(operation)) if independent_receipt else None
    except (OSError,ValueError):return out
    if not isinstance(r,dict) or r.get('operation_sha256')!=digest(operation) or r.get('authority')!='INDEPENDENT_ENGINEERING_VERIFIER':return out
    if not all(r.get(k) is True for k in ['full_scope_checked','semantic_relation_set_identical','provenance_preserved','untouched_records_identical','rollback_verified','source_hashes_verified','history_clear','correspondences_clear']):return out
    return dict(out,status='QUALIFIED_FOR_EXACT_SCOPE',scope_sha256=digest(operation['exact_scope']),operation_sha256=digest(operation))

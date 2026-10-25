"""Blind reviewers receive observed forms/locators, never inferred component paths."""
def blind_record(record):
    out={k:record[k] for k in ('word','normalized','search_form','context','source_refs') if k in record}
    if 'sources' in record:
        out['sources']=[{k:s[k] for k in ('id','file','category') if k in s} for s in record['sources']]
    return out

def assert_blind_record(record):
    if record!=blind_record(record):raise ValueError('blind source record contains inferred analysis or unapproved fields')

def require_final_blinding(folder):
    from pathlib import Path
    from associativvordes.family_boundary.core import read,sha
    path=Path(folder)/'BLINDING-POLICY.json'
    if not path.exists():raise ValueError('intermediate prepare packets are not eligible for human evaluation')
    policy=read(path)
    if policy.get('version')!=2 or policy.get('privacy_code_sha256')!=sha(__file__):raise ValueError('stale blinding policy/code')

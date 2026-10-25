"""Independent decoder, byte-level preservation and finite record-delta validation."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse, collections, hashlib, pathlib, resource, time
from associativvordes.structural_cleanup.common import *
from associativvordes.structural_cleanup.shadow import decode, tokens, at, set_at, RULES

def validate(before, after, plan, output):
    start = time.monotonic(); before = pathlib.Path(before); after = pathlib.Path(after)
    a = load(before / 'SNAPSHOT.json'); b = load(after / 'SNAPSHOT.json')
    verify(before, a); verify(after, b)
    if b['before_inventory_sha256'] != a['inventory_sha256'] or b['plan_sha256'] != sha_file(plan):
        raise ValueError('after snapshot dependencies differ')
    old = {x['path']: x for x in a['files']}; new = {x['path']: x for x in b['files']}
    if set(old) != set(new): raise ValueError('objects added or lost')
    fixes = [json.loads(line) for line in pathlib.Path(plan).read_bytes().splitlines() if line.strip()]
    planned = collections.defaultdict(list)
    for fix in fixes:
        if fix['rule'] not in RULES: raise ValueError('non-metadata operation')
        planned['current/' + PREFIX + '/' + fix['object']['path']].append(fix)
    changed = {name for name in old if old[name] != new[name]}
    if changed != set(planned): raise ValueError('unplanned or missing file changes')
    for name, items in planned.items():
        original = decode(before / name); actual = decode(after / name)
        for fix in items:
            pieces = tokens(fix['object']['pointer'])
            if canonical(at(original, pieces)) != canonical(fix['before']): raise ValueError('wrong before')
            if canonical(at(actual, pieces)) != canonical(fix['after']): raise ValueError('wrong after')
            set_at(actual, pieces, fix['before'])
        if canonical(original) != canonical(actual): raise ValueError('untouched record/field lost')
    # Whole-bucket JSON decoder differs from scanner's incremental decoder.
    # Every nested key, gzip trailer and numeric constant is checked independently.
    root = after / 'current' / PREFIX; counts = collections.Counter(); stream = hashlib.sha256()
    for name in ('manifest.json', 'report.json', 'repository-provenance.json'): decode(root / name)
    for bi in range(256):
        buck = f'{bi:02x}'; families = decode(root / 'families' / (buck + '.json.gz'))
        counts['families'] += len(families); observed = collections.defaultdict(collections.Counter)
        for lang in LANGS:
            groups = decode(root / 'members' / lang / (buck + '.json.gz'))
            for fid, rows in groups.items():
                if fid not in families or not rows: raise ValueError('orphan/empty group')
                seen = set()
                for ordinal, row in enumerate(rows):
                    lid = row['lemma_id']
                    if lid in seen: raise ValueError('physical duplicate requires review')
                    seen.add(lid)
                    if row.get('family_id', fid) != fid: raise ValueError('incompatible family reference')
                    stream.update(canonical([fid, lang, ordinal, hashlib.sha256(canonical(row)).hexdigest()]) + b'\n')
                observed[fid][lang] += len(rows); counts['memberships'] += len(rows)
        for fid, family in families.items():
            if family['support'] != sum(observed[fid].values()): raise ValueError('family counter mismatch')
            if {k:v for k,v in family['language_support'].items() if v} != dict(observed[fid]):
                raise ValueError('family language counter mismatch')
        counts['aliases'] += len(decode(root / 'aliases' / (buck + '.json.gz')))
        if bi % 32 == 31: print(canonical(dict(validation_bucket=buck, counts=dict(counts))).decode(), flush=True)
    member_paths = [p for p in old if p.startswith('current/' + PREFIX + '/members/')]
    carriers = [p for p in old if p.startswith('original/')]
    if any(old[p] != new[p] for p in member_paths + carriers): raise ValueError('membership/source byte loss')
    result = dict(schema='v5-structural-independent-validation/1', status='PASS', counts=dict(counts),
        strict_serialization_files=2048, unchanged_membership_files=len(member_paths),
        unchanged_source_carrier_files=len(carriers), unchanged_files=len(old) - len(changed),
        changed_files=sorted(changed), all_untouched_record_fields_preserved=True,
        membership_stream_sha256=stream.hexdigest(), semantic_membership_delta=0,
        independent_linguistic_confirmation=False, production_writes=0,
        seconds=time.monotonic() - start, max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    save(output, result); return result

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--before', required=True); p.add_argument('--after', required=True)
    p.add_argument('--plan', required=True); p.add_argument('--output', required=True)
    a = p.parse_args(); print(canonical(validate(a.before, a.after, a.plan, a.output)).decode())

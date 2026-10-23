"""Reversible metadata-only trial. There is deliberately no production/apply mode."""
import argparse, gzip, hashlib, io, pathlib, re, shutil, sys
from common import *

RULES = {'FAMILY_SUPPORT', 'FAMILY_LANGUAGE_SUPPORT', 'REPORT_CACHED_SUPPORT', 'REPORT_CACHED_LANGUAGES'}

def strict_object(items):
    result = {}
    for key, value in items:
        if key in result: raise ValueError('duplicate JSON key: ' + key)
        result[key] = value
    return result

def decode(path):
    with (gzip.open(path, 'rt', encoding='utf-8') if str(path).endswith('.gz') else open(path, encoding='utf-8')) as f:
        return json.load(f, object_pairs_hook=strict_object,
                         parse_constant=lambda x: (_ for _ in ()).throw(ValueError('non-finite JSON ' + x)))

def tokens(pointer):
    if not isinstance(pointer, str) or not pointer.startswith('/'): raise ValueError('JSON pointer required')
    return [x.replace('~1', '/').replace('~0', '~') for x in pointer[1:].split('/')]

def at(obj, pieces):
    for p in pieces: obj = obj[int(p)] if isinstance(obj, list) else obj[p]
    return obj

def set_at(obj, pieces, value):
    parent = at(obj, pieces[:-1]); key = int(pieces[-1]) if isinstance(parent, list) else pieces[-1]
    parent[key] = value

def observed(root, fid, b):
    result = {}
    for lang in LANGS:
        rows = decode(root / 'members' / lang / (b + '.json.gz')).get(fid, [])
        ids = [r['lemma_id'] for r in rows]
        if len(ids) != len(set(ids)): raise ValueError('duplicate IDs require history and provenance review')
        if rows: result[lang] = len(rows)
    return result

def prove(root, fix):
    """Recompute every allowed after-value; supplied evidence never grants authority."""
    if fix.get('classification') != 'SAFE_STRUCTURAL_FIX' or fix.get('rule') not in RULES:
        raise ValueError('unsupported or semantic operation')
    rel = fix['object']['path']; pieces = tokens(fix['object']['pointer']); rule = fix['rule']
    if rule.startswith('FAMILY_'):
        match = re.fullmatch(r'families/([0-9a-f]{2})\.json\.gz', rel)
        field = 'support' if rule == 'FAMILY_SUPPORT' else 'language_support'
        if not match or len(pieces) != 2 or pieces[1] != field: raise ValueError('family metadata scope')
        fid = pieces[0]; b = match[1]
        if bucket(fid) != b: raise ValueError('wrong family bucket')
    else:
        field = 'support' if rule == 'REPORT_CACHED_SUPPORT' else 'language_support'
        if rel != 'report.json' or len(pieces) != 3 or pieces[0] not in ('largest_families', 'highest_suspicion_families') or pieces[2] != field:
            raise ValueError('cached report metadata scope')
        cached = at(decode(root / rel), pieces[:-1]); fid = cached['id']
        b = bucket(fid)
    languages = observed(root, fid, b)
    family = decode(root / 'families' / (b + '.json.gz')).get(fid)
    if not family or family.get('id') != fid or not languages: raise ValueError('unresolved family identity')
    expected = sum(languages.values()) if field == 'support' else languages
    if canonical(expected) != canonical(fix['after']): raise ValueError('forged derived value')
    if fix['impact'] != dict(semantic_memberships=0, source_evidence_records=0, source_lemmas=0):
        raise ValueError('semantic/provenance change is not permitted')
    return rel, pieces

def bucket(s):
    h = 2166136261
    for c in s: h = ((h ^ ord(c)) * 16777619) & 0xffffffff
    return f'{h % 256:02x}'

def encode(path, obj):
    raw = json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False).encode() + b'\n'
    if str(path).endswith('.gz'):
        out = io.BytesIO()
        with gzip.GzipFile(filename='', mode='wb', fileobj=out, mtime=0) as f: f.write(raw)
        raw = out.getvalue()
    atomic(path, raw)

def apply(before, plan, destination, repo=ROOT):
    before = pathlib.Path(before); plan = pathlib.Path(plan); destination = outside_repo(repo, destination)
    lock = load(before / 'SNAPSHOT.json'); verify(before, lock)
    fixes = [json.loads(x) for x in plan.read_bytes().splitlines() if x.strip()]
    digest = sha_file(plan)
    if len({x['id'] for x in fixes}) != len(fixes): raise ValueError('duplicate fix IDs')
    # Even empty runs lock the available history; missing/corrupt history cannot grant a write.
    sys.path.insert(0, str(ROOT / 'associativvordes/history_registry'))
    from registry import History
    current = load(pathlib.Path(repo) / 'audit/associative-history-registry/CURRENT.json')
    history_path = pathlib.Path(repo) / 'audit/associative-history-registry' / current['snapshot']
    h = History(repo, history_path, current['sha256'])
    if destination.exists():
        manifest = load(destination / 'SNAPSHOT.json'); verify(destination, manifest)
        if (manifest.get('plan_sha256') != digest or manifest.get('before_inventory_sha256') != lock['inventory_sha256']
                or manifest.get('history_snapshot_sha256') != current['sha256']):
            raise ValueError('existing shadow belongs to different plan/input/history')
        return dict(status='ALREADY_APPLIED', changed_files=manifest['changed_files'])
    # Unresolved history blocks nonempty applications. No inferred exception bypasses the registry.
    if fixes and not h.snapshot.get('coverage_complete'): raise ValueError('HISTORY_UNAVAILABLE: nonempty shadow plan held')
    if fixes: h.verify()
    root = before / 'current' / PREFIX; grouped = {}
    for fix in fixes:
        if fix['source_inventory_sha256'] != lock['inventory_sha256'] or fix['source_version'] != lock['production_commit']:
            raise ValueError('source version differs')
        rel, pieces = prove(root, fix)
        if sha_file(root / rel) != fix['source_file_sha256']: raise ValueError('before file differs')
        if canonical(at(decode(root / rel), pieces)) != canonical(fix['before']): raise ValueError('before value differs')
        grouped.setdefault(rel, []).append((fix, pieces))
    stage = destination.with_name(destination.name + '.partial')
    if stage.exists(): raise ValueError('partial shadow is unpublished; preserve it and choose fresh destination')
    shutil.copytree(before, stage)
    for rel, items in grouped.items():
        path = stage / 'current' / PREFIX / rel; obj = decode(path)
        for fix, pieces in items: set_at(obj, pieces, fix['after'])
        path.chmod(0o644); encode(path, obj)
    files = inventory(stage)
    manifest = dict(lock, schema='v5-structural-shadow/1', files=files,
                    inventory_sha256=hashlib.sha256(canonical(files)).hexdigest(),
                    before_inventory_sha256=lock['inventory_sha256'], plan_sha256=digest,
                    history_snapshot_sha256=current['sha256'], changed_files=sorted(grouped),
                    semantic_membership_delta=0, source_lemma_delta=0)
    save(stage / 'SNAPSHOT.json', manifest)
    for p in stage.rglob('*'):
        if p.is_file(): p.chmod(0o444)
    os.replace(stage, destination)
    return dict(status='SHADOW_ONLY', changed_files=sorted(grouped), inventory_sha256=manifest['inventory_sha256'])

def rollback(before, shadow, destination, repo=ROOT):
    before = pathlib.Path(before); shadow = pathlib.Path(shadow); destination = outside_repo(repo, destination)
    a = load(before / 'SNAPSHOT.json'); b = load(shadow / 'SNAPSHOT.json'); verify(before, a); verify(shadow, b)
    if b['before_inventory_sha256'] != a['inventory_sha256']: raise ValueError('inverse source mismatch')
    if destination.exists(): raise ValueError('fresh rollback destination required')
    stage = destination.with_name(destination.name + '.partial')
    shutil.copytree(shadow, stage)
    for rel in b['changed_files']:
        target = stage / 'current' / PREFIX / rel; target.chmod(0o644)
        shutil.copyfile(before / 'current' / PREFIX / rel, target)
    save(stage / 'SNAPSHOT.json', a); verify(stage, a); os.replace(stage, destination)
    return dict(status='ROLLBACK_VERIFIED', exact_original_inventory_sha256=a['inventory_sha256'])

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('operation', choices=('apply', 'rollback'))
    p.add_argument('--before', required=True); p.add_argument('--plan'); p.add_argument('--shadow'); p.add_argument('--destination', required=True); p.add_argument('--repo', default=str(ROOT))
    a = p.parse_args()
    result = apply(a.before, a.plan, a.destination, a.repo) if a.operation == 'apply' else rollback(a.before, a.shadow, a.destination, a.repo)
    print(canonical(result).decode())

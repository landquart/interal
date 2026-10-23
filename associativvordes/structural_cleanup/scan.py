"""Full physical-record inspection. Diagnostic resemblance never authorizes deletion."""
import argparse, collections, gzip, hashlib, json, pathlib, resource, sqlite3, sys, time
from common import *
sys.path.insert(0, str(ROOT / 'associativvordes/v5_adapter'))
from stream import pairs

def issue_id(kind, scope): return hashlib.sha256(canonical([kind, scope])).hexdigest()

def inspect(snapshot, output, repo=ROOT):
    started = time.monotonic(); snapshot = pathlib.Path(snapshot); output = pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    if (output / 'SCAN.json').exists(): raise ValueError('fresh scan destination required')
    lock = load(snapshot / 'SNAPSHOT.json'); verify(snapshot, lock)
    root = snapshot / 'current' / PREFIX
    db = sqlite3.connect(output / 'index.sqlite')
    db.executescript('''PRAGMA cache_size=-8192; PRAGMA temp_store=FILE;
      CREATE TABLE families(id TEXT PRIMARY KEY,support INTEGER,langs TEXT,body_hash TEXT);
      CREATE TABLE forward(alias TEXT,family TEXT,PRIMARY KEY(alias,family)) WITHOUT ROWID;
      CREATE TABLE reverse(alias TEXT,family TEXT,PRIMARY KEY(alias,family)) WITHOUT ROWID;
      CREATE TABLE issues(id TEXT PRIMARY KEY,kind TEXT,scope TEXT,detail TEXT);
      CREATE TABLE checkpoints(bucket TEXT PRIMARY KEY,counts TEXT);''')
    counts = collections.Counter(); fixes = []; sources = collections.Counter()
    def review(kind, scope, detail):
        db.execute('INSERT OR IGNORE INTO issues VALUES(?,?,?,?)',
                   (issue_id(kind, scope), kind, scope, canonical(detail).decode()))
    def fix(rule, rel, pointer, before, after, evidence):
        if before == after: return
        fixes.append(dict(id=issue_id(rule, [rel, pointer]), classification='SAFE_STRUCTURAL_FIX',
            object=dict(path=rel, pointer=pointer), rule=rule, before=before, after=after,
            evidence=evidence, source_version=lock['production_commit'],
            source_inventory_sha256=lock['inventory_sha256'],
            source_file_sha256=sha_file(root / rel),
            inverse=dict(before=after, after=before),
            impact=dict(semantic_memberships=0, source_evidence_records=0, source_lemmas=0),
            application_scope='ISOLATED_SHADOW_ONLY'))
    def read_checked(path):
        seen = set()
        try:
            for key, body in pairs(path):
                if key in seen: review('DUPLICATE_TOP_LEVEL_KEY', str(path.relative_to(root)), key)
                seen.add(key)
                yield key, body
        except (ValueError, OSError, EOFError) as e:
            review('SERIALIZATION_OR_PARTIAL_ARTIFACT', str(path.relative_to(root)), repr(e))
    for bi in range(256):
        b = f'{bi:02x}'; local = {}; observed = collections.defaultdict(collections.Counter)
        bucket_bad = False; member_digest = hashlib.sha256()
        with db:
            for fid, f in read_checked(root / 'families' / (b + '.json.gz')):
                if not isinstance(f, dict) or f.get('id') != fid:
                    review('FAMILY_ID_CONFLICT', fid, f); bucket_bad = True; continue
                local[fid] = f; counts['families'] += 1
                for alias in f.get('aliases', []):
                    try: db.execute('INSERT INTO forward VALUES(?,?)', (alias, fid))
                    except sqlite3.IntegrityError: review('DUPLICATE_FAMILY_ALIAS', fid, alias)
            for lang in LANGS:
                for fid, rows in read_checked(root / 'members' / lang / (b + '.json.gz')):
                    if fid not in local: review('MISSING_FAMILY_REFERENCE', lang + ':' + fid, None); bucket_bad = True
                    if not isinstance(rows, list) or not rows:
                        review('EMPTY_OR_INVALID_MEMBER_GROUP', lang + ':' + fid, None); bucket_bad = True; continue
                    identities = {}
                    for ordinal, row in enumerate(rows):
                        scope = [fid, lang, ordinal]
                        if not isinstance(row, dict) or not isinstance(row.get('lemma_id'), str):
                            review('INVALID_MEMBERSHIP_RECORD', canonical(scope).decode(), row); bucket_bad = True; continue
                        body = canonical(row); lid = row['lemma_id']; digest = hashlib.sha256(body).hexdigest()
                        if lid in identities:
                            kind = 'IDENTICAL_PHYSICAL_DUPLICATE' if identities[lid] == digest else 'CONFLICTING_MEMBERSHIP_ID'
                            review(kind, canonical(scope).decode(), dict(lemma_id=lid, body_sha256=digest,
                                history_required=True, deletion_prepared=False)); bucket_bad = True
                        identities[lid] = digest
                        if row.get('family_id', fid) != fid:
                            review('INCOMPATIBLE_MEMBER_REFERENCE', canonical(scope).decode(), row.get('family_id')); bucket_bad = True
                        for source in row.get('sources', []):
                            desc = {k: source.get(k) for k in ('id', 'file', 'category')}
                            sources[(lang, canonical(desc).decode())] += 1
                        observed[fid][lang] += 1; counts['memberships'] += 1; counts['language:' + lang] += 1
                        member_digest.update(canonical([fid, lang, ordinal, digest]) + b'\n')
            for fid, f in local.items():
                languages = dict(observed[fid]); n = sum(languages.values())
                if not n: review('EMPTY_FAMILY', fid, None); bucket_bad = True
                db.execute('INSERT INTO families VALUES(?,?,?,?)', (fid, n, canonical(languages).decode(), hashlib.sha256(canonical(f)).hexdigest()))
                # No counters are rewritten around a known ambiguous/duplicate membership.
                if not bucket_bad:
                    pointer = '/' + fid.replace('~', '~0').replace('/', '~1')
                    proof = dict(bucket=b, observed_members=n, observed_languages=languages,
                                 all_six_languages_read=True, linguistic_claim=False)
                    fix('FAMILY_SUPPORT', 'families/' + b + '.json.gz', pointer + '/support', f.get('support'), n, proof)
                    declared = {l: n for l, n in f.get('language_support', {}).items() if n}
                    if declared != languages:
                        fix('FAMILY_LANGUAGE_SUPPORT', 'families/' + b + '.json.gz', pointer + '/language_support', f.get('language_support'), languages, proof)
            for alias, targets in read_checked(root / 'aliases' / (b + '.json.gz')):
                counts['aliases'] += 1
                if not isinstance(targets, list) or not targets:
                    review('EMPTY_OR_INVALID_ALIAS', alias, targets); continue
                for fid in targets:
                    try: db.execute('INSERT INTO reverse VALUES(?,?)', (alias, fid))
                    except sqlite3.IntegrityError: review('DUPLICATE_ALIAS_TARGET', alias, fid)
            db.execute('INSERT INTO checkpoints VALUES(?,?)', (b, canonical(dict(membership_stream_sha256=member_digest.hexdigest(), families=len(local))).decode()))
        if bi % 16 == 15: print(canonical(dict(bucket=b, counts=dict(counts))).decode(), flush=True)
    with db:
        for kind, query in (
            ('MISSING_ALIAS_TARGET', 'SELECT r.alias,r.family FROM reverse r LEFT JOIN families f ON f.id=r.family WHERE f.id IS NULL'),
            ('MISSING_REVERSE_ALIAS', 'SELECT alias,family FROM forward EXCEPT SELECT alias,family FROM reverse'),
            ('REVERSE_ONLY_ALIAS', 'SELECT alias,family FROM reverse EXCEPT SELECT alias,family FROM forward')):
            for alias, fid in db.execute(query): review(kind, canonical([alias, fid]).decode(), dict(alias=alias, family_id=fid, no_equivalence_inferred=True))
        # Cached report rows are views of an exact family, not independent witnesses.
        report = load(root / 'report.json')
        for section in ('largest_families', 'highest_suspicion_families'):
            for i, cached in enumerate(report.get(section, [])):
                row = db.execute('SELECT support,langs FROM families WHERE id=?', (cached.get('id'),)).fetchone()
                if row is None: review('STALE_REPORT_FAMILY_REFERENCE', section + ':' + str(i), cached.get('id')); continue
                proof = dict(family_id=cached['id'], all_six_languages_read=True, cached_view_only=True)
                fix('REPORT_CACHED_SUPPORT', 'report.json', '/' + section + '/' + str(i) + '/support', cached.get('support'), row[0], proof)
                old = {l: n for l, n in cached.get('language_support', {}).items() if n}
                if old != json.loads(row[1]):
                    fix('REPORT_CACHED_LANGUAGES', 'report.json', '/' + section + '/' + str(i) + '/language_support', cached.get('language_support'), json.loads(row[1]), proof)
        for (lang, raw), n in sorted(sources.items()):
            d = json.loads(raw); filename = d.get('file'); category = d.get('category')
            valid = isinstance(filename, str) and pathlib.Path(filename).name == filename and d.get('id') == str(category) + '/' + filename
            path = 'associativvordes/frequency lists/' + lang + '/' + str(filename)
            exists = bool(git(repo, 'ls-tree', MAIN, '--', path).strip()) if valid else False
            if not valid or not exists:
                review('SOURCE_DESCRIPTOR_REVIEW', lang + ':' + raw, dict(descriptor=d, memberships=n, current_file_exists=exists,
                       original_generation_bytes_not_certified=True))
        for kind, message in (
            ('ORIGINAL_ASSIGNMENTS_UNAVAILABLE', 'Historical carrier rows are not original assignments; do not reconstruct rejected memberships.'),
            ('ORIGINAL_GENERATION_INPUTS_UNAVAILABLE', 'Candidate/Kaikki input bytes and original artifact availability remain baseline provenance holds.'),
            ('HISTORY_COVERAGE_HOLD', '358 unresolved historical authority/scope/source conflicts; no nonempty membership/alias proposal is permitted.')):
            review(kind, 'CORPUS_PROVENANCE', message)
    issue_counts = dict(db.execute('SELECT kind,count(*) FROM issues GROUP BY kind ORDER BY kind'))
    atomic(output / 'SAFE-FIXES.ndjson', b''.join(canonical(x) + b'\n' for x in sorted(fixes, key=lambda x: x['id'])))
    with open(output / 'REVIEW-REQUIRED.ndjson', 'wb') as out:
        for ident, kind, scope, detail in db.execute('SELECT * FROM issues ORDER BY id'):
            out.write(canonical(dict(id=ident, classification='REVIEW_REQUIRED', kind=kind, scope=scope,
                                    evidence=json.loads(detail), source_version=lock['production_commit'], automatic_change=False)) + b'\n')
    result = dict(schema='v5-structural-scan/1', input_inventory_sha256=lock['inventory_sha256'],
        buckets=256, counts=dict(counts), safe_fixes=len(fixes), review_counts=issue_counts,
        files=dict(safe_fixes_sha256=sha_file(output / 'SAFE-FIXES.ndjson'), review_sha256=sha_file(output / 'REVIEW-REQUIRED.ndjson')),
        physical_duplicates_are_not_identical_family_sets=True, production_writes=0,
        seconds=time.monotonic() - started, max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    save(output / 'SCAN.json', result); db.close(); return result

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--snapshot', required=True); p.add_argument('--output', required=True); p.add_argument('--repo', default=str(ROOT))
    a = p.parse_args(); print(canonical(inspect(a.snapshot, a.output, a.repo)).decode())

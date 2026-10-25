# Structural v5 shadow cleanup, version 1

This module inspects physical records, not the linguistic correctness of a family.
There is no production write switch, membership deletion, alias rewrite, merge,
national-stem normalization or recalculation of associativity.

`rules.json` and `decision.schema.json` define the two output classes. The only
prepared safe rules replace derived family size fields or the same fields in
cached report views. Every value is independently recomputed from all six member
shards of the exact family. Full before-values, source hashes, evidence, inverse
values and zero semantic/source impact are recorded. Different witnesses, sense
ambiguity, duplicate IDs, missing objects, aliases, serialization and provenance
issues go to review. Equal member sets in different families are not physical
duplicate records. No deletion rule is implemented in this release.

The protected history registry is checked before shadow publication. Missing or
damaged history blocks even initial empty publication. Incomplete semantic history
blocks every nonempty plan. It is never treated as permission to correct a row.
An empty plan can produce a byte-identical research copy with its holds retained.

## Reproduce the complete run

Python 3.12+, Git, approximately 20 GiB of external working space. Obtain the
exact baseline commit (PR #680), diagnostic branch (PR #683) and reachable historical
Git objects. No external linguistic model or online annotation service is used.

```sh
git fetch origin 47723611112610945cb09b34e18588b7bd151911
git fetch origin 44f1105cfe8e59d50affa08889654bfb488056c1
python3 associativvordes/structural_cleanup/workflow.py \
  --repo /absolute/interal --work /external/new-v5-structural-run
```

The pinned baseline census and stable-ID verifier are extracted byte-for-byte
from Git into the work directory, rather than silently copying a mutable local
tool. Production is captured at `4772361`; source lemma carriers come from the
first materialization `ee6637b`. Original assignments and generation inputs are
still unavailable. Source carriers do not certify their missing provenance.

The run captures `before`, performs a full disk-backed baseline recount, inspects
all 256 buckets, writes `scan/SAFE-FIXES.ndjson` and `scan/REVIEW-REQUIRED.ndjson`,
and publishes a separate `after` snapshot. It checks idempotence and uses a
second decoder for every complete gzip bucket, including nested duplicate keys
and truncated serialization. A second full census deliberately exits 75 inside
an uncommitted bucket, then resumes from the preceding committed checkpoint.
The source/materialized/unassigned equation and finite unassigned rows are
compared; no false membership is restored to make counts match.

It also produces a fresh independent application replay, a byte-exact inverse,
a full tar backup, and an actual independent restoration. A successful final
`RUN.json` appears only after all stages succeed. Large SQLite databases, original
carriers and archives remain outside Git. Small manifests/receipts belong in the
audit directory. Structural success never resolves linguistic or provenance holds.

## Individual operations and recovery

```sh
python3 associativvordes/structural_cleanup/capture.py --repo . --work /external/run
python3 associativvordes/structural_cleanup/scan.py \
  --repo . --snapshot /external/run/before --output /external/run/scan
python3 associativvordes/structural_cleanup/shadow.py apply --repo . \
  --before /external/run/before --plan /external/run/scan/SAFE-FIXES.ndjson \
  --destination /external/run/after
python3 associativvordes/structural_cleanup/shadow.py rollback --repo . \
  --before /external/run/before --shadow /external/run/after \
  --destination /external/new-rollback
python3 associativvordes/structural_cleanup/verify.py \
  --before /external/run/before --after /external/run/after \
  --plan /external/run/scan/SAFE-FIXES.ndjson --output /external/run/validation.json
python3 /external/run/pinned-tool/census.py restore \
  --archive /external/run/v5-structural-shadow.tar --destination /external/new-restored \
  --sha256 EXACT_BACKUP_JSON_ARCHIVE_SHA256
```

Snapshots and completed receipts are checksum locked. Incomplete captures/scans
are not published as complete: preserve partial artifacts and use a new work
directory. Interrupted census transactions resume with source/code dependency
checks. An existing completed shadow can be reused only with identical input,
plan, history pointer and hashes. Rollback reconstructs original file bytes;
it never infers reverse semantic operations. Backup restoration needs its archive
and SHA-256, not the original temporary source directory. The five-volume join
utility from `v5_diagnostics/tools/join_volumes.py` accepts any manifest with the
same ordered chunk schema; the number of volumes is taken from the manifest.

## Tests

```sh
python3 -m unittest discover -s associativvordes/structural_cleanup -p 'test_*.py' -v
node tests/associative-v5-structural-cleanup.test.mjs
```

Tests separate counter repairs from changes to membership, aliases, witnesses,
IDs and independent source records. They exercise exact inverses, repeat
application, corruption, unavailable history and unassigned preservation.

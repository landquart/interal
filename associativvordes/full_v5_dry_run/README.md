# Full v5 shadow dry-run — empty qualified plan only

Production, root recognition, linguistic formulas and data PR merge are not
implemented. Current stage11 has no qualified operation scope. The five layers
therefore validate an unchanged full research copy; they do not certify an
unimplemented nonempty cleanup or changed v5 generator. Any nonempty plan fails
closed, even when a supplied field claims APPROVED.

Restore the exact stage05 archive using the four volumes in
`audit/associative-v5-structural-cleanup/ARCHIVE-VOLUMES.json`. Its current and
historical source carriers are separately pinned; original source assignments
remain unavailable. Check out the stage12 branch with baseline v5 files present.

```sh
python3 associativvordes/v5_diagnostics/tools/join_volumes.py --manifest audit/associative-v5-structural-cleanup/ARCHIVE-VOLUMES.json --directory /research/volumes --output /research/run/certified-source.tar
git show 44f1105cfe8e59d50affa08889654bfb488056c1:associativvordes/v5_baseline/census.py > /research/run/pinned-census.py
python3 /research/run/pinned-census.py restore --archive /research/run/certified-source.tar --destination /research/run/before --sha256 fae523b90c644532dee1e4dc028b82a37d0e368f376129ea10e2f42e051a50cc
python3 -m associativvordes.full_v5_dry_run.census --work /research/run --snapshot /research/run/before --output /research/run/before-census
python3 -m associativvordes.full_v5_dry_run.exercise --work /research/run
```

`exercise` verifies current main's exact bytes, freezes all current and historical
operation-manifest roles, quality/source/history/normative locks, kills a real
copy process by SIGKILL during its second uncommitted file, resumes its checkpoint,
and publishes an object only after every source file matches. A separate physical
copy/replay, five deterministic layers, exact no-op inverse and real cold restore
must finish before COPY-PHASE appears. CURRENT/VIEW files are research pointers,
never a production index switch. Partial objects cannot be selected.

After `SHADOW-PATH.json` supplies the complete shadow's relative location, run:

```sh
python3 -m associativvordes.full_v5_dry_run.census --work /research/run --snapshot /research/run/shadow/objects/615100bd660269356e17d38d2ddf29109616240fbd9ada1c59f8f6dcec075302 --output /research/run/after-census --crash-after 2
# The command above deliberately exits 75 before the second transaction commits.
# Verify one checkpoint and PRAGMA integrity_check='ok', then resume without flag.
python3 -m associativvordes.full_v5_dry_run.census --work /research/run --snapshot /research/run/shadow/objects/615100bd660269356e17d38d2ddf29109616240fbd9ada1c59f8f6dcec075302 --output /research/run/after-census
node --expose-gc associativvordes/full_v5_dry_run/raw_replay.mjs /research/run
node --expose-gc associativvordes/full_v5_dry_run/runtime.mjs /research/run
python3 -m associativvordes.full_v5_dry_run.checks --work /research/run
node tests/associative-full-v5-dry-run.test.mjs
npm test
```

The separately locked census adapter retains the exact baseline SQL/accounting
core and replaces only its incremental decoder with strict `json.load` of one
existing gzip bucket. Both baseline and adapter hashes bind every checkpoint;
duplicate nested keys, truncated gzip/JSON and nonfinite values fail. Peak memory
is bounded by a shard and SQLite cache, not millions of families. This changes
neither linguistic decisions nor calculation formulas. Runtime/decoder code is
separately hashed in final code locks.

The two fresh censuses independently recover source/materialized/unassigned
sets and all language, relation, family-size, alias and orphan distributions.
The Node decoder compares all 3,587 exact files and decodes all 256 current and
historical buckets with a different JSON implementation. An empty membership
diff is certified only together with these full-coverage receipts; it is not a
sample or an assertion that all existing memberships are correct.

Runtime tests execute the real v5 loader on the two local roots, preserve its
fan-out holds and manual routing, and never fall back to production. Calculator
replay uses actual source frequencies and the current unmodified calculation
runner. No A/P/Di, scores or model identities are fabricated. Missing semantics,
demographic coverage of scored languages and valid top-five supports remain
unknown; identical no-score output is not certified linguistic impact.

The existing durable stage05 archive can be reused as this no-op shadow's backup
only after exact shadow file and SNAPSHOT metadata equality with its real cold
restore is proven. No new changed data archive is implied. The new research
receipt bundle contains complete diffs, recounts, guards, runtime comparison,
resource/recovery receipts and a reference to that independent full backup.
Databases and copies stay outside Git. Preserve original journals and 699
unassigned rows; never restore false links to make source counts match.

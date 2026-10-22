# Protected historical registry, version 1

This is a read-only preservation and constraint layer. **The committed snapshot is BLOCKED, not a certification of complete semantic coverage.** All nonempty release previews/applications are held; preannotation cannot emit include/exclude proposals while history coverage is unresolved. Empty/deterministic observations remain possible. Production family/member/alias files and old journals are unchanged.

`audit/associative-history-registry/CURRENT.json` selects a content-addressed immutable snapshot. It locks every discovered unique source blob reachable from the two exact historical roots, including deleted source versions; byte size, SHA-256, Git blob identity, introducing/changing commit and date are retained. Source paths are discovery metadata; raw blob bytes and JSON pointers are authoritative. PR metadata is provenance only.

The builder discovers all versions under the v5/v6/external audit trees, associative cleanup scripts, v6 review/correction/authorization/journal/snapshot paths, and the review/release implementation. It does not discover private external human journal directories, unpushed branches or repositories. Existing external review stores must be supplied and chain-verified before semantic certification. The absent source artifacts from baseline PR #680 remain absent; no memberships are recreated.

## Decision domains and authority

A record contains source/commit/date, operation, exact scope, previous status, decision, rationale, evidence references, authority, data version, supersession and separate evidence/identity/sense/relation/association statuses. Null POS/sense means unknown, never a dictionary sense invented from corpus spelling.

Authority categories are distinct: `CONFIRMED_MANUAL`, `BOUNDED_OPERATION`, `ENGINEERING_CHECK`, `RESEARCH_HYPOTHESIS`, `OWNER_ACCEPTED_AT_RISK`, `INDEPENDENT_GOLD`, and `UNDETERMINED`. A declared historical category is not proof of that authority. The current normalized records assert only engineering deltas and research restrictions. No manual or gold authority is manufactured. In particular, owner risk acceptance is an operational waiver, never linguistic validation.

For engineering deltas, `historical_outcome` records inclusion/exclusion in materialized data; `decision` remains `UNRESOLVED` as a linguistic question. Research v6 baseline exclusions/uncertainties preserve their historical scope and authority. Raw observations retain the original claims without promotion. A model confidence field is never an authority input.

A finite membership selector is the exact difference of two locked historical bucket arrays for one canonical family and language. Its selected lemma IDs are independently counted and SHA-256 locked. This preserves removed sets even when the current family is gone. Retained words are outside the removed set. Scope is not a substring/prefix rule and is not transferred to another family, language, allomorph or known distinct sense. Unknown sense overlap causes review, not universal rejection of every sense.

Alias decisions are reverse-routing constraints; they never become membership negatives. Duplicate-family consolidation does not establish general ID equivalence. A changed/new ID, new source version or uncertain identity alignment needs a reviewed mapping. `merge` is blocked until separate finite source and destination checks are provided; there is no implicit family-wide expansion.

`History.observations()` replays source records lazily by immutable blob + JSON pointer. The snapshot indexes counts and hashes for these views instead of duplicating over a million nested source objects in Git. Historical claims without an adapter retain `UNDETERMINED` authority and `UNRESOLVED` effective status. Four malformed historical file versions are locked and listed verbatim in the conflict queue; none is silently repaired.

## Fail-closed API

```python
from associativvordes.history_registry.registry import active_check
r = active_check({
    "operation": "restore", "family_id": "ety:cf2897b18b16",
    "language": "de", "lemma_ids": ["lemma:149ebd32db1b986c8992"]
})
if not r["allowed"]:
    raise ValueError(r["status"])
```

The lower-level `check(repo, snapshot, expected_sha256, proposal)` pins the expected snapshot hash explicitly. `CLEAR` means no applicable constraint found in a **complete verified** history, not permission, evidence or linguistic truth. Applicable positives, negatives and unresolved decisions all require review. Opposite decisions produce `HISTORY_CONFLICT`, regardless of date. An explicit supersession is held until a separate authority/scope adjudication adapter exists. Equal reimports are idempotent; reused IDs with different payloads fail.

Missing/truncated/corrupt snapshots, missing source blobs, unsupported operations, unresolved history, absent corpus identity and merge scopes all block. Setting `coverage_complete` alone cannot bypass indexed unresolved observations or conflicts. The registry has no membership writer and no authority escalation path.

The preannotation pipeline checks history before returning proposals and includes the snapshot pointer hash and history code in resume dependencies. Release control checks again before preview and under its existing apply lock. The old cleanup scripts remain unchanged historical tools; they are **not** safe entry points for a future cleanup. Other writers/standalone v6 research tools have not been retrofitted; no claim of repository-wide interception is made. Mass cleanup must remain disabled until all writers are covered and the conflict queue is adjudicated.

## Reproduce and restore

Use Python 3.12, Git, and a full clone containing the pinned main and v6 objects. No packages, model calls or network calls are used by the builder.

```sh
python associativvordes/history_registry/build.py --repo . --output /tmp/history-rebuilt
python -m unittest discover -s associativvordes/history_registry -p 'test_*.py'
python -m unittest discover -s associativvordes/auto_annotation -p 'test_*.py'
python -m unittest discover -s associativvordes/release_control -p 'test_*.py'
```

Read `CURRENT.json` to obtain `SNAPSHOT` and `DIGEST`, then:

```sh
python associativvordes/history_registry/registry.py restore --repo . --snapshot "$SNAPSHOT" --sha256 "$DIGEST" --output /tmp/history-restored
python associativvordes/history_registry/registry.py verify --repo /nonexistent --snapshot /tmp/history-restored/REGISTRY.json --sha256 "$DIGEST" --objects /tmp/history-restored/objects
```

Restore verifies each raw byte hash, fsyncs staged files, and publishes a fresh directory only after completion. An existing destination is refused. A crash leaves a staging directory that cannot become the published restoration. The second command proves restoration works without Git or the original source tree. Keep the verified external source archive and its checksum; do not commit the 565 MB restored objects. Rebuilding into another output directory must produce the same snapshot SHA-256. New history requires a new snapshot, never edits to the old one.

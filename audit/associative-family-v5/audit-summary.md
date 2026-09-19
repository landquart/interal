# Associative family index v5 corrective audit

Status: **preflight and exact input recovery passed; analysis-only distribution scan pending**.

Production remains on audited v4 and is not modified by this branch.

## Implemented before the build

- PR 621 protections retained from merge `d9e4f3d3e67d18f3533600deebaffc687f127523`.
- Regex ancestry extraction removed as a source of automatic equivalence.
- Structured expansion parser added; malformed and incomplete nodes are review-only.
- Explicit typed relation policy added.
- Transitive seed absorption replaced with exact root-node claims.
- Manual override evidence integrated before assignment/member materialization.
- English-only post-build repair removed from the workflow and made inapplicable to v5.
- Canonical selection no longer prefers the shortest alias unconditionally.
- Deterministic corpus-quality classification added; rejected members cannot reach runtime.
- Family schema bumped to v5; runtime keeps read compatibility with v4.
- Locked v4 checkpoints replace automatic source rebuilding/downloading.

## Local evidence

- `npm test`: all 75 discovered test files passed.
- Corrective fixture suite: 8/8 passed.
- Existing family/runtime regression suite: passed.
- `git diff --check`: passed.

## Not yet proved

- full v5 artifact counts and structural invariants;
- old-vs-new topology comparison;
- absence of analogous false merges across all shards;
- dual independent annotation of 9,600 memberships;
- false-negative recall audit;
- staging runtime and load SLOs;
- complete browser matrix.

The index must not be called production-ready until these items are complete.

## Input-lock recovery

Lock-only workflow run `35427527134` failed to restore the audited candidate
cache key `Linux-family-candidates-v3-3024370275a832dc65b5d4c58055343f36da1d4d2169ceaa2743d2e152ce01c2`.
The cause was GitHub Actions cache scope isolation between sibling branches, not
an absent source checkpoint. Lock-only run `35441277463` in the original cache
scope restored both exact entries without rebuilding or downloading replacements.
It recorded candidate tree SHA-256
`2fa23e5690cbdcb80e27708f950a3c3935d87a566030221327c06eabbab0f2f6` and
Kaikki SHA-256 `42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9`.
No family generation step ran. The original service branch was restored to its
pre-recovery commit after the lock artifact was downloaded.

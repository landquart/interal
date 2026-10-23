# Morphology semantic review v2

The v1 corpus scan is a frozen **source-availability census**. Its multiple-type
labels are not established competing analyses. Direct derivation and suffixation
can describe the same event; inflection can coexist with derivation. v2 corrects
that distinction over every selected membership without altering the v1 snapshot,
source annotations, native alternatives or production data.

Read `audit/associative-v5-morphology-cleanup/CURRENT.json` for the current semantic
version. Flat v1 receipts and the original archive remain reproducible historical
inputs. Only v2 is the current semantic classification.

Input MANIFEST SHA is pinned to the completely replayed v1 census. Input rows retain
all ten fields except the unsupported verdict; an eleventh field records explicit
unresolved reasons. Every selected row is `INSUFFICIENT_EVIDENCE` until its corpus
lexeme/sense and path to the root are verified. Source masks and counts are features,
not approvals. Neither missing source rows nor several coexisting types imply a
wrong relation. Every alternative remains recoverable through v1 `records_all` and
the exact-row inspector; original source versions/lineage locks are unchanged.

`policy.adjudicate` is a proof-envelope validator for future **independently reviewed**
proposals. It never invents linguistic facts. Native endpoints include artifact,
revision, language, POS and sense. Every path step needs a locked original-row
locator and explicit direction. Unknown compound segmentation/roles/meaning,
common-ancestor steps, homonym bridges and cross-language allomorph propagation
fail. A separately configured trusted registry adapter must return an approved
`CONFIRMED_MANUAL` or `INDEPENDENT_GOLD` receipt bound to the complete exact proposal
SHA. Unverified input booleans, model confidence, research/engineering checks and
OWNER_ACCEPTED_AT_RISK do not qualify. There is no default authority adapter.

A type correction still has `membership_operation=NONE`; alternatives remain intact.
The separate history application guard fails closed when history is unavailable,
conflicting or not CLEAR. Even CLEAR conveys no linguistic authority. No live
corpus binding/proof registry has been supplied, so this release creates zero
confirmed verdicts, type corrections and membership exclusions.

```sh
python3 associativvordes/morphology_review/run.py --input V1_RUN --output V2_RUN --crash-bucket 00
# Deliberate exit 75; resume without --crash-bucket.
python3 associativvordes/morphology_review/run.py --input V1_RUN --output V2_RUN
python3 associativvordes/morphology_review/run.py --input V1_RUN --output FRESH_REPLAY
node associativvordes/morphology_review/verify.mjs V1_RUN V2_RUN INDEPENDENT.json
node --test tests/associative-morphology-review-v2.test.mjs
```

The v1 census already accounts for all 2456543 families / 10078319 memberships;
v2 streams its complete exact suspicious scope (10078175 memberships). The 144
unselected memberships remain explicitly accounted by that frozen census. This is
a versioned semantic status correction, not a new claim of linguistic certification.

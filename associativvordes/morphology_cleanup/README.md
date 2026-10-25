# Full-v5 morphology review v1

This is read-only triage. No spelling alignment establishes native lexical identity,
sense, root component, direction, semantic relation, or membership. No code path
emits a confirmed correction or exclusion without future, independently supplied
reviewed identity/sense evidence. All final proposal manifests are empty in v1.

`native.py` builds bounded disk profiles from the complete pinned adapter row
indexes. A profile counts rows containing the same normalized spelling, not
independent evidence or native lexemes. GLeMM has unknown direction; a source
row's position never establishes direction. MorphyNet inflection stays inflection.
Prefix/suffix types require an explicit operation field. UDer relation labels are
source claims. Other source relation types remain unconfirmed in the profile;
the full native annotation is never discarded from the raw index.

`COMPETING_ANALYSES` in this triage means **multiple candidate relation types**.
It does not assert semantic incompatibility: inflection and derivation can coexist.
`INSUFFICIENT_EVIDENCE` also covers zero matches. Neither status is negative.

All ten requested types have distinct bits in `policy.TYPES`; indirect derivation,
allomorphy, borrowing and inheritance are not synthesized from proximity or common
ancestry. `chain_valid` checks declarations of explicit native endpoints, same-language
continuity, identity and sense verification. It is only a shape/continuity predicate:
boolean declarations confer no evidence or authority. Callers must namespace IDs
by artifact/revision and independently validate receipts; v1 creates no chain-based
confirmation and never transfers meaning.
`disposition` preserves membership when an individual relation needs review,
including when a valid alternative is available. It grants no authority.

Every output tuple has these columns:

`[family_id, language, lemma_id, ordinal, word, status, candidate_type_mask,
source_row_occurrences, exact_history_decision_ids, diagnostic_flags]`

The immutable input inventory plus bucket, language and ordinal recovers the
original row including all components. Frozen external manifest, language and
word recover **all**, not a bounded sample, native evidence alternatives:

```python
import sys
sys.path.insert(0, 'associativvordes/morphology_cleanup')
from native import records_all
for record in records_all(EXTERNAL, LOCK, language, word):
    # Stream each record to NDJSON; never list() the entire source corpus.
    print(record)
```

Each record retains exact original bytes, raw locator, revision, native lexemes,
POS, explicit direction, segmentation, relation parameters and competing analyses.
UDer compound source slots and primary parent remain separate. Roles and meaning
not documented by a source remain unknown. MorphyNet affix fields are not an
invented full compound segmentation. Native endpoints must be verified within the
same artifact before indirect paths can be proposed. Row-role IDs in GLeMM and
MorphyNet are not extensible lexical heads. Source independence is unestablished;
GLeMM/MorphyNet possible dependence is retained in the pinned source lock.

Reproduce outside Git, from certified `SNAPSHOT` and restored pinned originals:

```sh
python3 associativvordes/v5_adapter/external.py --raw RAW --lock data/morphology-evidence/sources/source-lock.json --output EXTERNAL
python3 associativvordes/morphology_cleanup/native.py --external EXTERNAL --lock data/morphology-evidence/sources/source-lock.json --output PROFILES
python3 associativvordes/morphology_cleanup/run.py --snapshot SNAPSHOT --profiles PROFILES --history HISTORY_SQLITE --output RUN --crash-bucket 00
# Exit 75 is deliberate; repeat without --crash-bucket.
python3 associativvordes/morphology_cleanup/run.py --snapshot SNAPSHOT --profiles PROFILES --history HISTORY_SQLITE --output RUN
node associativvordes/morphology_cleanup/verify.mjs SNAPSHOT RUN INDEPENDENT.json
python3 -m unittest discover -s associativvordes/morphology_cleanup -p 'test_*.py'
```

`HISTORY_SQLITE` is restored/rebuilt by the Prompt06 finite history procedure,
with its 348028 exact scoped rows and committed SHA receipt. Missing/corrupted
history fails closed. Every applicable decision is retained; no latest-row-wins.
A hit is not automatically a confirmed negative. Incomplete history blocks
application globally. Source versions and core Python code are checkpoint keys;
changed inputs, corrupt completed buckets and stale resumes fail. Partial buckets
are unpublished and rebuilt. Parallel independent runs use separate output paths.

Current source indices preserve 24 quarantined raw rows. Missing evidence in
these rows is unknown, never a linguistic rejection. Do not edit old ledgers,
production artifacts, association formulas, or retained national correspondences.

For a specific frozen row, use `scripts/inspect-v5-morphology.py` with
`--snapshot`, `--external`, `--lock`, `--bucket`, `--family`, `--language`,
`--lemma-id`, `--ordinal`, and a fresh separate `--output` directory. This verifies
exact bucket hashes and exports every alternative with license, lineage, native
fields, unresolved component meaning and the existing adapter question ID.

Run `scripts/verify-v5-morphology-profiles.py` with `--external`, `--lock`,
`--profiles`, `--output` for an independent full normalized-row replay. It compares
every word/type/count with the profiles in both SQL EXCEPT directions and checks
UDer native endpoints inside each artifact. Endpoint presence alone proves neither
sense continuity nor a valid path to the Interal root.

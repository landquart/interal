# Full-v5 surface hypothesis and proof dry-run

The source is the checksum-locked v5 snapshot from structural PR #685. Main stays
at `47723611112610945cb09b34e18588b7bd151911`; no production writer is present.
This module does not establish a false lexical relation from a short fragment,
an ending, a candidate-index label or the absence of an external positive path.

The historical catalog retains full recorded explanations, all exact old scope
digests and retained exceptions. Four logically invalid *proof rules* are
distinguished from empirical linguistic verdicts. Historical repairs are not
promoted to independent gold. `historical_scope.mjs` independently replays full
old arrays and evidence distributions by their pinned Git blobs; a word sample
is never substituted for those arrays. Those locks are not transferred to a new
family, language, sense or source version.

The complete scan emits one observational record for every current family and
an exact `[family,language,legacy_lemma_id,ordinal]` row for every membership in
a candidate family. Source bucket hashes, rather than copied frequency objects,
bind each ordinal to the full original record. Each candidate also gets a SHA-256
of its complete sorted finite `(language,lemma_id)` set. All actual evidence types
and sources are counted, including competing historical/compound claims. Unknown
native identities, historical correspondences and alternative analyses stay unknown.

Three overlapping discovery signals are used: a base of at most three Unicode
code points, exact exposure to a configured legacy tail family, and a multi-member
`surface_singleton` family. They are observations of risk, not independent negative
votes. Their exact signature partitions groups; global counts never add overlapping
signals. No million-item LLM queue or automatic individual rejection is generated.

All five proposal operations are representable in `proposal.schema.json`.
`REJECT_ENTIRE_FAMILY` requires the entire current finite set, not a sample.
`REMOVE_EXACT_MEMBERSHIPS` requires the precise smaller set. Both also require a
trusted existing proof-receipt verifier, verified native lexeme/sense bindings,
adjudication of competing analyses, current source version and a clear protected
history. No such authoritative verifier is manufactured by this module. A dict
of model confidence or boolean claims cannot pass the gate. `SPLIT_REQUIRED`,
`RETAIN_WITH_REVIEW` and `INSUFFICIENT_EVIDENCE` do not authorize removal.

## Reproduction

Python 3.12, Node 22+ and exact Git objects from PR #681 are required. Restore or
rebuild the structural snapshot using `structural_cleanup/capture.py`. Bulk fetch
the finite before/after blob SHAs referenced by the immutable history selectors
if a partial clone does not contain them. Use `fetch.negotiationAlgorithm=noop`
and `--refetch --no-filter` for explicit reachable blob wants; missing sources
block history materialization instead of silently omitting negatives.

```sh
python3 associativvordes/surface_cleanup/run.py --repo . \
  --snapshot /external/structural/before --output /external/surface-a
python3 associativvordes/surface_cleanup/run.py --repo . \
  --snapshot /external/structural/before --output /external/surface-b
node associativvordes/surface_cleanup/verify.mjs \
  /external/structural/before /external/surface-a /external/independent.json
node associativvordes/surface_cleanup/exceptions.mjs \
  /external/structural/before /external/all-retentions.json
node associativvordes/surface_cleanup/historical_scope.mjs \
  /external/surface-a /external/historical-scopes.json /external/all-retentions.json
python3 -m unittest discover -s associativvordes/surface_cleanup -p 'test_*.py' -v
```

Every bucket publishes compressed records and hashes atomically. `--crash-bucket
00` exits 75 before publication; resume removes only its own unpublished research
staging directory and rebuilds that bucket. Completed buckets verify hashes
before reuse. Source, code or history changes reject stale resume. Manifest and
summary bytes from fresh complete runs must agree. The native Node verifier
checks every affected ID, every source membership and every finite-set hash with
an independent decoder and independently implemented selection predicates.

Large outputs stay outside Git. The small final manifest locates all full
affected-ID and complex-case records; no sample is represented as complete.
Each FAMILIES record with `candidate=true` is a complex-case queue item with its
precise finite scope, not an approved exclusion. No source lemma or old negative
is deleted; no removed family is restored. Before/after dry-run counts are the
same whenever the proposed-exclusion manifest is empty.

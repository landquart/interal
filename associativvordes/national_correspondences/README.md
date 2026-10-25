# Finite national correspondences v1

`registry.py` validates documentary facts and provides a fail-closed exclusion
preflight. It does not certify legacy lexical identities, memberships, association
strength, or a new normative root. National forms never rename normative forms.

The default registry is `audit/associative-national-correspondences/CURRENT.json`.
Pin its SHA in the operator configuration. Every permission is an exact
language × lemma × POS × dictionary sense × context. No glob, regular expression,
case folding, accent folding, cross-language propagation or transitive closure is
performed. One lowercase v5 `monokel` record has a separate exact-ID identity hold.
Its dictionary identity and sense remain unresolved.

`SOURCE_DOCUMENTED` means a publisher documents this limited lexical fact; it is
not `CONFIRMED_MEMBER`, independent gold or authority to change the corpus.
`DIFFERENT_ETYMON` refutes a specified analysis, never every alternative path.
`UNRESOLVED`/`CONFLICT` hold destructive proposals for review. All association
statuses remain `NOT_ASSESSED`; the methodology calculations are unchanged.

```python
from associativvordes.national_correspondences.registry import preflight
result = preflight(
    'audit/associative-national-correspondences', exact_proposal,
    history_checker=operator_configured_history_adapter,
    verify_release=operator_configured_authority_receipt_verifier,
    expected_sha256=operator_pinned_registry_sha256)
```

A proposal must name the v5 family namespace, exact lemma ID and word, and the
locked production commit. A matching documentary fact or unresolved identity
blocks it. No match requires complete history plus an independently verified
receipt bound to the entire proposal and registry hash. Such a receipt must
resolve native identity, sense, alternative paths, component meanings, historical
positives and source versions. Input confidence or boolean proof flags do not
supply this authority. `CLEAR` is preflight only, not application authorization.

For a family operation, use `finite_scope_guard` over every row of an independently
locked ordered NDJSON membership manifest, with count and SHA-256. Disk-backed
uniqueness checks prevent duplicate IDs replacing missing scope. A sample, empty
scope, altered hash or unresolved member holds the operation. The surface
`authorize` gate additionally requires its configured checker to attest the full
proposed-ID set, count and pinned registry hash. The morphology `guard_application`
gate requires correspondence checking after the history gate; omitted checker
fails closed. Structural shadow code allows only proven metadata operations and
cannot remove memberships.

Audit all proposal manifests, including historical morphology v1 and current v2:

```sh
python -m associativvordes.national_correspondences.audit --output /tmp/interal-correspondence-audit
node associativvordes/national_correspondences/verify.mjs .
node --test tests/associative-national-correspondences.test.mjs tests/associative-morphology-review-v2.test.mjs tests/associative-surface-proof.test.mjs
```

The audit dynamically discovers new proposed manifests as well as requiring every
known one. Invalid/bulk/type-only rows are held; their unknown membership counts
are explicit. It preserves v1 inputs rather than counting their archived copy as
additional unique scope. Missing/corrupt required files stop the run. Completed
outputs use flushed atomic renames; partial files are not receipts.

Full current-corpus hash verification and finite carrier inspection:

```sh
python scripts/check-v5-national-correspondence-inputs.py --snapshot /path/to/restored/v5-before --output /tmp/interal-correspondence-scan
```

Restore the baseline using the stage 01/05 archive receipts. The path is arbitrary;
no single temporary directory is required. Read-only production files are hashed
against every current entry of `SNAPSHOT.json`; all 256 family buckets and six
member languages are read. The unrelated original-source carriers in the baseline
remain outside this finite inspection. Repeating a scan must produce identical
`PRODUCTION-INTEGRITY.json`; benchmark timing is intentionally separate.

To reproduce prior stages' archived semantic runs, check out their pinned commits.
The stronger gates in this branch change code identities; old checkpoint receipts
must not be resumed under changed code. No prior census or queue is rewritten.

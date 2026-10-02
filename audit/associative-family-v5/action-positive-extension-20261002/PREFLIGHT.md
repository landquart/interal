# Additive action extension preflight

The review commit is `78cb37158ef845f345414049aa7d6a7e4d0f7385`.
This separate checkpoint saves the materializer, the prepared ledger and its
preservation audits. Runtime corpus changes are committed separately.

All 170 selected records passed the original-source equality and quality checks.
The preflight hashes the three repository metadata files, the original family
object, the ordered member arrays, and unrelated objects in affected shards.
The frozen initial action ledger and review ledgers are not modified.

Expected change: add 15 English and 155 German memberships. Family support moves
from 2,098 to 2,268. Remove no memberships or families; change no aliases. Existing
member arrays remain as exact ordered prefixes. Each new member retains original
measurements and components, with one reviewed action component appended.

Preparation and application:

```sh
node scripts/materialize-associative-action-extension-20261002.mjs
node scripts/materialize-associative-action-extension-20261002.mjs --apply
node tests/associative-action-extension.test.mjs
npm test
node scripts/audit-repository-associative-family-v5.mjs
```

Use the saved ledger only if its metadata and source preflight still match the
checkout. A repeated application must fail before writes. When resuming from a
later runtime commit, inspect provenance and `materialization-status.json`
instead of applying again. The runtime tests activate only when provenance
records this extension; the whole decision-frame conservation test always runs.

These checks do not certify the 16,642 pending or 143 uncertain action records.
Legacy action containers remain pending a later evidence-backed retirement.

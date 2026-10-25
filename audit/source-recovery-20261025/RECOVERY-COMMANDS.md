# Reproducible recovery commands

These commands operate outside the production checkout. Python 3.11+, Node 24
and owner access to the private Library are required. Temporary paths below are
examples, never durable locators. Long-lived references and expected bytes are
in the checked-in plans. No credentials or signed URLs are stored here.

## 1. Source code and pinned metadata

```sh
git clone --branch audit/source-recovery-20261025 https://github.com/landquart/interal.git interal-source-recovery
cd interal-source-recovery
git rev-parse HEAD
sha256sum -c audit/source-recovery-20261025/TOOL-CHECKSUMS.sha256
python3 -m unittest associativvordes.source_recovery.test_restore -v
```

Record the exact checked-out commit for a new run. The audited linguistic/code
input snapshot is `78f73c0b4e151088c5ce2e7daab6dcd4472de52e`; newer code is not
silently substituted into its historical receipts. To recover original
historical generation code independently:

```sh
git fetch origin 3d71828f9bfa7ce6ea5f1814442a6604cb180c96
git archive 3d71828f9bfa7ce6ea5f1814442a6604cb180c96 scripts .github/workflows | gzip -n > ../generation-code-3d71828.tar.gz
```

Compare the result with `evidence/GENERATION-CODE-ARCHIVE.json`. This recovers
code, not old assignments, Kaikki bytes or candidate universe.

## 2. Obtain exact private archive parts

For one plan, produce a request containing only the stable owner-file IDs:

```sh
python3 - <<'PY'
import json
from pathlib import Path
p=json.loads(Path('audit/source-recovery-20261025/plans/baseline.json').read_text())
items=[dict(library_file_id=r['library_file_id'],file_name=r['file']) for r in p['parts']]
for n in range(0,len(items),20):
 print(json.dumps(dict(items=items[n:n+20]),ensure_ascii=False))
PY
```

In an authenticated ChatGPT Work session, use Library `prepare_materialize` on
these exact IDs, with a fresh external destination (maximum 20 per request).
Complete each returned transfer with the **current** Library skill's
`library_file_transfer.py` materialization/apply-xattrs route. Do not save
transfer tokens or signed URLs in Git. If unavailable, retain the exact failure;
do not replace the part with a similarly named file. This account-bound step
is required and is not claimed to work anonymously through plain curl.

Use `plans/raw.json`, `history.json`, `surface.json`, `morphology.json`,
`morphology_semantic.json`, `semantic.json`, `boundary.json`, `quality.json`,
`dryrun.json`, `diagnostics.json`, `structural.json`, `new_diagnostic.json` and
`new_replays.json` in the same way. For `boundary.json`, the ordered fragment
entries replace part 0004; do not concatenate a whole part and its fragments.
For diagnostics/structural, each ZIP volume holds one original archive chunk;
the verifier unwraps and hashes it before virtual concatenation.

## 3. Cold restore and SQLite checks

```sh
python3 -m associativvordes.source_recovery.restore \
  --plan audit/source-recovery-20261025/plans/baseline.json \
  --downloads /absolute/external/downloads \
  --cold-root /absolute/external/new-empty-baseline-restore \
  --output /absolute/external/new-evidence/baseline.json
```

Repeat once for each plan, always with a new absent `--cold-root`. The verifier
checks every part hash and length, whole reassembled hash, archive members,
physical restored bytes, locked raw-source member hashes and SQLite integrity.
It never extracts a member onto its supplied pathname: only a private temporary
file is created. Each temporary member is removed after rehash/integrity checks.
For this sequential model, allow space for the parts and the largest restored
member (the diagnostic database is large). This is not a simultaneous full
research environment or a production materializer/rollback test.

Interrupted runs do not get PASS. Keep their failed observation; use another
fresh restore directory for the retry. Old completed receipts do not grant a
new run permission to skip verification.

## 4. Key-stage engineering replay

```sh
INTERAL_INTEGRATION_RECEIPT=/absolute/external/new-evidence/KEY-REPLAY-RECEIPT.json \
  node tests/associative-v5-integration.test.mjs
node tests/associative-source-recovery.test.mjs
```

These are synthetic native fixtures through real modules. They establish
engineering compatibility, not new production human gold or historical origin.
The release gate must remain BLOCKED. Production files must remain untouched.

## 5. Refresh the catalogue

```sh
python3 -m associativvordes.source_recovery.catalog \
  --repo . \
  --evidence /absolute/external/new-evidence \
  --plans audit/source-recovery-20261025/plans \
  --output /absolute/external/new-catalogue
```

Preserve the new input commit, wall-clock observations, failures and limits.
Recheck `EXTERNAL-READBACK.json` before claiming an independent raw-source
backup. Missing original inputs and licensing/authority gaps must remain BLOCKED
until actual evidence changes. Do not rewrite old source locks to fit a download.

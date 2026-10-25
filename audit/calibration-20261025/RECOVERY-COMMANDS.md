# Reproduce calibration preparation and empty analysis

Check out this PR's exact source commit. The code is versioned in Git; the private dataset is pinned in `ARCHIVE.json`. Obtain that exact saved file by its durable ID, then run:

```bash
sha256sum "$CALIBRATION_ARCHIVE"
# Expected: 01b53591c686cbdda40f3a4270c6041fe786beba90cb4334e07d1018d0a48682
python - "$CALIBRATION_ARCHIVE" "$FRESH_RESTORE" <<'PY'
import base64,hashlib,json,pathlib,sys,zipfile
archive=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='01b53591c686cbdda40f3a4270c6041fe786beba90cb4334e07d1018d0a48682'
out.mkdir(exist_ok=False)
with zipfile.ZipFile(archive) as z:
 for x in z.infolist():
  p=pathlib.PurePosixPath(x.filename)
  assert not p.is_absolute() and '..' not in p.parts
 z.extractall(out)
for r in json.loads((out/'FILE-HASHES.json').read_bytes())['files']:
 b=(out/r['path']).read_bytes()
 assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
for line in (out/'SOURCE-ROW-EXTRACTS.ndjson').read_text().splitlines():
 r=json.loads(line)
 assert hashlib.sha256(base64.b64decode(r['raw_base64'])).hexdigest()==r['raw_sha256']
PY
python -m associativvordes.calibration_study.collect \
  --reserve "$FRESH_RESTORE/reserve" --output "$FRESH_ANALYSIS"
```

Expected: BLOCKED, zero real responses/arbitrations/gold, unknown agreement and timing, no main annotation authority. The cold-restored archive makes every preview and its source context inspectable; do not distribute the coordinator archive to reviewers.

For full independent replay against original sources, restore the quality archive from `audit/source-recovery-20261025/plans/quality.json`, the nine-part mapping/native archive from `audit/lexical-identity-20261025/ARCHIVE.json`, the exact v5 baseline and original morphology archive using `audit/lexical-identity-20261025/RECOVERY-COMMANDS.md` and `RECOVERY-SOURCES.json`. Then run the prepare/verify commands in `associativvordes/calibration_study/README.md`. Use fresh output directories. Compare every frozen reserve file against `RESERVE-MANIFEST.json`; sampling flags and labels are never human gold.

Run the locked contract checks:

```bash
python -m unittest associativvordes.calibration_study.test_study -v
node --test --test-concurrency=1 \
 tests/associative-calibration-study.test.mjs \
 tests/associative-cleanup-quality.test.mjs \
 tests/evidence-registry.test.mjs \
 tests/associative-identity-mapping.test.mjs \
 tests/associative-v5-integration.test.mjs
```

Genuine collection additionally requires external identity/competence/authorization checks, separately controlled blind delivery and content-bound verifier receipts. Never populate the journals or roster with invented people, answers or TEST_ONLY fixtures. The empirical final instruction and human gold can only be frozen after actual independent responses and arbitration.

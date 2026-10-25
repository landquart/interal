# Reproduce the research evidence view

1. Check out the PR's exact implementation commit. Restore all nine Prompt 19 archive parts with the commands and byte/hash checks in `audit/lexical-identity-20261025/RECOVERY-COMMANDS.md`. Reassemble and verify the full archive against `ARCHIVE.json`; restore all members including the mapping registry and native SQLite database. Run SQLite integrity and exact-file verification from that procedure. A temporary path is an execution location, not an archive locator.
2. With `RESTORED` pointing to that verified cold restore, run from the repository root:

```bash
python -m associativvordes.evidence_registry.view \
  --registry "$RESTORED/registry" \
  --output /tmp/REPLAYED-EVIDENCE-REGISTRY.json \
  --parent-archive audit/lexical-identity-20261025/ARCHIVE.json
cmp audit/evidence-registry-20261025/EVIDENCE-REGISTRY.json /tmp/REPLAYED-EVIDENCE-REGISTRY.json
python -m associativvordes.evidence_registry.replay \
  --manifest audit/evidence-registry-20261025/EVIDENCE-REGISTRY.json \
  --registry "$RESTORED/registry" \
  --output /tmp/INDEPENDENT-EVIDENCE-REPLAY.json
python -m unittest associativvordes.evidence_registry.test_model associativvordes.evidence_registry.test_view
node --test --test-concurrency=1 tests/evidence-registry.test.mjs tests/associative-identity-mapping.test.mjs tests/associative-normative-admission.test.mjs tests/associative-normative-resolver.test.mjs tests/associative-normative.test.mjs tests/associative-v5-integration.test.mjs
```

3. To stream the full unresolved case registry, use the `query` command in `EVIDENCE-REGISTRY.json`, substituting the restored registry path. Every part is checked before reading it. Changing parent data, schemas or mapping statuses requires a new registry version; there is no silent upgrade to confirmed evidence.
4. Native candidate and occurrence queries use `associativvordes.identity_mapping.query`; preserve all alternatives, raw source lines and source locks. The mapping archive does not contain the original morphology files: restore the 35-file raw archive using `audit/lexical-identity-20261025/RECOVERY-SOURCES.json`. Missing queues require their separately locked archives; see `QUEUE-COVERAGE.json`. They are not claimed as freshly restored here.
5. Dictionary URLs and precise entry locators are in `FRESH-SOURCE-FACTS.json`. Re-access is necessary to recheck the publisher; assertion hashes are not source-page hashes. Full documentary cold restore remains blocked pending licensed captures. Do not treat this partial recovery as complete linguistic certification.

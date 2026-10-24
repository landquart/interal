# Sense-specific v5 research review (version 1)

Read-only diagnostic layer. Existing lemma IDs, lexical heads, spelling search results and old memberships do not establish POS or sense identity. `policy.py` implements six separate outcomes; export never authorizes a production operation. Dictionary meanings can be documented while a corpus sense remains unbound.

The JSON schema documents case shape; `validate_case`, `export_cases`, `restore_cases` and the closed-catalog `bridge.py` provide executable validation. Evidence and authority gates remain necessary in addition to shape validation. The callback supplied to `adjudicate` must be an independently maintained receipt verifier, never a model's confidence or an untrusted self-issued receipt. History must be available and clear. Rejection additionally requires a clear stage08 guard and affirmative contradiction evidence. All alternative paths and the root target meaning must have been reviewed. Every response still has `membership_operation=NONE`.

## Reproduction

Run from the repository root with Python 3.11+, Node 18+, Git (historical blobs available), and the existing npm dependencies (`npm ci --ignore-scripts`). Store research data outside the checkout. `WORK` below is a new absolute directory; `RAW` is the restored pinned morphology `raw/` directory. Restore pinned originals and previous queues using the hashes in SOURCE-LOCK and PRIOR-QUEUE-RESTORE. A sparse checkout must retain all production index files and history ledgers.

```sh
export WORK=/absolute/research/semantic09
export RAW=/absolute/pinned-morphology/raw
python3 -m associativvordes.semantic_cleanup.scan --output "$WORK/scan" --stop-after 2
python3 -m associativvordes.semantic_cleanup.scan --output "$WORK/scan"
python3 -m associativvordes.semantic_cleanup.native --raw "$RAW" --lock data/morphology-evidence/sources/source-lock.json --targets audit/associative-v5-semantic-cleanup/LEXICAL-TARGETS.json --output "$WORK/native"
python3 -m associativvordes.semantic_cleanup.history --output "$WORK/history.json"
python3 -m associativvordes.semantic_cleanup.review --scan "$WORK/scan" --native "$WORK/native" --output "$WORK/review"
node associativvordes/semantic_cleanup/verify.mjs "$PWD" "$WORK/scan" "$WORK/review"
python3 associativvordes/auto_annotation/pipeline.py offline --store "$WORK/annotation" --input "$WORK/review" --config associativvordes/auto_annotation/config.offline.json --run-id semantic09-offline --stop-after 3
python3 associativvordes/auto_annotation/pipeline.py resume --store "$WORK/annotation" --input "$WORK/review" --config associativvordes/auto_annotation/config.offline.json --run-id semantic09-offline
python3 associativvordes/auto_annotation/pipeline.py export --store "$WORK/annotation" --run-id semantic09-offline --output "$WORK/annotation-export"
node tests/associative-semantic-cleanup.test.mjs
npm test
```

For an independent replay use fresh `scan-replay` and `review-replay` paths, omit `--stop-after`, repeat review against the same native index, and compare both MANIFEST files and every release output hash. Metrics and elapsed times are deliberately separate from deterministic manifests. Source hashes are checked on resume; output receipts commit only complete buckets/artifacts. Rebuilding one interrupted source restarts that artifact's SQLite transaction. The scope pass loads one static JSON bucket at a time, never the full production graph.

The bundle command packages scan checkpoints, every native alternative, review outputs, the actual annotation backup and the sense-preserving export. It verifies a cold restore against all archived file hashes; it refuses an existing restore destination. See `BUNDLE-RESTORE.json` in the audit directory for the executed invocation's receipt. No downloaded licensed dictionary pages or full production copy is included.

```sh
node associativvordes/semantic_cleanup/bundle.mjs pack /absolute/research.zip "$WORK/scan" "$WORK/native" "$WORK/review" /absolute/annotation-backup.zip "$WORK/annotation-export"
node associativvordes/semantic_cleanup/bundle.mjs restore /absolute/research.zip /absolute/fresh-restore
```

The offline configuration has no providers, no paid authorization, zero request budget, a journal and cache. Its 67 ABSTAIN results are deterministic engineering outputs, not LLM answers or human verdicts. Existing paid-provider modes require their separate existing authorization; this change does not enable them.

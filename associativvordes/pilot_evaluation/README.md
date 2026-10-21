# Phase 06 — reproducible annotation and evaluation

This package prepares an experiment; it does not clean families or accept membership. The published real release contains unannotated questions, not automatically generated gold.

## Test

```sh
/usr/bin/python3 associativvordes/pilot_evaluation/test_pilot.py -v
node --test tests/associative-pilot-evaluation.test.mjs
```

Tests use genuine project/source lexical carriers from phase 05 and explicitly TEST-ONLY simulated raters/labels/captures. They are never published as human annotation.

## Reproduce from verified caches

Acquire the pinned sources/approved registry using phase 03/04 instructions. `--prior-snapshot` is the phase-04 seven-family v6 projection, retaining its finite manual controls; all twelve families additionally receive current pinned v6 corrections and head evidence. All outputs must use a fresh directory outside the checkout.

```sh
/usr/bin/python3 associativvordes/pilot_evaluation/reproduce.py \
  --cache /tmp/registry-original --prior-snapshot /tmp/registry/v6.json \
  --source-lock data/morphology-evidence/sources/source-lock.json \
  --raw-root /tmp/morphology-raw --output /tmp/pilot06-release
```

This verifies original registry Git blobs, projects 12 actual families, selects bounded original source rows, builds an isolated graph, freezes approximately 1440 cases (shortfalls remain explicit), writes blinded tasks and runs source configurations. No network calls, paid model calls or production writes are made by this package. Cached raw resources are required.

To reuse a previously verified selection, replace `--raw-root` with `--selection DIR --selection-manifest-sha256 HASH`. It must match the frozen selection receipt, source lock, selector code, seeds and record checksum. The receipt SHA is in the published replay metadata. Source rows are reparsed by the existing graph builder. Normative fresh selection scans the 35 pinned files; reuse is a checksum-verified optimization.

`REPLAY.json`, graph/source/registry locks and `SAMPLING-MANIFEST.json` pin inputs. Cases, annotation tasks, gold and substantive predictions are deterministic. Runtime observations naturally vary and are stored separately from interpretation; run JSON includes their durations, so whole timing-bearing experiment files are not expected to have identical hashes.

## Create actual human gold

Use `cases/annotation-tasks.ndjson`. It hides predicted decisions, source proposal tags and prior labels. Fill separate annotator files, never overwrite `cases.ndjson`. Read `ANNOTATION-GUIDELINES.md` and `GOLD-DATA-SCHEMA.md` in the audit directory. 20% deterministic repeat review plus all prior-decision cases require independent reviewers. Register verified human annotators in a private `raters.json`; the package cannot authenticate a person's identity or detect someone falsely claiming to be human. Project-owner verification of authorization and blinded independence is essential. Defaults contain **no authorized raters**.

```sh
/usr/bin/python3 associativvordes/pilot_evaluation/run.py \
  --cases /tmp/pilot06-release/cases/cases.ndjson --graph /tmp/pilot06-release/graph/BUILD_ID \
  --judgments /tmp/judgments.ndjson --raters /tmp/raters.json \
  --adjudications /tmp/adjudications.ndjson --baseline /tmp/baseline-capture.json \
  --output /tmp/pilot06-reviewed-release
```

`GOLD.json` references individual judgments and exact case hashes; `ANNOTATION-RECEIPT.json` retains supplied judgments, roster and adjudications. Unknown/disputed cases are excluded from precision/recall denominators and reported separately. Evaluation split is primary; overall/development summaries are exploratory. Never tune against evaluation labels or alter labels from algorithm responses.

## Capture A, do not invent it

A and B stay unavailable until an actual frozen-runtime capture exists. `BASELINE-CODE-LOCK.json` pins the pre-experiment code at `156083cb5a631f3e5dd2d6f85d2abdc5d53ecc49`. This is a frozen repository baseline, not an assertion about a live deployment revision. Capture actual search outputs in an isolated copy of that tool. No calls to an LLM are initiated here.

Each recording JSON must contain `capture_kind: actual_runtime`, the exact `algorithm_commit`, `runtime_code_hashes` equal to the lock's SHA-256 map, `methodology_modified: false`, `case_set_sha256`, `artifact_path` and matching `artifact_sha256` for the original saved export, `recorded_at`, and `searches`. A search is `{family, language, complete, truncated, candidates:[{word,...original runtime fields}]}`. Record explicit `merged_families` only when observed. Preserve frequency/source/model fields in candidates. Optional `boundary_offsets` are accepted only if explicitly captured on the exact target string. Missing search/truncated absence is abstention, never a negative decision. Same spelling in a capture does not prove sense identity.

```sh
/usr/bin/python3 associativvordes/pilot_evaluation/capture.py \
  --cases /tmp/pilot06-release/cases/cases.ndjson --recordings /tmp/recording.json \
  --operator VERIFIED_OPERATOR --output /tmp/baseline-capture.json
```

The operator must establish that recordings came from actual execution. A checksum alone is not evidence of authenticity. Candidate membership lists, imported statuses and handcrafted predictions are not substitutes for A.

## Compare calculator captures

`impact.py --before FILE --after FILE --lock LOCK --output FILE` compares actual unchanged-calculator captures. LOCK stores `before_sha256` and `after_sha256`. Captures require the same case scope, methodology and complete code-hash map; all six explicit language states; model/head identities; actual P or null; preserved frequency observations; and recorded `selected_top_five` or null. Use `independent_model_id` only with separate human evidence. Include actual `internationality` or null. Missing scores/coverage prevent a numeric conclusion. The mode compares outputs and flags regressions; it does not reimplement formulas, infer P from priority, or invent candidate scores.

See `06-PILOT-DESIGN.md`, `EVALUATION-METRICS.md` and `PILOT-READINESS.md` for interpretation and currently blocked work.

## Current Prompt 04 experiment

See [QUALITY04.md](QUALITY04.md) for actual A/B/U/C/D captures, locked budgets, independent human collection, timing, confidence intervals and blocked quality gates. Historical predictions above are not a current final quality estimate.

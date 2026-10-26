# Prompt 22 — independent LLM comparison readiness

**Status: BLOCKED. No real model experiment took place; no winner is selected.**
Date: 2026-10-26. Repository: `landquart/interal`.
Observed main: `1a28f5235f3b99bf227013b9ba25c031008df2a4`.
Exact research parent, PR #704: `46a12b47ba6eac3e60f046da7d83a0dd334e67cb`.
This draft builds on the unmerged Prompt 21 chain, rather than representing that
chain as installed on main. Previous integration/scientific blockers remain.

## Verified prerequisites and actual observations

The pinned Prompt 21 analysis contains **zero authenticated human reviews, zero
paired cases, zero human-gold entries**. Its 240 questions (40 per language) are
provisional reserved material, not certified LLM evaluation input. Compound and
alternative-origin coverage is missing even as discovery hypotheses in every
language. POS/sense/normative context and transitive independence certification
are incomplete. No old holdout or private packets were opened or sent to a model.

This execution host has no `ollama`, `llama-server`, `vllm` or `nvidia-smi` binary
on PATH. Read-only probes of loopback ports 11434, 8000 and 8080 returned no
available model listing. This does not establish anything about the user's own
computer, other ports, cloud accounts or all possible model deployments.
`MODEL-AVAILABILITY.json` records the exact endpoints, timestamps and probe times.

The existing real offline configuration was imported and its client called with
no configured B role: result `MODEL_UNCONFIGURED`, response `null`, zero generation
requests. This is a configuration smoke check, not a lexical prediction. The
offline deterministic route is not an LLM and cannot stand in for a measured arm.
No paid provider or budget is authorized; no API key was inspected or requested.
Existing Qwen/DeepSeek references do not supply a pinned usable comparison model.
No claim about their relative quality or current commercial availability is made.

## Method frozen before generation

`PREREGISTRATION.json` fixes five paired conditions: no external morphology;
verified evidence; evidence plus graph; graph plus rules and alternatives; and
the same raw rich-condition output with a conservative abstention wrapper. Raw
and routed hybrid outcomes must remain separate, so abstaining on all cases
cannot masquerade as perfect quality. No claim that a hybrid improves quality
is supported yet.

The final execution registration is still blocked. It must bind exact model
revisions/digests, question and gold manifests, complete linkage and exposure
inventories, approved scientific text, response schema, prompts, runner, schedule,
parameters and independently reviewed statistical plan before any generation.
Filling these fields later is a new signed registration, not a backdated result.
Calibration/development/holdout are required to be nonempty and independently
separated over transitive dependencies. Preserve the old holdout; never repurpose
it for tuning, and do not automatically relabel Prompt 21 reserve as calibration.

The proposed paired schedule randomizes model/arm order with the fixed seed.
Calibration estimates empirical reliability from independent human labels;
development selects a candidate procedure and routing; holdout is evaluated once
after freezing all choices. Challenge cases and probability-sampled corpus cases
are analyzed separately. Results from a purposive reserve cannot estimate a
population error rate without a valid sampling design.

## Engineering preparation and remaining implementation

`associativvordes/llm_comparison/compare.py` adds strict reviewed-text projection,
content-bound question approval checks, cross-split linkage validation,
high-risk abstention and descriptive denominator-explicit metrics. The module
does not certify human identities, scientific facts or completeness of supplied
leakage keys. Those are upstream independent certification requirements, not
booleans that a model or experiment operator may self-approve.

The current `auto_annotation` transport always uses a rules-bearing card. Its
schema requires supplied evidence for definitive answers, which would handicap
an evidence-free baseline structurally. Therefore the five-arm preparation is
kept separate: it proposes the same scientific question and response fields in
each arm while varying only approved evidence/context. **A validated generation
runner and full response validator for this task are not implemented here.**
No existing fixed-prompt benchmark is presented as the requested five-arm study.

The future runner must retain exact raw request/response bytes, requested and
resolved model identity, version, parameters, usage, timestamps, latency and
authorization/price receipts. Existing parsed response/cache hashes alone do
not meet this expanded receipt requirement. The durable budget/lease/unknown
billing safeguards must be retained in a reviewed transport integration.
Transport errors, refusals, schema failures and truncation must stay separate
from actual model ABSTAIN. No automatic paid retry or cloud fallback is enabled.

## Measurements and acceptance

There are **0 requests, 0 responses, 0 frozen predictions, 0 authorized experiment
cases and $0 in experiment provider spend**. Empty NDJSON receipt/prediction files
express absence of observations; they are not fabricated fixtures. Generation
speed, hardware cost, human speedup and quality remain unknown, not zero.

`QUALITY-METRICS.json` records null estimates with zero denominators, explicit
language strata and `manu`, `regul`, `creat` strata. Positive precision is
TP/(TP+FP), negative precision TN/(TN+FN), dangerous exclusion risk FN/all correct
memberships, and membership recall TP/all correct memberships. Abstentions count
against recall. Uncertain human gold is counted separately. Missing outputs
are rejected by the diagnostic evaluator, not silently turned into ABSTAIN.

Diagnostic Wilson intervals in the utility are **not** a final design-based
quality certificate. Grouped/stratified uncertainty, design weights, paired
comparison and sufficient stratum support remain required for the real study.
The provisional gates are research selection gates, not modifications to the
approved language definitions or production quality policy. No selection is
allowed from missing or underpowered measurements.

The existing schema prohibits confidence probabilities. Calibration therefore
requires a separately frozen empirical reliability procedure using observable
evidence/risk bins fitted only on independent calibration gold, with holdout
reliability/Brier measurements later. This estimator is not implemented, and
no model confidence is treated as factual evidence.

Sense identification requires exact externally verified sense IDs. Rationale
evaluation requires qualified independent people to check every factual claim,
citation entailment, source/version/scope and alternative origin; reference-ID
validity is insufficient. No such factual audit has taken place. Two LLM outputs
do not constitute independent experts or human gold.

Allomorph and historical cases require separate measured error rates. A model
that systematically rejects correct allomorphs is disqualified. Currently those
rates are unknown. No false-exclusion safety claim or sample-size claim is made.

## Recommended process and human review

`RECOMMENDED-PROCESS.json` selects **no model** and keeps paid execution disabled.
Only preparation/integrity work is currently supported. Every current membership
decision requires human review. High-risk classes explicitly include `manu`,
`regul`, `creat`, historical correspondences, allomorphs, homonymy, ambiguous
identity/POS/sense, compounds/indirect/mixed paths, alternative origins, conflicting
or dependent sources, proposed exclusions, family merges/splits and every
uncertain, failed or unsupported output. The candidate hybrid is not an empirically
recommended production procedure.

## Validation and completion boundary

Seven synthetic `TEST_ONLY` engineering tests verify denominator behavior,
null metrics, missing/duplicate rejection, split leakage, blind arm projection,
exact approval hashes, high-risk routing and empty named strata. They are not
model outputs or linguistic gold. Validation details are in `TEST-REPORT.json`.
The existing auto-annotation suite is recorded separately when run; no full
repository CI success or independent linguistic verification is inferred.

No approved definitions, association calculations, production families, old
holdout, human answers or earlier receipts were changed. This work adds only
comparison preparation and honest blocked-state artifacts. No merge or release.

**The user's completion criterion is not met:** a real comparison requires
certified human gold, authorized independent splits, a pinned accessible model,
the validated runner/receipt integration and external factual/statistical review.
Paid execution additionally requires explicit provider and budget authorization.
There is no measured winner and the error classes are not quantitatively bounded.

## Reproduction

```bash
python -m unittest associativvordes.llm_comparison.test_compare -v
python -m unittest discover -s associativvordes/auto_annotation -q
python -c 'from associativvordes.llm_comparison.compare import inventory; import json; print(json.dumps(inventory(), indent=2))'
```

`INPUT-PREFLIGHT.json` binds the pinned source reports and implementation hashes.
`MANIFEST.json` hashes every new source/report artifact except itself, with no
private data. Clone the PR commit, verify those hashes and replay the commands;
probe timestamps/latencies may differ. This reconstructs preparation, not a
nonexistent experiment. Real future packets/receipts must be durably archived
with access controls without exposing the old holdout in Git.

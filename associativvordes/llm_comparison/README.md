# LLM comparison (Prompt 22)

Research preparation, not an executed model experiment. See
[`LLM-COMPARISON-REPORT.md`](../../audit/llm-comparison-20261026/LLM-COMPARISON-REPORT.md).
The method is locked before generation; exact model, case, independent human-gold
and scientific evidence manifests are still missing. A final execution registration
must bind their hashes before ANY request, including an exploratory holdout request.

`compare.py` implements a strict text-only allowlist for reviewed scientific
questions, exact question-content approval checks, cross-split linkage checks,
conservative hybrid routing, denominator-explicit metrics and loopback inventory.
It cannot authenticate supplied approvals or certify that leakage keys are complete.
It has no provider execution path, no production writer and no winner selector.
Metrics are descriptive diagnostics, not independent quality certification.

```bash
python -m unittest associativvordes.llm_comparison.test_compare -v
```

Future execution must use a separately reviewed integration with the existing
`auto_annotation` budget/store transport. Its current fixed card/prompt cannot be
silently reused for the five ablations: it always includes normative rules. Its
current response schema also requires supplied evidence for definitive decisions;
that would structurally handicap the evidence-free baseline. The new study prompt
is therefore a separately versioned proposal-only task. Every arm must use the SAME
new validated response contract; factual evidence verification remains external.
`prompt()` is only a preparation helper, not an implemented generation runner.

Before enabling a runner, capture exact raw HTTP request and response bytes,
provider request ID, requested/resolved model and revision/digest, full parameters,
token usage, timestamps, monotonic latency and price/authorization references.
Existing successful parsed responses and request hashes alone do not meet that
expanded receipt contract. Malformed/refused/truncated/transport failures must be
retained separately, never converted into model ABSTAIN or silently omitted.

Private cases, gold, human identities, prompts and responses must stay in
access-controlled durable storage; publish hashes and counts in Git. Do not
release the old holdout. Future split separation must be independently certified
over transitive family/alias/lexeme/sense/source/evidence linkage, not spellings alone.

# Associative family v5 annotation protocol

Status: locked before annotation. The 9,600-row sample and acceptance thresholds must not be changed after an evaluator sees labels.

Each row is independently reviewed by evaluator A and evaluator B. They must not see each other's labels. At least one evaluator must be a human with relevant linguistic competence; an LLM may be one evaluator but cannot be the only source of linguistic judgment. The `annotator` values must be distinct.

Allowed labels: `true_positive`, `false_positive`, `uncertain`, `normalization_error`, `morphology_error`, `etymology_error`, `homonymy`, `distant_relation`, `corpus_noise`.

For every non-obvious decision, record a short note and a verifiable evidence URL or bibliographic reference. A shared surface string is not sufficient evidence. Compound components, affixes, distant ancestors, proto relations, homonyms and uncertain parses are not equivalent branches unless the locked relation policy explicitly permits the edge.

All disagreements go to adjudication. The adjudicator records the final label, reasoning and evidence without altering either original annotation. Precision is computed only after adjudication. Recall remains blocked until a separately constructed and reviewed false-negative gold set is complete.

The scorer intentionally exits non-zero when annotations are missing, both files use the same annotator, or disagreements remain unresolved.

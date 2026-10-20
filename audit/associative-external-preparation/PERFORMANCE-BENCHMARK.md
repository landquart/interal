# Performance benchmark

The source projection uses SQLite (8 MiB page cache, file-backed temporary operations), compressed random-access source observations and indexed lexical lookups/arcs. Inflections stay in lossless staging and are counted but excluded from productive arcs. Queries expose truncation, finite depth and expansion bounds; all returned paths are hypotheses.

`candidate_search/scale_project.py` reads one actual Git-locked v5 shard at a time, with a 64 MiB decoded-shard ceiling. It stores real national words, original lexical identifiers, full frequency observations, source file/row locators and row hashes. Missing frequency is not replaced with zero.

`candidate_search/benchmark_scale.py` measures 10, 100, 1,000 and all available v5 inventory families using SQL counts. Finite path payloads, grouping and queue persistence are separately measured on 100 real seed queries. These scopes must not be conflated. The approved v6 catalog has only 19 families, so thousands of approved v6 families cannot truthfully be benchmarked.

`candidate_search/index_pilot.py` connects the full source index to the existing guarded graph/queue on seven explicitly selected families. It retains the seven-family limit, negative/manual decisions, source-local identities and unchanged-queue fingerprints.

Status: measurements pending. Full operational queue expansion is not certified merely by full-inventory SQL counts and a bounded payload sample. New-source incremental replacement currently requires a new versioned index; unchanged partitions are checkpointed/reused.

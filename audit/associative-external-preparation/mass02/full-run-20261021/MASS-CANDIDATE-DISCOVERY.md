# Full-registry candidate discovery validation

All results below come from the full pinned sources and actual 19-family v6 registry.
This is bounded proposal discovery; no memberships, confirmed annotations or production formulas were changed.

| Language | Questions | Selected seeds | Available seeds | Unknown frequency | Grouped duplicate observations | Search seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| de | 198 | 115 | 10515 | 31 | 670 | 2.024 |
| en | 379 | 125 | 3083 | 115 | 956 | 2.394 |
| es | 316 | 92 | 2795 | 44 | 418 | 1.617 |
| fr | 144 | 91 | 1763 | 33 | 372 | 0.907 |
| it | 124 | 103 | 2140 | 12 | 329 | 0.805 |
| ru | 406 | 84 | 1340 | 133 | 688 | 2.2 |

All 114 family/language units were selected. Category counts overlap. Question IDs are unique.
Language search seconds sum the measured discovery units; shared full-file checksum reads and export I/O are included only in the stage timings below.
Native analyses, paths and raw source locators remain in the proposal artifact. Source independence and sense identity remain unresolved.
Detailed omissions, family statistics and bounded-search limits are in COVERAGE.json, SEARCH-full.json and MASS-RUNBOOK.md.

| Stage | Processed units | Reused units | Seconds | Peak RSS KiB |
| --- | ---: | ---: | ---: | ---: |
| difficult | 72 | 0 | 31.191 | 90112 |
| full | 114 | 0 | 39.88 | 93056 |
| independent | 114 | 0 | 41.117 | 92828 |
| interrupted | 5 | 0 | 17.13 | None |
| resumed | 109 | 5 | 38.318 | 91412 |
| small | 1 | 0 | 15.342 | 38032 |
| unchanged | 0 | 114 | 25.464 | 62664 |

Independent fresh exports and interrupted/resumed exports have identical versions and NDJSON hashes.
The full-data refusal probe used a separate test copy: the original proposal queue was unchanged.
A deliberately damaged CURRENT pointer was restored after verifying the prior manifest and every exported file.
Unchanged runs still read full input checksums and reconcile review history; zero rediscovered units does not mean zero I/O.
Registry owner-word changes require a fresh auxiliary inflection projection. The native graph stays on disk.
No raw corpora are uploaded. Proposal artifacts retain source metadata and original license/attribution records.
Temporary runner databases are reproducible products; durable small receipts accompany this report.

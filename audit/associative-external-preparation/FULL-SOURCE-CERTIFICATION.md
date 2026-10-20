# Full source certification — stage 01

**PASS for the complete pinned source corpus and normalized catalog.** Baseline `a3afb7dad56ba951cc9044591f0236731d35dbbe`; source-lock SHA-256 `0ca240e9c42334e04ff188d329433b8e476d88a54a80da60d54eca9edaa2bbad`.

All 35 originals (260,992,004 bytes), 13 partitions and six languages were checked against the existing trusted lock. UDer remains 1.1; GLeMM remains 2.0 / `395020177a96a81177582fb59664509ff015f934`; MorphyNet remains `378144f64df58c78db5245af19d16a511ccecf3a`. UDer/MorphyNet were acquired from their official pinned endpoints; GLeMM was restored from the already verified private offline cache. No source pin, importer or original attribution was changed.

Two independent release roots, with no reused partitions, reproduced every pinned partition's identity, logical/compressed output checksum and source count. Each physical source row was independently compared with staging or quarantine, including its original fields and bytes. Both builds read **9,404,068**, staged **9,404,044** and quarantined **24**; each catalog has **3,047,035** normalized views and **3,750,624** evidence occurrences. All outputs match between runs and match the earlier pinned global catalog. Counts were compared rather than forced.

| Language | Files | Read | Staging | Quarantine |
|---|---:|---:|---:|---:|
| de | 5 | 979,173 | 979,173 | 0 |
| en | 6 | 2,021,878 | 2,021,878 | 0 |
| es | 6 | 1,561,353 | 1,561,329 | 24 |
| fr | 5 | 906,109 | 906,109 | 0 |
| it | 5 | 910,105 | 910,105 | 0 |
| ru | 8 | 3,025,450 | 3,025,450 | 0 |

All 24 exclusions are Spanish inflections with empty inflected forms; originals remain in quarantine. None was silently dropped or converted to a derivation.

Receipts: `certification01/INPUTS.json`, both `*-PARTITIONS.json`, both `*-RUN.json`, `REPLAY-VERIFIED.json`, `COVERAGE.json` and `CATALOG.json`. `GLOBAL-CATALOG-VALIDATION.md` records complete evidence/identifier checks. `PERFORMANCE-BENCHMARK.md` and `RECOVERY-AND-REPLAY.md` delimit measured scale and recovery. These small receipts are versioned with code, while all complete corpora/products remain outside Git.

This certifies source preservation and reproducibility. It creates no accepted family memberships or linguistic gold and does not certify unrestricted operational mass annotation.

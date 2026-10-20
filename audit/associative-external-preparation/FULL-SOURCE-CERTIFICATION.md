# Full source certification — stage 01

Baseline: `a3afb7dad56ba951cc9044591f0236731d35dbbe` (stabilization PR #671).
Source registry SHA-256: `0ca240e9c42334e04ff188d329433b8e476d88a54a80da60d54eca9edaa2bbad`.

The 35 pinned input files (260,992,004 bytes) were acquired again from official endpoints or the verified private GLeMM cache. `certification01/INPUTS.json` records all artifact pins, licenses, sizes and hashes. UDer is 1.1, GLeMM is 2.0 at `395020177a96a81177582fb59664509ff015f934`, and MorphyNet is at `378144f64df58c78db5245af19d16a511ccecf3a`. No version changed.

Two fresh release roots are being built with `associativvordes/importers/certify_corpus.py`. Each partition must reproduce its published build identity, every logical/compressed output hash and every per-artifact count. `audit_import.py` independently compares every physical source row to its original bytes and fields in staging or quarantine. It does not call the source adapter parser.

Both fresh full builds completed: 9,404,068 read, 9,404,044 staged and 24 quarantined; 3,047,035 normalized views and 3,750,624 evidence occurrences. Every partition reproduces its pinned identity, counts and output hashes. The two full catalog manifests are identical and reproduce the earlier pinned global catalog. Independent global referential/identifier audits are recorded separately when complete.

Raw data, staging, catalogs and mutable databases remain outside Git. No family membership, manual decision or calculation formula is written by these commands.

| Language | Files | Read | Staging | Quarantine |
|---|---:|---:|---:|---:|
| de | 5 | 979,173 | 979,173 | 0 |
| en | 6 | 2,021,878 | 2,021,878 | 0 |
| es | 6 | 1,561,353 | 1,561,329 | 24 |
| fr | 5 | 906,109 | 906,109 | 0 |
| it | 5 | 910,105 | 910,105 | 0 |
| ru | 8 | 3,025,450 | 3,025,450 | 0 |

All three resources cover each of the six languages in this lock. Coverage does not imply equal semantic/POS/segmentation completeness. All 24 technical exclusions are Spanish inflections with empty inflected forms; original bytes and locators remain in quarantine.

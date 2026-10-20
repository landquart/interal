# Full source certification — stage 01

Baseline: `a3afb7dad56ba951cc9044591f0236731d35dbbe` (stabilization PR #671).
Source registry SHA-256: `0ca240e9c42334e04ff188d329433b8e476d88a54a80da60d54eca9edaa2bbad`.

The 35 pinned input files (260,992,004 bytes) were acquired again from official endpoints or the verified private GLeMM cache. `certification01/INPUTS.json` records all artifact pins, licenses, sizes and hashes. UDer is 1.1, GLeMM is 2.0 at `395020177a96a81177582fb59664509ff015f934`, and MorphyNet is at `378144f64df58c78db5245af19d16a511ccecf3a`. No version changed.

Two fresh release roots are being built with `associativvordes/importers/certify_corpus.py`. Each partition must reproduce its published build identity, every logical/compressed output hash and every per-artifact count. `audit_import.py` independently compares every physical source row to its original bytes and fields in staging or quarantine. It does not call the source adapter parser.

Status: full replay and catalog verification in progress. Expected historic counts are comparison controls, not manufactured results. Completion requires receipts for both complete releases and a byte-for-byte output comparison.

Raw data, staging, catalogs and mutable databases remain outside Git. No family membership, manual decision or calculation formula is written by these commands.

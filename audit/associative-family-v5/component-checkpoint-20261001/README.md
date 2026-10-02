# Saved review checkpoint — 2026-10-01

This captures all retrieved candidate records, preliminary etymological selections and the corrected exact-fragment decisions. Nothing is materialized by saving the checkpoint. The user explicitly excludes naive from nat and lieutenant from loc: etymology cannot override an absent fragment. Existing search normalization (version 4) is retained; loc/lok, nat/nasc/naci and inter/entre substitutions are not allowed.

`candidate-records.json.gz` preserves all 18 complete retrieved arrays and original corpus records, including undecided candidates. `source-records.json.gz` preserves preliminary selected records before the exact-fragment correction. `decisions.json` is the frozen accepted list after that correction; it records removed etymological-only choices, missing corpus forms and dictionary bases. `candidate-inventory.json.gz` is the compact per-lemma retrieval/selection inventory. Artifact SHA-256 values are locked in decisions.json.

The three Python selection notebooks and retrieval scripts are historical review aids, not runtime membership rules. To resume their work, unpack candidate-records into `<root>-<language>.json` beside these files; the frozen decisions remain authoritative for materialization. All source family memberships outside the reviewed component families must be preserved. English natalism was not found in the locked English source; its frequency and lemma ID must not be invented.

A checkpoint is not a claim of global lexicographic completeness: remaining candidates and other families still require review.

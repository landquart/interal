# Associative family index v5 corrective build

## Why a rebuild is required

The audited v4 topology was produced by regex extraction from etymology-tree expansions, untyped equivalence, transitive seed absorption, and an English-only post-build repair. These defects changed family membership itself, so metadata-only repair cannot make assignments, members, aliases, and families agree semantically.

## Reused inputs

The corrective workflow restores the exact candidate-index and Kaikki cache keys used by audited run `35346791625`. Cache misses fail closed. It does not rebuild candidate indexes or download a newer dump. Content SHA-256 values are calculated before generation and attached to the output.

## Preflight gates

- structured expansion fixtures;
- typed relation policy fixtures;
- adjacent-node non-pairing fixture;
- exact seed-claim fixture;
- canonical quality fixture;
- corpus-noise fixture;
- PR 621 runtime regressions;
- all repository tests;
- `git diff --check`.

## Corrective semantics

- `etymon`/`ety` expansion ancestry is review-only and cannot merge families;
- only explicit direct template policies can merge;
- component, affix, distant, proto, homonym, uncertain, malformed, and unknown relations cannot merge;
- seed families claim only exact configured root nodes and never absorb another family transitively;
- manual evidence is produced before assignments and members are materialized;
- post-build control repair is disabled for v5;
- rejected corpus items remain auditable but are excluded at runtime;
- family schema version becomes `5`, while runtime remains backward compatible with production v4.

## Publication rule

Corrective artifacts are Actions artifacts only. No production Blob pathname, manifest, deployment, or `main` branch is modified by the build. A separate acceptance decision is required after structural, semantic, runtime, performance, and browser validation.

# Associative family v6

V6 is an additive, parallel interpretation of the immutable v5 corpus and evidence. Production remains on v5 until a separate switch decision. The expensive review unit is a lexical-head-to-family edge; a corpus lemma and a discovered component may have no accepted family.

## Entities and identities

Corpus lemma IDs, measurements, sources and component arrays remain unchanged. Components, lexical heads, families, national realizations, etymological clusters, aliases and review edges have distinct typed namespaces. `surface:*` means component candidate; `ety:*` means evidence cluster. Neither prefix grants membership or creates a user family. Old objects are retained by content-addressed references and a complete migration inventory.

Canonical root decisions are explicit catalog entries. `pede` migrates to canonical `ped` with the old ID retained as a route/provenance reference. `creat` stays `creat`: `-at-` belongs to the international associative base and is not discarded. All other seed boundaries require individual documented decisions. Proposals from Latin ending removal are retrieval aids marked `proposal_requires_review`; they never promote families.

Lexical heads use language, normalized spelling and a sense/identity discriminator. Homonyms and disputed senses must remain separate. Generated lemma-to-head links enumerate existing IDs and record morphology/evidence; unrecognized words stay pending rather than acquiring invented dictionary heads. Head decisions have accepted, excluded, uncertain or pending status, evidence URLs, a version and a finite propagation policy. Acceptance propagates only through listed, language-bound, root-bound links. A whole word as fallback review identity is explicitly unresolved, not an asserted lexical head.

## Catalog, evidence and routing

One declarative v6 catalog controls v6 builder, review tools, audit and parallel runtime. V5 compatibility code stays frozen. Catalog root boundaries, accepted/excluded head edges and approved realizations are independently versioned. `observ` can use Italian `osserv`; `loc` can use approved German `lok` and Russian `лок`. This creates no global spelling substitution. An alias may return several candidate families or evidence targets and never merges their identities.

Previously accepted v5 memberships are imported as finite legacy decision proofs. They remain traceable even when a reliable shared lexical head has not yet been established. Such exact record proofs do not certify a new guessed head and do not grant propagation. Every unassigned lemma/component remains reachable through the immutable source adapter.

## Pipeline and determinism

Retrieve candidates → recognize evidenced lexical heads → review canonical boundary → review national realization → assess etymology → materialize head edge → generate finite memberships. No substring membership, shortest-stem selection, global reflex replacement, semantic merge or family size cap. Evidence cache entries and all decisions are explicit files; the builder does not call an LLM or network service. Sorted inputs and stable gzip output provide reproducibility.

Migration scans every old family, fingerprints all source artifacts, classifies technical namespaces, records duplicate hashes and retains unknowns without promotion. Backlogs are regrouped into evidenced heads where possible, otherwise explicit unresolved units; grouping alone never resolves a linguistic decision. Priority is downstream exact lemma IDs per unresolved edge. Review reduction metrics must distinguish established reusable heads from provisional groups.

## Validation and rollout

Golden controls cover ped/creat boundaries, observ/osserv, loc/lok/лок, nat/naive, inter/winter/printer, action/Actium/actin/fact/tract, information/nonformal and the fifteen quarantined val targets. Full migration must conserve source corpus IDs, components, evidence bytes and manual decisions. Differential reports compare exact IDs and classify route removal as technical demotion separately from linguistic exclusion. Unexpected differences block completion. Schema/engine tests, deterministic replay, exhaustive v5 preservation audit and a v6 global audit are required. No production switch or merge is performed by this implementation.

## Typed realization review

A realization has one explicit type: canonical_reflex, lexical_branch_realization, derivational_stem, inflectional_form, query_alias or historical_evidence_form. Only an accepted canonical_reflex with evidenced, language-bound supporting heads is a general realization. Branch stems and inflected forms have finite head scope; aliases and historical forms confer no membership. Head identity, family edge, realization and canonical decisions remain independent. Existing untyped entries are historical migration inputs until realization_schema_version is 1. No type or realization admits strings or modifies accepted membership.

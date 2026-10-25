# v5 research evidence registry — Prompt 20

Status: **BLOCKED for linguistic certification and production changes**.

The implementation extends the exact Prompt 19 source baseline `33a47d1164724cd614f836005be2735e05a9b4d6`. The preceding integration PRs remain dependencies; this report does not certify that they have merged into main. Production data and association calculations are unchanged.

## Complete corpus view

`EVIDENCE-REGISTRY.json` defines a deterministic, content-addressed view over every physical membership in the archived lexical mapping registry. All 1,536 compressed mapping parts were physically read and checksum verified. All **10,078,319** memberships retain their original family, language, lemma ID, ordinal, record SHA-256, source commit and shard path. The view links to all source alternatives through the frozen native database hash and lookup key; signatures are not treated as semantic identities or independent votes.

| Language | Cases | Unresolved evidence |
|---|---:|---:|
| English | 2,619,261 | 2,619,261 |
| German | 2,205,038 | 2,205,038 |
| French | 1,143,061 | 1,143,061 |
| Spanish | 1,796,516 | 1,796,516 |
| Italian | 1,187,709 | 1,187,709 |
| Russian | 1,126,734 | 1,126,734 |

No corpus record currently has an independently certified lexical/sense binding: 816,045 have multiple possible source signatures and 9,262,274 remain otherwise unresolved. Therefore no membership/nonmembership conclusion is issued. Unknown canonical family resolution, normative element, segmentation and sense are explicit nulls, not guessed values. Native inflected forms remain in source rows but the parent lookup indexes canonical lemmas only; discovery completeness is not claimed.

The view is a complete unresolved register, **not ten million completed linguistic analyses**. Its archive dependencies are the nine exact private parts in `../lexical-identity-20261025/ARCHIVE.json`, whose full restore was performed in Prompt 19. No duplicate archive is required. The independent Prompt 20 replay uses that physically restored copy, imports no producer/model code, and checks all rows, part hashes and the full ordered case-ID digest. `INDEPENDENT-REPLAY.json` records the result. Independent storage-provider redundancy remains unestablished.

## Graph contract

`associativvordes/evidence_registry/model.py` returns exactly the four requested research statuses. Every strong case must have a complete source-scoped lexical entity, exact physical corpus origin, compatible input version, canonical family and normative element. Each positive path records direction, segmentation, component role, meaning bridge, exact source references and intermediate lexical entities. Compound components and context-specific national correspondences need separate verified proofs. The endpoint must bind the actual normative element. Inflection, unresolved homonym jumps, reversed direction, missing intermediate proofs and template reuse for another origin are blocked.

Documentary references require a pinned source/version/license/locator and independent content-bound review of the exact assertion. Caller-configured review receipts are trusted verifier outputs, not fields a case can approve for itself. This module does not create those reviews or pretend to perform human adjudication. Case-completeness review is required to rule out unexamined alternatives. A negative result additionally needs an independent sufficient refutation covering the entire scoped membership; disproving one path, absence of support, or membership in another family is insufficient. Reviewed opposing analyses retain `CONFLICTING_EVIDENCE`.

The graph validator is a **research interface**, not a replacement for the installed normative resolver. It cannot publish an approved decision or authorize mutations. The existing decision, operation and release gates still require their actual normative/history checks and verified lexical mappings. The component and its data dependencies are included in the unified version contract; source/schema drift blocks compatibility. Receipt ingestion for new real human reviews remains future work requiring the established verifier trust boundary.

## Queues and actual evidence

The finite semantic queue supplies **67 exact scoped cases grouped into 23 hypotheses**. `HYPOTHESES.ndjson` preserves original dictionary analyses and source references without upgrading old `DOCUMENTED` labels into fresh proof. Each application remains unresolved separately. Grouping does not authorize other records.

`QUEUE-COVERAGE.json` inventories stage 06–10 manifests and available finite records with exact local hashes. Large surface, morphology and boundary payloads were **not freshly restored or replayed in this stage**. Their historical counts are not reported as newly processed evidence. The all-corpus view covers their memberships but does not replace their analyses. Full queue-specific ingestion is an explicit blocker.

`RAW-SOURCE-REPLAY.json` independently rechecks the bytes and sizes of all **35** pinned morphological inputs. `SOURCE-PROVENANCE.json` preserves per-artifact source locks and licenses. GLeMM 2.0 explicitly uses MorphyNet and Wiktionary-derived inputs; they are not independent confirmation. UDer licenses apply per resource. GLeMM's pinned local license declares CC BY 4.0; MorphyNet's README declares CC BY-SA 3.0. These declarations are not blanket legal clearance for redistributing all derivatives. Fresh GLeMM web access failed with HTTP 502; cached pinned bytes do not prove current upstream availability.

Five primary-page assertions were freshly checked in `FRESH-SOURCE-FACTS.json`: auditory, healthy, waterway and probing senses of English sound, plus French adjectival net. These are bounded dictionary facts, not certified v5 membership. The American Heritage auditory path reaches Latin sonus; its healthy adjective has a different Old English source. The French Academy derives its adjective net from Latin nitidus. These distinctions prohibit transferring a conclusion by spelling alone. The inherited Oxford waterway analysis and American Heritage analysis remain distinct; their compatibility is not adjudicated here. No unobserved dictionary entry or citation was invented.

Only structured paraphrases are retained from copyright dictionaries. Their hashes authenticate these records, **not original publisher page bytes**. Raw licensed source capture and an independent linguistic gold review have not been established. `VERIFIED-HYPOTHESES.json` is consequently empty rather than falsely certified.

## Verification and remaining blockers

Adversarial tests cover polarity, independent approval, exact scope, unknown sense, per-record applicability, path continuity, inflection, direction, segmentation/role, compound components, national correspondences, evidence bytes/license, alternatives, schema and production namespaces. Full independent corpus replay and original morphology byte verification are separate from these contract tests. Tests use clearly marked synthetic identities, not linguistic gold.

Completion requires: verified corpus lexical/sense mappings; complete normative endpoints and historical/correspondence proofs; exact ingestion/replay of all stage 06–10 payloads; reproducible documentary captures under suitable permissions; independent linguistic review and bounded treatment of conflicting analyses. Earlier unresolved history and prior integration/release blockers are inherited, not waived. No irreversible operation is permitted on this registry alone.

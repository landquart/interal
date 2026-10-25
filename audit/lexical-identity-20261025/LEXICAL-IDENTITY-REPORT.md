# v5 lexical identity / POS / sense mapping — Prompt 19

**Full physical-membership inventory complete; linguistic binding certification BLOCKED.** This stage preserves all current records and produces a complete unresolved registry. It does not certify that any original v5 carrier has been linked to a particular dictionary sense.

The data producer is pinned at `f085ecce623f687b9e50fd9a70f481e6bffa39c6`, above normative integration #701. Data generation began at #701 with the new mapping implementation uncommitted; that fact and the exact producer file/function hashes are retained in `IMPLEMENTATION.json`. Subsequent proof-reader hardening requires an operator-configured verified database fingerprint and source-lock version. The archive's producer revision is not a substitute for the final consumer implementation/version contract. No data release or merge is authorized.

## What the old identifiers mean

`stableLemmaId` hashes language plus normalized/lowercased spelling. Its input contains no source, POS, lexical sense or usage context. It is a language/spelling carrier key. A matching ID cannot independently certify a sense or distinguish homonyms. Frequency-file/category IDs in v5 `sources` remain frequency provenance, not dictionary-native lexical IDs. Old IDs, spelling, source fields and source records are retained without replacement.

The actual pinned v6 head archive was inspected: 18,602 heads, comprising 18,360 `legacy_exact_record`, 124 `historically_reviewed_lexical_head`, and 118 `lexical_head`. These labels are not a universal source-native sense system. Historical-review and unspecified-sense labels are preserved; no v6 head is automatically promoted into a v5 sense binding. See `SOURCE-MODEL-AUDIT.json`.

All 35 locked UDer/GLeMM/MorphyNet artifacts were physically recovered and hash-verified. They contain 9,404,068 input rows: 9,404,044 parsed rows and 24 explicitly quarantined rows. The source index preserves 12,716,787 endpoint observations. Source-identified UDer keys and source POS are retained. GLeMM/MorphyNet generated row/role IDs remain observation IDs; they do not establish native lexical identity. In the inspected harmonized en-WordNet rows, `lemid` is `lemma#POS`, with no synset/sense binding to v5. Dataset naming supplies no missing sense identifier.

The index preserves all GLeMM definition occurrences and their raw locators, plus the existing frozen packet of 32 documentary dictionary senses with publisher sense locators, source refs, POS and glosses. These are source-side alternatives, not corpus bindings. Original assignments, original Kaikki bytes and the historical candidate-generation index remain unavailable. No substitute original provenance was invented.

## Identity model and statuses

A normalized identity is the complete tuple:

`language + source + source_version + lemma + POS + lexical_identity + sense + context`

Source, sense, context and POS distinctions remain in the content identity. Unknown fields remain null. Homonyms and identities in different sources are not merged by spelling. NFC/casefold lookup is used only to discover possible source occurrences; it is not a lexical or semantic equivalence operation. Every native occurrence and its source row/role/hash remain accessible. Unbound source-signature grouping is explicitly a candidate container, not a merged lexical identity or independent evidence vote.

The model supports `EXACT_IDENTITY`, `SUPPORTED_MAPPING`, `MULTIPLE_POSSIBLE_IDENTITIES`, `UNRESOLVED`, and `INCOMPATIBLE`. Exact identity requires a complete declared source-native identity and independently verified proof. A reviewed cross-source/context mapping can be supported without falsely calling it exact. An incompatible **mapping** never authorizes deletion of a family member. Neither zero candidates nor one spelling candidate becomes a rejection or confirmation. No most-common sense is selected.

`MappingReviewer` prepares finite proposals from actual locked source facts. The caller must configure the expected database SHA-256 and source-lock SHA-256. Unknown schema/version and altered databases are rejected. Unbound morphology rows cannot be converted into complete sense targets. An independent verifier must approve the content hash of the entire origin/target/context/evidence proposal. The proposed object never supplies its own authority.

Before normative membership confirmation, `v5_contract.policy.decision` now requires an independently configured, content-bound lexical mapping. It checks the exact decision scope, full lexical/POS/sense/context identity, target-source bytes, source origin/ordinal/hash and current version contract. The approved registry, semantic adjudication, human quality pipeline and nonempty operation gates inherit this boundary. Unconfirmed or stale mappings remain blocked even when the other normative evidence checks pass. Each versioned operation additionally carries the exact `source_record_ref` and `lexical_binding_sha256`; reusing a proof for another original ordinal is rejected. Declared semantic/review/operation POS must match the verified target POS.

## Full physical corpus

The exact `47723611112610945cb09b34e18588b7bd151911` source tree was restored. All 2,048 gzip shards and metadata were checked against pinned Git object identities and SHA-256. Every physical membership is represented by its original family, language, lemma ID, ordinal, spelling, canonical-record hash and source-file locator/hash. Duplicate physical records are retained, not deduplicated into decisions.

| Language | Physical memberships | Multiple possible source identities | Unresolved |
|---|---:|---:|---:|
| en | 2,619,261 | 239,253 | 2,380,008 |
| de | 2,205,038 | 96,690 | 2,108,348 |
| fr | 1,143,061 | 104,413 | 1,038,648 |
| es | 1,796,516 | 95,348 | 1,701,168 |
| it | 1,187,709 | 97,395 | 1,090,314 |
| ru | 1,126,734 | 182,946 | 943,788 |
| **Total** | **10,078,319** | **816,045** | **9,262,274** |

`EXACT_IDENTITY = 0`, `SUPPORTED_MAPPING = 0`, `INCOMPATIBLE = 0` in this production-source inventory. All 10,078,319 records remain blocked for irreversible operations. The ambiguity count measures alternative source signatures, not independently established homonym prevalence. Many signatures may share upstream data or refer to the same eventual lexeme; their counts are never votes.

The denominator is the current physical membership tree, not the historical 14.9-million membership report or the manifest's 4,924,980 original-generation lemma count. Missing original assignments prevent certification of the original complete lemma inventory. They are not reconstructed from membership rows.

The projection streams one family list at a time and uses disk-backed exact history lookup. The source index streams source rows and uses SQLite, bounded caches and disk sorting. Mapping uses 1,536 compressed language/bucket parts and a bounded lookup cache. Measured peak RSS: about 56 MiB for original projection and 124 MiB for registry construction; the complete corpus is never loaded into RAM. Independent origin checking loads one bucket at a time.

Priority flags preserve formal/surface-review signals, large families (engineering priority threshold: 100 rows), competing component bases, exact historical negative/unresolved scopes, multiple source alternatives and POS ambiguity. Priority is not a linguistic decision. Historical removals are used as exact review context and are not restored.

## Independent verification and quality limits

A separate verifier imports neither the producer nor its parser/model. It checks all output/input part hashes, every mapping status and **the complete original physical identity sequence** (family, old ID, ordinal, spelling) against independently decoded source buckets. All 10,078,319 origin identities were replayed. It additionally compares full canonical source payload hashes for 600 deterministic language/status-stratified records.

The independent source-format sample covers 431 endpoint observations across all 35 morphological artifacts and the dictionary packet. It reconstructs source row hashes, POS extraction and source-scoped observation IDs independently: zero projection errors were observed in that sample. Full source-declared language alignment and native-key conflicts are audited separately. This is engineering conformance, not linguistic gold.

Final mapping identity-error, POS-binding-error and sense-binding-error rates are **unknown/not estimable**, because no independently approved corpus mappings or human sense gold exist. Reporting these rates as zero would be false. Source POS extraction is not certified corpus POS, and a documentary source sense is not a certified corpus sense. See `INDEPENDENT-NATIVE-AUDIT.json`, `INDEPENDENT-CORPUS-AUDIT.json`, `LANGUAGE-AND-NATIVE-ID-AUDIT.json`, and `COVERAGE-REPORT.json`.

The full normative E2E exercises explicit TEST_ONLY mapping-verifier fixtures. Those fixtures create no production mapping, gold or write permission. Real production proposals remain blocked by identity uncertainty and the parent historical/provenance gates. Definitions, thresholds, Di, Pr, Sh, SWOW, A, F, P, FAv and FAₐ are unchanged.

## Deliverables and durable recovery

The private archive contains the complete native/dictionary SQLite index, all source occurrence locators, all 1,536 mapping parts, the complete unresolved view, input locks, hash manifests and independent audit receipts. It contains no credentials, private keys or new personal annotations. Raw corpora retain their original license restrictions; private archiving is not permission for public redistribution.

`REGISTRY.json` and `UNRESOLVED-REGISTRY.json` in Git are the complete part/hash indexes. Full rows are in the private archive referenced by `ARCHIVE.json`. A `/tmp` path is not a durable locator. All nine saved parts were reacquired, hashed, joined as a seekable byte stream and fully restored into a new directory. Every listed object was checked byte-for-byte and SQLite passed `integrity_check`. The cold restore did not use the original work directories. An independently verified second-store backup of this new archive is **not established**; parent source-recovery limitations remain explicit.

The read-only registry can be used to inspect any proposed correction's exact source record and every possible source identity. It cannot supply a missing corpus sense or approve a change. An independently reviewed binding is still required before final membership admission. This stage completes the explicit-status inventory and implements the binding mechanism; it does **not** complete mass semantic identity establishment or release certification.

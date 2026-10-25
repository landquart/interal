# Historical decision preservation report

Status: **BLOCKED — semantic coverage is not certified.** Production is unchanged. This is a reviewable preservation foundation, not completion of Prompt 02.

The actual main observed for this work is `47723611112610945cb09b34e18588b7bd151911`. PR #679 (normative definitions) and PR #680 (v5 baseline) are separate unmerged prerequisites. V6 research is pinned to `9fff76431a86a06df6db69b64d7f2ca4c871f1b7`; first complete v5 materialization is `ee6637b266f4bbb4acd77cccf597ed75b2b44aef`.

The source inventory covers 2,578 unique blobs (565,031,440 bytes) from the documented discovery roots, including historical deleted versions. It indexes 1,187,041 structural observations in 354 source documents. These are nested source observations, **not 1,187,041 independent linguistic decisions**. Raw fields, original statuses, evidence, exact reviewed lists and historical supersession claims remain reproducible by blob and pointer.

Seventeen materialization commits contain the 29 provenance repair operations. Exact before/after bucket comparisons recover 347,760 removals and 2 additions, matching the certified v5 repair arithmetic. They also recover 120 removed reverse-alias pairs and 3 added pairs; these include deletion of entire empty-family routes and consolidation changes, not just the 21 net and 12 val routing exclusions. Alias changes never become lexical membership exclusions. The normalized snapshot contains 279 engineering delta records and 266 v6 research baseline records (545 total). IDs are content-derived and imports are idempotent.

`HISTORY_CONFLICT.json` contains 358 source-level holds: 354 sources with uninterpreted scope/authority observations and 4 unparsable historical versions. A source-level hold does not assert that all its observations contradict one another. No oldest/newest record is silently discarded.

The malformed versions are three historical `staging-network-benchmark.json` blobs and blob `ded40a7e4a12ae7b5a8b6e8b01d80b973502aeb9` of `prompt09-shadow-20261007/research.json.gz`. The latter was introduced at `97a8ff9c680c1ee74734401c42e794845072431f` and replaced at `b5cf9fc92d2b0d1b2b25caa636d0efc228b163ef`. This is historical transport damage, not a claim that current production buckets are damaged. The archive preserves both historical bytes and subsequent versions; old source files are not repaired in place.

PR #629–678 metadata was retrieved independently and pinned in `PR-HISTORY-LOCK.json`. PR titles/body summaries do not determine any decision; actual Git source blobs and exact data diffs do. The inventory includes existing EVIDENCE-AND-VERDICTS policies, review code, v6 corrections, frozen review artifacts and historical risk acceptance. The current normalization does not convert these wholesale into manual/gold verdicts.

## Blocking work still required

1. Implement and review scope/authority adapters for remaining source formats, including v6 lexical/head/family journals, positive controls, manual exclusions and explicit grants/revocations. Preserve every historical status while distinguishing evidence, binding, relation, membership and alias domains.
2. Reconcile conflicting scope/version claims and family-ID changes into explicit adjudicated supersession chains. The canonical nitidus consolidation, already removed members and changed alias routes must not imply general family equivalence.
3. Import any authoritative external human review journal stores and frozen snapshots. Their location/content is not contained in this Git capture; absence is not proof that none exists.
4. Integrate the guard into every future mutation/proposal entry point, including standalone v6 tools and retired cleanup scripts if anyone intends to execute them. Current enforcement covers preannotation and controlled-release preview/apply only.
5. Repeat a complete semantic coverage audit before changing the blocked state. A boolean edit cannot override indexed observations/conflicts. Independent linguistic gold must be supplied/verified separately.

The conservative hold is intentional and prevents accidental restoration now, but it also blocks unrelated changes. It must not be described as a completed fine-grained historical resolver. Structural preservation and restored hashes do not establish linguistic correctness.

## Completed preservation follow-up

All 1,187,041 indexed observations were replayed from the 354 source documents; every JSON-pointer payload hash and document observation digest matched. Each now exposes the full common decision envelope, original status/claim, raw scope, evidence references, authority claim and declared supersession. Unresolved authority stays UNDETERMINED; a source assertion is not promoted to manual/gold truth. See SOURCE-OBSERVATION-REPLAY.json. Exact normalized constraints are returned even when unresolved broader history holds an operation.

Seventeen active legacy mutation entry points are now fenced before any write. Historical replay remains available from the exact historical Git versions in an isolated restoration. New mutations must use controlled release and its finite history checks. The 23 history tests include actual execution of all 17 fences and verify no target is created. Current read-only analysis can proceed with HISTORY_CONFLICT queues; semantic adjudication and release authorization remain blocked by the recorded holds.

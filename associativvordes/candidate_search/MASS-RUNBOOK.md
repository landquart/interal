# Full-registry candidate discovery

Run from the repository root with Python 3.12. Keep databases, corpora and exports outside the checkout. This workflow changes review proposals only. No command grants membership, creates canonical family IDs or edits production formulas.

## Inputs

Use the complete certified source index, certified staging release and v5 frequency projection from [the corpus runbook](../../audit/associative-external-preparation/FULL-CORPUS-RUNBOOK.md). Source revisions and SHA-256 remain in `data/morphology-evidence/sources/source-lock.json`. Never replace unavailable inputs with excerpts.

The approved v6 input revision is `9fff76431a86a06df6db69b64d7f2ca4c871f1b7`; its exact Git blob pins come from `evidence_graph/prepare_registry.py`. These archived v6 files are not present in the current main tree. Its actual registry has 19 canonical families, including all 12 requested difficult families. The millions of v5 families are a separate inventory workload. The legacy revision below pins existing manual controls and frequency context, without promoting v5 inventory into new v6 canonical families.

```sh
git fetch --depth=1 --filter=blob:none origin 9fff76431a86a06df6db69b64d7f2ca4c871f1b7
python3 associativvordes/candidate_search/mass_registry.py \
  --repo . --legacy-revision 0c167fcd8a17cfaf433c37f68e89ba7f2ee0ceae \
  --destination /external/mass02/registry
python3 associativvordes/candidate_search/mass_source.py \
  --index /external/source-index/index.sqlite \
  --release /external/certified-release \
  --registry /external/mass02/registry/registry.sqlite \
  --source-lock data/morphology-evidence/sources/source-lock.json \
  --destination /external/mass02/aux
python3 associativvordes/candidate_search/mass_run.py \
  --index /external/source-index/index.sqlite \
  --registry /external/mass02/registry/registry.sqlite \
  --aux /external/mass02/aux/aux.sqlite \
  --project /external/project-index/project.sqlite \
  --source-lock data/morphology-evidence/sources/source-lock.json \
  --output /external/mass02/search --all
```

`REGISTRY.json`, `AUX.json`, `INDEX.json` and `PROJECT.json` must accompany the databases. Every invocation checks their full SHA-256. Auxiliary preparation additionally verifies staging product checksums and counts. The reverse index uses native endpoints; inflections are a separate owner lookup, never arcs. The small range inventory handles source partitions interleaved by an interrupted index build. Auxiliary preparation resumes completed transactions under an exclusive lock. Registry preparation uses a fresh versioned destination; decoded shards have hard size limits, and its declared process budget is 1 GiB. The source graph remains on disk, with 8 MiB per SQLite connection and a 128-record LRU.

## Scopes and budgets

Append `--family OCUL`, `--families OCUL PEDE MANU`, `--language ru` or `--languages en de fr es it ru`. With no family selection, all actual families are selected. Aliases resolve against registry data; unknown or ambiguous IDs fail. PEDE resolves to `family:ped`.

Defaults per family/language: four seeds per role (head/member/accepted finite allomorph/nonaccepted head), two native analyses per source and seed, eight arcs per relation class and endpoint, depth two, twelve frontier states per path class, eight inflections and four frequency observations per seed/word. `--limits '{"seeds_per_role":2}'` can reduce bounds. Increasing tested maxima requires a code change and a new resource measurement. There is no shared global language or source quota. All finite memberships remain queryable even when their seed expansion is omitted.

`discovery.ndjson` records budget exclusions, cycles, blocked expansions, language exclusions and unexpanded depth states. Counts at different limits overlap; depth states are not a count of missing words. `LAST-RUN.json` reports selected/available seeds, examined/available arcs, candidate observations, grouped duplicate observations, categories, time, RSS and disk bytes by unit and language. Full registry scope does **not** mean exhaustive lexical recall. Omitted seeds and native analyses are explicit coverage limits.

## Review and replay

Dry-run is the default and writes `preview.sqlite`. Add `--prior-queue /external/old/queue.sqlite` to retain prior decisions while keeping the input queue read-only. Add `--write-queue --queue /external/review/queue.sqlite` only when writing proposal state is intended. The same stable ID policy as the existing queue groups family/language/spelling/POS; it does not merge lexeme or sense identities. Rejections survive reruns and POS changes. Prior unassigned base questions remain contextual evidence rather than a global rejection in another family scope.

Seven overlapping category exports accompany `questions.ndjson`: `NEW_MEMBER`, `EXISTING_MEMBER_AUDIT`, `CONFLICT`, `POSSIBLE_BASE`, `IDENTITY_UNRESOLVED`, `NEGATIVE_HISTORY`, `LOW_EVIDENCE`. Each question carries native analyses, family/head/membership references, original source IDs, physical row locators and hashes, claims, paths and prior decisions. Source counts and priority scores are heuristics; independence and correctness probabilities remain unknown. GLeMM direction is unknown. Unknown/orthographic/inflection observations cannot become productive chains. Productive chains require the same native endpoint ID, same language and no blocking decision. Proposed bases remain within an existing family question scope.

`--stop-after 1` commits one unit and stops before export publication. `--resume` or `--changed-only` reuses matching family/language fingerprints. Local family inputs and spelling-overlap dependencies invalidate affected units; source, frequency, policy or limit changes invalidate all selected units. Full database checksum reads still occur on an unchanged run; their cost is included in timing. Checkpoints commit questions, active scope, events and stats together. Inactive questions and history remain in the database.

The auxiliary inflection projection is scoped to all registry owner words. Changes to that word set require a fresh auxiliary version and a streaming staging scan; the large native source index is reused. Decision-only or other changes preserving the owner set can reuse it. This preparation cost is separate from incremental family discovery and is reported rather than treated as free.

Review uses the existing `Queue.decide(question_id, state, reason, actor)` API with `rejected`, `reviewed`, `split_required`, `deferred` or `open`. There is no `accepted` state. Review state never writes memberships. Export ranks new/deferred questions first, then reviewed, then rejected/split; each group uses the experimental priority and stable ID. Missing frequency stays `unknown` with `rank: null`.

`CURRENT.json` selects an immutable checksum manifest under `releases/`. An interrupted export cannot replace it. Keep previous versions; `python3 associativvordes/candidate_search/mass_recover.py --output /external/mass02/search` verifies and restores `PREVIOUS.json`, even if CURRENT is damaged. This selects an export and does not undo reviewer history. For independent replay, use a fresh output directory with the same verified inputs and compare all NDJSON hashes. Preserve small receipts with the code; archive full exports and review databases outside Git in durable storage.

```sh
python3 -m unittest discover -s associativvordes/candidate_search -v
```

CI discovers `test_mass.py` through the existing corpus certification workflow. Its pinned real excerpts test native chains, ambiguous direction, inflection separation and provenance. Explicit adversarial registry/endpoint mutations test false stems, homonym and sense overlap, conflicting families, negatives, unverified POS, cross-language rejection, rollback and queue recovery; they never stand in for a full corpus run.

For independently timed small, 12-family, all-family, fresh replay, unchanged and interrupted/resumed runs, use `mass_benchmark.py` with the same five input arguments as `mass_run.py` and a fresh external `--output`. It records each run in a separate process and fails if export versions differ or unchanged units are rediscovered. It does not fabricate hundreds or thousands of canonical v6 families to inflate the 19-family workload. Those larger inventory stages remain the measured stage-01 v5 benchmark.

## Full validation with an offline GLeMM cache

The complete runner accepts the existing attributed `GLeMM-2.0-39502017.zip` cache. It verifies the cache against the original GLeMM lock and verifies that its artifact IDs, revisions, sizes and SHA-256 agree with the combined source lock before use. Other source files are downloaded or checksum-verified from their existing local cache. An unavailable server never authorizes a different version or excerpt substitution.

The certified runtime is **Python 3.12.3, SQLite 3.45.1, Unicode 15.0.0 and zlib 1.3**. The importer includes these versions in every build ID. `build` and `verify` reject a different runtime before expensive work; installing Python 3.12.3 alone is insufficient if its linked SQLite or zlib differs. Use the original Ubuntu 24.04 runtime or the exact verified equivalent.

Run the following phases with that same Python executable, from a fresh checkout and an external work directory with at least 32 GiB free. Fetch both approved Git revisions described above first.

```sh
python3 associativvordes/candidate_search/mass_ci.py --work /external/mass02 \\
  --phase inputs --glemm-cache /external/GLeMM-2.0-39502017.zip
python3 associativvordes/candidate_search/mass_ci.py --work /external/mass02 --phase build
python3 associativvordes/candidate_search/mass_ci.py --work /external/mass02 --phase verify
python3 associativvordes/candidate_search/mass_ci.py --work /external/mass02 --phase collect
```

Omit `--glemm-cache` for official network acquisition. The build starts the index follower only after certification publishes its first atomic checkpoint. Final `receipts/COVERAGE.json`, `BENCHMARK.json`, `VALIDATION.json` and `MASS-CANDIDATE-DISCOVERY.md` are produced only after full verification; input or index preparation alone is not a completed mass-search measurement.

Preparation can be repeated after interruption: a completed registry is reused only if its database SHA-256, approved v6 revision, legacy revision and registry-policy hash all match. Source partitions, source index transactions and the frequency projection retain their existing checkpoints. Use persistent storage (or a saved filesystem snapshot) for long remote jobs; process state alone cannot survive VM shutdown. Run the benchmark phase in a fresh benchmark output directory when repeating an interrupted validation experiment; retain prior review queues and receipts separately.

## Разметка экспортированной очереди

Для последовательной проверки вопросов, слепой второй разметки, арбитража и
версионированных решений используйте [интерфейс разметки](../review/RUNBOOK.md).
Он импортирует проверенный `exports/MANIFEST.json` и `questions.ndjson`, сохраняет
собственную историю вне production и не применяет одобрения к семьям.

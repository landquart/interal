# План последующей реализации архитектуры

Спецификация `external-morphology/1.0-draft`, 18.10.2026. **Этот план не выполняется в текущем этапе.** Текущий результат — только пять Markdown-документов; нет новых импортёров, schema-файлов, DDL, тестовых модулей, membership dossiers или production изменений.

## 1. Решения, принятые проектированием

- Новые Lexeme/Sense/Relation/Evidence/Verdict и source/alignment инфраструктура изолированы от accepted Family/Head/Membership V.
- Family/Head IDs и конечный generator V переиспользуются; существующие snapshots не переписываются.
- Source lineage DAG и semantic Relation graph разделены. Совпадения зависимых данных не становятся majority vote.
- Accepted extraction, accepted linguistic relation и accepted membership — разные domains; precedence не переносится между ними механически.
- Directed/undirected/unknown и десять core relation types имеют строгие validators; extension по умолчанию не участвует в membership.
- Authoritative negative lookup выполняется независимо от retrieval/fallback и от нового spelling/source/head ID.
- Raw и normalized данные content-addressed, индексы производные; verified decisions/families остаются в Git.

Нормативные документы: [архитектура](02-DATA-ARCHITECTURE.md), [сущности](ENTITY-SCHEMA.md), [taxonomy](RELATION-TAXONOMY.md), [lineage/решения](EVIDENCE-AND-VERDICTS.md). Примеры OCUL/REGUL/INTER — синтетические body-views, а не imported records или реальные новые аннотации.

## 2. Порядок будущих этапов

| Этап | Работа и допустимая область изменений | Выход / критерий завершения |
|---|---|---|
| P0 — design (текущий) | Только этот каталог документации; прочитать предыдущий аудит и проверить опорный код | Пять согласованных документов, source/code refs, варианты и выбранное решение; никаких functional diff |
| P1 — contracts | Новые isolated schemas/type registry/validators/fixtures; SourceRevision/Ref/Scope/hash policy | Nine entities и инфраструктура проверяются машинно; required/null/unknown rules; production trees неизменны |
| P2 — source registration | Только проверка canonical artifacts/releases/licenses/key policies; raw acquisition в отдельный CAS, если разрешено следующим заданием | Hash/availability/license manifests для каждого реально выбранного источника. Flexor до идентификации остаётся disabled; для других не нужен его готовый адаптер |
| P3 — isolated normalizers | Малые заранее ограниченные fixtures: сначала один источник, затем UDer/GLeMM/MorphyNet; Flexor после identity gate | Deterministic NDJSON/quarantine, raw locators, native type/order/POS, no automatic head creation. Даже malformed source не пишет принятые families |
| P4 — lineage + indexes | Read-only derived SQLite и inverted refs, duplicates/overlap; bounded disk sort | Exact record ancestry при наличии, dataset-level uncertainty при отсутствии; нет фиктивной независимости; повторный build logical-identical |
| P5 — alignments + review tasks | Corpus/source matching, альтернативы POS/sense, finite boundary candidates, status mapping | Exact corpus IDs/proofs сохраняются; unresolved не выбирается по confidence. Новые строки без corpus measurement не получают частоту |
| P6 — verdict resolver | Append-only decisions/trusted authority/scope overlap/predecessors; isolated manual review dossiers | Veto > allow; равный конфликт без latest-wins; stale locks/failure authoritative lookup → hold; автоматический импорт не выпускает reviewed разрешение |
| P7 — V bridge / projection_shadow | Новая bridge ветка с доступной pinned V архитектурой; full V loaders, finite scope, copies вне active generated tree | Независимый oracle совпадает; known OCUL/REGUL/INTER positive/negative fixtures; protected trees и текущие расчёты идентичны |
| P8 — отдельная оценка применения | Независимые linguistic annotations/holdout, policy review AC-013/015 при затрагивании runtime, performance | Документированный точный разрешённый scope/risk; не «весь словарь сертифицирован» |
| P9 — future reviewed application | Только отдельный явно порученный этап после acceptance; production rollout — самостоятельное действие | Exact finite differential/grants/rollback manifest; прежние snapshots сохраняются. Этот план сам по себе не разрешает P9 |

P1–P6 можно вести от M без merge v6: это standalone evidence layer. P7 не копирует V функции в новый конкурентный generator — использует их в ветке/изолированном checkout, где V действительно доступна. Выбор integration ref и включение цепочки #650/#651 решаются отдельно, не скрытой миграцией main.

## 3. Что переиспользовать, а что расширять

| Existing код | Использование в будущем | Недостающая работа |
|---|---|---|
| M `scripts/lib/frequency-record-stream.mjs::streamFrequencyRecords` | Bounded streaming/error подход | Отдельные TSV/graph normalizers: это frequency JSON parser, не готовый morphology importer |
| M `associativvordes/js/morphology/analyzer.js::parseDerivationalModel`, `discoverLexicalComponents` | Предложения сегментации/model comparison | Не повышать их confidence до lexical identity; сохранить alternatives |
| V `associative-family-v6-head-recognition.js::recognizeFiniteHeadBindings` | Exact approved identity/boundaries | External source alignment adapter, без implicit sense merge |
| V `associative-family-v6.js::validateRealizations/applyHeadReview/generateV6Memberships` | Existing typed realization/edge/membership | Dossier translation и metadata sidecar, не новая family graph |
| V `scripts/lib/associative-v6-lexical-review.mjs::loadLexicalReview` | Frozen grants/source hashes | External-specific subject/source/lineage locks и subject domain distinction |
| V `scripts/lib/associative-v6-head-lifecycle.mjs::replayHeadLifecycle` и `associative-v6-baseline-corrections.mjs::replayBaselineCorrections` | Finite extension/revision/negative overlay | Explicit translation NEW Verdict statuses, не прямое помещение raw Relation в accepted edge |
| V `scripts/lib/associative-v6-queue-organization.mjs::organize`, packet lifecycle | Очереди без потери questions/occurrences | Добавить external source frames/lineage/sense blockers |
| V `associativvordes/js/associative-family-v6-shadow.js::deduplicateV6CorpusRows` | Сохранить исходные измерения с несколькими proofs | External→corpus bridge, exact cache/index manifests |
| V `scripts/audit-associative-v6-independent.mjs` | Независимый finite oracle | Source/taxonomy/authority/lineage adversarial cases |
| M `candidate-index-loader.js::loadCandidateEntries`, `candidate-finder.js::findCandidatesForRoot` | Пока не подключать новые claims к runtime | EP-04/05: единый negative lookup и сохранение IDs/proofs перед eventual UI integration |

Runtime-файлы в строках с сокращённым путём находятся в `associativvordes/js/`. Existing modules V не становятся частью M оттого, что они названы в плане.

## 4. Проверяемые gates будущей реализации

### Identity и taxonomy

- Один spelling с разными POS/senses/source entry IDs даёт разные Lexemes/Relations, не разные доли F.
- На exact source release повторная extraction с тем же policy выдаёт те же semantic IDs/hashes; новая semantic policy не перезаписывает старый claim.
- directed(A,B), directed(B,A), unknown(A,B), undirected(A,B) различаются по ключам. Зеркальные source occurrences не создают reverse linguistic proof.
- compounding сохраняет все slots/roles/границы; form в inflection не создаёт новый derivational Lexeme.
- Неполный indirect path не дополняется string match; surface_similarity не устанавливает identity/family.

### Lineage и решения

- Exact GLeMM-like→MorphyNet-like lineage даёт correlated origins; dataset-level связь даёт possible correlation, а не ложные exact copies всех rows.
- Неизвестный upstream не объявляется независимым. Lineage cycles, missing raw/hash и unknown type не допускаются в разрешающий dossier.
- Reviewed manual prohibition блокирует matching scope через alias, новый source ID, changed proposed head, transport failure и stale negative index.
- Manual allow не снимает manual prohibition без explicit trusted revocation; изменение source release и новая hypothesis не могут выпустить такой отзыв.
- Equal-rank conflict остаётся needs_review/split_required. Evidence rejection касается evidence subject, а не автоматически всей Family.
- Concurrent review publication с одним predecessor допускает только один successor; второй должен перечитать source/grants, не force-write.

### Изоляция и расчёты

- Negative fixtures запускаются в disposable directories; отказ не меняет ни одного исходного registry byte. Unexpected writes — fail всего этапа.
- `git diff` защищённых v5, frequencies, shared methodology, runtime/UI и existing V trees пуст после любого shadow запуска.
- Изменяется только isolated projection/queue; existing memberships проходят exact carry-forward, external conflict лишь создаёт задачу.
- До/после на фиксированных M inputs совпадают F, один F-представитель каждой модели, max-five по P, language max-P/A и N-weighted итог.
- Несколько source observations/memberships не удваивают corpus measurement. Missing, истинный zero и unresolved sense frequency различаются.
- Legacy exact record не распространяется на новый descendant или изменённый lexical identity.

### Масштаб

- Малый fixture → один язык/один тип в ограниченном frame → bounded pilot. Полный corpus build допустим только после решения о масштабировании.
- Замерять parse/sort/index memory/disk, peak uncompressed bytes, lineage cache, cold/warm exact lookup и отмену; лимиты задаются manifest/job config, не выдаются за измеренный SLA.
- Deterministic NDJSON/manifest проверять byte hashes; SQLite logical export/query results отдельно от физического file layout.
- Manifest publication atomic; прерванный build не виден читателям и может быть удалён без потери reviewed решений. Raw GC удерживает все транзитивно referenced artifacts/grants/дossiers по manifests и retention, не по одному возрасту файла.

## 5. Совместимость без изменения production

Вначале только isolated artifacts, без UI controls, import statements в M, новых runtime defaults или family aliases. Family/Head/Membership используют pinned adapters, а не переименовываются. Частоты берутся только из существующих corpus rows; если записи нет — «нет corpus alignment», не искусственный ноль.

Новое accepted relation может быть интересно исследованию, но не должно появляться в пользовательском расчёте до самостоятельного integration этапа. Existing результаты сохраняются, потому что их входные деревья и M code paths не меняются. Даже исправление EP-04/05 либо AC-013/015 относится к будущему functional PR с отдельным совместимостным контрактом, не к этой документации.

Сохранённые baseline CI результаты: M Tests имеет независимый PH mater failure; M production audit — прежнее противоречие source/classified counts. Их нельзя чинить подбором новых family edges или ожиданий в рамках внедрения evidence layer. V последнего проверенного дерева имеет успешный strict gate; это не сертификат нового импортёра.

## 6. Definition of done design-этапа

| Требование | Достигнутый результат |
|---|---|
| Все девять сущностей | ENTITY-SCHEMA: назначение, required/optional, IDs, связи, integrity и versions; REUSE для V сущностей |
| Все десять типов | RELATION-TAXONOMY: arity/endpoints/direction/semantic parameters и nonmembership constraints |
| Provenance/source lineage | EVIDENCE-AND-VERDICTS: row/dataset dependence, неизвестность, независимость без voting |
| Пять состояний и ручной приоритет | Scoped domain resolver, revocation/adjudication/predecessor contracts |
| Формальное членство | Десять предикатов + finite dossier; no closure; отдельный legacy carry-forward |
| Хранение/масштаб | Raw CAS, normalized partitions, derived indexes, Git reviewed state, hashing/rebuild/atomicity |
| Совместимость | Изоляция по paths/snapshots, protected-tree hashes, неизменные UI/F/A/P/model selection |
| Примеры | OCUL positive finite, REGUL lineage/uncertainty, INTER similarity/veto; все помечены synthetic |
| Архитектурный выбор | Четыре варианта сравнены в 02-DATA-ARCHITECTURE §8; выбран additive claims/Git decisions/V6 projection |

Текущая проверка документов: валидность JSON snippets, локальные ссылки, наличие перечисленных path/symbols, согласованность enum/ID/scope/lineage правил и documentation-only diff. Функциональные tests, mass processing, paid model calls, index rebuild, merge и rollout в рамках этапа не выполняются. Публикация draft PR содержит документацию этапов 01–02; она не означает реализацию этого плана.

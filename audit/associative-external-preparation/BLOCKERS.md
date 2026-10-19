# Препятствия и риски интеграции

Проверка 18.10.2026; снимки M/V и CI приведены в [baseline](01-BASELINE-AUDIT.md). Перечисленные изменения — рекомендации для следующих этапов. В этом аудите они не выполнялись.

Уровни готовности: **D** — проектирование общей модели; **S** — изолированный staging внешних свидетельств; **A** — применение к реальным memberships; **P** — production integration. Ошибка может блокировать A/P, не препятствуя D/S. Не требуется сначала закончить весь словарь или исправить все независимые тесты ради проектирования.

## 1. Основные препятствия

| ID | Факт, подтверждение и риск | Что блокирует | Конкретная рекомендация / критерий снятия |
|---|---|---|---|
| EP-01 | V6 вне main: V `associative-family-v6.js::validateCatalog/generateV6Memberships` существует только в открытой цепочке #650/#651; #652 merged в #651, не main. M `FamilyIndexLoader` поддерживает v4/v5 | Использование v6 как уже доступного production API; A/P без выбранной основы | Зафиксировать ref будущей integration branch и контракт совместимости с M. Можно проектировать и вести отдельный staging от M; merge цепочки не является обязательным условием D/S и не разрешён этим аудитом |
| EP-02 | Нет общего external observation/relationship interchange. V `family-index-v6/schema.json::$defs.edge` — head→family, `$defs.lemma_head_link` — finite binding; M `associative-etymology-policy.mjs::TEMPLATE_RELATION_POLICY` — Wiktionary-specific | S до реализации минимальной схемы/валидации; A | Спроектировать отдельные source assertions с source lexeme IDs, типом/направлением, POS/sense, морфемными диапазонами, альтернативами, provenance и review status. Не расширять accepted family registry сырыми строками |
| EP-03 | Provenance есть для внутренних сборок, но нет единого external source/release/license/dependency registry: M `family-index-v5/manifest.json::provenance.input_lock`, V `build-associative-family-v6.mjs::inputs` — текущие source locks | Воспроизводимый S и публикация данных | До первого импорта фиксировать canonical URL, subresource, release/commit, checksum, license/attribution, upstream dependencies и importer version; каждый observation связывать с этим source revision |
| EP-04 | Неполная гарантия отрицательных решений: M `candidate-index-loader.js::loadCandidateEntries` catch → static/legacy; `annotateFamily` пользуется registry verified. Удаление membership в v5 не равно универсальному tombstone | A/P; любой staging, использующий этот fallback как подтверждение | Запроектировать authoritative verdict lookup с exact language/lexeme-or-corpus/family/scope/version; применять одинаково ко всем retrieval paths. Transport error не должен получать права rejected→candidate→accepted. Synthetic diagnostic baseline §7; не заявлена живая реинтродукция |
| EP-05 | M `candidate-finder.js::findCandidatesForRoot` теряет lemma/head/source-proof IDs и дедуплицирует spelling. V `shadow.js::deduplicateV6CorpusRows` сохраняет эти различия, но не подключён к page | A/P с доказуемым provenance; сравнение UI результатов | Отдельный adapter contract, сохраняющий corpus ID, head ID, edge version, source proofs, все конкурирующие analyses и membership reasons. Дедупликат измерений не должен удалять evidence |
| EP-06 | Corpus IDs не делят омонимы: M `stableLemmaId(language, normalized)`. V `decideLexicalRow` запрещает выдавать aggregate frequency за sense frequency; `recognizeFiniteHeadBindings` не принимает несколько конфликтующих heads на один вопрос | Автоматическое принятие при несовместимых analyses; A для таких случаев | Связать external lexemes/POS/senses с corpus aggregate через отдельные alignment records. Не менять старые lemma IDs и не делить F между значениями выдуманными долями; конфликт → unresolved/split_required в своём scope |
| EP-07 | Несколько authorities: M `associative-family-registry.js::VERIFIED_ROOT_FAMILIES` использует canonical pede и глобальные aliases, v5 shards материализованы отдельно; V catalog canonical ped и scoped realizations. V registry специально сохраняет v5 compatibility | P и смешанный runtime без явной версии | Сделать явный versioned adapter/route policy. Не удалять compatibility registry сейчас и не синхронизировать автоматически по строке canonical. Alias — lookup, не право на морфологическую замену |
| EP-08 | Низкоуровневая validation не заменяет full guarded loader. V `validatePromotionDecision` условно проверяет senses, `loadFamilyPromotions` добавляет exact historical grant; `loadLexicalReview` требует frozen source grants | A через новый import/application path | Новый путь обязан проходить полный source/sense/authorization contract. Сохранить F01–F04 adversarial assertions и добавить external-specific tests; не вызывать materializer напрямую |
| EP-09 | Нет независимого gold/precision/recall для новых external relations. M `audit/associative-family-v5/audit-summary.md` — insufficient evidence; V `audit-associative-v6-independent.mjs` проверяет finite oracle, не весь словарь | Утверждение «массовая разметка проверена»; A без оценки допустимого риска | Отдельная blind выборка по source/language/relation/ambiguity, positives/negatives/uncertain, held-out controls и adjudication. Структурные invariants и несколько совпавших источников не заменяют языковую оценку |
| EP-10 | Не зафиксированы поставляемые external releases/licenses; Flexor не идентифицирован; GLeMM repository недоступен при попытке (502). Первичные источники baseline §8 | Импорт соответствующего источника; распространение данных | Установить exact artifact/license до загрузки. Для Flexor нужен canonical URL/автор/release. Это не повод блокировать общую схему или выдумывать свойства ресурса |
| EP-11 | Масштаб: M `FamilyIndexLoader.load` cache не ограничен; V `loadParallelV6/searchV6` читает memberships целиком и фильтрует массив; V shadow cache до 32 resources по count; offline builder хранит maps/sets | Непроверенное массовое расширение и интерактивный P | Разделить offline ingestion и browser serving, stream raw данные, индексировать exact IDs/relations, установить byte/memory budget. Сохранить текущие source rows; сначала измерить малый fixed fixture, не повторять полный corpus rebuild ради предположений |

EP-02/03/10 — отсутствующие external компоненты. EP-04/05/06/07 — реальные границы существующего runtime, а не отсутствие всей архитектуры v6. EP-08 — запрет на ослабление уже исправленных guards.

## 2. Сохранение обязательных ограничений

| Ограничение пользователя | Фактическое обеспечение | Недостающая гарантия будущего подключения |
|---|---|---|
| Приоритет manual_override | M `family-index-loader.js::candidateEntries/hasManualEvidence`; offline `build-associative-exhaustive-family-index.mjs::applyExactControlOverride` | Проверять override независимо от доступности index и порядка внешних источников: EP-04 |
| Не восстанавливать отвергнутое fallback | При успешном alias lookup M `loadCandidateEntries` возвращает authoritative empty; `BLOCKED_RUNTIME_STATUSES` блокирует rejected/split_required | При ошибке transport существует другой путь; единый negative registry отсутствует: EP-04 |
| Unknown отдельно от rejected | V `EDGE_STATUSES` и `generateV6Memberships`: pending/uncertain не accepted; `packetStates` отдельно deferred/rejected_with_scope | Нужен явный mapping внешних unknown/absent/error/excluded. Отсутствие строки ресурса не отрицательное решение |
| Языково-зависимые алломорфы | M `allomorphVariants` фильтрует language; V `validateRealizations` требует scoped heads | Не подмешивать global aliases registry как proof: EP-07 |
| Формальное сходство отдельно от связи | V `proposeMorphologicalHeads`, `stemProposal`, `evidenceClusterSimilarity` — proposals/review only | Исходный external stem/regex/similarity не должен сразу создавать binding: EP-02/08 |
| Семейные данные в Git | M `repository-provenance.json::storage`, v5 static gzip; V `generated/manifest.json::artifacts`, deterministic builder | Future artifacts и решения хранить с versioned manifest в Git; внешнее кеширование не должно стать единственной копией reviewed decisions |
| Частотность/ассоциативность сохранены | M `frequency-loader.js::getFrequencyProfile`, `association-analyzer.js::calculateAssociationScore/calculateFinalScore/calculateFinalAssociation` | External counts/confidence не заменяют IPM и A; scope missing/zero требует решений отдельно |
| Один наиболее частотный представитель модели | M `candidate-model-family.js::selectHighestFrequencyPerModel/compareFrequencyRepresentatives` | При новых analyses сохранить выбор по F, не выбирать по source confidence или числу источников |
| До пяти моделей по итоговому весу | M `qwen-client.js::selectBestFinalModels`, `script.js::scoringCandidates`, `associative-state.js::MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE` | Не обрезать raw pool пятью строками до группировки; проверять неизменность max-five P на фиксированном входе |

## 3. Незавершённые вопросы прежнего аудита расчётов

Источник статусов: M `audit/associativvordes-calculation/ISSUES.md`, сверенный с фактическими функциями и CI. Старые заголовки отчётов не считаются текущим вердиктом.

| ID / вопрос | Проверенный код / evidence | Связь с интеграцией |
|---|---|---|
| AC-001/012, gzip и фактическое подключение | M `family-index-loader.js::createFamilyIndexFetch`; `candidate-index-loader.js::createCandidateIndexLoader`; `tests/associative-calculation-transport.test.mjs`; #659 | Исправлены и вошли в main. Не требовать повторного ремонта; будущие adapters должны сохранить transport |
| AC-002/003/005/010, numeric/status/persistence | M `association-analyzer.js::calculateLanguageScore/calculateFinalAssociation`; `associative-state.js::compactAssociativeState/restoreAssociativeState`; #659 | Исправления входят в M; не путать отсутствие A с нулём. Общий pass всего live процесса не заявлен |
| AC-004/006/007, lifecycle/manual races | M `script.js::invalidateActiveRuns/analyzeItem`, `candidate-task-registry.js` (task registry module), #659/#661 | Исправления присутствуют; prospective adapter обязан сохранять abort/run identity |
| AC-008/009, services/deadlines | M `shared/request-deadline.mjs::withRequestDeadline`; `api/qwen-analyze.js` handler; #659/#661 | Transport/semantic validation исправлены. Причина прежнего upstream 403 и доступ production review остаются непроверенными; это blocker live semantic acceptance, но не offline morphology D/S |
| AC-011, реальные нули / denominator | M `association-analyzer.js::calculateFinalAssociation`, represented фильтр `normalized>0 && associationNormalized>0 && count>0` | Открытая методология; не блокирует external observations, блокирует изменение знаменателя/объявление новой полной совместимости при затронутых zero cases |
| AC-013, candidate validation fallback | M `qwen-client.js::validateFinalCandidatesWithQwen/applyQwenCandidateValidation` с `failClosed:false` на runtime path | Принципиально относится к A/P: внешний морфологический proof нельзя объявить semantic approval. Согласовать local proof, operational error и обязательность Qwen; D/S не блокирует |
| AC-014, PH mater | M `tests/methodology-20260909.test.mjs::near`, строка 45, run 37994612465 | Независим от формата morphology. Не блокирует D/S; общий main CI остаётся красным и не даёт полный regression certificate. Expected число не подгонять |
| AC-015, selected/max-five vs all completeness | M `associative-calculation-runner.js` (execution completeness), `script.js::scoringCandidates`, `association-analyzer.js::calculateLanguageScore` | Не блокирует D/S; существенно для runtime A/P, когда новый source расширяет pool и добавляет missing F/P/A. Нужна явная область полноты |

Новые симптомы current CI: production `runViewport` сравнивает source и classified counts вопреки 699 сохранённым zero-membership IDs; это тестовый/метрический контракт, а не причина автоматически восстанавливать семьи. Исправление относится к отдельному этапу validation; offline schema design не блокируется.

Уточнение имён Qwen функций: проверять актуальные exports в M `associativvordes/js/qwen-client.js`; если source path меняется, использовать описанный control flow, не прежние номера строк аудита. AC-013 остаётся policy-вопросом, а не разрешением автоматически менять `failClosed`.

## 4. Что из старых v6 blockers уже снято

Исторические F01–F04 из V `FOUNDATION-READINESS.md` не являются незакрытыми technical blockers на V:

| Старый ID | Проверенное исправление | Ограничение вывода |
|---|---|---|
| F01 | V `scripts/integrate-associative-v6-reviewed-stage.mjs` требует четыре строгих boolean grants | Новый external CLI ещё не существует; он может заново внести обход |
| F02 | V `scripts/lib/associative-v6-lexical-review.mjs::loadLexicalReview` действительно читает frozen grants и проверяет revoked false | Проверка покрытия grant-файла без вызова loader недостаточна |
| F03 | V stage CLI загружает независимую frozen queue и сверяет language/root/word/status/ID до записи | Нужны external alignment/source checks, не stage против самого себя |
| F04 | V `loadFamilyPromotions` отклоняет отсутствие senses policy без exact historical grant | Не переносить historical compatibility на новую версию/пакет автоматически |

Подтверждение — successful final strict gate [run 37710521729](https://github.com/landquart/interal/actions/runs/37710521729), step 17; дерево V совпадает с прошедшим V-CI. Сохранённый `regul-20261008/validation/independent.json` содержит 50 pass / 0 fail в results; старый FAIL заголовок оставлен как исторический документ, не переписан этим аудитом.

Лингвистические рекомендации прежнего независимого исследования, например `personalverwalter/altersbestimmung → alter`, не закрываются успешными guards. V `audit/associative-family-v6/FOUNDATION-READINESS.md` (раздел реальных annotations) и `prompt10-independent-20261007/DECISION.md` и `audit/associative-family-v6/regul-20261008/WORK-REPORT.md` описывают ограниченные scopes; full linguistic certification=false. Они не блокируют изолированный ingestion, но проверенные manual decisions нельзя переопределять общим морфологическим правилом.

## 5. Лицензии и зависимость доказательств

Точные первичные ссылки — baseline §8; это не заключение о юридической совместимости конкретного будущего дистрибутива. UDer требует выбора подресурса с его условиями, MorphyNet README указывает CC BY-SA 3.0, статья GLeMM — CC BY 4.0 для v2.0. Условия release/archive и attribution нужно зафиксировать до публикации; Flexor остаётся unidentified. Нельзя автоматически приравнять лицензии статьи, исходного кода и данных.

Практическая схема provenance должна сохранять upstream ancestry: совпадение GLeMM/MorphyNet и текущего Wiktionary/Kaikki-derived evidence может иметь общий источник. Это мешает независимой проверке, если принимать majority vote по названиям ресурсов. Рекомендация — хранить source dependencies и в evaluation отделять независимые словарные/ручные доказательства от повторной упаковки одной записи.

## 6. Производительность и диагностика

V `build-associative-family-v6.mjs` использует in-memory heads/edges/corpus/maps и corpus-wide hashing; workflow `.github/workflows/audit-associative-family-v6.yml` на финальном CI выделяет Node до 6144 MB для audit/replay. V `regul-20261008/WORK-REPORT.md` сохраняет предыдущий OOM стандартного heap. Поэтому будущий external-scale ingest нельзя оценить по скорости 21 359 accepted rows: исходный корпус — миллионы записей.

V `loadParallelV6/searchV6` пока рассчитан на полный membership массив, `loadV6ShadowRuntime` ограничивает count кеша, но размер gzip/распакованной структуры различается. M `FamilyIndexLoader.load` держит успешные shards без LRU. Конкретная recommendation: offline stream + отдельный lookup index + ограниченный byte cache + измерение cold/warm/abort/error поведения на фиксированном размере. В этом этапе performance tests не повторялись.

Нужные diagnostics внешнего слоя: input/valid/quarantined rows по причине, тип отношения, language/POS/sense mismatch, дубли lineage, unresolved alignments, затронутые ручные решения, proposals против memberships, source-only diff и память. Отсутствуют именно external-specific контракты/метрики; существующие V queue/replay/source-lock механизмы переиспользуются.

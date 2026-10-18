# Повторно используемые компоненты

Проверенные снимки M/V определены в [01-BASELINE-AUDIT.md](01-BASELINE-AUDIT.md). «Использовать» ниже означает последующее проектирование/реализацию; в этом аудите ничего не импортировано и не применено.

## 1. Карта повторного использования

| Возможность | Существующий компонент и символ | Как использовать | Ограничение |
|---|---|---|---|
| Нормализация формы | M `associativvordes/js/search-normalizer.js::buildSearchForm/normalizeText`; `morphology/normalizer.js::normalizeForMorphology` | Lookup keys и обратимые морфологические диапазоны | Search transliteration/diacritics collapse не годится как identity омонима |
| Стабильный corpus key | M `scripts/lib/associative-family-graph.mjs::stableLemmaId` | Сопоставлять исходный агрегированный frequency record | Не включает POS/sense; external lexeme ID хранить отдельно |
| Частотные источники | M `associativvordes/js/language-source-descriptor.js::normalizeLanguageSource`; `frequency-loader.js::getFrequencyProfile` | Неизменные измерения и конфигурация источников | Это registry частот, не registry морфологии |
| Потоковое чтение | M `scripts/lib/frequency-record-stream.mjs::streamFrequencyRecords` | Повторить bounded streaming подход и обработку ошибок | Парсер специализирован на frequency JSON; TSV/графы требуют отдельных адаптеров |
| Сборка candidate данных | M `scripts/lib/associative-index-core.mjs::extractFrequencyRecords/mergeFrequencyRecord/calculateFrequencyScore` | Сохранять existing frequency contracts | Нельзя передавать туда число relations вместо IPM |
| Морфологические модели | M `associativvordes/js/morphology/analyzer.js::parseDerivationalModel/discoverLexicalComponents`; `morphology/morphotactics.js::validateMorphemeSequence` | Генерировать предложения/сопоставлять сегментации | Confidence и full coverage не подтверждают этимологию |
| Национальные алломорфы | M `morphology/data/root-allomorphs.js::ROOT_ALLOMORPHS`; V `associative-family-v6.js::validateRealizations` | Сохранить язык и тип реализации | Нельзя переносить языкоспецифический stem в глобальные aliases с правом membership |
| Отделение evidence | M `scripts/lib/associative-etymology-policy.mjs::RELATION_TYPE/templateRelations`; V `associative-family-v6.js::getEvidenceNode` внутри loader | Сохранять исходный тип и источник как свидетельство | Существующая policy — для Wiktionary templates, не универсальный cross-resource mapping |
| Lexical heads | V `associativvordes/js/associative-family-v6-head-recognition.js::validateLexicalFacts/recognizeFiniteHeadBindings` | После проверки превращать exact external/corpus alignments в finite bindings | Автоматический raw relation не становится accepted lexical fact |
| Поисковые предложения | V тот же файл `proposeMorphologicalHeads`; `associative-family-v6.js::stemProposal` | Separate candidate status без принятия | Не перезаписывать головы/семьи предложениям |
| Семьи и canonical решения | V `family-index-v6/catalog.json::families`; `associative-family-v6.js::validateCatalog` | Опираться на существующий typed catalog | Не создавать второй независимый authoritative family catalog |
| Решения по edge | V `associative-family-v6.js::applyHeadReview/generateV6Memberships` | Accepted/excluded/uncertain/pending, exact lemma scope, version | Это head→family, а не lexeme→lexeme relation interchange |
| Версии и ревизии | V `scripts/lib/associative-v6-head-lifecycle.mjs::loadHeadLifecycle/replayHeadLifecycle/lifecyclePredecessor` | Extension, reuse, revision с hashes и private copy | Не вызывать обходя source loaders/guards |
| Исторические исправления | V `scripts/lib/associative-v6-baseline-corrections.mjs::loadBaselineCorrections/replayBaselineCorrections` | Corrected overlay без удаления прошлых доказательств | Не превращать uncertain correction в rejected автоматически |
| Frozen authorizations | V `scripts/lib/associative-v6-lexical-review.mjs::loadLexicalReview`; `review-application-authorizations.json::bindings/reviews` | Exact source/decision grants и отказ до применения | Для новых external batches потребуется свой reviewed scope; старый grant не распространяется на новые записи |
| Очередь проверки | V `scripts/lib/associative-v6-review-queues.mjs::regroupCurrentReviewQueues`; `associative-v6-queue-organization.mjs::organize` | Свести exact вопросы по корпусу/семье/голове, сохранить occurrences | Дедупликация работы не означает подтверждение отношения |
| Пакеты кандидатов | V `scripts/lib/associative-v6-packet-lifecycle.mjs::reviewPacketLifecycle/packetStates` | Unreviewed/deferred/rejected_with_scope/partially_promoted | Это finite packets существующих frames; adapters external frames отсутствуют |
| Nonmutating partitions | V `scripts/lib/associative-v6-contamination.mjs` и `scripts/audit-associative-v6-contamination.mjs` (module/CLI) | Группировать риск/неопределённость отдельно от accepted | Не использовать загрязнённый pool как основание family merge |
| Новые finite families | V `scripts/lib/associative-v6-family-promotion.mjs::loadFamilyPromotions/materializeFamilyPromotions` | Лишь после dossier, formal continuity, positive/negative controls | Не импортирует внешний connected component целиком; historical compatibility grants exact-hash |
| Исходные измерения и dedup | V `associativvordes/js/associative-family-v6-shadow.js::loadV6ShadowRuntime/deduplicateV6CorpusRows` | Read-only исследование external coverage и сохранение frequency rows | Это shadow, не production page adapter; cache bounded по count, не byte budget |
| Загрузка Git-backed gzip | M `associativvordes/js/family-index-loader.js::createFamilyIndexFetch/FamilyIndexLoader.load`; `shared/request-deadline.mjs::withRequestDeadline` | Транспорт, raw/decoded gzip, отмена, deadlines | `FamilyIndexLoader` не универсальный графовый импортёр; policy fallback требует усиления |
| Проверка correctness | V `scripts/audit-associative-v6-independent.mjs` (independent CLI oracle); `audit-associative-family-v6.mjs` (structural CLI) | Проверять exact source/edge/link map независимо от materializer | Пройденный CI не делает external gold и не доказывает весь словарь |
| Статистическая оценка | M `scripts/score-associative-family-annotations.mjs` (CLI), `scripts/lib/associative-annotation-stats.mjs` (statistics module) | Отдельная blind evaluation, agreement/precision и uncertain | Нужны настоящие независимые labels, не совпадения нескольких Wiktionary-derived ресурсов |
| Сохранение методологии | M `candidate-model-family.js::selectHighestFrequencyPerModel`, `association-analyzer.js::calculateLanguageScore/calculateFinalAssociation` | Сохранить одного F-представителя, top-five P, N/пороги | Морфологические confidence не подменяют A/F/P |

Для runtime-файлов без полного префикса в последних строках: `associativvordes/js/`. Квалифицированные символы проверены чтением исходников. Модули/CLI, у которых нет экспортированной entry function, обозначены явно.

## 2. Чего таблица не означает

Универсального готового импорта UDer/GLeMM/MorphyNet/Flexor не обнаружено в проверенных M/V исходниках. M `scripts/lib/associative-etymology-policy.mjs::TEMPLATE_RELATION_POLICY.uder` — совпадение имени Wiktionary template; никакого read/parse UDer release этот ключ не выполняет.

JSON read helpers в V `scripts/build-associative-family-v6.mjs::read` и `loadParallelV6({readJson})` работают с существующими внутренними структурами. Они не валидируют внешние TSV, source-specific POS tags, направление отношения, external IDs и лицензии. Их можно использовать как техническую опору, но не объявлять импортёр уже готовым.

## 3. Минимальное соответствие будущих адаптеров

Это рекомендации, а не внесённая схема:

| Источник | Сохранить до принятия | К чему может подаваться после проверки |
|---|---|---|
| UDer | Source lexeme IDs, POS, edge type/direction, оригинальные графовые связи, subresource/version/license | Proposal relations; затем finite lexical identity/boundary review V |
| GLeMM | Обе стороны пары, категории, исходные stem/exponents и definition references; связь с MorphyNet/Wiktionary | Proposal evidence, сравнение моделей; stem не назначать автоматически canonical root |
| MorphyNet | Деривацию отдельно от флексии, исходные морфемы/тип, source/target POS, release и row locator | Проверка форм/моделей/конечных heads; inflection не создаёт новую derivational family |
| Flexor | Сначала установить canonical URL, автора, release и LICENSE | Пока отсутствует достаточное основание для source-specific mapping |

Основания по форматам и лицензиям — первичные ссылки в baseline §8. Совпадение MorphyNet и GLeMM нельзя считать двумя независимыми аннотаторами. Технический общий вывод: импортировать сначала **утверждения источников**, сохранять конкурирующие анализы, а подтверждённые memberships получать только через существующий reviewed v6 path.

## 4. Необходимый набор будущих контрактных тестов

Это недостающее покрытие, новые тесты в этом аудите не написаны:

- Round-trip каждого адаптера сохраняет raw IDs/строки, версии, direction/POS и rejected/unknown; malformed TSV/JSON/graph записывается в quarantine с причиной.
- Один и тот же external claim через два производных источника не удваивает уверенность или частоту; разные senses одинакового spelling не схлопываются.
- Manual acceptance/exclusion и split_required переживают transport failure, static/legacy fallback и повторный импорт; unknown не превращается в rejected.
- Национальный алломорф не переносится в другой язык; branch stem/inflection/query alias не становятся общей реализацией.
- Обработка external records не меняет Git trees v5/frequency data и accepted v6 до отдельного application stage.
- Page adapter сохраняет corpus/head/edge-version/source-proof IDs; несколько memberships одной frequency row не дают повторного вклада.
- F-представитель, top-five P, missing/zero, review/completeness и итоговые N-веса совпадают с фиксированными M входами.

Переиспользовать negative controls из V `tests/associative-family-v6-{head-recognition,realizations,senses-policy,head-lifecycle,stage-authorization}.test.mjs`, а не ограничиваться snapshot-тестом импортёра на нескольких корректных строках.

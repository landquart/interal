# 08. Независимая верификация готовности

Дата: 2026-10-19. **Массовая разметка — NO-GO. Сравнительный автоматизированный пилот — NO-GO до исправлений. Сбор независимой ручной разметки по замороженным tasks — условный GO.** Найдены четыре воспроизводимых дефекта. Функциональный код и данные не исправлялись.

## Проверенные снимки и remote

Обновлены сведения remote и PR #662–667; повторная проверка после восстановления среды подтвердила неизменные SHA. Main: `39d8a47d2588b55c4c750cdd9985b5d6ba26ec73`. Исследованный head #667: `cb2d009bebe29147cdecc62f228f5ffe70451fcb`, дерево `aa82e59b5902b9ec7a81ca46a7f1d9319ed6a33d`. Все PR #662–667 открыты и не merged; #662 объединяет этапы аудита/проектирования. Квитанции — [REMOTE-CI.json](verification08/REMOTE-CI.json).

Полный Git diff относительно main: **267 добавленных файлов, 0 изменённых и 0 удалённых**. Все 7297 прежних tracked файлов сохранены. Отдельно совпали tree/blob IDs v5, JS, scripts, shared, API, workflows, package и deployment configuration. [PROTECTION.json](verification08/PROTECTION.json). Это подтверждение статической сохранности; оно не доказывает исправность live deployment.

Сопоставлены архитектура, отчёты этапов 01–07 и реализация. Перечень 32 исходных Markdown с SHA и разделами — [REPORT-INVENTORY.json](verification08/REPORT-INVENTORY.json). Прежние заявления и зелёные тесты не принимались как достаточное доказательство. Новые controls написаны отдельно, без использования test helpers предыдущих исполнителей. Это повторная техническая проверка в той же сессии, не внешняя лингвистическая сертификация.

## Матрица подсистем

PASS относится только к указанному свойству, а не к правильности всех морфологических решений.

| Подсистема / свойство | Статус | Доказательство и ограничение |
|---|---|---|
| Источники отделены от семей | PASS | Новые Python CLI не подключены к runtime; существующие файлы неизменны |
| Evidence не равно membership | PASS | Внешние records unreviewed, граф/путь/очередь возвращают establishes_membership=false; writer membership отсутствует |
| Семьи и прежние ручные решения остаются в Git | PASS | v5 tree и весь прежний Git snapshot сохранены; v6 используется как pinned external projection из Git, а не переключает production |
| Native lexical identities, heads, альтернативы | PASS / WARN | Graph не соединяет разные native IDs по spelling, хранит existing head refs и отдельные анализы; sense/POS alignment проекта остаётся unresolved |
| Типы и направления исходных отношений | PASS | UDer native_type/ordered Sources/OTHERRELS сохраняются; GLeMM direction unknown; MorphyNet inflection отдельно |
| Нормализация | PASS / WARN | NFC/casefold только lookup, оригиналы/native POS сохраняются; одинаковая строка не lexical identity. Unknown POS не объявлен compatible |
| Свежий малый импорт и provenance | PASS | Две сборки 257 реальных строк; независимая проверка raw fields/hash/status; все выходы совпали |
| Полная сертификация корпусов | BLOCKED | После очистки среды полные raw/normalized snapshots и неопубликованные квитанции не сохранились; новая полная проверка не заявляется |
| Граф: ложное сходство, омонимы, missing links | PASS | Независимые controls не создают мостов по общей строке и не пропускают отсутствующее звено |
| Граф: сложение, косвенные цепи | FAIL | IV-004: смешанная цепь получает итоговый proposed_category=derivation_indirect; отдельные component flags сохранены |
| Граф: неподтверждённая смена языка | FAIL | IV-003: обычная directed derivation EN→DE проходит без отдельного language/borrowing proof |
| Запреты forward/direct/alias/fallback/path | PASS | Manual negative блокирует все четыре канала; повторный реальный CREAT/creel guard blocked; неоднозначный alias даёт hold |
| История одной persistent queue | PASS | Rejected переживает повтор, дубликата ID нет; accepted не входит в enum очереди |
| Отрицательные решения в reverse | FAIL | IV-002: family=unassigned создаётся open без прежнего семейного запрета/истории |
| Частотность и алломорфы | PASS / WARN | Исходный frequency JSON хранится с hash/locators; unknown — отсутствие наблюдения, не частота 0; approximate/new allomorph не разрешён автоматически |
| Независимость evidence в priority | WARN | source-name buckets — эвристика, не доказанная lineage independence; коэффициенты экспериментальные и не входят в Di/Pr/Sh/P/PI |
| Ручной gold contract | PASS | Все 1406 case hashes проверены; automatic label отклонён; пустые judgments не дают gold; непустой выпуск защищён |
| Привязка predictions к лексеме | FAIL | IV-001: mapping использует только family/language/spelling, игнорируя lexeme/head/POS |
| Сравнение A/B и влияние на расчёт | BLOCKED | Нет actual baseline captures, ручного gold и before/after calculator captures |
| HanTa | WARN | Пакет и диагностический интерфейс доступны; прежний 40-case probe опубликован, качество без gold неизвестно. Новый запуск весов после очистки не выполнялся |
| Flexor | BLOCKED | Проверенной поставки кода/весов нет; HanTa его не заменяет |
| Большие объёмы и incremental graph | WARN | Importer streaming/partitioned; graph grouping/seed/frequency loading не доказаны bounded на миллионах, graph rebuild целиком |
| Регрессии и live production | FAIL / BLOCKED | Methodology test воспроизводимо падает PH/mater; main Tests/production audit failure по API; live поведение не проверено |

## Независимые воспроизведения

[verification08/verify.py](verification08/verify.py) создаёт только тестовые объекты/временные outputs. Он не добавляет синтетические записи в источники или эталон. [RESULTS.json](verification08/RESULTS.json) сохраняет результаты: **31 PASS / 4 FAIL**. Завершение скрипта означает сбор наблюдений; FAIL остаются явными и не объявляются успехом.

Controls охватывают similarity, два омонима с разными IDs, конечную indirect chain с промежуточными узлами, missing link, compound flags, family alias ambiguity, конкурирующие allomorph proposals, языковой scope, четыре отрицательных канала, reverse history, homonym predictions и отдельный gold contract. Пропозиция или существование пути не принимает членство.

Дополнительно пять прежних Node wrappers заново проходят: [EXISTING-SUITES.txt](verification08/EXISTING-SUITES.txt). Они не покрыли четыре новых FAIL. Общий `methodology-20260909.test.mjs:45` выполнен отдельно и падает: PH/mater `60.515946719946726 != 60.03928052899482`. [METHODOLOGY.txt](verification08/METHODOLOGY.txt). Код формулы/теста совпадает с main, поэтому дефект не приписывается новой morphology-подготовке. Полный npm suite не объявляется зелёным.

В опубликованных U/C/D соответственно **78/99/115** положительных внешних cases не имеют пути к точному target Lexeme ID. [PILOT-IDENTITY.json](verification08/PILOT-IDENTITY.json) заново вычислен из tracked CASES/RUNS и содержит также POS-конфликты, где обе лексемы представлены в cases. Это число неразрешённых переносов, не число доказанных лингвистических FP: для части source identities могло бы существовать соответствие, но reviewed alignment не предъявлен.

## Проверка импортёров и источников

Фактические пути: `associativvordes/importers/{morphology_import,fetch_sources,build_catalog,audit_import,rebuild}.py`; locks/licenses — `data/morphology-evidence/sources/`. Код читает строки потоком, сохраняет raw bytes/base64, native fields и provenance; SQLite cache 8 MiB, сортированный deterministic export, atomic publication. Missing file/hash mismatch не публикуют результат. Изменение partition может переиспользовать другие, но это не доказательство всей incremental цепи.

UDer: IDs включают ресурс/release; primary parent и ordered Sources раздельны; дополнительные словари OTHERRELS сохраняются, unresolved endpoints не выдумываются. GLeMM: stem/exponents остаются source patterns, не lexical head; lemma1/2 не задают деривационное направление; possible dataset dependency от MorphyNet явно сохранена, exact row lineage неизвестна. MorphyNet: derivation — отдельный claim; inflection — Lexeme→Form с признаками, без новой словообразовательной модели. Native affix/operation сохранены, отсутствующая сегментация не угадывается.

Закрепления: UDer 1.1, GLeMM `395020177a96a81177582fb59664509ff015f934`, MorphyNet `378144f64df58c78db5245af19d16a511ccecf3a`. Отдельные UDer подресурсы имеют разные лицензии; GLeMM — CC BY 4.0, MorphyNet — CC BY-SA 3.0. Проверяемые license copies/attribution/version locks в Git есть; это не универсальное разрешение любого будущего дистрибутива. CELEX data не подменены синтетикой.

Ниже **зафиксированные upstream/stage-03 input counts**, а не новая полная сертификация после очистки среды. В первой части текущей сессии их потоковый пересчёт и SHA 35 файлов совпали; неопубликованные машинные квитанции затем утрачены. Эти наблюдения нельзя подменять сохранившимся fresh-output receipt; нынешний полный normalized scope — BLOCKED.

| Язык | UDer | GLeMM | MorphyNet | Всего исходных строк |
|---|---:|---:|---:|---:|
| EN | 96488 | 1050666 | 874724 | 2021878 |
| DE | 280775 | 178686 | 519712 | 979173 |
| FR | 22060 | 357869 | 526180 | 906109 |
| ES | 151173 | 90079 | 1320101 | 1561353 |
| IT | 8267 | 130969 | 770869 | 910105 |
| RU | 617041 | 994346 | 1414063 | 3025450 |

Это разнородные записи, не уникальные лексемы. По stage-03 manifest всего 9 404 068 строк, 24 ES inflection empty-form в карантине. После восстановления доказан fresh replay только 257 малых реальных records, не повтор всех 9,4 млн. Успех парсинга не доказывает морфологическую правильность.

## Производительность, сохранность и предел заключения

Новые fresh imports: 5 output files, 169906 байт; graph fixtures: 15 outputs, 2218368 байт. Manifest и все outputs двух независимых построений совпадают. Секунды/RSS и точные SHA сохранены в RESULTS; это малая проба, без экстраполяции. Первоначальное измерение графа 6940 наблюдений дало 11018 Lexeme/6775 Relation, 82.8 MB export/131.9 MB SQLite, 12.846 сек открытия и около 27.1 MB peak RSS. Его внешний snapshot/неопубликованный receipt утрачен, поэтому это только сохранённое наблюдение сессии, не нынешний проверяемый million-scale benchmark.

По коду `evidence_graph/analyze.py::report` накапливает relation groups в памяти; `prepare_registry.py` читает реестры целиком; `candidate_search/search.py::collect` сначала собирает все matched seeds, CLI загружает весь frequency JSON. Граф пересобирается целиком при смене identity hash. Восстановление истории review queue из backup и долговечный Git-reviewed dossier workflow не завершены. Это препятствия массовому режиму.

Защищённые Git-деревья доказывают отсутствие внесённых изменений формул, модельного выбора, старых решений и v5/v6 переключения. Нового accepted membership и runtime wiring нет. Состояние live production этим не сертифицировано. Merge/cleanup/application не выполнялись.

Дефекты, порядок дальнейших работ и ответы о готовности: [FINAL-ISSUES.md](FINAL-ISSUES.md), [REMAINING-WORK.md](REMAINING-WORK.md), [GO-NO-GO.md](GO-NO-GO.md).

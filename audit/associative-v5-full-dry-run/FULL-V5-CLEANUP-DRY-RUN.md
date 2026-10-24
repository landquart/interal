# Полный reproducible dry-run production v5 — этап 12

Дата: 24 октября 2026. **Завершён полный dry-run текущего пустого допустимого набора.** Результат: `PASS_EMPTY_PLAN_INTEGRITY_ONLY`. Семантический gate **BLOCKED**; `nonempty_cleanup_validated=false`. Применённых изменений 0. Это проверка полного неизменённого корпуса и исследовательской инфраструктуры, а не подтверждение непустой массовой очистки.

Production, source lexemes, canonical roots, memberships, aliases и формулы не изменены. Новый authoritative индекс не опубликован; data PR не создавался и не объединялся. Исследовательские CURRENT/VIEW относятся только к отдельному shadow store.

## Входы и допустимый scope

Фактический main повторно проверен: `47723611112610945cb09b34e18588b7bd151911`. Родитель исследования — этап 11 `4a13ffe867e5b9d2a11ecc761e00179ea61625b1`; baseline accounting core закреплён на `44f1105cfe8e59d50affa08889654bfb488056c1`, нормативные определения — `ad32277ab9bc4fc8cd28ba82f08eaba2ab130f05`. Прочитаны все восемь действующих manifests операций этапов 05–10, отдельно сохранена роль двух исторических v1 morphology manifests. Конкретных действующих операций **0**, qualified scopes **0**.

SOURCE-LOCK.json связывает точные hashes/размеры, current morphology pointer, нормативные файлы, исходный baseline, correspondence registry, history pointer и stage11 quality artifacts. CODE-LOCK.json отдельно фиксирует исполнявшиеся Python/Node модули, калькулятор, runtime loader и историю. Несовпадение версии или hash checkpoint приводит к отказу, а не к применению по устаревшим данным. Любой непустой план, включая JSON с заявленным QUALIFIED статусом, отклоняется: для него ещё нет exact-scope адаптера и независимых разрешений.

Закреплённые UDer 1.1, GLeMM 2.0 (`395020177a96a81177582fb59664509ff015f934`) и MorphyNet (`378144f64df58c78db5245af19d16a511ccecf3a`) сохранены по source-lock/лицензиям в UPSTREAM-SOURCES.json. Нового ingestion или независимого подтверждения их бинарных источников этим этапом не заявляется; ни одна строка источника не использована как разрешение операции. Зависимость GLeMM/MorphyNet не превращается в два независимых подтверждения.

Stage11 содержит 0 human gold, BLOCKED semantic quality, несертифицированный holdout и 1 498 ранее экспонированных probability cases. История `fe87153c07976f8b4ae02fffee778b5213303cd01d5f8e1f380b08f2d0882374` имеет `coverage_complete=false`. Эти барьеры сохранены. Исходные assignments/generation ZIP по-прежнему недоступны: исходные лексемы восстанавливаются из закреплённых исторических materialized carriers `ee6637b266f4bbb4acd77cccf597ed75b2b44aef`, а не выдаются за первоначальные assignments.

## План и пять последовательных слоёв

OPERATION-MANIFEST.json неизменяем, имеет собственный content hash и ссылается на source lock. В семи категориях STRUCTURAL, SCOPED_EXCLUSION, RELATION_CORRECTION, LEXICAL_IDENTITY, FAMILY_SPLIT, ALIAS_CHANGE и UNRESOLVED — пустые списки. Неопределённые предложения не применялись. Статус BLOCKED не обходился для получения непустого плана.

| Слой | Применённые operations | Затронутые families/memberships/aliases | Статус |
|---|---:|---|---|
| Небольшой структурный набор | 0 | 0 / 0 / 0 | SKIPPED_EMPTY_APPROVED_SCOPE |
| Ограниченные семейные исключения | 0 | 0 / 0 / 0 | SKIPPED_EMPTY_APPROVED_SCOPE |
| Морфологические исправления | 0 | 0 / 0 / 0 | SKIPPED_EMPTY_APPROVED_SCOPE |
| Разрешённые лингвистические исправления | 0 | 0 / 0 / 0 | SKIPPED_EMPTY_APPROVED_SCOPE |
| Полный применимый набор | 0 | 0 / 0 / 0 | SKIPPED_EMPTY_APPROVED_SCOPE |

Между слоями заново проверены **все 3 587 хешей**. Полная отдельная копия физически содержит 2 051 current production file и 1 536 исторических carrier files, всего **1 401 532 272 bytes** payload. Каждый слой ссылается на уже полностью проверенный immutable object; пустые слои не размножают одинаковый payload. Любое расхождение останавливает публикацию последующих слоёв.

## Полный before/after recount

Два свежих независимых SQL-прогона заново прочитали все 256 current, 256 alias и 256 historical-source bucket tasks. Использован точный baseline accounting core с отдельно закреплённым строгим bounded-bucket JSON decoder; nested duplicate keys, nonfinite values и повреждённые gzip/JSON отклоняются. В память загружается один существующий shard и ограниченный SQLite cache, не глобальный граф.

| Объект | Before | After | Delta |
|---|---:|---:|---:|
| Canonical families | 2 456 543 | 2 456 543 | 0 |
| Memberships | 10 078 319 | 10 078 319 | 0 |
| Aliases | 1 934 050 | 1 934 050 | 0 |
| Alias-target pairs | 2 486 153 | 2 486 153 | 0 |
| Source lemma records recovered | 4 924 980 | 4 924 980 | 0 |
| Materialized unique lemmas | 4 924 281 | 4 924 281 | 0 |
| Unassigned lemmas | 699 | 699 | 0 |
| Леммы более чем в одной семье | 3 332 240 | 3 332 240 | 0 |

**4 924 980 = 4 924 281 + 699**. Все 699 конечных unassigned records совпали побитово после декомпрессии. Source/current identity collisions, current_not_in_source и cross-snapshot word/normalized mismatches — **0**. Orphaned alias targets, missing reverse aliases и reverse-only alias pairs — **0**; structural findings отсутствуют.

Все распределения по языкам, relation/source-claim types, числу семей на лексему и числу лексем на семью совпали. Полные значения — BEFORE-FULL-CENSUS.json и AFTER-FULL-CENSUS.json. INTEGRITY-REPORT сохраняет BLOCKED по неполному исходному provenance; структурные показатели нулевые. Структурная корректность не сертифицирует лингвистическую истинность старых связей.

Независимая Node-реализация другим gzip/JSON декодером прошла все buckets, сравнила **каждый из 3 587 файлов before/after**, проверила полные current memberships и прочитала **10 426 077** исторических carrier membership rows. Это физические carrier rows с повторами лексем, а не 10 426 077 разных source lemmas. Source unique-ID accounting независимо выполнен двумя SQL census.

## Полный diff и ограничения истории

В исследовательском FULL-DIFF.ndjson.gz находятся все **3 587** before/after file records с точными SHA-256; каждый UNCHANGED. В Git — FULL-DIFF-MANIFEST.json и полная coverage. MEMBERSHIP-DIFF, FAMILY-DIFF и ALIAS-DIFF пусты по результату полного обхода: исчезнувших отношений **0**, необъяснённых исчезновений **0**, approved operation IDs `[]`. Пустой diff сопровождается полной проверкой 10 078 319 связей, а не выборкой.

Сохранены **545** envelopes исторических решений, включая **7** CONFIRMED_NONMEMBER решений с конечными scopes. Снимок истории совпадает по точному hash; старые IDs, POS/sense scope, источники и полномочия не переназначались. Выполнены семь проверок точных отрицательных restore-proposals; все остаются заблокированы с применимыми decision IDs. Не выполнялось расширение отказа на другой язык, семью или значение.

Существующих HISTORY_CONFLICT: **358 → 358**, новых **0**. Это сохранение текущей истории и её ограничений; полное разрешение исторических mappings и повторная лингвистическая проверка всех source blobs не заявляются. Любой непустой план по-прежнему блокируется неполной историей.

## Реальный runtime, поиск и калькулятор

Выполнены **17 запросов × 6 языков = 102** пары before/after через текущий FamilyIndexLoader: manu, regul, creat, ocul, ped, inter, liber, mut, net, nitidus, sonus, genea, act, actu, mani, regl и отсутствующий alias. Использованы две локальные копии actual v5; fallback к production или v6 recording отсутствует. Fan-out holds, ручная маршрутизация и corpus filters сохранены. Ошибки, кроме ожидаемого fan-out hold, приводят к остановке. Изменений выдачи **0**.

Для тех же actual v5 candidates вызван текущий calculator runner без изменения формул. Исходные IPM/source frequency records перенесены неизменными. Независимые A/P, target-sense и model bindings отсутствуют, поэтому FAv во всех этих replay **null**, семантически проверенный top-five и demographic coverage scored languages **unknown**. В полном recording сохранены raw calculator outputs, наблюдаемые первые пять source rows и provenance. Нулевое raw coverage при отсутствии score не объявлено нулевым реальным демографическим охватом. Competing-model semantic effects остаются unknown.

Before/after calculator state hashes совпали; различий **0**, paid/model API calls **0**. Это baseline-vs-identical replay. Изменённый v5 materializer, новый runtime handoff и калькуляторное влияние непустой очистки этим результатом не сертифицированы.

## Recovery, idempotency, rollback и backup

Реальный subprocess убит **SIGKILL**, exit `-9`, на второй ещё не committed копии файла. На диске оставался один committed file, CURRENT и готового объекта не было. Resume повторно проверил его hash, переиспользовал **1** файл и скопировал остальные **3 586**; полупубликация не произошла. Повторный вызов распознан ALREADY_MATERIALIZED и переиспользовал все **3 587** файлов. Регрессия отдельно проверяет усечённый .partial и повреждённый committed output.

Во втором SQL census дополнительно исполнен аварийный exit **75** до второго commit: сохранился ровно один checkpoint, PRAGMA integrity_check=`ok`; затем выполнен полный resume. Физический independent replay store и все пять view versions совпали. Rollback заново восстановил исходные bytes при пустом inverse `[]`; статус PASS_NOOP_INVERSE_ONLY явно не сертифицирует непустой rollback.

Полный corpus backup — закреплённый durable архив этапа 05, **1 408 552 960 bytes**, SHA-256 `fae523b90c644532dee1e4dc028b82a37d0e368f376129ea10e2f42e051a50cc`. Его повторное использование разрешено только после нового реального cold restore и доказательства точного равенства всех shadow files **включая SNAPSHOT metadata**. DATA payload побитово тот же; нового изменённого data archive не предполагается. CORPUS-BACKUP-REFERENCE.json перечисляет четыре независимых сохранённых тома.

Новый research bundle содержит оба SQL indexes, complete diff, все recount/recovery/runtime receipts и нормативные pins: **778 480 584 bytes**, **71 файл**, SHA-256 `80faa6a0e36a2aceaa3e828660c767755261ccbdf78899a5e34546550eef95c5`. Он реально восстановлен; оба SQLite quick_check=`ok`. Дополнительно архив собран из 24 частей по проверенным хешам. Все 24 части и RESEARCH-PARTS.json сохранены — **25 успешных файлов**. Большие результаты находятся вне Git; воспроизведение не зависит от одного временного каталога.

При предыдущем возобновлении была очищена незавершённая временная среда. Итоговые цифры и receipts получены **новыми** полными прогонами восстановленных pinned inputs; утраченный незавершённый прогон не засчитан. Код и завершавшиеся receipts закреплялись в Git по мере работы.

## Измеренные ресурсы и тесты

| Процесс | Wall s | CPU s | Peak RSS MiB |
|---|---:|---:|---:|
| Before census | 1062.7 | 967.7 | 364.8 |
| After census / resume | 1077.0 | 989.5 | 418.9 |
| Independent Node decoder | 141.2 | 176.0 | 449.4 |
| v5 runtime / calculator | 49.5 | 104.8 | 906.8 |

Процессы выполнялись с перекрытием; wall times не суммируются как время сеанса. PERFORMANCE-REPORT.json хранит точные per-process CPU/RSS, дисковые размеры, copied/reused files, полный размер work и архивов, processed/reused units и число блокировок. Время/CPU прерванного до reset прогона и отдельного abort-сегмента не выдумываются. Сравнение скорости декодеров в одинаковом эксперименте не проводилось; ускорение не заявляется.

Прошли **4** новых regression tests, полный npm test (**109 test files**): отказ nonempty/BLOCKED/подложных grants, atomic complete copy, idempotency/replay, truncated partial recovery, duplicate JSON keys, extra files и symlinks. TEST_ONLY fixtures не являются человеческим gold.

## Итоговый допуск

Инженерная проверка текущего полного пустого scope завершена. Непустая очистка остаётся BLOCKED: нет qualified операций и human gold, holdout не сертифицирован, history coverage неполна, original assignments отсутствуют, семантические входы калькулятора неизвестны, изменённый materializer ещё не проверялся. Вход нового непустого плана потребует нового доказанного scope, самостоятельных разрешений своей категории, проверенного before/after и повторения полного dry-run.

Команды — associativvordes/full_v5_dry_run/README.md. Никакой автоматический data merge или production switch не выполнен.

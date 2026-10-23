# Безопасная техническая очистка v5 — полный shadow-прогон

**Результат: подготовлено 0 исправлений.** Полный физический обход и два полных
независимых пересчёта не обнаружили технического дефекта, допускающего изменение.
`SAFE-FIXES.ndjson` намеренно пуст. `DATA-CHANGE-PROPOSAL.json` фиксирует
`NO_DATA_PATCH_NEEDED`; production, исходные лексемы и старые журналы не изменены.

## Закреплённые входы

Фактический `main` на старте: `47723611112610945cb09b34e18588b7bd151911`. Код: PR #684,
`b576357113735aee8933becadb104eb3a0d0b4b0`; диагностика: PR #683, `842ddbb5c9d9db51df000e6d4a17c9b762531a0c`.
Baseline PR #680 закреплён commit `44f1105cfe8e59d50affa08889654bfb488056c1`; его census и stable-ID verifier
извлечены из Git без изменений. Исторические исходные носители закреплены
`ee6637b266f4bbb4acd77cccf597ed75b2b44aef`. Registry snapshot: `fe87153c07976f8b4ae02fffee778b5213303cd01d5f8e1f380b08f2d0882374`.

`BEFORE-MANIFEST.json` и `AFTER-MANIFEST.json` содержат все 3 587 точных путей,
размеров и SHA-256: 2 051 текущий файл и 1 536 исторических файлов source carriers.
Исходные assignments и исходные файлы candidate/Kaikki generation по-прежнему
недоступны; historical materialization не объявляется их заменой.

## Полнота и физические дефекты

| Проверяемая единица | Before | After |
|---|---:|---:|
| Families | 2 456 543 | 2 456 543 |
| Membership records | 10 078 319 | 10 078 319 |
| Aliases | 1 934 050 | 1 934 050 |
| Materialized lemma identities | 4 924 281 | 4 924 281 |
| Source lemma records | 4 924 980 | 4 924 980 |
| Unassigned lemma records | 699 | 699 |
| Полные buckets | 256 | 256 |

Физических дублей membership, orphan references, конфликтов stable IDs,
несогласованных прямых/обратных aliases, неправильных family counters,
устаревших support/language_support в 100 cached report entries, повреждённых
ссылок source descriptors, нарушений сериализации и несовпадений manifest не
найдено. Оба independent integrity reports имеют пустые `structural_findings`
и нулевые cross-reference discrepancies. Все stable IDs пересчитаны; значения
не подгонялись под исторические контрольные числа.

Source descriptors проверены по точным language/file маршрутам текущего Git
корпуса; это проверка разрешимости ссылок, не сертификация пропавших generation
bytes или лицензий первоначальных входов. Gzip CRC, завершённость JSON, вложенные
повторные ключи и non-finite constants отдельно проверены полным строгим decoder.
Посторонние untracked transport files checkout не попали в Git snapshot и не удалялись.

## Что не было объявлено технической ошибкой

5 982 группы разных семей с одинаковыми наборами членов из диагностики не являются
физически повторёнными membership внутри одной семьи. Они не объединены.
281 198 alias keys с несколькими targets не означают несогласованность routing;
точные множества прямых и обратных соответствий совпадают. Ни один target не удалён.

`counts.lemmas = 4 924 980` обозначает source corpus; это не ошибочный размер
materialized set `4 924 281`. `components = 9 349 982` — исторический счётчик
другой единицы, а не неверное число memberships `10 078 319`. Пороги ассоциативности,
review_required и подозрительные механизмы формирования не являются правилами
технического удаления. Старые тесты не переписаны ради совпадения ожиданий.

## SAFE_STRUCTURAL_FIX и REVIEW_REQUIRED

Код разрешает только подготовку детерминированных derived-counter replacements
для точного family ID или его cached report view. Каждое непустое предложение
обязано иметь объект, before/after, правило, исходную версию и hashes, evidence,
inverse и нулевой semantic/source impact. При применении after-value вычисляется
повторно из всех шести языков. Подмена пути, after-value, входов или history
отвергается. Не существует membership, alias или provenance writer.

Удаление дубля не реализовано: даже одинаковый lemma ID не доказывает равенство
значений и самостоятельных свидетельств. Такие случаи должны идти в review.
На реальных входах их не найдено, поэтому ни удаления, ни потери provenance нет.
Неполная история блокирует любой непустой plan, включая shadow; её 358 конфликтов
не обойдены. Пустая копия не меняет отношения и сохраняет ограничения.

`REVIEW-REQUIRED.ndjson` содержит ровно три corpus-level holds:
`ORIGINAL_ASSIGNMENTS_UNAVAILABLE`, `ORIGINAL_GENERATION_INPUTS_UNAVAILABLE`,
`HISTORY_COVERAGE_HOLD`. Это известные ограничения provenance/authority, а не
три вновь обнаруженных повреждения записей. Им не назначено автоматическое исправление.

## Независимая проверка и обратимость

Все 1 536 текущих member shards, 256 alias shards и 1 536 source carriers
побайтово сохранены. Число изменённых данных и semantic edge delta равны нулю.
Полный disk census выполнен отдельно для before и after. Полный строгий decoder
прочитал ещё раз все 2 048 gzip artifacts независимо от incremental scanner.
Все остальные поля/records сохранены; source manifests и provenance tree
`b1b02de3b6e7b967a99c63380b8b0097214912efe402fef67a65f2d824eb4a83` совпали.

Проверено `4 924 980 = 4 924 281 + 699` через SQL anti-join, а не вычитание
manifest counters. Полный finite unassigned NDJSON совпал; исходные носители
включены в backup. Ложные memberships для уменьшения unassigned не восстановлены.
Scope старых отрицательных решений не расширялся. Семь REGUL research-hypothesis
overlaps предыдущей диагностики остались unresolved; новый gold не создан.

После намеренного exit 75 второй census сохранил один committed bucket и
откатил следующий. Повторный запуск завершил все задачи. Повторное применение
вернуло `ALREADY_APPLIED`; fresh replay получил тот же manifest. Реальный rollback
в новый каталог восстановил точный original inventory. Архив реально восстановлен
в ещё один каталог с проверкой всех 3 587 SHA-256.

## Ресурсы, backup и воспроизведение

Полный physical scan: 676.812 s, peak RSS 81852 KiB.
Отдельные полные census и strict-decoder measurements находятся в
`RESOURCE-BENCHMARK.json` и его per-process receipts. Параллельные процессы
измерены отдельно; их peaks не выданы за общий host peak.

Archive: 1 408 552 960 bytes; SHA-256
`fae523b90c644532dee1e4dc028b82a37d0e368f376129ea10e2f42e051a50cc`.
Четыре сохранённых тома перечислены в `ARCHIVE-VOLUMES.json`; реальная обратная
сборка проверена в `VOLUME-REASSEMBLY.json`. Большие raw artifacts и SQLite не
добавлены в Git. Git source commits + small manifests позволяют восстановить
входы независимо от единственного временного каталога.

```sh
python3 associativvordes/structural_cleanup/workflow.py \
  --repo /absolute/interal --work /external/new-structural-run
python3 associativvordes/v5_diagnostics/tools/join_volumes.py \
  --manifest audit/associative-v5-structural-cleanup/ARCHIVE-VOLUMES.json \
  --directory /external/volumes --output /external/v5-structural-shadow.tar
git show 44f1105cfe8e59d50affa08889654bfb488056c1:associativvordes/v5_baseline/census.py > /external/census.py
python3 /external/census.py restore --archive /external/v5-structural-shadow.tar \
  --destination /external/new-restored \
  --sha256 fae523b90c644532dee1e4dc028b82a37d0e368f376129ea10e2f42e051a50cc
```

20 новых contract tests, 13 diagnostic и 18 adapter regression tests прошли;
полный локальный `npm test` прошёл; пять CI checks последнего commit code PR #684
успешны, repository test ещё выполняется на момент публикации.
Подробные apply, idempotence, restart, rollback, backup, restore, stable-ID и
independent-validation receipts приложены. Структурная корректность не доказывает
лингвистическую правильность; содержательная массовая очистка не начиналась.

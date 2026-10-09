# Отчёт об исправлениях расчёта ассоциативности

Дата: 09.10.2026 UTC. Основание: независимый аудит [PR #658](https://github.com/landquart/interal/pull/658), исходный main/production `b266c92f00d111c1df53da05221fefac0db1dc3a`. Перед работой remote и открытые PR обновлены; после работы повторный fetch main подтвердил тот же SHA. Последующих интегрированных исправлений по этим IDs не найдено. Работа выполнена в `fix/associativvordes-calculation-20261009` на основании опубликованного audit SHA `bb2ccdbe203f8472b67b8610cd73f3be421c6d00`.

Проверенный код GitHub: [`e08a573e829329e042b5cadef70dd18a2bb857b3`](https://github.com/landquart/interal/commit/e08a573e829329e042b5cadef70dd18a2bb857b3). Локальный SHA `06a54d57ec4455272171bdcf1c137ddc960d93ea` имеет идентичный tree `8a795a3618b65cb911171dcdb0f81e10785d427a`. При публикации через Git data API отличаются метаданные коммитов; tree каждого блока проверен на точное совпадение. Последующие коммиты отчёта меняют только документы/логи.

## Результат и границы

Исправлены подтверждённые технические причины: gzip transport, отсутствие reference N у исключённых строк, неявные причины отсутствия A, fabricated null→zero, состояния review и stale-response гонки, незавершённое ожидание body, некорректный backend success и ошибочные названия языковых показателей. Реальная обязательная review остаётся обязательной: получение первичной A/P не разрешает автоматически принятие.

Это не заявление о полностью работающем production расчёте: production не изменялся. Исходный пользовательский targetMeaning/30 производных и полный ответ review не предоставлены; причина внешнего HTTP403 остаётся неизвестной. Browser E2E заблокирован отсутствием Chromium и повреждённым архивом при установке. Подтверждение обеспечено реальными pure/page adapter функциями, gzip-ресурсами v5, mocked сервисами и регрессионными данными; mocks не названы живым расчётом.

## Логические блоки и коммиты

| Коммит GitHub | IDs / результат |
|---|---|
| [7f6ee869](https://github.com/landquart/interal/commit/7f6ee869ea2b1a31bc644ce041efef8e208248f0) | AC-001/012: общий transport raw gzip и уже декодированного JSON; page loader получает curated v5 |
| [55c7496b](https://github.com/landquart/interal/commit/55c7496b17bed2ffb7f2dc869536ba796ef3edf3) | AC-002/003/005/010: N, предварительная A, причины, счётчики, null-safe persistence и подписи |
| [b9004af9](https://github.com/landquart/interal/commit/b9004af9d9fb0d0f20ea2f5ca57d4c51c35060ff) | AC-004/006/007: реальное review start/end, manual cancellation, stale guards, pending/cache isolation |
| [7973de64](https://github.com/landquart/interal/commit/7973de649b2ede02b68b5f6b514b5a14053dd656) | AC-008/009: полный deadline, strict backend validation, typed errors |
| [8bf32df5](https://github.com/landquart/interal/commit/8bf32df5ba2f9e96e236c211ed388d52721cfc58) | Actual page adapter VM regression; прежняя область пяти scoringCandidates сохранена |
| [b0cf509c](https://github.com/landquart/interal/commit/b0cf509c906556980acb228dd44e5ac39aa88a9b) | Review error/disabled/budget диагностика, доказанный legacy zero, null interval |
| [e08a573e](https://github.com/landquart/interal/commit/e08a573e829329e042b5cadef70dd18a2bb857b3) | Первичная A отдельно от P, точное сообщение кнопки, финальная целевая верификация |

## Контракты после исправления

`calculateLanguageScore` по-прежнему выбирает maximum P и A того же представителя. `associationNormalized` является допустимой подтверждённой оценкой; `associationPreliminary` не снимает `incomplete`. `incompleteReasons` содержит конкретные missing_A/missing_P/review_required, reviewStatus и errorCode. Сохранены primary/review и интервалы; при отсутствии числовой оценки интервал не подменяется [0,0].

В `calculateFinalAssociation` каждой строке назначается reference `speakers`; `includedInFinal` и `weightedScore` описывают допуск/вклад. Исключённый вклад null. Для включённых языков по-прежнему выполняется requireSpeakerCount; неизвестный N не заменяется произвольным значением. Изменение reference N не меняет denominator включённых языков.

Счётчики: foundLanguages — языки с текущими сохранёнными candidate rows; selectedLanguages — с выбранными строками; scoredPLanguages — с числовым языковым P; primaryALanguages — с числовой A выбранной производной; verifiedALanguages — с подтверждённым языковым A; completedLanguages — execution completed/completed_with_warnings; includedLanguages/groups — допущенные в FAᵥ. Они не являются одним и тем же охватом. Суммарное число найденных до всех проверок в прошлом запуске не восстанавливается из этих счётчиков.

Snapshot остаётся version=2; additive numeric_schema_version=1 отличает новые корректные записи. Для старого неоднозначного zero сохраняется строка, но оценки инвалидируются и требуется пересчёт. Если primary подтверждает ноль, он сохраняется. Это не исправляет задним числом неизвестные исходные данные и не редактирует исторические лексические доказательства.

Manual tasks проверяют исходный state/run/item/word перед записью; изменение/удаление/новый запуск/reset отменяют сигнал. Runner проверяет актуальность после асинхронных стадий и не ставит aborted новому запуску. Family cache хранит только завершённые ответы; разные run signals не делят pending запрос. Review callbacks выполняются во время реальной review; review_required и execution terminal различаются в интерфейсе и кнопке.

Дедлайн охватывает fetch и body/parse. Qwen budgets 15s и 70s сохранены; локальные ресурсы и backend имеют технический предел 70s, backend допускает QWEN_REQUEST_TIMEOUT_MS. Проверка достаточности этого предела для крупных корпусов/реальной сети остаётся эксплуатационной задачей. Timeout не равен отсутствию слов или нулевой оценке. Backend invalid scores → QWEN_SEMANTIC_SCORES_INVALID/HTTP502; upstream HTTP error отличается от input error; timeout → QWEN_TIMEOUT/HTTP504.

## Исходная неисправность regul: before/after

| Условие | После исправления |
|---|---|
| Штатный loader, raw gzip v5 | По 2 curated записи en/de/fr/es/it/ru; static fallback не вызывается; v6 не используется |
| Фиксированные 5 записей/язык, P=74.87/48.66/35.24/56.71/94.08/52.64, A=85, обязательный review отсутствует | N корректен у всех языков; первичная A показана; подтверждённый A/FA отсутствует; покрытие 0 и принятие запрещено с причиной review |
| Те же nominal P/A, review подтверждён | FAᵥ = Σ(N×P)/ΣN, Ā=85, coverage=1, 6 языков/3 группы, accepted=true |
| A отсутствует при числовом P | Причина missing_A, подтверждённый A=null, неполные данные не включаются |
| Review завершился ошибкой | Первичная оценка сохранена, причина review error и код ошибки видимы; финальное принятие заблокировано |

Итоговое значение в полном fixture выводится из справочного N и формулы прямо в тесте, а не подгоняется под желаемый результат. Первоначальное отсутствие FA при реальном незавершённом review намеренно не «исправляется» включением неполной оценки.

## Проверки

- Последний целевой прогон на кодовом tree: `node --test tests/associative-calculation-*.test.mjs tests/associative-atomic-pipeline.test.mjs tests/associativvordes-error-handling.test.mjs tests/associativvordes-target-translation-batch.test.mjs` — **20/20**, 0 ошибок, включая **17 новых** регрессионных проверок. [Лог](FIX-REGRESSION-TESTS.txt).
- Полные/частичные языки, missing A/P, обязательный review, N, отсутствующая демография, FA/взвешивание, пороги 35/3/2, cancel/restart, stale responses, index/Qwen errors, отсутствие NaN/undefined/Infinity в числах UI, группы и покрытие проверены в новых файлах.
- Реальные функции `analyzeItem` и `calculateFinal` страницы исполняются в VM; это проверка адаптера, не browser E2E. [Лог](FIX-PAGE-ADAPTER-TESTS.txt).
- `npm test` успешно прошёл первые 51 файл и остановился на устаревшей source-string проверке AbortController. Она обновлена под общий helper; продолжение оставшихся 34 файлов дало 32 успеха и 2 ошибки. Устаревшая source-string проверка передачи review context затем исправлена и отдельно прошла; также прошла в последнем целевом прогоне. **Совокупно 84/85 файлов проверены успешно; единственная оставшаяся ошибка — AC-014. Единый финальный npm test не объявляется зелёным.** [Первый прогон](FIX-FULL-TESTS.txt), [продолжение](FIX-REMAINING-TESTS.txt), [translation recheck](FIX-TRANSLATION-TESTS.txt).
- Browser команда `npm run test:browser` — не выполнена успешно: отсутствующий executable Chromium; установка CDN завершилась повреждённым ZIP. [Лог](FIX-BROWSER-TESTS.txt).
- `git diff --check`, syntax check script/analyzer успешны. Diff утверждённой методологии, demographics, family-index-v5/v6 и исторических data — пустой. Production/v5 routing не переключался; merge и изменения существующих PR не выполнялись.

Старые тесты, завязанные на прежний контракт reference N или точную строку реализации, обновлены; формульные ожидаемые значения не менялись. Подробные логи каждого блока сохранены рядом.

## Открытые направления

1. AC-011/013/015: отдельные утверждённые решения о нуле в denominator, финальной candidate validation fallback и области полноты. Технический PR не меняет эти правила.
2. AC-014: отдельное расследование PH mater; общий CI остаётся не зелёным.
3. Полный browser E2E в среде с Chromium, затем production-like полный regul с фиксированным meaning и записью primary/review/selected/statuses.
4. Доступ к upstream логам/моделям для объяснения исходных null и HTTP403; typed errors сами по себе не устраняют отсутствие доступа к review-модели.
5. Эксплуатационная проверка дедлайнов на реальных крупных источниках и медленной сети.

Следующий этап — независимая верификация согласно CHECKPOINT.md. Эта работа не является разрешением merge или production promotion.

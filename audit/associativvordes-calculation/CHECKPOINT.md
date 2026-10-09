# Контрольная точка — аудит расчёта ассоциативности

Дата: 09.10.2026. Проверенный исходный SHA: `b266c92f00d111c1df53da05221fefac0db1dc3a`.
Ветка: `audit/associativvordes-calculation-20261009`; base=main. Production deployment: dpl_Era2Mu6evrdJF1zXwa68jZPFJGqx; methodology=2026-09-09; runtime data route=v5. PR публикации фиксируется отдельно в ответе и metadata GitHub, чтобы не создавать циклическую ссылку на ещё не созданный коммит.

## Статус направлений

| Направление | Статус | Результат/ограничение |
|---|---|---|
| Remote/ветки/PR/production | завершено | полный ls-remote, open REST PR snapshot, production SHA и live hashes |
| Исходный regul | механизмы подтверждены; exact source ограничен | каждый симптом имеет причину или documented limit в AUDIT §10; исходный export не получен |
| Живое воспроизведение | ограничено, run остановлен | >8 минут, дошёл до немецкого анализа, не до финальной таблицы; meaning=правило — допущение |
| Подключение v5 | подтверждён дефект AC-001 | raw gzip+overridden json parser; local v5 regul/en=2, fallback=152 |
| A/P/поля/review | завершено | штатные поля согласованы, stored A исключается при incomplete; review gate методологически обоснован |
| Демография/renderer | завершено | справочные N есть; top-level speakers отсутствует вне represented; Intl→NaN |
| Представленность/FA | завершено | found/selected/scored/verified/included разные множества; нули — отдельный вопрос |
| Состояния/async | статический trace завершён; races открыты | main guards существуют, manual guards отсутствуют; lifecycle/status conflicts reproduced isolated |
| Методология | сверено с repository edition | A/P/maxP/weighted aggregate соответствуют; внешний более поздний документ не получен |
| Сравнение семей/случаев | локальные v5 counts и mock cases выполнены | нет full live successful alternative root; inter root-route не считать preposition-route |
| Внешний сервис | настоящие ответы получены, upstream причина открыта | primary200/null fields, review403; mock success/failure разделены |
| Существующие тесты | 9/10 файлов прошли | methodology test baseline PH mater failure; subsequent assertions не выполнены |
| Четыре обязательных отчёта | готовы | AUDIT.md, ISSUES.md, FIX-PLAN.md, CHECKPOINT.md |

## Доказательства

REMOTE-SNAPSHOT.md; REMOTE-BRANCHES.txt; LIVE-ASSETS.txt; LIVE-QWEN.txt; LIVE-SESSION.md; DIAGNOSTICS.txt; EXISTING-TESTS.txt; ADDITIONAL-TESTS.txt. Это текстовые диагностические материалы; временных harness/script файлов и новых тестов нет. Команды диагностик выполнялись через stdin и не изменяли исходные модули.

Полный repo suite и глобальная повторная этимологическая проверка не заявлены. Девять проходящих файлов не означают green CI. Достоверные прежние structural family audit результаты не повторялись и не трактуются как проверка расчётного UI.

## Следующий этап

1. Прочитать AUDIT/ISSUES/FIX-PLAN, обновить remote/production и сверить SHA. Если код не изменился, не повторять gzip/null/NaN proof.
2. Получить source snapshot regul, exact meaning и safe review traces. До этого не заявлять доказанную первопричину исходного Qwen сбоя.
3. Исправлять сначала AC-001/002/005 в **другой** ветке и отдельном PR; сохранять методологические review guards, данные v5, frequency/lemma IDs.
4. Отдельно решать AC-011/013/015; не менять формулы/denominator без утверждённого решения.
5. Независимая верификация по FIX-PLAN этап 6; реальные сервисы и mocks маркировать отдельно.
6. AC-014 не исправлять автоматически заменой expected PH числа; требуется самостоятельная диагностика.

Merge, изменение существующих PR, пересборка данных и переключение production v5→v6 не выполнялись. Этот аудит не содержит функциональных исправлений.

## Исправление: блок 1

Ветка fix/associativvordes-calculation-20261009 от опубликованного аудита bb2ccdbe203f8472b67b8610cd73f3be421c6d00; main/production по-прежнему b266c92. Последующих исправлений в main и новых относящихся к аудиту PR не найдено; исторический #542 не реализует новый gzip transport.
AC-001/AC-012: общий gzip/JSON transport установлен именно в createCandidateIndexLoader. Новый тест проверяет шесть настоящих локальных v5 regul списков, raw/HTTP-decoded body, ошибку и отмену; старые family guards сохранены. FIX-TRANSPORT-TESTS.txt: 20 assertions/subtests, всё прошло. Данные v5 не изменены.
Следующее: numeric/persistence contract, причины pending review и renderer, затем lifecycle/backend. Открытые методологические AC-011/013/015 и независимый PH baseline AC-014 не менять.

## Исправление: блок 2 — AC-002, AC-003, AC-005, AC-010

Справочное N доступно всем строкам; исключённый вклад остаётся null. Добавлены первичная A, причины незавершённой проверки и раздельные счётчики покрытия. Допуск в FAᵥ и формулы сохранены. Сохранение не превращает отсутствие в ноль; старые неоднозначные нули требуют пересчёта, текущий формат version=2 совместим с additive numeric_schema_version=1. Исправлены русские подписи max-P и A представителя.

Проверка: `node --test tests/associative-calculation-numeric.test.mjs tests/associativvordes-persistence.test.mjs tests/associativvordes-language-statuses.test.mjs` — 8/8, 0 ошибок. Следующий блок: жизненный цикл и внешние запросы.

## Исправление: блок 3 — AC-004, AC-006, AC-007

Review callbacks теперь ограничивают реальный запрос проверки, статус возвращается к analyzing. Сохраняется review_status/error_code; числовая оценка и подтверждение раздельны. Ручные задачи имеют AbortSignal и проверку исходного state/run/candidate/word перед записью. Редактирование, удаление, reset и новый запуск отменяют задачи. Старый runner не меняет статус/кнопку нового запуска; поздние audit/error/review callbacks защищены. Семейный cache хранит только успешно завершённые данные и разделяет pending по сигналам.

`node --test tests/associative-calculation-lifecycle.test.mjs tests/associative-atomic-pipeline.test.mjs tests/associative-search-runtime-patch.test.mjs tests/associativvordes-qwen-review.test.mjs` — 8/8, 0 ошибок. Изменена только устаревшая source-string проверка кнопки, поскольку теперь она блокируется также во время reviewing. Следующий блок: дедлайны полного ответа и валидация backend semantic scores.

## Исправление: блок 4 — AC-008, AC-009 и уточнения AC-004/005

Полный fetch + чтение body ограничены дедлайном с отменой, включая Qwen primary/review/candidates, Yandex backend, gzip, static index, frequency и SWOW. Клиентские Qwen бюджеты 15s/70s не изменены; локальным ресурсам/серверу задан технический предел 70s (существующий candidate budget), backend допускает QWEN_REQUEST_TIMEOUT_MS. Это ограничение ожидания, а не утверждение о достаточности времени для любых корпусов. Backend отвергает missing/non-numeric semantic scores с QWEN_SEMANTIC_SCORES_INVALID; настоящий ноль валиден. Ошибка review не заменяет первичную оценку и остаётся обязательным блоком. Кнопка не сообщает Done при reviewRequired. Сохранённая диагностика ограничена review counters; сырые SWOW shards не добавлены в snapshot.

`node --test tests/associative-calculation-services.test.mjs tests/association-demographic-weighting.test.mjs tests/associative-qwen-backend-model-routing.test.mjs tests/associativvordes-qwen-review.test.mjs tests/associative-candidate-index-loader.test.mjs` — 7/7, 0 ошибок. Старые тесты signal identity заменены проверкой AbortSignal; собственный deadline требует объединённого сигнала. Demographic test теперь проверяет reference N отдельно от included/denominator. Следующий этап: общая верификация, отчёт и отдельный PR.

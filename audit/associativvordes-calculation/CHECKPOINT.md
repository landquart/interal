# Актуальная контрольная точка — этап 02

Дата: 09.10.2026 UTC. Ветка: `fix/associativvordes-calculation-20261009`. Основной отчёт: [FIX-REPORT.md](FIX-REPORT.md), статусы [ISSUES.md](ISSUES.md). Разделы исходного аудита ниже являются историческими снимками этапа 01 и промежуточных блоков.

- Main/production при повторном fetch: `b266c92f00d111c1df53da05221fefac0db1dc3a`; deploy/promotion не выполнялись, v5 сохранён.
- Последний кодовый SHA GitHub: `e08a573e829329e042b5cadef70dd18a2bb857b3`; локальный проверенный SHA `06a54d57ec4455272171bdcf1c137ddc960d93ea`; tree обоих `8a795a3618b65cb911171dcdb0f81e10785d427a`.
- Последующие документы/логи имеют отдельный commit. Для полного актуального HEAD использовать `git fetch origin fix/associativvordes-calculation-20261009`, затем `git rev-parse FETCH_HEAD`; это не меняет проверенный code tree. SHA документов не записывается внутрь самого коммита во избежание циклической ссылки.
- Технические IDs AC-001–010/012: исправлены в пределах подтверждённых дефектов. AC-009 upstream root cause, browser/live результаты и достаточность дедлайнов остаются ограничениями.
- AC-011/013/015: открыты методологические решения; политика не изменена. AC-014: открытый независимый PH baseline, общий CI не зелёный.
- Последний target regression: 20/20 (17 новых), 0 ошибок. Совокупная проверка top-level: 84/85 успешны; итоговое полное npm test не объявляется успешным. Browser E2E не прошёл запуск Chromium; live полный regul после исправления не выполнялся.
- Remote PR-проверка: #658 содержит только исходный аудит; исторические #508/#511/#542/#419 не являются последующими интегрированными исправлениями на main. Не изменялись существующие PR.

## Независимая верификация

1. Получить новую ветку; проверить code SHA/tree и diff от main. Обязательный diff `shared/methodology-calculation.mjs`, `shared/control-language-demographics.mjs`, v5/v6 data должен быть пустым.
2. Выполнить `npm ci --ignore-scripts`, затем последнюю целевую команду из FIX-REPORT. Получить 20/20; проверить все четыре новых test файла и ID.
3. Выполнить `npm test`. Ожидаемый оставшийся blocker — PH mater AC-014; не менять ожидаемое значение без отдельного исследования. Новых failures быть не должно.
4. В среде с рабочим Chromium выполнить `npm run test:browser`, расширить фактический page E2E на regul/manual edit/reset/late response. VM/regression результаты не считать browser proof.
5. В разрешённом preview окружении выполнить полный regul с фиксированным meaning, записать в audit первичные/повторные payloads, selected rows, error codes и итог. Не отправлять ключи в отчёт. HTTP403 требует проверки доступа модели и upstream logs.
6. Проверить timeout поведение больших frequency/SWOW/static файлов в реальной сети; 70s — технический верхний предел, не эмпирический SLA.
7. До разрешённых методологических решений не включать zero/incomplete данные ради охвата и не изменять failClosed/selected-vs-all policy. Никакого merge/production promotion в этом этапе.

---

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

## Исправление: блок 5 — контроль page adapter

Счётчики найденных и выбранных строк отделены от прежнего набора максимум пяти scoringCandidates. Сфера проверки полноты не расширяется на произвольные дополнительные строки: AC-015 остаётся методологическим вопросом. VM-проверки исполняют реальные функции calculateFinal/analyzeItem из страницы (не browser E2E): подтверждают полные счётчики при неизменном max-five scoring и игнорирование late manual response после редактирования слова.

`node --test tests/associative-calculation-numeric.test.mjs tests/associative-calculation-lifecycle.test.mjs tests/associative-model-selection-policy.test.mjs` — 14/14, 0 ошибок. Browser E2E пока заблокирован отсутствующим Chromium; попытка установки завершилась ошибкой повреждённого архива CDN. Полный npm test ещё проверяется.

## Исправление: блок 6 — диагностика review и нулевых доказательств

В таблице различаются review pending/error/disabled/budget, сохраняется error code. Upstream HTTP error на backend отделён от ошибки пользовательского запроса. Отсутствующий P не превращается в интервал [0,0]. Legacy true zero сохраняется при наличии primary.association_score=0; без доказательства требуется пересчёт.

`node --test tests/associative-calculation-numeric.test.mjs tests/associative-calculation-services.test.mjs tests/associativvordes-qwen-review.test.mjs` — 11/11, 0 ошибок. Source-only проверка AbortController переведена на общий deadline helper, фактические тесты timeout/abort сохранены. Общая верификация продолжается после уже успешно проверенных файлов; отдельный PH baseline AC-014 не исправляется здесь.

## Исправление: блок 7 — окончательная семантика счётчиков/кнопки

Первичная A учитывается независимо от наличия P, допуск в FAᵥ не меняется. Кнопка различает pending mandatory review, неопределённое решение и терминальные ошибки запуска; index/qwen error больше не получает сообщение о pending mandatory review. Новый source-assertion target translation учитывает передачу review context; проверка оригинального meaning и пропуска SWOW сохранена.

Последний целевой прогон `node --test tests/associative-calculation-*.test.mjs tests/associative-atomic-pipeline.test.mjs tests/associativvordes-error-handling.test.mjs tests/associativvordes-target-translation-batch.test.mjs`: 20/20, 0 ошибок (из них 17 новых регрессионных проверок).

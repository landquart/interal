# Реестр проблем

Проверенный SHA: `b266c92f00d111c1df53da05221fefac0db1dc3a`. Все ссылки на файлы/строки относятся к этому снимку. «Подтверждено кодом» не равно живому воспроизведению гонки. Исправления и новые тесты здесь только предложены; не выполнялись.

## AC-001 — Обход распаковки gzip в подключении v5

- Серьёзность: Критическая.
- Доказательность: Подтверждено локально и production HTTP.
- Затронутые функции/места: candidate-index-loader.js:199–203,308–350; family-index-loader.js:17.
- Условия воспроизведения: Штатный createCandidateIndexLoader; shard *.json.gz без Content-Encoding.
- Ожидаемое и фактическое поведение: Ожидается чтение curated v5; фактически response.json отвергает gzip, family error скрывается резервным поиском. Для regul/en v5=2, faulty fallback=152.
- Свидетельства: LIVE-ASSETS.txt; DIAGNOSTICS.txt ACTUAL_CANDIDATE_LOADER_LOCAL.
- Предлагаемое исправление: Общий transport для JSON/gzip без потери внедряемого fetch; явная provenance fallback, отдельное решение о допустимости резервного происхождения.
- Необходимые тесты следующего этапа: Интеграция именно createCandidateIndexLoader с compressed Response; browser calculation получает v5; HTTP encoding/raw gzip; abort; запрещённые и отсутствующие families.

## AC-002 — N и N×P выводятся как NaN вне represented

- Серьёзность: Высокая.
- Доказательность: Подтверждено исполнением.
- Затронутые функции/места: association-analyzer.js:142–150; script.js:1014–1024.
- Условия воспроизведения: count>0/P конечен, но A=null или score=0 исключён из represented.
- Ожидаемое и фактическое поведение: Справочный N должен отображаться независимо от допуска; сейчас top-level speakers/weightedScore undefined, Intl.NumberFormat показывает «не число».
- Свидетельства: DIAGNOSTICS.txt SYNTHETIC review_required; demographics имеет все N.
- Предлагаемое исправление: Контракт строки с demographic N для каждого языка, отдельный флаг included; weightedScore при исключении явно null; formatter не принимает undefined как число.
- Необходимые тесты следующего этапа: Русская/английская таблица при review pending, zero, missing A; N остаётся справочным, итоговый denominator не меняется.

## AC-003 — Отсутствующий review не отделён от отсутствующего A

- Серьёзность: Высокая.
- Доказательность: Механизм подтверждён; не считать блок review ошибкой формулы.
- Затронутые функции/места: association-analyzer.js:128–135,360–413; script.js:1008–1045.
- Условия воспроизведения: Selected с числовыми A/P и review_required=true.
- Ожидаемое и фактическое поведение: Ожидается объяснение «первичная оценка есть, review отсутствует» при запрещённом принятии; сейчас агрегат A скрыт, UI сообщает нет рассчитанных данных/не завершён.
- Свидетельства: MOCKED_SERVICE reviewFails=true; полная синтетическая матрица.
- Предлагаемое исправление: Сохранить блок принятия, добавить явные primary/verified метрики и структурированные причины review missing/failed/disabled/budget. Не включать неполные данные в окончательный FA.
- Необходимые тесты следующего этапа: Review success/failure/disable/budget/abort, слабый selected с pending review; первичные значения видны как предварительные, accepted=false.

## AC-004 — Статус completed не описывает полноту решения

- Серьёзность: Высокая.
- Доказательность: Подтверждено изолированным runner; статический дефект transition.
- Затронутые функции/места: associative-calculation-runner.js:403–455; script.js:525,780–787; association-analyzer.js:170–190.
- Условия воспроизведения: Primary успешен, review_REQUIRED; либо порог/представитель uncertain.
- Ожидаемое и фактическое поведение: Ожидается различие execution completed и decision needs_review; сейчас язык completed, global completion и кнопка Done возможны при calculation_incomplete. Callback reviewing может быть перекрыт старым status.
- Свидетельства: MOCKED_RUNNER_COMPARISON inter; spread {status,...extra} с oldStatus; onReviewStart после await.
- Предлагаемое исправление: Разделить execution/verification, чинить spread/реальное время callbacks и сообщения; не удалять methodological block.
- Необходимые тесты следующего этапа: Все перечисленные statuses, completed+review pending, uncertain threshold, terminal index/qwen failure, реальные review start/end callbacks.

## AC-005 — Сохранение null оценок превращает их в ноль

- Серьёзность: Высокая.
- Доказательность: Подтверждено исполнением.
- Затронутые функции/места: associative-state.js:22–24,247–268,328; script.js:1198–1200.
- Условия воспроизведения: compactAssociativeState получает final_score/association_score=null.
- Ожидаемое и фактическое поведение: Ожидается сохранение отсутствия данных; Number(null)=0 записывает final_score=association_score=0. При восстановлении появляется ложная конечная оценка.
- Свидетельства: DIAGNOSTICS.txt PERSIST_NULL.
- Предлагаемое исправление: Единая null-safe нормализация, versioned migration старых сохранений без догадок о true zero; сохранить primary/review/interval/provenance.
- Необходимые тесты следующего этапа: Round-trip null/undefined/empty/zero/finite, legacy snapshots, forced failed selected/manual edits; после reload нет fabricated A/P.

## AC-006 — Ручной анализ не защищён от устаревших ответов

- Серьёзность: Высокая.
- Доказательность: Отсутствие guards подтверждено кодом; реальная гонка не воспроизведена.
- Затронутые функции/места: script.js:1138–1178; associative-state.js:223–244; qwen-client.js:1053–1066.
- Условия воспроизведения: analyzeItem в работе, затем слово меняется, строка удаляется либо стартует новый run/reset.
- Ожидаемое и фактическое поведение: Ожидается run/candidate identity guard; signal/runId не передаются анализатору, после await обновляются item/current language state.
- Свидетельства: Статический trace AUDIT §7.
- Предлагаемое исправление: Run-local AbortSignal, immutable candidate identity/version, guard после каждого await; не применять stale результат.
- Необходимые тесты следующего этапа: Deferred responses: edit same item, delete/reorder, reset/new run, checkbox microtask; старый ответ не пишет оценки/статус нового run.

## AC-007 — Старый atomic runner и кеш v5 могут затрагивать новый run

- Серьёзность: Средняя.
- Доказательность: Код подтверждён; operational race остаётся гипотезой.
- Затронутые функции/места: associative-calculation-runner.js:459–464; family-index-loader.js:20–28.
- Условия воспроизведения: Повторный run во время pending fetch/старого catch.
- Ожидаемое и фактическое поведение: Ожидается отсутствие любых записей старого runner в новое state; catch пишет aborted в shared state. V5 cache path-only разделяет сигнал первого caller.
- Свидетельства: Сопоставление signal-aware static cache с path-only family cache.
- Предлагаемое исправление: Отдельный state каждого run либо guards перед мутациями/catch; caller-local cancellation/shared immutable cache policy.
- Необходимые тесты следующего этапа: Два run с разными signal на одном shard, abort first, late catch; current state/version остаются неизменны.

## AC-008 — Дедлайны не покрывают весь жизненный цикл запроса

- Серьёзность: Средняя.
- Доказательность: Подтверждено кодом; вечное зависание не доказано.
- Затронутые функции/места: qwen-client.js:167–214,380–410; frequency-loader.js:65–82; api/qwen-analyze.js:42.
- Условия воспроизведения: Headers приходят, body задерживается; upstream fetch или static files не завершаются.
- Ожидаемое и фактическое поведение: Ожидается ограниченная и отменяемая стадия; Qwen timeout очищен до res.json, upstream без timeout/signal, static/frequency загрузки без deadline.
- Свидетельства: AUDIT §7; живой расчёт длительный, но движется.
- Предлагаемое исправление: Deadline включает чтение body/parse и upstream; понятные timeout codes по этапам; измерить latency до выбора лимита.
- Необходимые тесты следующего этапа: Delayed headers/body, abort parse, index/SWOW/frequency hangs; timers/listeners cleaned, причина доходит до UI.

## AC-009 — Backend может вернуть ok:true с некорректными semantic scores

- Серьёзность: Высокая.
- Доказательность: Подтверждён production ответ; upstream причина не установлена.
- Затронутые функции/места: api/qwen-analyze.js:38–42,386–401; qwen-client.js:140–164.
- Условия воспроизведения: regulation/правило, primary endpoint response HTTP200 с тремя null.
- Ожидаемое и фактическое поведение: Ожидается валидная оценка либо структурированная ошибка; сервер возвращает ok:true/null, клиент отвергает QWEN_SEMANTIC_SCORES_INVALID.
- Свидетельства: LIVE-QWEN.txt; отдельный review403 только наблюдение, не объяснение.
- Предлагаемое исправление: Серверная валидация извлечённого semantic payload, safe diagnostic correlation/task/model/elapsed; исследовать raw upstream в разрешённых логах без публикации ключей.
- Необходимые тесты следующего этапа: Missing fields/null/invalid JSON/upstream wrapper/empty content, корректный structured error и client display.

## AC-010 — Русские названия показателей не соответствуют max/representative

- Серьёзность: Средняя.
- Доказательность: Подтверждено кодом и методологией.
- Затронутые функции/места: script.js:54,106; association-analyzer.js:119–135.
- Условия воспроизведения: Любые выбранные P, например 80 и 20.
- Ожидаемое и фактическое поведение: Ожидается «максимальный P» и «A опорного деривата»; русский текст говорит средний P/A, английский частично исправлен.
- Свидетельства: docs/methodology-20260909.md; SYNTHETIC; существующий max-P control.
- Предлагаемое исправление: Переименовать видимые labels/описания, явно показывать representative и множества found/scored/included; формулы оставить.
- Необходимые тесты следующего этапа: P80/20→language80/A90, RU/EN parity, selected count не выдаётся за membership/full coverage.

## AC-011 — Нули исключаются из represented и меняют denominator

- Серьёзность: Методологический вопрос.
- Доказательность: Политика подтверждена; не квалифицирована как утверждённая ошибка.
- Затронутые функции/места: association-analyzer.js:144–180.
- Условия воспроизведения: Язык P=0,A>0,count>0 или A=0.
- Ожидаемое и фактическое поведение: Необходим утверждённый критерий represented; фактически zero исключается, FA по другим языкам выше варианта с включённым нулём.
- Свидетельства: DIAGNOSTICS.txt ZERO_AND_POSITIVE; existing language-statuses test ожидает no data для нулей.
- Предлагаемое исправление: Сначала документировать решение владельца методологии о нулях; только затем код/тесты. Не приравнивать null к zero.
- Необходимые тесты следующего этапа: All-zero, zero+positive, missing+positive, denominator/coverage/counted groups; baseline expectations явно утверждены.

## AC-012 — Прежние проверки не покрывают фактическое подключение страницы

- Серьёзность: Средняя.
- Доказательность: Подтверждено по содержимому проверок.
- Затронутые функции/места: tests/browser/associative-family-v5-production.playwright.mjs:34–36; audit/associative-family-v5/browser-regression.json.
- Условия воспроизведения: Standalone FamilyIndexLoader проходит, page wrapper переопределяет fetchJson.
- Ожидаемое и фактическое поведение: Ожидается end-to-end page route; прежний тест проверяет прямой loader и не ловит AC-001.
- Свидетельства: AUDIT §1; текущий gzip diagnostic.
- Предлагаемое исправление: Добавить отдельную проверку фактического расчётного path страницы и sentinel family provenance; сохранить прямой loader test.
- Необходимые тесты следующего этапа: Production-like gzip headers, shared loader injection, selected derivative origin and UI, comparison with curated v5.

## AC-013 — Неполная Qwen candidate validation допускает fallback без финального proof-флага

- Серьёзность: Методологический/архитектурный вопрос.
- Доказательность: Подтверждён control flow; исходный regul не доказан.
- Затронутые функции/места: qwen-client.js:609–623,959–1035; association-analyzer.js:170–179.
- Условия воспроизведения: Validation missing/errors; failClosed:false, primary/review прочих этапов успешны.
- Ожидаемое и фактическое поведение: Ожидаемое принятие зависит от утверждённого proof правила. Фактически непроверенные кандидаты сохраняются; warnings не обязательно блокируют accepted.
- Свидетельства: AUDIT §3/8; existing runtime-finalization проверяет fallback.
- Предлагаемое исправление: Разделить local/etymology evidence, Qwen verdict и operational error; согласовать допустимость принятия. Не выдавать fallback за проверенное происхождение.
- Необходимые тесты следующего этапа: Incomplete checks/wrong_language/duplicate/service failure; independent evidence и acceptance gates.

## AC-014 — Baseline методологический тест падает на независимом PH-примере

- Серьёзность: Средняя.
- Доказательность: Подтверждено запуском, вне формул A/P.
- Затронутые функции/места: tests/methodology-20260909.test.mjs:45.
- Условия воспроизведения: Node24, неизменённый production SHA.
- Ожидаемое и фактическое поведение: Ожидается green test; actual60.515946719946726 vs expected60.03928052899482, дальнейшие проверки файла не выполнены.
- Свидетельства: EXISTING-TESTS.txt.
- Предлагаемое исправление: Отдельно расследовать PH snapshot/ожидание; не подгонять expected автоматически и не связывать с review-A; не менять в данном аудите.
- Необходимые тесты следующего этапа: Повторить PH diagnostic по строкам mater после отдельного разрешённого исправления, затем весь файл.

## AC-015 — Проверка incomplete может учитывать невыбранные F и скрывать полный выбранный итог

- Серьёзность: Методологический/архитектурный вопрос.
- Доказательность: Условия подтверждены кодом; исходный regul не доказан.
- Затронутые функции/места: associative-calculation-runner.js:408; association-analyzer.js:128; script.js:683–688,833–836.
- Условия воспроизведения: В source есть versioned frequencyProfile с F=null, но selected top5 полны.
- Ожидаемое и фактическое поведение: Expected требует определения области полноты; runner помечает весь язык incomplete, calculateLanguageScore проверяет passed selected список. Слой score и слой execution имеют разную область проверки.
- Свидетельства: AUDIT §7/8.
- Предлагаемое исправление: Определить selected/unselected completeness contract и сохранять отдельный warning о непроанализированных моделях без молчаливого снятия обязательных проверок.
- Необходимые тесты следующего этапа: Full selected + unselected missingF; selected missingP/A; maxModels cutoff; status и accepted строго по утверждённой политике.

## Порядок и ограничения

AC-001, AC-002, AC-005 — независимые подтверждённые дефекты. AC-003/004 исправлять как контракт статусов/отображение, сохраняя обязательность review. AC-011/013/015 требуют методологического решения. AC-006/007/008 требуют направленного воспроизведения до заявления о влиянии на исходный regul. AC-014 — отдельный baseline failure. Первопричина конкретного исходного сетевого сбоя остаётся открытой.

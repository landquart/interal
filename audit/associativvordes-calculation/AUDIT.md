# Независимый аудит расчёта ассоциативности

Дата: 09.10.2026 (Europe/Moscow). Проверенный production SHA: `b266c92f00d111c1df53da05221fefac0db1dc3a`.
Область: инструмент `associativvordes/`. Функциональный код, формулы, методология, тесты и производственные данные не менялись. Все новые файлы находятся в этом каталоге.

## Вывод и уровень доказательности

Подтверждены три независимые цепочки: (1) gzip-сбой подключения v5 с переходом на резервный поиск; (2) скрытие языкового A при обязательной, но отсутствующей повторной оценке, несмотря на сохранённые первичные A/P; (3) форматирование отсутствующего N как «не число». Последняя цепочка является дефектом отображения/контракта. Блокировать окончательное принятие при отсутствии review требует текущая методология; удалять эту защиту нельзя.

В отдельном исполнении реальных функций агрегирования, с синтетическими входами, воспроизведены **все** перечисленные пользователем итоговые симптомы и все шесть заданных P. Это не повторный production-расчёт и не подтверждение конкретной ошибки сервиса в исходном пользовательском запуске. Точный исходный targetMeaning, список 30 выбранных записей, primary/review, предупреждения и сетевые ответы этого запуска не предоставлены. Положительный P при стандартном пути означает, что A ранее был вычислен; почему конкретно этот A стал неполным — без исходного состояния окончательно не устанавливается.

## 1. Версии, процесс и прежние результаты

Production deployment `dpl_Era2Mu6evrdJF1zXwa68jZPFJGqx`: READY, target production, main, указанный SHA. Получены remote HEAD, полный список удалённых веток и актуальный REST-список открытых PR (REMOTE-SNAPSHOT.md, REMOTE-BRANCHES.txt). #652 уже merged/closed; #650, #651, #542 и другие остаются открытыми. Исторические инструкции о незавершённом #652 не подменяют текущий снимок.

Версия расчёта `2026-09-09`; версия FamilyIndexLoader — 5; production подключает `/associativvordes/family-index-v5`. Резервный search-index: manifest version 4 / normalizer 4 / static-affix-anchored-ngram-v1. V6 не включался. LIVE-ASSETS.txt подтверждает байтовое совпадение пяти production-модулей и одного gzip-шарда с checkout.

Прежний browser-regression.json от 20.09.2026 подтверждает прежние проверки прямого FamilyIndexLoader. Нынешний production browser test также создаёт **прямой** FamilyIndexLoader (https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/tests/browser/associative-family-v5-production.playwright.mjs#L34), а не подключение через createCandidateIndexLoader. Эти результаты не доказывают исправность нынешней интеграции страницы; повторный аудит всех миллионов memberships не выполнялся.

## 2. Воспроизведение: разделение сред

### Реальная страница

На production открыт новый браузерный tab, root=regul, targetMeaning=правило, type=root. Значение «правило» — явно выбранное допущение: пользователь не сообщил значение исходного запуска. Наблюдались загрузка, поиск по языкам и последовательный Qwen-анализ английских regulation, unregulated, self-regulate, over-regulation, self-regulated. Страница не дошла до итоговой таблицы за наблюдаемый интервал; это ограничение живого воспроизведения, а не доказательство вечного зависания. Подробная конечная фиксация находится в LIVE-SESSION.md.

### Настоящие production HTTP-ответы

LIVE-ASSETS.txt: alias shard `aliases/24.json.gz` — HTTP 200, Content-Type application/gzip, Content-Encoding отсутствует, первые байты 1f8b. Значит `response.json()` не может прочитать его как JSON.

LIVE-QWEN.txt: один запрос primary для regulation/правило вернул HTTP 200 с directness/field_relatedness/domain_shift=null; один review-запрос получил HTTP 403. Первичный ответ не проходит клиентский parseQwenPayload и становится QWEN_SEMANTIC_SCORES_INVALID. Источник 403 не установлен: тело/серверные логи не получены, это не доказательство отсутствия ключа, запрета модели или bot detection. Не доказано, что те же ответы были в исходном запуске. Ключи Yandex в локальной среде не использовались; запрос шёл через опубликованный backend.

### Изолированная диагностика

DIAGNOSTICS.txt записывает:
- реальные функции calculateLanguageScore/calculateFinalAssociation с синтетическими пятью записями на язык, P=[74.87,48.66,35.24,56.71,94.08,52.64] и review_required=true;
- реальный analyzeAssociativeWord с имитированными primary/review HTTP-ответами;
- реальный runner с имитированными зависимостями и сравнительными сценариями;
- чтение настоящих локальных gzip-данных v5;
- реальный createCandidateIndexLoader с локальным файловым HTTP-адаптером без распаковки.
Адаптер разрешает относительные URL относительно /associativvordes/. Первоначальная попытка с неверной базой URL не использовалась как доказательство дефекта.

При имитированной ошибке review: storedA=85, storedP=83.21541764181104, review_required=true, languageA=null. При успешном review с совпадающими оценками A=85 и расчёт завершается. При синтетическом review_required на всех языках: все P и count=5 сохранены, N форматируется «не число», FA/A=null, coverage=0, языки=0, группы=0, решение insufficient_data, причины calculation_incomplete/no_calculated_data.

## 3. Полный путь данных

| Стадия | Вход → выход | Функции и завершение | Ошибки/ограничения |
|---|---|---|---|
| Ввод | root, targetMeaning, elementType → input/runId/signal | script runCalculation; обязательны root и meaning | отсутствие ввода — alert; новый запуск отменяет старый |
| Переводы | targetMeaning → шесть локализованных строк | getRunTargetTranslations/target-meaning-translator | timeout/HTTP/invalid payload; перевод нужен SWOW, исходное значение остаётся у Qwen |
| Поиск | root/language → corpus entries | createCandidateIndexLoader.loadCandidateEntries; v5 alias→family→members, иначе registry/static index | gzip-сбой, fanout, blocked family, отсутствующие shards; fallback не равен этимо-подтверждению |
| Происхождение/модель | entries с family_id/components/sources → candidates/model_key | findCandidatesForRoot, isValidRuntimeCandidate, lexicalModelDescriptor, morphology, candidate-integrity | family_indexed принимается без обязательного family_verified; parser fallback и Qwen решения не заменяют ручное доказательство |
| Частоты | word/corpus sources → frequencyProfile F и интервалы | getFrequencyProfile; повторно проверяется до выбора моделей | отсутствующий файл и усечённый корпус → null/interval, не ноль; загрузка без общего deadline |
| Audit кандидатов | candidates/known models → validation/suggestions | refineCandidatesWithQwenAudit, applyQwenCandidateValidation; предложения сверяются с локальным индексом | предупреждения/fallback при сбое; для отдельных режимов failClosed:false |
| Представители | model_key/F → наиболее частотный представитель модели | reconcileModelRepresentatives/selectHighestFrequencyPerModel/selectBestFinalModels | анализируется больше пяти моделей, чтобы затем выбрать пять по P; это не лимит запросов |
| A | primary Di/Pr/Sh → association.association_score | analyzeAssociativeWord/buildEvaluation | некорректный primary отвергается; SWOW только диагностика |
| P и review | A/F → final_score, primary/review/interval/review_required | calculateFinalScore; review обязателен для любого конечного P | review error сохраняет primary, устанавливает review_required; budget/disable также блокируют подтверждение |
| Итоговый отбор | проанализированные модели → top5 selected | validateFinalCandidatesWithQwen → selectBestFinalModels | incomplete validation может оставить выбор; это отдельная неопределённость |
| Языковой итог | selected top5 → max P и A того же представителя | calculateLanguageScore | любой selected с review_required/неполным P/A блокирует associationNormalized |
| Демография/FA | положительные P/A/count → represented | requireSpeakerCount/calculateDirectDemographicAverage | N присваивается лишь represented; нулевые показатели исключаются |
| Решение/UI/сохранение | result+statuses → decision/reasons/card/draft | calculateFinalAssociation/buildDecisionReasons/renderResults/compactAssociativeState | смешение terminal/review, undefined→NaN, null→0 в draft |

Связанные модули: associative-calculation-runner.js, associative-state.js, qwen-client.js, candidate-index-loader.js, family-index-loader.js, candidate-static-search.js, candidate-finder.js, candidate-model-family.js, candidate-integrity.js, morphology/*, frequency-loader.js, config-frequency-sources.js, swow-client.js, target-meaning-translator.js, shared/methodology-calculation.mjs, api/qwen-analyze.js, api/qwen-candidates.js, shared/button-status.js и persistence UI.

## 4. Где теряется A

Актуальная реализация находится в https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/associativvordes/js/association-analyzer.js#L119:
1. отбираются selected с конечным P;
2. сортируются по P, A, F, слову;
3. проверяется incomplete по выбранным записям;
4. normalized остаётся max P;
5. associationNormalized становится null при incomplete.

Анализатор сохраняет A в `analysis.association.association_score` и `analysis.association.A_final`; script копирует его в `item.association_score` (https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/associativvordes/script.js#L534). Основной associationScoreGetter читает эти штатные поля. Потери A из-за несовпадения имени поля в нормальном production-пути не выявлено. Но standalone raw analyzer result с `association.A_final` напрямую не поддержан getter: это ограничение API, не доказанная причина regul.

| Возможная причина | Результат проверки |
|---|---|
| A не вычислено | primary error даёт A/P=null и selected=false; сам по себе не объясняет положительный P в штатном пути |
| A вычислено, но не сохранено | основной путь сохраняет A в двух доступных getter полях; не подтверждено |
| A сохранено в другом поле | штатные поля согласованы; нестандартный caller требует отдельной нормализации |
| A требует review | подтверждено изолированным исполнением; обязательность review подтверждена методологией |
| A исключено агрегированием | подтверждено: incomplete блокирует A, затем represented исключает язык |
| Асинхронная ошибка | review failure воспроизведён mock; exact timeout/403 исходного запуска не доказан |

shouldReviewPrimaryScore теперь проверяет любой конечный P (https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/associativvordes/js/association-analyzer.js#L48), а не прежнее окно 25–35, указанное в историческом PR #542. Config enableReview=true, budget=Infinity. Поэтому гипотеза «штатный конечный budget исчерпан» не соответствует текущему config без вмешательства caller.

Review failure не означает «ассоциации нет»: первичная A сохраняется. Отсутствие SWOW пары A не штрафует. Первичная и повторная оценки не усредняются и не заменяются: первичная остаётся nominal, повторная задаёт envelope.

Даже если максимальный P уже подтверждён, review_required у другого selected деривата скрывает A всего языка; LOWER_DERIVATIVE_REVIEW_BLOCK это подтверждает. Это консервативная политика полноты, требующая уточнения границ методологии, а не основание автоматически выбрасывать менее сильные дериваты.

## 5. N, форматирование и веса

Справочные N: en 1 493 000 000; de 133 000 000; fr 334 000 000; es 561 000 000; it 66 000 000; ru 210 000 000; сумма 2 797 000 000. requireSpeakerCount возвращает конечные положительные значения и бросает MISSING_LANGUAGE_SPEAKERS для неподдержанного языка.

Подтверждённая цепочка (https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/associativvordes/js/association-analyzer.js#L142 → https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/associativvordes/script.js#L1008):
- lang.speakers уже существует в справочнике;
- score.speakers присваивается только represented;
- таблица representedRows фильтрует count>0 и числовой P, не требует A;
- numberFormat.format(item.speakers) получает undefined, преобразует в NaN, русская локаль показывает «не число».
То же происходит с undefined weightedScore. Это не порча demographics и не неверный N=0; это пропущенное поле контракта строки плюс незащищённый renderer.

formatMetric, formatFixed, formatPercent защищают null/NaN. Прямые Intl.NumberFormat вызовы строки N/weightedScore защиты не имеют. Для speakersTotal/weightedScoreTotal объект результата содержит 0 при отсутствии represented, поэтому там настоящий вычислительный ноль, а не NaN. formatMetric принимает числовые строки и Boolean через Number; пустая строка в нём отличается от formatFixed. Это не причина наблюдаемых шести N.

FAᵥ=Σ(N×Pmax)/ΣN, среднее A=Σ(N×Arepresentative)/ΣN по represented. coverage=ΣNrepresented/2 797 000 000. totalAssociation в объекте — **невзвешенная сумма** языковых P; UI для надписи Σ(N×P) использует weightedScoreTotal, правильно. Нельзя заменять одно другим при исправлении контракта.

## 6. Что именно считается представленностью

| Категория | Нынешний источник | Для пользовательского исходного снимка |
|---|---|---|
| Найден язык | candidateCount/pool непустой | шесть с выбранными записями; точное число найденных не известно |
| Есть selected дериваты | selected в state.languages | по таблице 5×6; исходные записи не получены |
| Есть вычисленный P | calculateLanguageScore.normalized конечен | 6 |
| Есть первичный A | item.association_score | при штатном положительном P должен быть; actual state не получен |
| Есть финальный языковой A | associationNormalized конечен | 0 |
| Завершён исполнитель | terminal statuses | не устанавливается по одной итоговой таблице |
| Включён в FA | P>0 AND A>0 AND count>0 | 0 |
| Включена группа | group хотя бы одного represented | 0 |

Таблица UI и итоговый счётчик относятся к разным множествам. Название representedRows вводит разработчика в заблуждение. 0/6 означает «включено в итог», а не «кандидаты найдены в нуле языков». Аналогично охват 0 — охват допущенного расчёта, не доказательство лексического отсутствия regul.

hasCompleteAssociationData проверяет полноту только **после** represented-фильтра; associationRepresented совпадает с represented по построению. Внешние исключённые языки этим показателем не проверяются. Защита incomplete/reviewRequired учитывает их отдельно.

Нулевые, но конечные P/A исключаются условием >0. ZERO_AND_POSITIVE показывает: en с P=0,A=50 не входит в denominator и N таблицы снова undefined. Это явно существующая политика (тесты тоже ожидают отсутствие calculated data для всех нулей). Её методологическая корректность требует отдельного решения; нельзя менять denominator тихо.

## 7. Состояния и асинхронность

| Состояние | Происхождение/переход | Проверенный риск |
|---|---|---|
| idle | новый/сброшенный input | в status summary считается intermediate, поэтому незапущенный язык блокирует итог |
| loading_index | load по языкам, concurrency=3 | файловый fetch не имеет собственного общего deadline |
| grouping_candidates | непустой pool | короткий промежуточный переход |
| candidate_audit | после группировки, общий Qwen audit | сбой превращается в warning и fallback, не обязательно language failure |
| analyzing | последовательные candidate primary | scoreOf оценивает P, не полноту review |
| reviewing | callback запуска review | script createLanguageStatus('reviewing', oldStatus) может быть перекрыт oldStatus.status из-за порядка spread; runner callbacks срабатывают после возврата analysis |
| completed | обработка кандидатов закончилась | не означает подтверждение A; review_required не участвует в terminal-status выборе |
| completed_with_warnings | failedCount/языковые warnings | candidate/run warnings не всегда превращают языковой статус в warning |
| no_candidates | пустой pool | terminal; отсутствие membership не равно недоступному индексу; все no_candidates дают глобальный completed_with_warnings |
| index_error | catch загрузки | swallowed family error с успешным fallback сюда не попадает |
| qwen_error | все analyzed неуспешны | ошибка review при успешном primary сюда не попадает |
| incomplete | null F в versioned frequencyProfile или unknown status | проверяет весь source, включая невыбранные записи: может блокировать при полных selected |
| aborted | новый run/reset/signal | глобальный catch не переписывает все языковые промежуточные statuses |
| global error | неожиданный throw | глобальный error не член LANGUAGE_STATUSES; не подменять им успешное окончание |

Основной runner проверяет signal/runId до и после await, script тоже проверяет stale после primary. Старые результаты обычно отвергаются. Но runner получает изменяемый shared state: старый catch пишет globalStatus='aborted' даже после потери актуальности; setState может выдавать snapshot другого этапа. Ручной analyzeItem не передаёт signal/runId в analyzeAssociativeWord и записывает результат в item после await, затем пересчитывает текущий state.languages. Смена слова/reset/new run во время ручного запроса требует отдельного воспроизведения гонки; отсутствие guard подтверждено кодом, фактический ущерб в исходном regul не доказан.

У candidate-index-loader pending-запросы различаются по signal; у FamilyIndexLoader cache ключуется только path и возвращает promise первого caller. При конкурентном новом запуске отмена первого запроса может затронуть второй; отклонённый cache удаляется. Static/frequency/SWOW fetch не имеют общего дедлайна, поэтому «долго loading» нельзя трактовать как доказательство зависшего сервиса без traces.

Qwen callQwen ставит 15s timeout вокруг fetch, но очищает таймер в finally **до** res.json. Медленный response body не покрыт таймером. Backend callYandex также не передаёт abort/deadline upstream. Проверены механизмы исключений, но deployment max duration и upstream traces не доступны. Отмена local UI не доказывает отмену backend-запроса Yandex.

buildDecisionReasons даёт calculation_incomplete также для reviewRequired/representativeUncertain/thresholdUncertain и terminal index_error/qwen_error. Эти случаи могут возникнуть после физического завершения всех запросов. Именно здесь требуется точный текст «требуется повторная оценка/неопределённый представитель/ошибка языка», а не одно сообщение «Расчёт не завершён».

## 8. Методологическая сверка

Основание: https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/docs/methodology-20260909.md#L1, shared/methodology-calculation.mjs и существующие тесты. Это утверждённая **редакция в репозитории**; независимая полная книга/внешний документ не получены, поэтому нельзя утверждать сверку с любыми более поздними правилами.

| Правило | Реализация | Вердикт |
|---|---|---|
| A=min(Di,0.45Di+0.35Pr+0.20(100−Sh)) | calculateAssociationScore | соответствует |
| P=100(A/100)^0.65(F/100)^0.35 | calculateFinalScore | соответствует |
| SWOW диагностический | bonus=0 | соответствует |
| Наиболее частотный дериват внутри модели | selectHighestFrequencyPerModel/selectBestFinalModels | соответствует архитектуре; parser/Qwen ошибки могут менять модели |
| После оценивания оставить 5 наибольших P | runner анализирует модели, затем selectBestFinalModels | соответствует; высокая стоимость при резервном пуле |
| Балл языка=max P, A того же деривата | calculateLanguageScore | соответствует; русское «Средний P» неверно описывает max |
| FA/A по носителям represented | calculateDirectDemographicAverage | соответствует формуле; критерий represented с нулями требует уточнения |
| Review не заменяет primary | primary остаётся finalEvaluation | соответствует |
| Разногласие меняет представитель/представительство/порог — блок | representativeUncertain/thresholdUncertain | консервативно, не полноценное доказательство устойчивости |
| Недоступный review требует проверки | review_required, incomplete | соответствует; удалять блок нельзя |
| Пропуски частот не нули | frequency-loader | соответствует до сохранения; persistence null→0 нарушает смысл |
| Интервалы uncertainty | envelope primary/review; possible representatives | это не статистический доверительный интервал; null→0 в interval fallback может подменять пропуск |

Отдельные методологические вопросы: учитывать ли конечные нули в represented; должна ли неполнота слабого выбранного деривата скрывать уже подтверждённую primary A представителя; какие proof требования допускают резервный морфемный поиск без v5; следует ли all-source frequency null блокировать полный selected набор. Решения не принимаются в аудите.

## 9. Сравнительная диагностика и границы

Настоящий локальный v5: regul по 2 entries на язык; nat [279,195,204,244,73,356]; loc [99,44,87,88,51,11]; inter [2,2,2,2,2,1] при чтении root-route; zzzzzzzz — 0 во всех языках. Это число corpus records, не число моделей, не оценка полноты и не результат Qwen. Для elementType=preposition production **обходит v5 route** и использует registry/static index; root-route counts inter нельзя выдавать за production-поиск предлога.

Runner comparison использует названия nat/loc/inter/regul только как метки имитированных случаев: complete, partial, review_pending, no_candidates, external_failure. Внутри этих сравнений не проводится этимологическое подтверждение реальных слов. Функции результатов общие для всех семейств. Отсутствие производных и сбой primary не совпадают с review pending; соответствующие state/reasons сохранены в DIAGNOSTICS.txt. Успешный live полный расчёт другого реального корня не получен; это явное ограничение.

## 10. Матрица симптомов regul

| Симптом | Подтверждённая цепочка / оставшаяся граница |
|---|---|
| По 5 производных | top5 policy подтверждена; пять не признак полноты семьи. V5 содержит по две runtime entries, а faulty loader получает резервный пул. Точный состав пользовательских пятёрок неизвестен |
| Положительные шесть P | maxP сохраняется независимо от incomplete A. Конкретные исходные оценки повторно не вычислены |
| Все языковые A — | incomplete от selected review_required либо отсутствующего A/P. Mock review failure подтверждает stored A→null aggregate; exact причина исходного run неизвестна |
| N «не число» | confirmed undefined score.speakers для строк вне represented + Intl.NumberFormat |
| FAᵥ/среднее A отсутствуют | represented=[] при всех aggregate A=null; возвращаются null |
| Охват=0 | speakersTotal=0 по пустому represented; denominator=2 797 000 000 |
| Языки=0/6, группы=0/3 | это число допущенных языков/групп, не поисковое покрытие |
| Недостаточно данных | decisionStatusForResult при !hasCalculatedData или неконечном FA |
| «Расчёт не завершён» | reviewRequired → critical calculation_incomplete; terminal physical completion не учитывает эту разницу |
| «Нет рассчитанных данных» | !hasCalculatedData → critical no_calculated_data |

## 11. Проверки и открытые вопросы

EXISTING-TESTS.txt: семь существующих файлов, шесть проходят; methodology-20260909 падает на строке 45, actual=60.515946719946726, expected=60.03928052899482, пример mater/PH. Более поздние assertions этого файла не исполнены. Это независимый baseline failure, не доказательство ошибки A/P. ADDITIONAL-TESTS.txt: три проходят. Итого 9/10 файлов, полный npm suite не запускался, ничего не правилось.

Открыто: исходный export regul/targetMeaning и сетевые ответы review; upstream причина invalid primary/403 и длительности; полное живое окончание на шести языках; фактическое воспроизведение ручных async гонок; внешняя более поздняя методология; политика нулевого представительства, incomplete слабых/невыбранных моделей и недоступной Qwen candidate validation.

Аудит причин закрывает критерий **для каждого симптома**: либо подтверждён механизм, либо выше документирована невозможность подтвердить исходные данные. Это не сертификат исправности приложения и не утверждение об успешном полном production reproduction. Следующий этап — отдельное исправление по FIX-PLAN.md; merge и переключение production не выполнялись.

# Независимая верификация расчёта ассоциативности — этап 03

Дата: 09.10.2026 UTC. Вердикт: **FAIL**. Публикацию исправлений в production сейчас не рекомендовать. Несколько первопричин исправлены, формулы контрольных примеров совпали; однако остались подтверждённые дефекты адаптера страницы и состояний, общий CI красный, обязательная review в живом сценарии недоступна. Ни merge, ни deployment/promotion, ни функциональные исправления в этом этапе не выполнялись.

## 1. Проверенное состояние и источники

- Исходный main/production: `b266c92f00d111c1df53da05221fefac0db1dc3a`.
- Исходный аудит: [PR #658](https://github.com/landquart/interal/pull/658), `bb2ccdbe203f8472b67b8610cd73f3be421c6d00`.
- Исправления: [draft PR #659](https://github.com/landquart/interal/pull/659), ветка `fix/associativvordes-calculation-20261009`, head `aac1ef8da3baf06e3e00ca2bffb18cccd40d8c73`, полный tree `bf21fea4d69c1021f0d7a8416396de9547e2456b`. Последний функциональный коммит `e08a573e829329e042b5cadef70dd18a2bb857b3`, tree до документации `8a795a3618b65cb911171dcdb0f81e10785d427a`.
- Проверены семь коммитов исправлений: `7f6ee869`, `55c7496b`, `b9004af9`, `7973de64`, `8bf32df5`, `b0cf509c`, `e08a573e`; последующий `aac1ef8` меняет отчёты. Подробная связь SHA/ID есть в FIX-REPORT.
- Remote обновлён в начале и повторно перед фиксацией отчёта. Прочитаны AUDIT, ISSUES, FIX-PLAN, FIX-REPORT, CHECKPOINT; утверждения автора перепроверены исполнением, а не приняты как доказательства.
- Проверочная ветка: `verify/associativvordes-calculation-20261009`, основана на canonical remote head исправлений. Базовый коммит извлечён в отдельный detached worktree, без изменений кода.
- Diff methodology-calculation, demographics, документов методологии и v5/v6 данных относительно baseline пустой. Коэффициенты .45/.35/.20 и .65/.35, пороги 35, минимум 3 языка/2 группы, maximum P и демографический denominator не изменены. Изменения тестов просмотрены: числовые ожидания формул не подменены; изменения строковых проверок реализации сами по себе не доказывают функциональную корректность.

Ссылки на код ниже относятся к **aac1ef8**, а не подвижному main. Базовый код: [baseline analyzer](https://github.com/landquart/interal/blob/b266c92f00d111c1df53da05221fefac0db1dc3a/associativvordes/js/association-analyzer.js).

## 2. Метод проверки и воспроизведение baseline

Разделены три уровня доказательств: реальные функции с фиксированными данными; фактические функции страницы, извлечённые в VM с управляемыми зависимостями; реальное приложение в cloud Chrome на Vercel preview. VM и mocks не названы браузерным или интеграционным успехом.

[VERIFY-BASELINE.mjs](VERIFY-BASELINE.mjs) импортирует baseline analyzer. Для пяти выбранных производных в каждом из шести языков, исходных P=74.87/48.66/35.24/56.71/94.08/52.64, A=85 и review_required=true независимо повторены: все языковые A=null, FA=null, охват=0, 0 языков/0 групп и шесть N «не число». [Результат](VERIFY-BASELINE.txt). Это воспроизведение исходного **механизма** на фиксированных данных, не восстановление неизвестных исходных 30 слов пользователя.

[VERIFY-FAMILIES.mjs](VERIFY-FAMILIES.mjs) работает с настоящими gzip файлами через Response без предварительной распаковки. На baseline regul возвращает 152/136/108/121/140/72 резервных записи и familyIndexStatus=unavailable; на исправлениях по две v5-записи и status=loaded. [Baseline](VERIFY-BASELINE-FAMILIES.txt), [исправления](VERIFY-FAMILIES.txt). Относительные URL разрешены относительно /associativvordes/; ошибочная база URL не используется как свидетельство.

## 3. Независимая оценка каждого AC-ID

| ID | Статус этапа 03 | Доказательства и границы |
|---|---|---|
| AC-001 | Подтверждено исправление | Настоящие gzip/decoded JSON проходят единый transport; baseline fallback повторён; regul на preview имеет 2 записи/язык. transport regression проходит. |
| AC-002 | Подтверждено исправление | N назначается всем строкам до represented; шесть справочных N видимы в живом regul; excluded weightedScore=null. Unknown represented language строго отвергается. |
| AC-003 | Исправлено частично | Числовая primary A сохранена отдельно от review, причины missing_A/review_required проходят; обязательная проверка сохранена. Но page prefilter уничтожает missing_P и счётчик primary A: V-001. |
| AC-004 | Исправлено частично | Review callbacks реально обрамляют запрос; execution/decision различаются, terminal errors tested. Отмена оставляет language loading_index (V-003); строки завершённого анализа остаются pending (V-004). |
| AC-005 | Подтверждено исправление | Null/blank/bool/NaN/Infinity не превращаются в ноль; measured zero сохранён; legacy ambiguous zero инвалидируется, proven primary zero сохраняется. Новый schema marker additive, snapshot version=2. numeric regression проходит. |
| AC-006 | Исправлено частично | Edit/delete/reset/new run guards и поздний ответ изменённого слова проходят. Однако снятие selected в ожидающей ручной операции переписывается поздним ответом: V-002. |
| AC-007 | Подтверждено исправление | Старый runner не меняет новый shared state; разные signals не делят pending family request; aborted ответ не попадает в cache. Lifecycle tests воспроизведены. Тотальная проверка всех возможных гонок не заявлена. |
| AC-008 | Подтверждено исправление | Deadline охватывает fetch+body; hanging JSON body, external abort, timeout и cleanup проходят services tests. Реальная достаточность 70 s для крупных ресурсов/медленных сетей не измерена. |
| AC-009 | Исправлено частично | Backend больше не выдаёт успешный semantic-null ответ, HTTP502/504 и upstream error различимы; services tests проходят. Живой обязательный review продолжает давать QWEN_UPSTREAM_HTTP_ERROR. Доступ модели/upstream первопричина не установлена без внешних журналов. |
| AC-010 | Исправлено частично | Max P/A представителя подписаны точнее, найдено/выбрано/P/verifiedA/included разделены, 0 включённых не маскирует 6 найденных. V-001 ломает primaryALanguages; V-004 противоречит карточкам. |
| AC-011 | Не исправлено | Finite zero по-прежнему исключается из represented/denominator. Независимый zero example подтверждён. Это оставленный методологический вопрос, не новое техническое разрешение включить ноль. |
| AC-012 | Исправлено частично | Реальный page-wrapper transport regression проходит и browser regul подтверждает v5 path. Однако preposition path страницы не соответствует контракту loader (V-005); browser CLI не запускается локально. |
| AC-013 | Не исправлено | failClosed:false final candidate validation и fallback оставлены. Наличие предупреждения не гарантирует блок принятия. Полнота этимологических доказательств не подтверждена: §7. Нужно отдельное методологическое решение. |
| AC-014 | Не исправлено | На baseline и исправлениях methodology test:45 actual=60.515946719946726, expected=60.03928052899482. Ошибка общего CI повторена независимо, не регрессия A/P. |
| AC-015 | Не исправлено | selected-vs-all-frequency policy сохранена. Maximum-five область расчёта не изменять без разрешения. Но missing_P диагностика внутри выбранных строк теряется до этой области: V-001, отдельный технический дефект. |

«Не исправлено» для методологических вопросов означает сохранённую открытую проблему; это не рекомендация менять методологию в текущем PR. AC-009 production access error не равен доказанной ошибке формулы.

## 4. Независимые контрольные вычисления

[VERIFY-ORACLE.py](VERIFY-ORACLE.py) использует Decimal с точностью 45 и **не импортирует функции приложения**. [Ожидания](VERIFY-ORACLE.txt). [VERIFY-INDEPENDENT.mjs](VERIFY-INDEPENDENT.mjs) сравнивает приложение с фиксированными результатами oracle, а не с вызовом той же функции для expected. [Полный журнал](VERIFY-INDEPENDENT.txt).

| Вход | Независимое ожидание | Реализация |
|---|---|---|
| Di=80, Pr=60, Sh=20 | A=min(80,36+21+16)=73 | 73 |
| A=73, F=64 | P=100×.73^.65×.64^.35=69.714457150604890… | 69.71445715060489 |
| Di=10, Pr=100, Sh=0 | cap directness: A=10 | 10 |
| null Di | нет A | null |
| два деривата P/A=40/90 и 70/60 | представитель второго: P=70,A=60 | совпало; не arithmetic mean |
| шесть исходных P, A=85 | ΣN=2,797,000,000; ΣNP/ΣN=64.033192706471219…; Ā=85; охват=1; 6 языков/3 группы; принятие | совпало в пределах 1e-10 |
| en/de/fr, P=A=35 | ≥35, 3 языка/2 группы; coverage=1,960,000,000/2,797,000,000=.700750804433321…; принятие | совпало |
| те же P=A=34.999 | отказ | совпало |
| P=A=0 | сохраняются числовые нули, excluded, охват0, отказ по текущей policy | совпало; AC-011 открыт |
| mandatory review у всех пяти дериватов каждого языка | primaryALanguages=6, verifiedA=0, included=0, FA=null, отказ | совпало в pure layer |
| P=60,A=null / P=null,A=80 / review_required | missing_A / missing_P / review_required, подтверждённый A=null | pure layer совпало; page missing_P расходится |
| en interval P=[30,50], de/fr P=40 | weighted нижняя граница ниже35, верхняя выше35, threshold uncertainty блокирует принятие | совпало |

Интервалы primary/review — envelope, не статистический confidence interval. Формулы и ограничения не ослаблены ради получения положительного результата. Успешное принятие проверено на воспроизводимом полном fixture; успешный live acceptance при недоступном review не заявлен.

## 5. Регрессионные проверки

- Независимый запуск целевой команды из FIX-REPORT: **20/20**, 0 ошибок — [VERIFY-REGRESSION.txt](VERIFY-REGRESSION.txt). Прочитаны реальные assertions, включая actual page VM, cache cancellation, malformed semantic data и body timeout.
- `npm test`: открывает 85 файлов, проходит первые **77** и останавливается на AC-014 — [VERIFY-FULL-TESTS.txt](VERIFY-FULL-TESTS.txt). Остальные **7/7** отдельно запущены без изменения runner — [VERIFY-REMAINING-TESTS.txt](VERIFY-REMAINING-TESTS.txt). Совокупно **84/85**, единый npm test **не зелёный**.
- Baseline methodology failure повторён: [VERIFY-BASELINE-METHODOLOGY.txt](VERIFY-BASELINE-METHODOLOGY.txt).
- Family/model regression: **18/18** — [VERIFY-PROVENANCE.txt](VERIFY-PROVENANCE.txt). Это проверка алгоритмических guards и curated examples, не доказательство этимологии всех corpus members.
- Дополнительный independent diagnostic воспроизводит V-001/002/003/005. Exit0 означает успешно воспроизведённые наблюдения, **не исправность приложения**; assertions в этом диагностическом скрипте ожидают обнаруженные дефекты. Скрипт не добавлен в продуктовый test suite.
- `git diff --check` успешен. Изменения этапа03 ограничены audit каталогом. Новых функциональных тестов/исправлений не добавлено.

## 6. Реальная повторная проверка regul

Preview: [страница](https://interal-g7u2n84dr-landquarts-projects.vercel.app/associativvordes/), deployment `dpl_F35PyNuZfNATVoGNrxFKYwhGTYPz`, READY, SHA=aac1ef8. Использована временная авторизованная ссылка согласно навыку vercel:access-protected-vercel-deployment; защита deployment не отключалась, токен не сохраняется в отчёте. Проверка состоялась в реальном cloud Chrome; targetMeaning=`правило`, elementType=`root`. Исходное пользовательское значение/снимок неизвестны, поэтому новые scores не обязаны совпадать с первоначальными P.

| Язык | Найдены реальные v5 слова | Выбрано | Первичные P/A | Review / итог |
|---|---|---:|---|---|
| en | regular, regulation | 1 (regulation) | 84.38 / 95 | QWEN_UPSTREAM_HTTP_ERROR; языковой A отсутствует |
| de | regulär, regulierung | 0 | оба P/A отсутствуют | primary failure; tab «ошибка Qwen» |
| fr | régulation, régulier | 0 | оба P/A отсутствуют | primary failure; tab «ошибка Qwen» |
| es | regulación, regular | 0 | оба P/A отсутствуют | primary failure; tab «ошибка Qwen» |
| it | regolare, regolazione | 1 (regolare) | 90.74 / 100 | QWEN_UPSTREAM_HTTP_ERROR; языковой A отсутствует |
| ru | регулирование, регулярный | 1 (регулирование) | 64.40 / 75 | QWEN_UPSTREAM_HTTP_ERROR; языковой A отсутствует |

Все N корректны: 1,493,000,000 / 133,000,000 / 334,000,000 / 561,000,000 / 66,000,000 / 210,000,000. Невключённый вклад отображён «—». Итог: FA/Ā «—», охват0%, включено0/6 и0/3; дополнительная строка: найдено6 / выбрано3 / рассчитанP3 / подтвержденаA0 / включено0. Решение «Недостаточно данных», причина «Обязательная проверка не завершена», предупреждение Qwen. Это корректное запрещение неподтверждённого результата; **полный успешный расчёт regul не подтверждён**.

Для regulation раскрыты реальные детали: модель regul-ation, family match, четыре corpus sources, Di95/Pr100/Sh0, F67.71, A95 и объяснение модели. Origin соответствует имеющейся curated v5 записи; независимое переутверждение исторических evidence не проводилось. Первичная ошибка остальных строк доступна в warning title, но статус строки ошибочно «не анализировалось» (V-004). То же написано рядом с конечными P/A, и показана кнопка повторного анализа. Это реальный UI дефект, не только гипотеза VM.

Матрица исходных симптомов: N NaN устранён; primary A теперь объясняет missing confirmed A; 0/6 и0/3 остаются количеством **включённых**, найдено отдельно6; generic incompletion заменён обязательным review; missing FA при review error сохранён правильно; противоречие карточек/строк остаётся. Фиксированный полный fixture подтверждает исправленный FA, live зависит от upstream.

## 7. Другие кандидаты, предлоги и принадлежность

Локальный loader: regul [2,2,2,2,2,2], nat [279,195,204,244,73,356], loc [99,44,87,88,51,11], inter root [2,2,2,2,2,1]. Большой/малый пул и неполное покрытие рассмотрены; число corpus records не равно числу моделей/подтверждённых этимологических членов.

Проверка обязательных примеров user: в en nat **нет** nation/natural/natalism; loc **нет** location/local/locomotive; inter содержит international, но нет interval/internet. Первые nat/loc записи имеют только compound_morphology из candidate_index: agglutinative→native (family_verified=false) и agallochum→loc (family_verified=false). Такое свидетельство не является независимым этимологическим подтверждением. isValidRuntimeCandidate допускает family_indexed=true без family_verified. Утверждать точную полноту/принадлежность по этим индексам нельзя. Данные неизменны относительно baseline: это **не доказанная новая порча данных исправлениями**. Исправление transport делает этот маршрут реально доступным, поэтому взаимодействие с непроверенными memberships требует отдельного решения/регрессионного доказательства (V-006). Нельзя автоматически считать все перечисленные corpus слова допустимыми или редактировать исторические evidence в этапе03.

Предлог inter: direct loader с elementType=root возвращает2 en, с preposition возвращает0; actual page getLanguageCandidates вообще не передаёт elementType (V-005). В браузере выбран «предлог», meaning=`между`, но запросы пошли для interdisciplinaire/internacional/interdisciplinario из root family. Запуск затем отменён через reset; его полный итог не объявляется проверенным. Это нарушение документированного FIX-PLAN route, а не разрешение менять v5/v6.

Дополнительный живой запуск `zzzzzzzz`/`правило` неожиданно нашёл French bizzzzzzzz и итальянскую строку; primary A/P=0, review error, решение insufficient_data. Поэтому этот ввод **не считать чистым no_candidates**. Отсутствие кандидатов подтверждено отдельными empty fixtures и terminal no_candidates tabs для en/de/es/ru. Нулевое значение реально показано 0.00, не «—».

Многоязыковые успешный/неуспешный acceptance, missingA/P, pending review, interval uncertainty, primary/index error, no_candidates, stale run и restart покрыты фиксированными независимыми примерами и отдельно перезапущенными tests. Полные live nat/loc при сотнях кандидатов не проведены: они требуют длительных внешних запросов и утверждённой этимологической проверки. Технические правки не ориентированы исключительно на regul, но полноту точных связей подтвердить не удалось.

## 8. UI, асинхронность и deployment

Реально проверены загрузка страницы, ввод, повторный запуск без reload, переключение шести языков, раскрытие деталей, N/ноль/пропуски, итоговые причины, disabled кнопка во время запросов и reset. После подтверждения reset активного inter ввод очищен, кнопка снова доступна; поздние ответы не восстановили результаты при повторном осмотре. Числа NaN/Infinity/undefined не наблюдались; существующий визуальный стиль сохранён. Русский интерфейс проверен; EN строки покрыты renderer tests, живой EN и mobile viewport не проверены. Adaptive качество нельзя объявить подтверждённым по одному desktop viewport.

VM проверил поздний manual response, page aggregate и preposition options. Cancellation runner проверен отдельно: globalStatus=aborted, язык остаётся loading_index, deriveGlobalStatus возвращает loading; catch не вызывает onStateChange после терминального изменения. Это V-003. Проверенные stale guards не отменяют этот дефект. Temporary service failure/deadline обработаны mocks, реальные primary/review errors встречены в браузере; причина доступа upstream остаётся неизвестной.

[Локальная browser CLI](VERIFY-BROWSER-CLI.txt) не запустилась: отсутствует chromium_headless_shell. Новая установка не повторялась: ранее сохранён достоверный результат повреждённой загрузки. Реальный cloud Chrome доступен независимо от этого ограничения. CLI test внедряет runtimeAdapter; его наличие не заменило бы проверку штатного script.js.

Production metadata: deployment `dpl_Era2Mu6evrdJF1zXwa68jZPFJGqx`, main b266c92, READY/target production. Preview READY/aac1ef8 не означает production publication. Импорты и gzip пути preview работали; новый маршрут воспроизвёл curated regul. Продвижение/переключение v5→v6 не выполнялись. Общий GitHub Tests [run 37866909308](https://github.com/landquart/interal/actions/runs/37866909308) завершился failure именно methodology test:45; browser job step skipped. Другие инструменты проверены существующими общими tests (кроме указанного baseline PH). Полное live тестирование всех инструментов/кеша CDN не проведено.

## 9. Новые/оставшиеся дефекты и точный следующий этап

Ссылки: [script.js](https://github.com/landquart/interal/blob/aac1ef8da3baf06e3e00ca2bffb18cccd40d8c73/associativvordes/script.js), [runner](https://github.com/landquart/interal/blob/aac1ef8da3baf06e3e00ca2bffb18cccd40d8c73/associativvordes/js/associative-calculation-runner.js), [loader](https://github.com/landquart/interal/blob/aac1ef8da3baf06e3e00ca2bffb18cccd40d8c73/associativvordes/js/candidate-index-loader.js).

| ID / приоритет | Причина, условия, ожидаемое → фактическое | Требуемая следующая правка / тест |
|---|---|---|
| V-001 / P1, AC003/010 | script:828–850 scoringCandidates фильтрует selected с finite P **до** диагностики. Selected P=null,A85: pure incomplete=true/missing_P/primaryA1 → page incomplete=false/no reasons/primaryA0. При en/de/fr P60,A70 и es selected P=null,A85 actual page accepted=true, прямой aggregator accepted=false: скрывает неполноту selected (VERIFY-INDEPENDENT V-001 MIXED_ACCEPTANCE). | Разделить входы диагностики и прежнего maximum-five scoring; не расширять методологическую область без решения AC015. Actual calculateFinal VM+browser test missingP/A, counts и acceptance. |
| V-002 / P1, AC006 | script:1129–1170 updateItem отменяет только word; analyzeItem присваивает selected=finiteP. Снять checkbox пока promise pending → поздний ответ вновь selected=true. | Уважать последнюю пользовательскую selection, token/revision/cancel policy для этого поля. Deferred actual analyzeItem test: deselect/edit/delete/reset/restart; итог не должен учитывать исключённое слово. |
| V-003 / P1, AC004 | runner:470–478 abort меняет только global и кнопку; языки остаются intermediate, callback не получает terminal snapshot. Abort при loading_index → global aborted, language loading_index, derived loading. | Терминализировать активные статусы current run и доставить terminal state без нарушения stale guard. Tests abort в index/analyzing/reviewing плюс повторный запуск; UI не остаётся активным. |
| V-004 / P1, AC004/010 | script:720/777 создаёт pending; analyzeCandidateItem:503–547 success и failedAnalysis сохраняют старый analysisStatus из ...item. rowHtml:950–964 выбирает pending прежде actual analysis. Live regulation P84.38,A95 → «не анализировалось». | Задавать действительный terminal item status на success/error/review pending и сохранить numeric verification отдельно. Tests фактической page pipeline+rowHtml, primary fail/review fail/success; browser совпадение таблицы/карточек. |
| V-005 / P1, AC012 | script:584–587 передаёт только signal, loader:310 default root. preposition inter → root v5 route. Actual VM options не содержит elementType; live запросы корневых записей. | Передавать captured elementType и подтвердить отдельно root/preposition route, не менять семейства/формулы. Actual page adapter test запрета v5 для предлога; controlled corpus и browser. |
| V-006 / P1, доказательства / AC013 | Восстановленный маршрут выдаёт unverified морфологические nat/loc memberships, обязательные examples отсутствуют; runtime guard принимает indexed без verified. Полная этимологическая допустимость не доказана. | Отдельно проверить существующие evidence и роль unverified records до selected/final acceptance. Не редактировать модель v5/v6 без разрешения. Negative substring/distant-ancestor tests и positive user examples с независимыми источниками. |
| AC009 / P1 эксплуатация | Обязательная review реально недоступна; typed code объясняет сбой, но не восстанавливает сервис. | Получить upstream журнал/доступ модели и успешный primary+review во всех 6 языках. Не обходить review. Повторить живой regul, сохранив безопасный экспорт без ключей. |
| AC014 / P1 CI | Baseline PH failure блокирует общий Tests, browser step не запускается. | Отдельное расследование mater/PH владельцем методологии; не подгонять expected. Добиться зелёного общего CI и browser job. |
| AC011/013/015 / отдельное решение | Нуль, failClosed fallback и selected-vs-all policy не разрешены. | Зафиксировать утверждённое решение отдельно от технических правок; потом независимая проверка соответствующих guards. |

V-001 счётчик — новая неполнота диагностики, предфильтрация существовала раньше. V-002/003/004/005 существовавшие либо оставленные дефекты, не заявлены все как регрессии новых строк. V-006 — нехватка доказательств exact family и ограничение snapshot, не утверждение доказанной ложной этимологии всех перечисленных слов.

## 10. Итог и условия повторной верификации

**FAIL** обусловлен воспроизводимыми V001–005 и отсутствием достаточных доказательств обязательного live review/точных семейных связей, а не требованием искусственно включить неполные данные в FA. Подтверждены transport, reference N, null persistence, строгие числа, cache/stale guards и полные deadlines; контрольные A/P/maxP/веса/FA/thresholds совпадают.

Следующая итерация должна отдельно устранить технические V001–005, получить рабочий review и зелёный CI, подтвердить exact-family interaction, затем повторить independent fixtures и browser. Открытые методологические вопросы оставить явными. Никакого разрешения merge или production promotion этот отчёт не даёт.

Воспроизводимые команды из корня проверенного checkout:

```sh
npm ci --ignore-scripts
python audit/associativvordes-calculation/VERIFY-ORACLE.py
node audit/associativvordes-calculation/VERIFY-INDEPENDENT.mjs
node audit/associativvordes-calculation/VERIFY-FAMILIES.mjs
node audit/associativvordes-calculation/VERIFY-BASELINE.mjs /path/to/baseline-worktree
node audit/associativvordes-calculation/VERIFY-FAMILIES.mjs /path/to/baseline-worktree
node --test tests/associative-calculation-*.test.mjs tests/associative-atomic-pipeline.test.mjs tests/associativvordes-error-handling.test.mjs tests/associativvordes-target-translation-batch.test.mjs
npm test
```

Для baseline worktree использовать именно b266c92. Независимые диагностические scripts не вызывают реальные внешние сервисы, не сохраняют production данные и не исправляют код. Предварительный oracle был вычислен отдельно Decimal; окончательные литералы expected перенесены из его результата до успешного comparison.

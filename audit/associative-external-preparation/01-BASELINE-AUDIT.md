# Аудит готовности к внешним морфологическим ресурсам

Дата проверки: 18 октября 2026. Область: `landquart/interal`, `associativvordes/`. Режим: исследование и новая документация; функциональные исправления, импорт, применение разметки, пересборка индексов и merge не выполнялись.

## 1. Решение

**К проектированию общей структуры внешних данных переходить можно. К импорту в действующие семьи и массовому автоматическому применению — нельзя.** Основа v6 уже реализована: её нужно расширять адаптерами внешних свидетельств, а не создавать повторно. Она пока не входит в `main`. Самостоятельный слой внешних наблюдений можно проектировать без изменения production; его последующее соединение с membership требует условий из [BLOCKERS.md](BLOCKERS.md).

Здесь «работает» означает подтверждённое поведение конкретного кода или прошедший указанный CI, а не правильность всех лингвистических решений. Структурная сохранность, лингвистическая достоверность и готовность production оцениваются отдельно.

## 2. Зафиксированные снимки и инструкции

Выполнены свежий clone, `git fetch --prune origin`, просмотр remote refs и история коммитов. Remote fetch/push: `https://github.com/landquart/interal.git`. Default branch: `main`. `AGENTS.md` не найден ни в дереве `main`, ни в дереве исследованной v6. Прочитаны `README.md`, существующие отчёты и документация архитектуры; ограничения настоящей задачи соблюдены.

Обозначения во всех пяти документах:

| Метка | Проверенный ref | SHA | Что относится к этому снимку |
|---|---|---|---|
| M | `origin/main` | `39d8a47d2588b55c4c750cdd9985b5d6ba26ec73` | Текущий основной код, v5, исправления расчётов |
| V | `origin/fix/associative-component-membership-20261001` | `9fff76431a86a06df6db69b64d7f2ca4c871f1b7` | Ветка #651 после включения #652; код и данные v6 |
| V-CI | `origin/feat/associative-family-v6-head-architecture-20261003` | `1c04d9ae48d079b56b6c37f854f96280b1915a10` | Последний head #652 с успешными Tests и v6 audit |
| I | `origin/fix/associative-information-20260930` | `3da2717f7de702f68cf465c7434e15ff7abd2d50` | Открытая основа цепочки #650 |
| C | `origin/fix/associativvordes-calculation-20261009` | `bdc24d2a5ab377b1bfd4278909f76edb337ed965` | Исправления #659, включая #661 |

`git diff V-CI V` пуст: дерево V совпадает с деревом прошедшего CI V-CI. `git merge-base --is-ancestor V-CI M` возвращает 1; для C→M возвращает 0. Следовательно, успешный CI v6 нельзя выдавать за CI `main`, а наличие #652 нельзя трактовать как rollout.

Для получения конкретного файла без переключения рабочего дерева: `git show <SHA>:<путь>`. Путь с меткой V в следующих документах **отсутствует в M**, если не оговорено обратное.

## 3. PR и фактически объединённые изменения

Состояния получены 18.10.2026 через GitHub REST `pulls?state=all&sort=updated&direction=desc&per_page=40`; даты ниже — UTC.

| PR | Фактический результат | Вывод для аудита |
|---|---|---|
| [#622](https://github.com/landquart/interal/pull/622) | merged 20.09 в main | Коррективная v5 принята владельцем с оговорённым риском |
| [#624](https://github.com/landquart/interal/pull/624), [#629](https://github.com/landquart/interal/pull/629), [#630](https://github.com/landquart/interal/pull/630) | merged в main | Git-backed gzip, материализация и удаление старого Blob uploader присутствуют |
| [#631](https://github.com/landquart/interal/pull/631)–[#633](https://github.com/landquart/interal/pull/633) | merged в main | Аудиты repository/production существуют, но их результаты относятся к своим снимкам |
| [#649](https://github.com/landquart/interal/pull/649) | merged в main | Ограниченные исправления nitidus/коротких RU/маршрутов вошли |
| [#650](https://github.com/landquart/interal/pull/650) | open, base main | Консолидация information из этой цепочки не вошла в main |
| [#651](https://github.com/landquart/interal/pull/651) | open, base ветка #650 | Component-membership/национальные семьи и v6 находятся здесь |
| [#652](https://github.com/landquart/interal/pull/652) | merged 08.10 **в ветку #651**, merge `9fff7643` | V6 существует, но не интегрирована в main |
| [#658](https://github.com/landquart/interal/pull/658) | closed, API `merged_at=2026-10-09T21:38:00Z` | Исходный аудит расчётов имеется в main; фактические файлы прочитаны |
| [#659](https://github.com/landquart/interal/pull/659) | merged 09.10 в main, `39d8a47d` | Transport/numeric/lifecycle/services исправления уже в основном коде |
| [#661](https://github.com/landquart/interal/pull/661) | merged 09.10 в #659, `bdc24d2a` | Пять postverification-исправлений вошли транзитивно через #659 |
| [#660](https://github.com/landquart/interal/pull/660) | open, head `9665db17d5e7971c2198fefc546b4e591b4f1676` | Историческая независимая FAIL-ветка; не считать её кодом main или последним вердиктом после #661 |

Техническое подтверждение v5: M `associativvordes/js/family-index-loader.js`, `FAMILY_INDEX_VERSION='5'`, `FamilyIndexLoader.constructor`; M `associativvordes/js/candidate-index-loader.js`, `createCandidateIndexLoader`. Параллельность v6: V `associativvordes/js/associative-family-v6.js`, `validateCatalog`, требует `production_enabled === false`.

## 4. CI: подтверждённые результаты и ограничения

Проверены GitHub Actions runs, jobs/steps и логи двух упавших main jobs. Дорогие проверки повторно не запускались.

| Снимок / workflow | Run | Результат и точная интерпретация |
|---|---|---|
| M / Tests | [37994612465](https://github.com/landquart/interal/actions/runs/37994612465) | failure: `tests/methodology-20260909.test.mjs`, `near`, строка 45: PH mater `60.515946719946726 != 60.03928052899482`. Suite останавливается здесь; browser step skipped |
| M / Audit repository associative family v5 | [37994612439](https://github.com/landquart/interal/actions/runs/37994612439) | success: структурная проверка текущего repository-backed v5 |
| M / Audit production associative family v5 | [37994612402](https://github.com/landquart/interal/actions/runs/37994612402) | failure до сценариев: source lemmas `4924980` ≠ classified/materialized `4924281`. Лог job `114037334726`, `runViewport`, тест строка 130. Не доказательство поломки всех сценариев: они не были выполнены |
| M / pages build and deployment | [37994610410](https://github.com/landquart/interal/actions/runs/37994610410) | success; это GitHub Pages, не доказательство текущего SHA Vercel |
| C / Associative Verification | [37994573422](https://github.com/landquart/interal/actions/runs/37994573422) | success: целевые регрессии и browser. Дерево вошло в M; не выдавать за отдельный новый main E2E |
| V-CI / Tests | [37710521734](https://github.com/landquart/interal/actions/runs/37710521734) | success на v6-ветке |
| V-CI / Audit parallel associative family v6 | [37710521729](https://github.com/landquart/interal/actions/runs/37710521729) | success, включая replay, source enumeration, planning, contamination, shadow и **Independent foundation closure gate** (job `113095134020`) |

Production-v5 assertion в M `tests/browser/associative-family-v5-production.playwright.mjs::runViewport` требует одновременно равенства source/classified и нуля `lemmas_with_zero_family`. Но M `associativvordes/family-index-v5/report.json::invariants` сохраняет 699 записей без семьи; M `audit/associative-family-v5/repository-static-integrity.json::counts` согласуется с этим. Рекомендация — отдельно согласовать тестовый контракт с сохранением corpus IDs, не добавлять ложные семьи ради нулевого счётчика. Точная причина расхождения «source = classified» — различающиеся множества, а не исчезновение 699 исходных слов.

Текущий live deployment Vercel 18.10 не проверялся прямым браузером/запросом: вывод о production опирается на маршрут основного кода и последний существующий production CI. Проверка сетевого primary/review-сервиса с production credentials не выполнялась.

## 5. Реальные данные и статус v5/v6

| Величина | M/v5 | Основание |
|---|---:|---|
| Source run | 35647932153 | `family-index-v5/manifest.json::provenance`, `repository-provenance.json::source_run_id` |
| Семьи / aliases | 2 456 543 / 1 934 050 | `family-index-v5/manifest.json::counts` |
| Исходные lemma records | 4 924 980 | тот же `counts.lemmas` |
| Компонентные свидетельства | 9 349 982 | тот же `counts.components`, это не memberships |
| Memberships | 10 078 319 | `audit/associative-family-v5/repository-static-integrity.json::counts.memberships` |
| Уникальные материализованные lemmas / без семьи | 4 924 281 / 699 | тот же `counts` |

Массовый пересчёт не повторялся; числа прочитаны из текущих файлов, а CI repository audit подтверждает структурную согласованность на M. V5 — действующий Git-backed индекс с историческим `OWNER_ACCEPTED_AT_RISK`, а не независимо сертифицированный словарь (`audit/associative-family-v5/audit-summary.md`, разделы verdict/annotation).

V: прочитаны небольшие сохранённые gzip-массивы без rebuild: `family-index-v6/generated/heads.json.gz` — 18 602 головы, из них `lexical_head` 118, `historically_reviewed_lexical_head` 124, `legacy_exact_record` 18 360; `edges.json.gz` — 18 769; `memberships.json.gz` — 21 359; `catalog.json::families` — 19. Эти величины не означают покрытие всего v5: большая часть head objects — конечные legacy-доказательства без установленной общей словарной головы.

V `audit/associative-family-v6/regul-20261008/WORK-REPORT.md`: regul — 557 accepted, 12 excluded, 2 089 uncertain в конечном поисковом наборе 2 658. Наличие v6-разметки regul не исправляет production v5 само по себе.

## 6. Актуальность прежних отчётов

| Документ | Что сохраняет силу | Что устарело |
|---|---|---|
| M `audit/associativvordes-calculation/AUDIT.md`, `ISSUES.md` | Исходные механизмы и открытые AC-011/013/014/015 полезны | Исходный SHA b266c92 и описание ещё не исправленных transport/UI ошибок нельзя применять к M |
| M `audit/associativvordes-calculation/CHECKPOINT.md`, `FIX-REPORT.md` | История исправлений, ограничения live service | Фразы «не merged», «Chromium недоступен», «main=b266c92» относятся к прежним этапам; последующий #661 и CI C учтены выше |
| M `audit/associative-family-v5/audit-summary.md` | Недостаток независимой лингвистической оценки и acceptance-at-risk | Итоговые сентябрьские 10 080 875 memberships / 685 без семьи устарели: текущие 10 078 319 / 699; прежний browser pass не заменяет последний failure |
| V `audit/associative-family-v6/FOUNDATION-READINESS.md` | Описания F01–F04 и пределы лингвистической проверки | Заголовок FAIL и «все три PR open» устарели: guard code исправлен, strict gate V-CI success, #652 merged в #651 |
| V `audit/associative-family-v6/prompt10-independent-20261007/DECISION.md` | Историческая независимая проверка и словарные вопросы | Не финальный технический статус после regul/guards |
| V `audit/associative-family-v6/regul-20261008/WORK-REPORT.md`, `PUBLICATION.md` | Конечная regul-разметка, границы неопределённости, сохранность | Публикационные SHA и «remote на исходном снимке» — этапная история; актуальные refs указаны в §2 |

F01–F04 не внесены повторно в список незакрытых ошибок: проверены V `integrate-associative-v6-reviewed-stage.mjs` (явные четыре разрешения и frozen queue), `loadLexicalReview` (grants/источники), `loadFamilyPromotions` (senses или exact исторический grant), и текущий CI gate. Это не доказательство готовности ещё не написанных внешних импортёров.

## 7. Новые малые диагностические проверки

Выполнены через Node stdin на M, без новых тестовых файлов, сети, записей в индексы и внешних сервисов:

1. Инъецирован отказ `familyIndexLoader.candidateEntries`. `createCandidateIndexLoader.loadCandidateEntries('en','regul')` загрузил synthetic legacy `en/r.json`, вернул `regular`, `family_id=family:regul`, `family_verified=true`, диагностика `familyIndexStatus=unavailable`. Это **поисковый fallback**, не запись членства. Подтверждает отсутствие полной гарантии отрицательных решений при недоступном authoritative индексе.
2. `FamilyIndexLoader` с явно `review_status='rejected'` вернул 0 кандидатов. Путь явного блокированного статуса работает; его нельзя смешивать с transport failure из пункта 1.
3. Переданы synthetic `lemma_id`, `lexical_head_id`, `source_proof` в `findCandidatesForRoot(..., groupModels:false)`: кандидат вернулся, все три поля отсутствуют. Причина — явная проекция объекта в `candidate-finder.js::findCandidatesForRoot`; downstream нельзя считать provenance-preserving.
4. Сверена сигнатура `scripts/lib/associative-family-graph.mjs::stableLemmaId(language, normalized)`: POS/sense не входят в ID; пример `en/bank → lemma:d482ae0a36040cda2667`.

Это targeted diagnostic, не статистическая оценка и не подтверждение конкретного живого повторного появления отвергнутого слова.

## 8. Внешние источники: установленное и неизвестное

Проверены только документация/первичные описания, данные в проект не импортировались.

| Ресурс | Установленная роль и риск | Первичный источник |
|---|---|---|
| UDer | Лексемные сети, деривация/словосложение; лицензии зависят от конкретного подресурса, нельзя назначить одну всему пакету | [ÚFAL](https://ufal.mff.cuni.cz/universal-derivations), [репозиторий](https://github.com/lukyjanek/universal-derivations) |
| GLeMM | Статья описывает v2.0, CC BY 4.0, `pairs.tsv`/`defs.tsv`; stem/exponents — описание отношения, не готовая голова Интераля. Использует MorphyNet, поэтому совпадения не независимые голоса | [статья, §§1, 4.4, 6.2](https://arxiv.org/html/2604.12442v1), [указанный авторами repository](https://src.koda.cnrs.fr/nabil.hathout.1/glemm) |
| MorphyNet | Раздельные данные деривации и флексии; README указывает CC BY-SA 3.0. Тип отношения нужно сохранить до нормализации | [README](https://github.com/kbatsuren/MorphyNet/blob/main/README.md) |
| Flexor | **Идентичность не установлена**: в задании нет URL/автора/версии, в исследованных исходниках интеграции нет, поиск не дал надёжного лингвистического первоисточника. Не приписаны формат, охват и лицензия | До адаптера нужен canonical URL и release; это локальный blocker четвёртого ресурса, не blocker проектирования общей модели |

Для GLeMM repository при проверке вернул 502; лицензия и версия здесь атрибутированы статье, а не проверенному LICENSE конкретного архива. Для всех источников до скачивания нужны точный release/hash и лицензия поставляемых файлов. У UDer встречаются NC/SA и иные условия; выбор подресурсов и допустимость публикации производных данных должны быть явными.

## 9. Границы результата

Проверены оба актуальных дерева, расчётный путь, registries, builder/loaders, малые диагностические примеры, metadata PR и существующий CI. Не повторялись полномасштабные v5/v6 audits/replay, статистическая разметка, LLM-классификация и live regul. Внешние данные не загружены в семейства. Последующие решения должны ссылаться на эти SHA; изменение источников или branch head требует проверки соответствующего diff.

Дальнейшая детализация: [архитектура](CURRENT-ARCHITECTURE.md), [повторное использование](REUSABLE-COMPONENTS.md), [препятствия](BLOCKERS.md), [контрольная точка](PREPARATION-CHECKPOINT.md).

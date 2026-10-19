# 00. Стабилизация репозитория после PR #670

Дата проверки: 20 октября 2026, Europe/Moscow. **PASS для исправлений публикации и обязательных инженерных проверок в PR #671.** Массовая разметка не запускалась.

## Актуальный commit и проверенный объём

Актуальный main при начале и заключительной проверке: `0b3faf2215d2008be5abc0ac7fe66f7eb03e0891`. Отдельная ветка: `fix/pages-morphology-stabilization-20261020`; проверенный функциональный commit исправления: `412ffed0e18e1da77f6440e9aaabec0c9492c5e8`. Последующие изменения отчёта/квитанций не меняют функциональные файлы.

Заново прочитаны PR #662–670, текущие реализации и входные схемы; состояния/commits записаны в `stabilization00/PR-HISTORY.json`. #663–669 закрыты как включённые в сводный merge #670, а не как отдельные main merge commits. Предыдущие отчёты не использованы вместо запуска проверок.

## Обнаруженные и исправленные неисправности

### Pages: библиография ошибочно обрабатывается как Liquid

Run [39338729838](https://github.com/landquart/interal/actions/runs/39338729838), build job `118354697909`, завершается Liquid::SyntaxError в `data/morphology-evidence/sources/UDer/fr-Demonette/README.md:27`. В других оригинальных README UDer также есть Liquid warnings. Deploy этого run пропущен.

`_config.yml` исключает только offline source/provenance directory и node_modules из Jekyll. Оригинальные README, лицензии, source-lock и hashes не изменены и остаются доступны в Git. Runtime HTML/JS не обращаются к исключённой директории. Jekyll и его проверки не отключены; не используется обход через редактирование оригиналов или отключение integrity checks.

Новый `.github/workflows/pages-validation.yml` выполняет реальную сборку официальным закреплённым Jekyll action. `.github/scripts/verify-pages-output.py` затем проверяет все **13 tracked HTML**, **1 скачиваемый PDF** и **9 runtime assets/manifests**, sitemap/robots: SHA-256 совпадают с checkout. Источники и node_modules отсутствуют в output. Чек не выполняет deployment. Все необходимые существующие HTML и проверяемые скачиваемые материалы сохранены.

### Production-аудит: два устаревших ожидания

Исторический live audit [37994612402](https://github.com/landquart/interal/actions/runs/37994612402) падал ещё до #670: он требует `source_lemmas == classified_unique_lemmas` и нулевой unassigned count. Это не соответствует текущему materialization-контракту `source = materialized + unassigned`: **4 924 980 = 4 924 281 + 699**. Контракт независимо задан в `scripts/lib/associative-repository-materialization.mjs` и `scripts/audit-repository-associative-family-v5.mjs`.

Неизменённый полный repository audit запущен заново в read-only режиме. Он проверил 2 456 543 семей, 1 934 050 aliases и 10 078 319 memberships. Результат **PASS** и побайтно совпадает с committed `audit/associative-family-v5/repository-static-integrity.json`. Проверены decision ledgers и materialization census; значения не подобраны для прохождения теста и не переписаны в данных.

Browser audit теперь проверяет exact census из этого integrity receipt и баланс source/materialized/unassigned. Дополнительно SHA-256 **всего** production manifest/report/provenance сравнивается с Git checkout. Все настоящие structural-error zero checks сохранены; произвольное увеличение unassigned count не допускается.

Повторный live audit [39341026526](https://github.com/landquart/interal/actions/runs/39341026526) обнаружил второе старое ожидание: `net` использовался как пример fan-out 28. После прежних ручных исправлений у net уже три разрешённых targets. Настоящие net members/routing теперь проверяются по неизменённым decision ledgers, а лимит **26 > 25** отдельно проверяется на явно test-only transport input, с нулём family/member fetches. Тестовые IDs не становятся лексемами, корпусом или membership. Семейства и runtime loader не менялись. После этого live audit прошёл.

## Состояние CI, сборки и публикаций

| Проверка функционального commit | Run | Результат |
|---|---|---|
| Tests, включая browser regression | [39341432242](https://github.com/landquart/interal/actions/runs/39341432242) | PASS |
| Associative Verification, включая browser regression | [39341432206](https://github.com/landquart/interal/actions/runs/39341432206) | PASS |
| Настоящая Pages/Jekyll build + проверка output | [39341432159](https://github.com/landquart/interal/actions/runs/39341432159) | PASS |
| Живой production v5 browser/runtime/transport audit | [39341432263](https://github.com/landquart/interal/actions/runs/39341432263) | PASS |

Полные ID/SHA/status и hashes проверяемых файлов — `stabilization00/CI.json`. Первые промежуточные сбои сохраняются как история и не объявляются успешными. Pages guard receipt — `PAGES-BUILD.json`; live runtime receipt — `LIVE-PRODUCTION.json`: desktop/mobile, по 54 controls, 4 transport failure modes, 0 page/console errors.

Vercel production `dpl_8mEBS7kvbigGCkkoDSsjFP61tXKM`: **READY**, exact main merge SHA. Vercel build gates проходят без изменения их условий. GitHub Pages live отвечает 200 и обслуживает прежний успешный выпуск от 9 октября; новая production Pages-публикация пока **ожидает merge/apply PR #671**. Успешная PR-сборка не выдаётся за выполненный deployment. Новый workflow имеет read-only permissions и ничего не переключает.

16 новых live probes страниц и основных ресурсов Vercel/Pages: HTTP 200, все проверенные SHA-256 совпали с main (`LIVE-ROUTES.json`). Local Chromium отсутствует; официальный download возвращает повреждённый ZIP. Поэтому local browser — BLOCKED_ENVIRONMENT, а обязательные browser проверки фактически выполнены и прошли в GitHub CI. Ruby/Jekyll локально также отсутствуют; реальная сборка проверена официальным CI action.

## Фактическое состояние подсистем и регрессии

| Подсистема | Текущая реализация и новая проверка | Статус |
|---|---|---|
| Импорт | `associativvordes/importers/`: оригинальные строки/provenance, разные derivation/inflection, isolated unreviewed output; 23 tests | PASS |
| Граф | `associativvordes/evidence_graph/`: native lexical identities, альтернативы, типы/направления, finite paths и prohibitions; 18 tests | PASS |
| Кандидаты | `associativvordes/candidate_search/`: scoped decisions/history, реальные carrier words, ограниченные paths, экспериментальный priority; 16 tests | PASS |
| Пилот | `associativvordes/pilot_evaluation/`: exact family/language/source-lexeme/POS, human-gold contract и abstain; 15 tests | PASS / качество требует human gold |
| Flexor/HanTa preparation | `associativvordes/flexor_research/`: 8 preparation tests; не новая интеграция модели | PASS в пределах подготовки |
| Независимые readiness controls | Неизменённый `verification08/verify.py`: 35 PASS / 0 FAIL; automatic gold 0 | PASS |

Локально `npm test` заново выполнил **93/93 test files**, отдельные Associative regressions — **25 tests**, Python packages — **80 tests**. Команды, exit codes, runtime и SHA логов: `LOCAL-CHECKS.json`; прямые package logs приложены. Все четыре IV-регрессии остаются исправленными: IV-001 не копирует prediction на омоним/POS, IV-002 сохраняет scoped reverse prohibitions/history, IV-003 не допускает неподтверждённый межъязыковой path, IV-004 не называет смешанный compound/path косвенной деривацией. Полные новые adversarial результаты — `READINESS.json`.

## Сохранность существующих семей и исходников

- **21 protected Git object** совпадает с main, включая v5, runtime JS, data, shared/api/scripts, частоты, manual-decision ledgers, пять исследовательских пакетов и methodology test. Изменены публикационная конфигурация/CI и browser-аудит, а не производственные формулы или семейные данные.
- Фактические байты **52 source/provenance файлов** сверены с main Git blobs, без исправления оригинальных README.
- Все **12 реальных raw GLeMM** повторно совпали по size/SHA-256 с доверенным lock. Новая полная сертификация UDer/MorphyNet raw и общего global catalog в этот этап не входит.
- Полный существующий repository audit и `cmp` PASS. Семейства, manual/rejected/split decisions, lexical heads, частоты, v5/v6 selection и input pins не изменены. Accepted membership writes, corpus cleanup и массовая разметка: **0**.

Подробности: `PROTECTED.json`, `SOURCE-INTEGRITY.json`, `REPOSITORY-INTEGRITY.json`. Целостность байтов/структуры не является утверждением о лингвистической правильности всех прежних семей.

## Оставшиеся ограничения перед массовой разметкой

Исправления готовы в отдельном [PR #671](https://github.com/landquart/interal/pull/671), merge и переключение production в рамках проверки не выполнялись. До применения PR live Pages остаётся на старом выпуске.

Инженерные проверки не заменяют ручной gold, actual baseline/calculator captures и измерение качества на размеченной области. Совместный свежий global source catalog, большие graph/queue workloads и независимость GLeMM/MorphyNet требуют отдельного подтверждения. Импорт, наличие пути и зелёный CI не дают права автоматически принимать membership. Массовая разметка на этом этапе не разрешалась и не запускалась.

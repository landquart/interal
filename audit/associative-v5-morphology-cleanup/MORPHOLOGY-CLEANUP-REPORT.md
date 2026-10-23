# Проверка морфологических отношений v5 — текущая версия 2

Полный production census сохранён: **2456543 семьи / 10078319 memberships**.
Версия 2 повторно обработала весь морфологически сомнительный scope:
**2456532 семьи / 10078175 memberships**. Ещё 144 membership явно учтены вне scope.
Production, исходные лексемы, 699 unassigned records и старые журналы не изменены.

**Подтверждённых исправлений отношений и исключений 0.** Во всех выбранных
строках отсутствуют подтверждённые corpus ↔ native lexical/sense bindings и путь
к рассматриваемому корню. Итоговый статус — `INSUFFICIENT_EVIDENCE`.
Это не доказательство отсутствия правильных связей или ошибок в корпусе.

## Исправление предыдущей исследовательской классификации

Первый проход был полным census доступности source claims. Однако его правило
`несколько типов → COMPETING_ANALYSES` было слишком широким: деривация и суффиксация
могут описывать одно событие, а инфлексия может сосуществовать с деривацией.
**774625 меток исправлены в исследовательском результате**, а не в production.
Прежний неизменяемый snapshot, его проверки и архив сохранены; это вход v2.
Текущую семантическую версию выбирает `CURRENT.json`. Плоские v1 JSON-файлы
и `V1-SOURCE-TRIAGE-REPORT.md` являются историческими source-availability receipts.
Их старые метки не используются как подтверждённые конкурирующие анализы.

`COMPETING_ANALYSES` теперь требует конкретных конкурирующих анализов одной
привязанной лексемы/значения и проверенного объяснения несовместимости. Одних
разных названий типов недостаточно. Подтверждённых таких случаев в этом запуске 0.

## Текущие решения по языкам

| Язык | INSUFFICIENT_EVIDENCE | Подтверждённые отношения | Подтверждённые ошибки / неверный тип | Проверенные конкурирующие анализы |
|---|---:|---:|---:|---:|
| en | 2,619,242 | 0 | 0 | 0 |
| de | 2,205,018 | 0 | 0 | 0 |
| fr | 1,143,031 | 0 | 0 | 0 |
| es | 1,796,493 | 0 | 0 | 0 |
| it | 1,187,687 | 0 | 0 | 0 |
| ru | 1,126,704 | 0 | 0 | 0 |

`semantic-review-v2/STATISTICS.json` отдельно сохраняет статусы, source features,
причины неопределённости и типы возможных ошибок. Нулевое число подтверждений
не подменяет неизвестное число реальных ошибок: неизвестные счётчики — null.
Флаги и source types пересекаются и не складываются как независимые множества.
8407234 memberships без найденной внешней строки не стали отрицательными решениями.
7042551 compound claims остаются непроверенными по сегментации, ролям и значению.

## Что сохраняется и проверяется

Десять типов: прямая/косвенная деривация, инфлексия, compound, алломорфия,
заимствование, историческое наследование, префиксация, суффиксация, неподтверждённая
связь. Порядок строк GLeMM не становится направлением; 4915497 MorphyNet inflection
records остаются инфлексиями. Все конкурирующие native records, исходные лексемы,
POS, явное направление, segmentation, raw locator и SHA доступны без truncation
через `records_all` и exact-row inspector предыдущего прохода. Зависимость
GLeMM/MorphyNet сохраняется; число источников не является числом независимых доказательств.
Историческое родство не подтверждает автоматически нужный компонент или смысл.

Новый `associativvordes/morphology_review/policy.py` проверяет proof envelopes.
Для окончательного вердикта нужны точный family/lemma/POS/sense scope, native binding,
каждый явный промежуточный шаг и locked original-row evidence. Native endpoints
различаются по artifact, revision, language, ID, POS и sense. Общий предок не
становится прямой деривацией; омоним, неизвестный endpoint, межъязыковой перенос
алломорфа, неизвестное направление и недокументированный compound блокируют вывод.
Для compound требуются части, роли, сегментация, значение и evidence refs.

Это валидатор доказательного конверта, а не автоматический лингвистический эксперт.
Независимо настроенный registry verifier должен подтвердить точный SHA всего
предложения и authority `CONFIRMED_MANUAL` или `INDEPENDENT_GOLD`. Нет verifier —
нет окончательного подтверждения. Model confidence, собственные booleans,
ENGINEERING_CHECK, RESEARCH_HYPOTHESIS и OWNER_ACCEPTED_AT_RISK недостаточны.
Синтетические gold receipts в тестах не являются gold для корпуса.

Исправление типа не превращается в исключение membership: результат всегда
содержит `membership_operation=NONE`; альтернативные основания сохраняются.
Отдельный application guard закрыт при недоступной, конфликтующей или неполной
истории. Непустых предложений для применения в этом выпуске нет. Все 7 прежних
nonmember-решений повторно проверены в точном scope без повышения их research
authority; 262 текущих пересечения с historical index сохранены побайтово.

Нормативные соответствия manu/mani, regul/regl, creat, ocul не расширялись и не
удалялись; алгоритм не создаёт substring-правил. Формулы ассоциативности не менялись.

## Проверки и повторяемость

Первый census независимо проверил весь v5 и все 9404044 принятых строк из 35
закреплённых artifacts. Оригиналы 24 quarantine rows сохранены. Версии, лицензии,
provenance и SHA закреплены прежним `SOURCE-LOCK.json` и новым dependency lock.
Повторная проверка v2: все 35 originals, 35 raw SQLite, 35 profiles и 2051 production
files совпадают с locks. Старые ledgers не изменены; finite history index содержит
348028 scoped IDs.

Полный v2 проход и свежий replay дали одинаковые 517 файлов результатов/receipts.
Node replay независимо сверил каждую из 10078175 строк: все ID, original source
fields, candidate masks, counts, history refs и alternatives сохранены.
Изменены только неподтверждённый статус и добавлены явные причины unresolved.
Прерывание exit 75 до публикации bucket 00 успешно возобновлено.
Adversarial tests и полный `npm test` прошли.

- Полный v2 проход: 128.382 s, peak RSS 15,752 KiB, output 250,240,933 bytes.
- Свежий v2 replay: 130.645 s, peak RSS 15,776 KiB, output 250,240,933 bytes.

v2 потоково читает один NDJSON record; миллионы семей и полный evidence graph
не загружаются в память. Это уточнение полного проверенного scope, а не замена
лингвистической проверки совпадением написаний.

## Выходные данные и запуск

Текущие результаты находятся в `semantic-review-v2/`: `SUMMARY.json`, `STATISTICS.json`,
`QUEUE-MANIFEST.json`, независимая проверка, replay/resource/history/source receipts.
`VERIFIED-RELATION-CORRECTIONS.ndjson` и `PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson` пусты.

```sh
python3 associativvordes/morphology_review/run.py --input V1_RUN --output V2_RUN --crash-bucket 00
# Ожидаемый exit 75; затем возобновление:
python3 associativvordes/morphology_review/run.py --input V1_RUN --output V2_RUN
python3 associativvordes/morphology_review/run.py --input V1_RUN --output FRESH_REPLAY
node associativvordes/morphology_review/verify.mjs V1_RUN V2_RUN INDEPENDENT.json
node --test tests/associative-morphology-review-v2.test.mjs
```

Для восстановления v1/native originals и воспроизводимого исходного полного census
см. `V1-SOURCE-TRIAGE-REPORT.md` и `associativvordes/morphology_cleanup/README.md`.
V2 не зависит от одного временного каталога: source snapshot и оригиналы сохранены
в прежнем immutable archive, а весь новый результат — в отдельном архиве.

`interal-v5-morphology-semantic-v2.zip` — 250,220,094 bytes; SHA-256
`caff94aee051944487ba04a45cc1c0d18459bb66f1801067a972d6f2e53648a0`. Реально восстановлен 521 файл; каждый SHA/размер совпал.
Архив v2 содержит полную новую очередь и точный dependency lock на прежний
`interal-v5-morphology-review.zip`; оба архива сохраняются.

Содержательная сертификация остаётся UNRESOLVED из-за отсутствующих проверенных
лексических/семантических bindings. Автоматические исправления не выдаются за
лингвистические решения; недостаточные данные не стали отказом.

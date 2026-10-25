# Полный dry-run формальных семейств v5

**Анализ выполнен; новые исключения удержаны за недостаточностью доказательств.**
Полностью прочитаны 2 456 543 семьи и 10 078 319 memberships. Найдены 729 791
кандидатная семья и 6 437 661 затронутое членство. Это гипотезы риска, не 6,4 млн
доказанных ошибок. `PROPOSED-EXCLUSIONS.ndjson` пуст; production не изменён.

## История и реальные основания

Использованы baseline и structural certification PR #685, полная диагностика
PR #683 и immutable history snapshot `fe87153c07976f8b4ae02fffee778b5213303cd01d5f8e1f380b08f2d0882374`.
Получены и проверены 348 028 конечных historical scoped IDs из 545 решений.

Каталог сохраняет 114 точных записей причин из текущих ledgers формальных
семейств и SHA-256 29 относящихся к ним файлов данных/скриптов. Дополнительный
полный обход JSON ledgers включает genea, sonus, nitidus и другие механизмы.
Независимый replay проверил 71 полный исторический набор, всего 304 874 строки
в соответствующих snapshots: совпали member-list digests и все evidence counts.
Это число строк исторических scopes, не union текущих affected memberships.

Причины включают немецкое -ten, флексии и суффиксы вместо общего корня,
стыки независимых компонентов, corpus noise и неточную нормализацию. Скрипты
проверяли source run, точные family/language, support, полный digest членов,
evidence distributions и aliases перед исторической операцией. Такие проверки
удостоверяют старый scope; они не доказывают ложность новой семьи с тем же хвостом.
В ряде ledgers прямо указаны contrasting examples и отсутствие индивидуальной
независимой этимологической разметки. Эти ограничения не сняты.

Все 32 явных keep/retained исключения найдены по точным текущим IDs и сохранены.
19 из них относятся к узкому каталогу surface-ledgers; эти два числа пересекаются
и не складываются. Удалённые прежде families/links не восстанавливались.

## Что является доказанной ошибкой правила

Каталог содержит четыре логически недопустимых вывода:

1. Общее окончание достаточно для доказательства общего лексического корня.
2. Внутренняя подстрока, включая стык основ, достаточно доказывает компонент.
3. Совпадение после потерь при нормализации доказывает тождество лексем/значений.
4. Метка старого генератора или его confidence является независимым gold.

Это ошибки **доказательных правил**, а не четыре подтверждённых класса новых
ложных memberships. Новых эмпирически подтверждённых массовых отказов — **0**.
Отбрасывание ненадёжного доказательства связи не доказывает отсутствия самой связи.
Исторические engineering deltas и research hypotheses не повышены до gold.

## Полный поиск и непересекающиеся числа

Независимые сигналы: основа длиной до трёх Unicode code points; точное попадание
family ID в закреплённый каталог configured-tail exposure; многосоставная
surface_singleton family. Ни один не является правилом удаления. Проверены
все реальные component evidence types/sources, возможные competing historical
claims, эффекты normalized/search-form и пересечения с историческими scope.
Сам генератор использовал stripKnownTail, inferred segmentation и substring
boundary heuristics. Эти механизмы описаны как происхождение claims, не как
подтверждённая морфология.

| Показатель | Семьи | Memberships |
|---|---:|---:|
| Весь корпус | 2 456 543 | 10 078 319 |
| Union кандидатов | 729 791 | 6 437 661 |
| INSUFFICIENT_EVIDENCE среди кандидатов | 729 480 | В полных scope manifests |
| RETAIN_WITH_REVIEW среди кандидатов | 311 | В полных scope manifests |
| Предлагаемые удаления | 0 | 0 |

Всего 14 непересекающихся signature groups; 11 из них содержат кандидатов.
Каждая семья имеет одну запись и одну группу. Флаги могут пересекаться и не
суммируются; membership здесь — ребро конкретной семьи, не уникальная лексема
во всём корпусе. Не-кандидатная семья также не объявляется лингвистически верной.
Полные counts каждой группы находятся в SUMMARY.json; никаких выборок вместо
полного affected-ID множества не используется.

## Доказательный gate и сложная очередь

Все пять операций представлены в schema/API. REJECT_ENTIRE_FAMILY требует
точного полного текущего finite set. REMOVE_EXACT_MEMBERSHIPS требует точного
ограниченного множества. Оба требуют проверенного существующего review receipt,
source-version match, native lexical/sense bindings, проверки competing paths
и разрешающего результата защищённой истории. Булевы утверждения или уверенность
модели без доверенного source verifier не проходят. Сам модуль такого linguistic
verifier не создаёт и не имеет production writer.

Сейчас native identities/senses и допустимые historical paths не подтверждены
для новых отказов, independent negatives нет, history сохраняет 358 конфликтов.
Неисследованный независимый путь помечен UNKNOWN_NOT_DISPROVED. Даже одна строка
UDer/GLeMM/MorphyNet сама не обеспечила бы требуемый corpus binding. Наличие
альтернативных анализов остаётся POSSIBLE_UNRESOLVED, а не искусственно False.
Поэтому все кандидаты отправлены в точную сложную очередь: 311 retain/review и
729 480 insufficient. SPLIT_REQUIRED не подменяет неизвестную омонимию; новых
доказанных splits нет. Отрицательное правило для -are, -tion, -skij не создано.

COMPLEX-CASE-QUEUE-MANIFEST.json ссылается на полные сжатые наблюдения каждой
семьи и на каждый [family, language, source lemma ID, ordinal]. Полный sorted
finite-set SHA-256 проверен для каждой из 729 791 кандидатной семьи. Ссылки на
первоначальные записи закреплены SHA-256 исходного snapshot и bucket/ordinal.
11 первичных signature groups могут организовать исследование механизмов;
они не разрешают 11 blanket verdicts. Индивидуальных LLM jobs — 0; экономия
человеческих часов не измерялась.

## Защита корректных форм и лексем

16 regressions проверяют настоящие краткие основы, продуктивные суффиксы,
заимствованные и compound-компоненты, исторические варианты manu/mani, regul/regl,
creat и ocul, омонимический scope, невозможность перенести отрицание по строке,
отказ при неизвестной истории и недостаточном scope. Это тесты защитных правил,
не новые положительные языковые решения.

Дополнительно выполнены девять точных lookup-контролей текущего production.
В трёх случаях исходные rows найдены и сохранены. В остальных шести нет строки
именно в указанной legacy-family: это не утверждение отсутствия слова в корпусе
и не разрешение его автоматически добавить. Так, национальная допустимость
мани-/règl- не создаёт отсутствующее старое membership. Все 32 явных исторических
исключения сохранены. Полный source corpus и 699 unassigned лексем сохранены;
ложные связи ради уменьшения unassigned не восстанавливались.

## Повторяемость и backup

Два полных запуска дали побайтово одинаковые manifests, summaries и все 512
сжатых family/scope files. Полные 348 028 history ID rows совпали логически.
Node-verifier с другим JSON decoder и независимо записанными предикатами
перечитал все 10 078 319 исходных memberships и проверил каждый affected ID.
Искусственный exit 75 произошёл до публикации bucket 00; продолжение завершилось.
Последующий reuse сохранил все 256 завершённых receipts без перезаписи.

Первый возобновлённый scan: 532,455 s, peak RSS 144 548 KiB (history index уже
был построен до сбоя). Независимый холодный scan: 620,795 s, peak RSS 308 880 KiB.
Это отдельные процессы; их peaks не выданы за общий peak RAM. Полный архив
194 448 888 bytes восстановлен: все 785 файлов совпали по SHA-256. Архив сохранён;
точный hash и dependencies находятся в ARCHIVE-RESTORE.json/IMMUTABLE-SNAPSHOT.json.
Большие research outputs не добавлены в Git и не копируют v5 в authoritative v6.

## Команды

```sh
python3 associativvordes/surface_cleanup/run.py --repo . \
  --snapshot /external/structural/before --output /external/surface-a
python3 associativvordes/surface_cleanup/run.py --repo . \
  --snapshot /external/structural/before --output /external/surface-b
node associativvordes/surface_cleanup/verify.mjs \
  /external/structural/before /external/surface-a /external/independent.json
node associativvordes/surface_cleanup/query.mjs /external/surface-a surface:en:sky
node associativvordes/surface_cleanup/exceptions.mjs \
  /external/structural/before /external/retentions.json
node associativvordes/surface_cleanup/historical_scope.mjs \
  /external/surface-a /external/history-check.json /external/retentions.json
python3 -m unittest discover -s associativvordes/surface_cleanup -p 'test_*.py' -v
npm test
```

Все локальные tests прошли. Полный before/after dry-run находится в двух
соответствующих JSON: после пустого плана counts и source inventory не меняются.
Аналитический обход завершён; разрешённых новых массовых отказов нет.

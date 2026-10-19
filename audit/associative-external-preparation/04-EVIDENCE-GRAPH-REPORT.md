# 04 — Граф морфологических свидетельств

Реализован изолированный read-only механизм в [associativvordes/evidence_graph](../../associativvordes/evidence_graph/README.md). Он представляет проверяемые источниковые отношения, альтернативные гипотезы и отрицательные решения. Новых membership, canonical roots и принятых внешних Verdict — **0**. Полная разметка/очистка семей не выполнялась.

## Реальные закреплённые входы

Использованы архитектура этапа 02 и парсер/источники этапа 03. V6 catalog, heads, edges, finite links, memberships, correction verdicts, reflexes и metadata взяты из утверждённого архитектурой V commit `9fff76431a86a06df6db69b64d7f2ca4c871f1b7`. Это реальный закреплённый V этапа 02, не заявление о latest всех последующих веток. V5 manual_override и corpus_quality controls прочитаны из неизменяемого base `d6780ebc693837cc4560a40672eb7ee39e8fa6f7` этапа 03. Их деревья не заменялись checkout другой ветки.

Оригинальные git blob IDs проверены до принятия файлов; размеры, SHA-256 и commits записаны в [V6-SOURCE-LOCK.json](../../data/morphology-evidence/graph-inputs/V6-SOURCE-LOCK.json). Stage-03 raw files повторно получены по прежним официальным pins и проверены SHA-256; UDer container также проверен официальным MD5. Незакреплённые обновления не используются.

Выборка: 484 точных lookup-запроса из существующих heads/finite links, до 12 на семью/язык. Совпадение слова — только discovery. В UDer включена native-ID окрестность радиуса 2. Прочитаны все 9 404 068 строк 35 файлов; выбрано 6940 реальных записей из 34 файлов. В ru-EtymWordNetRU совпадений в пробе нет, ресурс зарегистрирован. Лимиты 2000 строк обычного artifact и 10000 UDer nodes не сработали. [SELECTION.json](graph-validation/SELECTION.json).

| Язык | Выбранных реальных строк |
|---|---:|
| en | 2552 |
| de | 481 |
| fr | 1003 |
| es | 1178 |
| it | 591 |
| ru | 1135 |


По источникам: UDer 695, GLeMM 3385, MorphyNet 2860. Это ограниченная морфологическая проба, не число уникальных смыслов/семей. Полные корпуса и полные графовые снимки остаются вне Git. В репозитории — код, pins, результаты и 70 малых реальных строк (по две из всех 35 файлов), а также сжатая конечная тестовая проекция v6.

## Модель

SourceRevision, Lexeme, LexemeSense, Relation, Evidence, CorpusAlignment, Verdict, ReviewTask имеют immutable envelopes/revisions и exact refs. Существующие v6 головы, семьи, finite bindings, memberships, scoped allomorph views и исторические findings сохраняются как ExistingRefs. Семейные edges, алломорфы, исторический контекст и морфологические отношения не смешиваются.

Словообразовательные типы/directions/participant roles разделены. Inflection содержит Form value object, не новую лексему/модель. GLeMM stem/exponents остаются шаблонами; definitions — контекстом Evidence. Проза этимологических findings не превращается в guessed ancestry. У реальных данных пробы нет надёжных sense IDs: универсальные LexemeSense не выдумываются. V6 sense label не даёт автоматически внешний sense alignment.

Получено 11 018 источниковых Lexeme, 6775 Relation, 6781 Evidence, 8297 candidate CorpusAlignment и 10 ReviewTask конкурирующих анализов. Принятых внешних relation/identity/membership Verdict нет. Совпавшие normalized строки не отождествляют source identities.

Семь утверждений UDer имеют endpoint вне выбранной окрестности: unresolved_claims явно посчитаны. Узлы/связи не выдуманы. Все исходные 6940 записей, включая корни, эти claims и аннотации, побайтово сохранены в source-observations.ndjson, а provenance — в отдельном observation index. Это ограничение проекции пробы, не семь повреждений исходного корпуса.

## Семь контрольных основ

| Основа | Семья v6 | Исходных edges¹ | Heads в пробе | Неlegacy heads¹ | Alignment proposals | Hold/block | Пробных путей² |
|---|---|---:|---:|---:|---:|---:|---:|
| OCUL | family:ocul | 59 | 17 | 0 | 302 | 0 | 13 |
| PEDE | family:ped | 1556 | 16 | 2 | 208 | 0 | 37 |
| ALTER | family:alter | 2485 | 63 | 0 | 413 | 0 | 18 |
| REGUL | family:regul | 286 | 27 | 20 | 2371 | 22 | 31 |
| CREAT | family:creat | 596 | 110 | 38 | 1254 | 0 | 37 |
| NAT | family:nat | 1913 | 258 | 2 | 2470 | 0 | 38 |
| INTER | family:inter | 4281 | 135 | 3 | 1279 | 0 | 36 |


¹ Исходные edges и неlegacy heads включают отрицательные решения; это не число принятых морфологических основ. Старые большие legacy counts не объявляются подтверждённым лингвистическим покрытием. Catalog содержит 19 именованных семей; содержательная проба здесь ограничена семью указанными.

² До 12 стартов, depth=3, до 8 путей и 200 expansions на старт. 210 сохранённых путей — детерминированные гипотезы, не исчерпывающие цепи и не членства. Сохранены все intermediate refs, типы, направления, источники, lineage, uncertainties и confirmed/unconfirmed участки.

PEDE разрешается существующим alias в family:ped; новая canonical основа не создаётся. У OCUL/ALTER в этом V-снимке нет неlegacy reusable heads: унаследованные exact records не распространяются на соседей. Во всех 8297 реальных POS comparisons status=unknown: используемые heads/links v6 не утверждают POS. Внешний POS сохранён; отсутствие v6 POS не выдано за совместимость. Все sense alignments unresolved.

Для REGUL 22 alignment proposals удержаны current uncertain corrections (например, русское «регулятор»); исторический acceptance не восстанавливается новым источником. После повторного открытия снимка CREAT/creel блокируется existing excluded edge. Query OCUL/ocular возвращает source matches и остаётся establishes_membership=false.

known_records перечисляет прежние exact corpus/head/family proofs, а context links — существующие finite bindings/head-family edges. Тождество новой внешней пары прежнему лингвистическому отношению без identity review не утверждается.

## Воспроизводимость и сохранность

Две свежие сборки всех 6940 выбранных записей дали побайтово одинаковые manifest и все выходы: [REPLAY.json](graph-validation/REPLAY.json). Это не повторная графовая обработка всех 9,4 млн строк. Export повторно открыт без корпусов; query index восстанавливается из проверенных NDJSON. Build ID `5527705c4a33d1b7f892cd0bc43337be5f6d34d8cca8ba4a4587bd6cfbf59a5a`.

SQLite — временный дисковый индекс с кэшем 8 MiB; его физические bytes не контракт. Экспорт детерминирован и отсортирован. Registry projection, comparison groups и frontier выбранной пробы находятся в памяти: не заявляется benchmark полного миллионного графа. Runtime/code/input/output hashes закреплены.

[Защищённые деревья](graph-validation/PROTECTED-PATHS.json), импортёры и source locks этапа 03 не изменены. Нет runtime/production подключения, изменения формул, v5/v6 membership, promotion или merge. Новые отрицательные решения требуют отдельной pinned пересборки; старый graph snapshot не разрешает изменять текущий production.

См. [валидацию](RELATION-VALIDATION.md), [конфликты](CONFLICT-HANDLING.md), [тесты](GRAPH-TEST-RESULTS.md).

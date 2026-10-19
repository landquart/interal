# Итоговые дефекты и ограничения

Исследованный remote head: `cb2d009bebe29147cdecc62f228f5ffe70451fcb`. Код не исправлялся. Все четыре дефекта заново воспроизведены после восстановления среды; точные входы и результаты — `verification08/verify.py`, `RESULTS.json`.

## IV-001 — P1 / FAIL: перенос prediction между разными лексемами

`associativvordes/pilot_evaluation/run.py:18–19,39–41`, `predictions_from_sources`: ключ `bytarget` содержит family/language/lookup(lemma), но не native Lexeme Ref, POS или head. Найденный путь присваивается всем строковым совпадениям cases. Последний guard не проверяет identity конца пути.

Control `IV001_prediction_not_copied_to_homonym`: fixture `bank/NOUN` и `bank/VERB` имеют разные IDs, единственный путь заканчивается на NOUN. Оба cases получают yes; для VERB ожидается abstain или явно unresolved alignment. Это не принятие membership, но нарушает единицу научного измерения.

Реальный carrier: опубликованные CASES/RUNS. В C случай `pilot-case:2960a84acc7aa289c6c193a681b49379feb160af0238d2f73f7411fcb804d9ec` — EN liberticide/NOUN, target `lexeme:026d90730e6bc8d43b85749dab4150b847977ef18c8b2038faab5b69c7b899b5`; path target `lexeme:5541e720cdcbed7f59f080bf55806fb7ccbde507a511ecd3c37f460c94b270f4`. В первой проверке graph body последнего был ADJ. Заново доступные конфликты POS из самих sampled cases, без исчезнувшего graph cache, находятся в `PILOT-IDENTITY.json::sampled_pos_conflict_examples`.

U/C/D: 78/99/115 положительных внешних cases без exact target path. Это неразрешённые переносы, а не автоматически доказанные FP. Исправление потребует exact match или отдельного проверенного identity/head/sense alignment; несовместимый POS не выводить из строки. Затем новый immutable predictions release на том же gold; gold не исправлять по ответу алгоритма.

## IV-002 — P1 / FAIL: reverse не показывает прежний семейный запрет

`associativvordes/candidate_search/search.py:182–226`, `reverse`/`enqueue_reverse`. Reverse исключает rejected relation review, но не присоединяет семейные decisions/controls. Вопрос получает family=unassigned и conflicts только о невыбранной семье. Queue inheritance ограничен той же family.

Control `IV002_reverse_surfaces_family_prohibition`: guard того же слова blocked во всех direct/alias/fallback/path каналах, forward path пуст. Reverse создаёт 1 open вопрос с пустой previous_decisions и без прежнего запрета. Ожидается отсутствие представления такого случая как полностью неизвестного без отрицательного контекста.

Это не восстановление accepted membership. Запрет одной семьи нельзя произвольно распространить на остальные семьи/омонимы; но exact scoped прежнее решение должно сопровождать reverse и последующее назначение семьи. Собственная история reverse-очереди после явного reverse rejection сохраняется — отдельный PASS.

## IV-003 — P2 / FAIL: неподтверждённая смена языка в derivation path

`associativvordes/evidence_graph/graph.py::relation` (строка 124), `paths` (строка 230). Проверяются refs/slots/arity, но не language compatibility для derivation_direct. Traversal не требует отдельного reviewed borrowing/alignment или cross-language hold.

Control `IV003_cross_language_requires_proof`: fixture EN→DE direct edge без посредничества даёт один обычный hypothesis path, ожидалось 0 продуктивных деривационных путей либо отдельно удержанный анализ. На действующих monolingual источниках фактический массовый ущерб не показан; это воспроизведённая ошибка API, существенная до межъязыкового расширения. Заимствования следует хранить отдельным типом с доказательствами.

## IV-004 — P2 / FAIL: неоднородный путь назван indirect derivation

`associativvordes/evidence_graph/graph.py:238`: любой len(steps)>1 получает proposed_category=derivation_indirect.

Control `IV004_mixed_chain_not_indirect`: compounding → derivation_direct выдаётся как косвенная деривация. Component flag шага сохранён, но итоговая категория неверна. Та же ветка кода действует для unknown-direction relatedness при include_uncertain=True. Accepted-indirect review отдельно проверяет direct chain, поэтому автоматического принятия не произошло. В первоначальной проверке сохранённых positive RUNS U/C/D смешанных цепей не найдено; дефект доказан controlled counterexample, не выдуманным корпусным случаем.

Нужна категория составного/неопределённого пути либо indirect только при подходящей ordered chain. Компонентное участие не является членством.

## Иные условия готовности

- IW-01 / BLOCKED: 0 ручных gold labels, нет A/B actual captures и before/after calculator results. Качество и дополнительная польза не измерены.
- IW-02 / WARN: `candidate_search/search.py:141` группирует independent_evidence по названиям источников. Это экспериментальная эвристика, не доказанная независимость lineage.
- IW-03 / WARN: `evidence_graph/analyze.py:31` держит группы отношений в памяти; реестры/частоты/seed pool также могут расти. Million-scale graph не проверен, fine-grained incremental rebuild отсутствует.
- IW-04 / WARN: queue decisions живут во внешнем SQLite и экспорте; законченного Git-reviewed dossier workflow и проверенного backup restore нет. Текущая потеря старых решений проекта не выявлена.
- IW-05 / FAIL (существующий baseline): `tests/methodology-20260909.test.mjs:45`, PH/mater — 60.515946719946726 вместо 60.03928052899482. Заново воспроизведено; код совпадает с main. Не исправлялось.
- IW-06 / BLOCKED: fresh API main Tests/production audit failure; live deployment не проверялся. Targeted suites не общий regression certificate.
- IW-07 / BLOCKED: полные raw/normalized snapshots и неопубликованные квитанции удалены обслуживанием среды. Fresh 257-row replay сохранён, повторная сертификация полного импорта после восстановления не выполнена.
- IW-08 / WARN/BLOCKED: HanTa доступен для диагностики, gold-оценки нет; Flexor проверенной поставки не имеет.

Ни один FAIL не означает, что действующие семьи уже повреждены: Git diff защищённых данных/кода пуст, нового accepted membership и production wiring нет.

# Конфликты и отрицательные решения

Сохраняются разные Relations/Evidence, source versions, направления, морфемные параметры и конкурирующие interpretations. Источник не выбирается по приоритету удобства, confidence или числу строк. Source dependence не превращается в независимое подтверждение.

## Реальные расхождения

Обнаружено 10 групп противоположных directed анализов на одном language/lemma/POS lookup. Здесь — реальные физические строки закреплённых файлов; полные raw_fields, SHA и exact refs: [SOURCE-CONFLICTS.json](graph-validation/SOURCE-CONFLICTS.json).

| Направление A | Источник / физическая строка | Направление B | Источник / строка |
|---|---|---|---|
| интервал (NOUN) → интервальный (ADJ) | MorphyNet:rus.derivational.v1 #30166 | интервальный (ADJ) → интервал (NOUN) | UDer:ru-DerivBaseRU #128001 |
| натурал (NOUN) → натуральный (ADJ) | MorphyNet:rus.derivational.v1 #6520 | натуральный (ADJ) → натурал (NOUN) | UDer:ru-DerivBaseRU #359094 |
| окуляр (NOUN) → окулярный (ADJ) | MorphyNet:rus.derivational.v1 #41911 | окулярный (ADJ) → окуляр (NOUN) | UDer:ru-DeriNetRU #350162 |
| креативный (ADJ) → креатив (NOUN) | UDer:ru-DeriNetRU #292754 | креатив (NOUN) → креативный (ADJ) | MorphyNet:rus.derivational.v1 #40643 |
| regolare (ADJ) → regolarizzare (VERB) | MorphyNet:ita.derivational.v1 #4052 | regolarizzare (VERB) → regolare (ADJ) | UDer:it-DerIvaTario #10908 |
| регулировать (VERB) → регуляция (NOUN) | MorphyNet:rus.derivational.v1 #1852 | регуляция (NOUN) → регулировать (VERB) | UDer:ru-DeriNetRU #420093 |
| натура (NOUN) → натурный (ADJ) | MorphyNet:rus.derivational.v1 #21310 | натурный (ADJ) → натура (NOUN) | UDer:ru-DerivBaseRU #359090 |
| креативить (VERB) → креатив (NOUN) | UDer:ru-DerivBaseRU #215851 | креатив (NOUN) → креативить (VERB) | MorphyNet:rus.derivational.v1 #52866 |
| regolamentare (VERB) → regolamento (NOUN) | UDer:it-DerIvaTario #10905 | regolamento (NOUN) → regolamentare (VERB) | MorphyNet:ita.derivational.v1 #1971 |
| интерес (NOUN) → интересовать (VERB) | MorphyNet:rus.derivational.v1 #15037 | интересовать (VERB) → интерес (NOUN) | UDer:ru-DeriNetRU #270823 |


Эти направления несовместимы при условии, что речь об одной лексеме/смысле. Такое тождество не установлено: lexical_identity_established=false, contradiction_established=false. Возможны омонимия, разные значения/методики, конверсия или ошибка. Обе версии сохранены, для каждой группы создан ReviewTask. GLeMM зеркальные unknown-direction строки не считаются доказательством обратной деривации.

Доказанных расхождений морфемных границ дополнительно не найдено. Null segmentation не считается противоречащей другой границе. Разные непустые segmentations сохраняются в разных Relation IDs и могут образовать отдельный needs_review; отсутствующие границы не заполняются GLeMM stem.

## Приоритеты и защита

1. Активный manual_verified запрет из доверенного review/grant scope блокирует concurrent ручное разрешение.
2. Ручное разрешение остаётся конечным и требует точного identity scope. Неизвестное совпадение даёт hold; source boolean не выдаёт grant.
3. Текущие pinned v6 excluded/uncertain/pending и correction verdicts сохраняются поверх historical acceptance. V5 manual_override — prior_confirmed finite evidence, не новый manual_verified grant.
4. Новые source assertions/hypotheses — proposals. Они не заменяют отдельное membership решение.

Guard учитывает family aliases, язык, exact corpus/head scope и возможное совпадение identity. Unknown overlap удерживается, а не обходится новым source ID. Direct/alias/fallback/path и промежуточные узлы используют один frozen negative index. Family-level blocked_from_runtime/rejected/split_required и corpus_quality rejected сохраняются; operational блокировка не выдаётся за лингвистическое опровержение слова во всех семьях.

REGUL: 22 alignment proposals удержаны uncertain corrections. Например, «регулятор» признан plausibly related, но существующее решение требует уточнения прямой ветви/посредничества/именного смысла. Новая пара не восстанавливает historical accepted membership.

CREAT/creel: existing excluded head-family edge с объяснением независимого basket/creel head блокирует reopened query. [QUERY-NEGATIVE.json](graph-validation/QUERY-NEGATIVE.json). Запрет относится к конкретному CREAT-вопросу, не ко всем семьям. PEDE alias сохраняет family:ped. OCUL/ALTER legacy exact proof не распространяется на новых соседей.

Rejected relation исключается как сегмент пути. Competing relation reviews сохраняют оба immutable Verdict и переводят effective view в hold до adjudication. Потенциальный split и неоднозначное alignment не разрешаются произвольным источником. Same id/revision с разными payload — hard integrity conflict: оба payload сохранены, старый не перезаписан; stale predecessor отвергается.

Гарантия относится к новому изолированному graph/query API. Production loaders/fallbacks не переписаны; устранение их прежних глобальных ограничений не заявляется. Снимок решений закреплён: изменение решений требует явной пересборки. Функции автоматического отзыва решений, promotion, изменения membership или переключения production нет.

Продолжай фундаментальное исправление associative family index в репозитории `landquart/interal`.

ВАЖНО: архитектурный переход к v6 уже начат и в значительной степени реализован. Не создавай второй v6 и не повторяй выполненную работу. Задача теперь — довести новую модель до состояния, в котором она действительно радикально сокращает объём лингвистической проверки всего индекса без потери качества.

Главная текущая проблема:

**новая ontology уже существует, но большинство старых решений всё ещё импортированы как individual exact-record units, поэтому реальное ускорение review пока равно 1.0.**

Следующий этап должен превратить v6 из правильной схемы хранения в реально масштабируемую лингвистическую систему.

## 1. Сначала перепроверь remote

На момент составления задания:

PR #650:
`fix/associative-information-20260930`

HEAD:
`3da2717f7de702f68cf465c7434e15ff7abd2d50`

PR #651:
`fix/associative-component-membership-20261001`

HEAD:
`22e6293f72a22e80e364079d83031a1f8f2a36d6`

PR #652:
`feat/associative-family-v6-head-architecture-20261003`

HEAD:
`b4c95f731512ee6f54a33205230c24b531e584ce`

\#652 основан на #651.

\#651 основан на #650.

PR #652 сейчас draft.

На проверенном HEAD #652:

`Tests` — success.

`Audit parallel associative family v6` — success.

Перед работой обязательно проверить, не появился ли более новый HEAD.

Не merge #650/#651/#652 без отдельного разрешения пользователя.

Production остаётся на v5.

## 2. Сначала прочитать существующую v6 документацию

Использовать как authoritative current state:

`docs/associative-family-v6.md`

`docs/associative-v6-canonical-boundaries.md`

`audit/associative-family-v6/CHECKPOINT.md`

`associativvordes/family-index-v6/catalog.json`

`associativvordes/family-index-v6/schema.json`

`associativvordes/family-index-v6/generated/migration-report.json`

`associativvordes/family-index-v6/generated/review-queue-frames.json`

`audit/associative-family-v6/risk-inventory.json`

Не переписывать уже доказанные checkpoints.

## 3. Что уже сделано и НЕ должно повторяться

V6 уже:

- существует параллельно v5;
- не включён в production;
- классифицирует все 2,456,540 v5 objects;
- сохраняет весь v5 как immutable evidence/candidate layer;
- отделяет `surface:*` от настоящих associative families;
- отделяет `ety:*` от настоящих associative families;
- имеет отдельный canonical family catalog;
- имеет lexical-head entities;
- имеет head→family edges;
- имеет lemma→head links;
- имеет national-realization/reflex layer;
- имеет parallel shadow runtime;
- имеет deterministic rebuild;
- имеет migration inventory;
- имеет risk analysis;
- имеет duplicate analysis;
- имеет query differential;
- сохраняет все source corpus records.

Текущая полная классификация:

`2,456,540` v5 objects.

Из них:

`2,435,769`
→ surface component candidates.

`20,755`
→ etymological evidence clusters.

`6`
→ legacy verified associative families.

`10`
→ manually promoted associative families.

Итого текущий catalog:

`16` associative families.

Это НЕ означает, что во всём индексе существует только 16 настоящих ассоциативных семей.

Это только уже доказанный catalog seed.

## 4. Corpus preservation уже доказан

Source corpus:

`4,924,980` IDs.

Zero-v5-membership source records:

`829`.

Все materialized source IDs найдены.

Не повторять старую диагностическую проблему с альтернативным parser как будто это unresolved data loss.

Current authoritative corpus enumeration уже доказала сохранность source frame.

Не создавать никаких новых:

- lemma IDs;
- frequencies;
- ranks;
- sources;
- category measurements.

## 5. Canonical-root policy уже исправлена, сохранить её

Ассоциативная семья называется по **ассоциативной основе без окончания**, но это не означает механического максимального сокращения строки.

Ключевые regression controls:

`pede → ped`

но:

`creat → creat`

НЕ:

`creat → cre`.

Это фундаментальный принцип.

Canonical associative root — не обязательно строгий исторический linguistic root.

Это **устойчивая узнаваемая основа международного ряда**, от которой отделены реальные окончания, но не отрезана часть самой основы.

Например:

`ped`

правильно.

`pede`

слишком длинно как canonical family base.

Но:

`creat`

правильно.

`cre`

слишком коротко.

Аналогично уже приняты:

`observ`
`inform`
`loc`
`nat`
`inter`
`relat`
`oper`
`mut`
`act`

и другие текущие catalog roots.

Не вводить generic suffix stripping.

Не использовать правило:

«отбросить конечную гласную».

Не использовать:

«Latin word minus Latin ending = family root».

`latinStemProposals` остаётся только retrieval/review aid.

## 6. Не путать три уровня: canonical root, national realization и lexical form

Это теперь критически важно.

Есть три разные сущности.

### A. Canonical associative root

Например:

`creat`

### B. Настоящая национальная реализация основы

Например:

canonical:
`observ`

Italian:
`osserv`

canonical:
`loc`

German:
`lok`

Russian:
`лок`

canonical:
`creat`

German:
`kreat`

Это устойчивые соответствия самой основы.

### C. Конкретная lexical/inflectional form

Например:

`crea`
`cree`
`creo`
`creation`
`osservando`
`azioni`
`attore`

Такая форма НЕ должна автоматически становиться national reflex.

Она может быть:

- lexical head;
- inflection;
- derivational stem;
- branch-specific realization;
- compound form.

Эти понятия нельзя смешивать.

## 7. Перепроверить текущий reflex/realization layer

Текущий catalog уже содержит полезные reflexes, но часть записей выглядит слишком поверхностной для статуса general national realization.

Особенно отдельно перепроверить такие типы записей как:

`crea`
`cree`
`crei`
`creo`

для `creat`;

`att`
`attric`
`azion`

для `act`;

`accion`;

`relac`
`relaz`;

и аналогичные формы в других families.

НЕ считать их автоматически неправильными.

Но определить, чем каждая из них реально является:

1. stable national root reflex;
2. lexical-branch stem;
3. derivational stem;
4. inflectional surface;
5. query alias;
6. historical evidence form.

Только тип 1 должен использоваться как general family realization.

## 8. Ввести typed realization model

Вместо одного неразличённого списка `realizations/reflexes` ввести явные типы.

Например:

`canonical_reflex`

Устойчивая национальная реализация самой ассоциативной основы.

Примеры:

`observ → osserv`

`loc → lok`

`loc → лок`

в доказанных языках.

---

`lexical_branch_realization`

Реализация, допустимая только для конкретной lexical branch.

Она НЕ разрешает искать любое слово с этой строкой.

---

`derivational_stem`

Основа конкретного деривационного ряда.

---

`inflectional_form`

Поверхностная словоформа.

Никогда не является general family reflex.

---

`query_alias`

Только поиск/navigation.

Не устанавливает membership.

---

`historical_evidence_form`

Только etymological evidence.

Не устанавливает membership.

Этот типовой слой должен пройти через schema, catalog, audit и tests.

## 9. General reflex должен иметь supporting heads

Не считать language realization полноценным productive reflex, если у него нет нормального supporting-head evidence.

Сейчас в catalog есть реализации с пустым:

`supporting_heads: []`.

Такие записи нужно перепроверить.

Возможные результаты:

- добавить реальные supporting lexical heads;
- понизить до branch-specific realization;
- понизить до query alias;
- оставить pending;
- удалить из general reflex layer, сохранив evidence.

Не фабриковать supporting heads.

## 10. Главный текущий bottleneck

Migration report сейчас показывает:

true associative families:
`16`

lexical heads:
`162`

legacy exact-record units:
`19,717`

head-family edges:
`20,058`

generated accepted memberships:
`19,967`

finite policy lemma links:
`71`

finite policy head edges:
`38`

manual review reduction factor:
`1`

Это главный показатель незавершённости архитектуры.

Новая модель ещё почти не сократила дорогую лингвистическую работу.

## 11. Главная следующая задача — заменить exact-record units доказанными shared lexical heads

Не пытаться улучшить статистику искусственно.

Но для каждого large review frame нужно искать реальную shared lexical identity.

Например вместо:

50 отдельных records:

`created`
`creates`
`creating`
`creator`
...

исследовать соответствующие lexical heads и derivational branches.

Один доказанный head/branch может управлять конечным списком конкретных lemma IDs.

### Требование

Нельзя объединять записи только потому, что:

- у них одинаковый prefix;
- string похож;
- один substring;
- одинаковый suffix;
- они semantic similar;
- morphology guess выглядит вероятно.

Shared head должен иметь evidence.

## 12. Создать полноценный lexical-head recognizer

Текущий fallback:

`legacy_exact_record`

не является окончательным lexical head.

Нужно систематически преобразовывать exact-record units в нормальные head identities.

Для каждого языка использовать:

- существующий morphology analyzer;
- source lemma/etymology data;
- inflectional relations;
- derivational analysis;
- dictionaries/etymological sources там, где нужно;
- already reviewed decisions.

Head identity должна включать:

- language;
- normalized lemma/head;
- sense/etymological discriminator при необходимости.

Омонимы не объединять.

## 13. Разделить morphology grouping и linguistic acceptance

Автоматический morphology engine может предложить:

`record A`
`record B`
`record C`

→ candidate head X.

Но это только proposal.

Затем проверяется:

- действительно ли формы принадлежат одной лексеме/branch;
- правильна ли морфология;
- одинаковая ли этимология;
- одинаков ли family relation.

Только после этого создаётся reusable head.

## 14. Finite head expansion

После доказательства head можно автоматически применять verdict ко всем **конкретно перечисленным** corpus forms этого head.

То есть:

head decision

→ finite lemma ID set.

Не:

head decision

→ все будущие strings matching prefix.

`applyHeadReview()` правильно требует exact affected links — сохранить этот guard.

Но число links на head должно увеличиваться там, где это действительно лингвистически доказано.

## 15. Главная метрика ускорения

Измерять:

`exact lemma records resolved / expensive head decisions`.

Сейчас:

reduction factor:
`1.0`.

После каждого большого этапа пересчитывать.

Цель — максимальное доказанное увеличение.

НЕ ставить искусственный обязательный порог 10×.

Если evidence позволяет 3× — записать 3×.

Если позже позволяет 15× — записать 15×.

Никогда не объединять сомнительные records ради улучшения метрики.

## 16. Current active review frame

Сейчас authoritative v6 current queue:

`25,202` distinct pending/uncertain records.

Разбивка:

observ/inform:
`201`

relat:
`325`

creat+mut:
`4,967`

oper:
`2,082`

act:
`16,785`

loc:
`842`

Эта сумма:

`25,202`.

Отдельно существуют:

investigated reflex uncertainties:
`155`

historical nat/loc/inter reconciliation;

Russian short candidates:

`kh`
`nl`
`lo`
`ca`
`um`;

val evidence targets:
`15`.

Не смешивать их искусственно в один count.

## 17. Первым использовать небольшие queues для калибровки head engine

Не начинать с 16,785 act records.

Сначала доказать качество grouping на меньших frames.

Рекомендуемый порядок:

1. `observ/inform` — 201;
2. `relat` — 325;
3. `loc` — 842;
4. затем `creat`;
5. `mut`;
6. `oper`;
7. `act`.

Задача первых трёх — откалибровать reusable lexical-head procedure.

## 18. Observ/inform как первый benchmark

Использовать уже огромное количество предыдущего research evidence.

Разобрать remaining 201 pending не как 201 независимое слово, если они образуют реальные shared heads.

Отдельно сохранить 155 genuine investigated uncertainties.

Не превращать их обратно в pending.

Не принимать их автоматически.

Измерить:

- число records;
- число proposed heads;
- число evidenced heads;
- reduction factor;
- число unresolved exact records.

Это первый реальный benchmark v6 acceleration.

## 19. Relat как второй benchmark

325 remaining records.

Сгруппировать по lexical heads и branch.

Особенно различать:

- relation;
- relative;
- correlate/interrelate;
- national derivatives;
- unrelated prelate/praelatus;
- French unrelated branches;
- Spanish unrelated ties/lazo branches;
- names;
- fused phrases.

Не использовать `relat` substring как head identity.

## 20. Loc как reflex benchmark

842 unresolved records.

Здесь одновременно проверяются:

- lexical-head grouping;
- real national reflexes;
- cross-script realization.

Approved examples сохраняются:

`loc`

German:
`lok`

Russian:
`лок`.

Negative controls:

`lieu`

`lieutenant`.

Не превращать любое `lok/лок` occurrence в family membership.

## 21. Creat benchmark должен отдельно защищать canonical boundary

Canonical:

`creat`.

Не:

`cre`.

Не считать поверхностные формы:

`crea`
`cree`
`creo`

general family root автоматически.

Различать:

- stable national realization;
- conjugated forms;
- derivational branch;
- unrelated `creer`;
- credit/credere branch;
- creatine;
- medical/Greek branch;
- crease/growth branch;
- proper names.

## 22. Act — главный stress test

Только после калибровки engine переходить к current:

`16,785`

pending + investigated uncertain records.

Current known aggregate:

accepted:
`2,268`

excluded:
`33,224`

pending:
`16,642`

investigated uncertain:
`143`

Полный action frame:

`52,277`.

Нужно максимально заменить record-level decisions на real shared lexical heads.

Но различать:

- act;
- action;
- actor;
- active;
- activity;
- actual;
- actuarial;
- German Akt/Aktion/aktiv;
- Spanish acción;
- Italian atto;
- attore;
- attrice;
- azione;
- Russian акт/акц branches;

от:

- Actium;
- Azio;
- actin;
- protein actin;
- fact;
- pact;
- tact;
- tract;
- fract;
- lact;
- unrelated Italian att-;
- unrelated Russian heads;
- names;
- fused garbage.

## 23. Особенно исправить модель Italian `act`

Нельзя иметь conceptual rule:

`att* → act`.

Нельзя иметь:

`azion* → act`

как unrestricted rule.

Если:

`atto`
`attore`
`attrice`
`azione`

принадлежат action family, это должно быть представлено через конкретные lexical branches / branch-specific realizations и evidence.

Например `attric` не следует считать универсальным Italian reflex canonical `act`, если это лишь часть конкретной derivational branch.

Это важный regression test нового typed realization layer.

## 24. Promotion pipeline для всех настоящих families

После того как head engine работает, перейти от текущих 16 seed families к поиску остальных реальных associative families.

Сейчас существует:

`20,755`

etymological evidence clusters.

Risk analysis уже имеет:

cross-language proposals:
`17,519`

alias ambiguity:
`17,660`

proper-name/capitalized signals:
`8,805`

short canonical proposals:
`301`.

Это candidate evidence, а не 20,755 будущих families.

## 25. Не проверять 20,755 evidence clusters по одному

Нужно сначала агрегировать их по возможной associative base.

Несколько разных:

Latin etymons;

French intermediate forms;

national surface components;

могут поддерживать одну associative family.

Создать:

`candidate associative base clusters`.

Единица promotion review должна быть:

**candidate associative root**

а не:

**один etymon key**.

## 26. Candidate associative root generation

Для формирования candidate root использовать совместно:

- cross-language lexical heads;
- recurring component boundaries;
- etymological continuity;
- national realizations;
- international-vocabulary distribution;
- shared derivational families.

Не использовать отдельно:

- shortest substring;
- one etymon;
- one alias;
- one surface root.

## 27. Canonical-root selection для новых families

Для каждого promotion candidate отдельно определить правильную основу.

Критерий:

**основа должна быть без окончания, но нельзя отрезать часть самой устойчивой международной основы.**

Regression pair:

`ped`, не `pede`;

`creat`, не `cre`.

Проверять обе ошибки:

### Under-stripping

Canonical слишком длинный.

Например:

full lexical/etymological form используется как root.

### Over-stripping

Canonical слишком короткий.

Он начинает совпадать с unrelated vocabulary.

Обе ошибки блокируют promotion.

## 28. Не использовать один механический stemmer

Нельзя:

remove final vowel;

remove Latin ending;

shortest common prefix;

longest common substring;

Porter stemming;

и т. п.

как canonical-family algorithm.

Такие методы могут только генерировать proposals.

Final canonical root является explicit reviewed decision.

## 29. Promotion priority

Чтобы максимально ускорить весь индекс, сначала проверять candidate roots с максимальным ожидаемым эффектом.

Приоритетная функция может учитывать:

- число distinct lexical heads;
- число corpus lemmas;
- число языков;
- количество evidence clusters, которые будут сведены;
- alias ambiguity;
- duplicate clusters;
- current runtime visibility;
- risk of mass false membership.

Но ranking ≠ verdict.

## 30. Использовать 6,624 duplicate candidates

Current migration report содержит:

`6,624`

duplicate candidates.

Провести глобальное exact/near-duplicate clustering.

Различать:

- один associative root, раздробленный несколькими etymons;
- действительно разные homonymous branches;
- duplicate technical containers;
- identical data produced by pipeline artifact.

Identical member arrays — сильный technical signal, но не доказательство linguistic identity.

## 31. Val использовать как обязательный architecture stress test

Current:

15 retained val evidence routes.

Не сливать их.

Проверить:

- valid;
- value/valor;
- valence;
- valley/vale/vallis;
- Valerius;
- personal names;
- unrelated branches;
- Italian/Russian surface forms.

Определить реальные candidate associative roots.

Alias `val` остаётся lookup route, а не linguistic merger.

## 32. Russian short roots

Остаются:

`kh`
`nl`
`lo`
`ca`
`um`.

Проверять не как surface buckets, а как possible associative-root promotion candidates.

Особенно:

`um`.

Если существует реальный lexical head `ум` с формами:

`ум`
`умный`
`умно`
и т. п.,

это не значит автоматически, что он является международной associative family.

Сначала определить:

- lexical family;
- международность/роль в модели;
- canonical root;
- допустимые forms.

## 33. Historical nat/loc/inter reconciliation

Старые exact-fragment dispositions нельзя просто импортировать как final truth.

Создать современный overlay:

historical decisions
\+
national reflex decisions
\+
current v6 head identities.

Особенно old category:

`excluded_absent_exact_fragment`

является technical historical screen.

Она НЕ является окончательным linguistic exclusion после принятия root-specific reflex policy.

Не принимать автоматически:

`nat ↔ nasc/naci`

или:

`inter ↔ entre`.

Каждый reflex доказывается отдельно.

## 34. Evidence cache должен стать глобальным

Если lexical fact уже исследован:

например:

`es:creer ≠ family:creat`

его решение должно использоваться во всех последующих reviews.

Не исследовать заново одно и то же слово из-за появления в другом candidate cluster.

Global evidence object должен быть addressable независимо от family queue.

## 35. Head identity должна быть sense-aware

Недостаточно:

`language + spelling`.

При омонимии использовать discriminator.

Например два одинаково написанных head с разной этимологией не должны автоматически объединяться.

Минимальная identity:

language
\+
normalized head
\+
sense/etymological branch when necessary.

## 36. Не выдавать guessed head за доказанный

Current v6 правильно использует:

`legacy_exact_record`

для unresolved cases.

Сохранять это поведение.

Morphology candidate становится shared head только после evidence.

До этого:

exact record remains exact record.

Это лучше низкого reduction factor, чем ложная компрессия.

## 37. Но actively исследовать shared heads

Не использовать осторожность как повод оставить все 19,717 records навсегда отдельными.

Цель следующей работы — именно найти реальные повторяющиеся identities.

Для каждого review frame:

1. morphology clustering;
2. evidence lookup;
3. lexical-head proposal;
4. representative verification;
5. finite lemma enumeration;
6. accepted head identity;
7. head→family review;
8. generated lemma memberships.

## 38. Head-level exclusions так же важны, как acceptances

Если доказан unrelated lexical head:

он должен исключить все finite linked forms одной decision.

Пример:

`Mütze` branch
≠ `mut`.

Это позволяет быстро удалять большие группы false candidates без repeated word-by-word review.

## 39. Отдельно различать four decision layers

Не смешивать:

### Head identity decision

Эти forms принадлежат одной lexical head/branch?

### Family-edge decision

Этот head принадлежит associative family?

### Reflex decision

Эта форма является общей национальной реализацией root?

### Canonical-family decision

Как называется сама associative base?

Одно решение не должно автоматически давать остальные три.

## 40. Alias также отдельный layer

Query alias:

`pede`
может вести к:

`family:ped`.

Но это не значит, что `pede` является canonical root.

Alias:

`information`
может вести к `inform`.

Это не значит, что вся строка `information` является reflex.

Alias:

`val`
может вернуть несколько candidates.

Это не значит, что они одна family.

## 41. Real family catalog должен постепенно заменять provisional 16-family seed catalog

Текущие 16 families — только начало.

Не создавать автоматически family для каждого component.

Но систематически искать остальные реальные associative roots.

Для каждого нового root:

- canonical boundary;
- lexical heads;
- national realizations;
- etymological support;
- aliases;
- controls;
- edge status;
- migration impact.

## 42. Не требовать шесть языков

Настоящая associative family может не иметь corpus evidence во всех шести языках.

Отсутствие одного языка не запрещает family.

Но international character должен иметь достаточное основание.

Не создавать family для чисто локального случайного root только потому, что morphology engine его нашёл.

## 43. Не ограничивать family size

Никаких:

20-word cap;

100-word cap;

top-N.

Большая реальная family допустима.

Проверка должна масштабироваться через heads и morphology, а не путём обрезания данных.

## 44. Corpus gap

Если ожидаемое слово отсутствует в source corpus:

record:

`corpus_gap`.

Не придумывать запись.

Известный пример:

English `natalism` в locked corpus ранее отсутствовал.

## 45. Current catalog accepted memberships сохранить

Current accepted membership counts:

act:
`2,268`

alter:
`2,485`

creat:
`574`

inform:
`1,473`

inter:
`4,283`

liber:
`162`

loc:
`1,218`

manu:
`244`

mut:
`569`

nat:
`1,915`

observ:
`315`

ocul:
`59`

oper:
`1,595`

ped:
`1,556`

regul:
`764`

relat:
`487`

Total:
`19,967`.

Не удалять их массово ради новой architecture.

При переходе exact-record → shared-head доказать эквивалентность generated membership set.

## 46. Exact-record → head migration должна быть lossless

Для каждого converted group доказать:

# before lemma IDs

after generated lemma IDs

если linguistic verdict не менялся.

Если одновременно обнаружена старая false membership:

это отдельный linguistic correction, а не скрытая migration difference.

Разделять:

`representation change`

и:

`membership correction`.

## 47. Differential report должен классифицировать причины

Каждое отличие v5/v6:

- technical demotion;
- canonical rename;
- alias-only change;
- head grouping representation change;
- accepted membership addition;
- linguistic exclusion;
- unresolved withheld;
- evidence-only route;
- corpus gap.

Никакого общего `removed`.

## 48. Не переключать production

V6 остаётся shadow/parallel до тех пор, пока:

- catalog достаточно развит;
- head grouping доказан;
- representative families проходят;
- differential понятен;
- v5 preservation проходит;
- v6 audit проходит;
- random sample quality измерена.

Production switch — отдельное решение пользователя.

## 49. Checkpoint discipline

Каждый большой этап отдельным commit.

Например:

1. typed realization schema;
2. realization catalog migration;
3. first shared-head recognizer;
4. observ/inform regrouping;
5. relat regrouping;
6. loc regrouping;
7. creat/mut;
8. oper;
9. act;
10. historical reconciliation;
11. promotion-cluster engine;
12. first new-family promotion batch;
13. val;
14. Russian short;
15. global validation.

Не делать один огромный commit.

## 50. После каждого head-review stage сохранять

- source frame hash;
- proposed heads;
- rejected head proposals;
- accepted shared heads;
- lemma-head links;
- head-family decisions;
- exact affected lemma IDs;
- evidence;
- pending;
- uncertainty;
- reduction metrics;
- replay test;
- targeted test.

## 51. Validation

После runtime-independent v6 data changes:

targeted v6 tests;

v6 audit;

deterministic replay.

После changes, затрагивающих shared code или v5:

полный:

`npm test`

v5 exhaustive preservation audit;

v6 audit;

deterministic replay.

Remote Actions проверять после push.

## 52. Не ослаблять safety guards

Сохранять:

expected version checks;

exact affected IDs;

no propagation from `legacy_exact_record`;

finite link requirement;

evidence requirement;

duplicate-edge rejection;

production disabled.

Эти guards сейчас являются сильной частью v6.

## 53. Новый критерий архитектурного успеха

Недостаточно:

«v6 существует».

Недостаточно:

«2.4M surface objects переклассифицированы».

Недостаточно:

«tests pass».

Успех означает:

1. настоящие lexical heads реально заменяют тысячи exact-record decisions;
2. review reduction factor растёт;
3. false grouping не увеличивается;
4. reflex layer больше не смешивает stems, inflections и aliases;
5. catalog постепенно охватывает реальные associative families всего индекса;
6. technical evidence clusters больше не требуют family-level ручной проверки;
7. каждое дорогое лингвистическое решение разрешает максимально возможное число finite corpus records.

## 54. Приоритет работы от current HEAD

Если remote state не изменился, порядок:

### Этап 1

Исправить typed realization/reflex ontology.

Особенно audit:

`crea/cree/crei/creo`

`att/attric/azion`

`accion`

`relac/relaz`

и аналогичные entries.

### Этап 2

Создать evidence-backed lexical-head grouping pipeline.

### Этап 3

Полностью применить его к 201 observ/inform records.

### Этап 4

Применить к 325 relat.

### Этап 5

Применить к 842 loc.

После каждого измерить actual reduction factor.

### Этап 6

Creat/mut:
`4,967`.

### Этап 7

Oper:
`2,082`.

### Этап 8

Act:
`16,785`.

### Этап 9

Reconcile historical nat/loc/inter.

### Этап 10

Review 15 val evidence routes.

### Этап 11

Review Russian short roots.

### Этап 12

Cluster 20,755 evidence nodes into candidate associative bases и начать systematic promotion остальных настоящих families.

### Этап 13

Повторный global risk scan.

Продолжать следующие high-value clusters без остановки.

## 55. Главные regression examples

Всегда сохранять:

`ped`, не `pede`.

`creat`, не `cre`.

`observ ~ Italian osserv`.

`loc ~ German lok / Russian лок`.

`nat ≠ naive`.

`loc ≠ lieu`.

`loc ≠ lieutenant`.

`inter` in `international` yes.

incidental `inter` in `winter/printer` no.

`act ≠ Actium`.

`act ≠ actin` автоматически.

`creat ≠ creer`.

Alias ≠ family identity.

Inflection ≠ national reflex.

Historical etymon ≠ associative family.

## 56. Центральное правило canonical root

Canonical root — это:

**наиболее компактная форма устойчивой ассоциативной основы, после удаления настоящих окончаний, но без удаления сегментов, которые являются частью узнаваемой международной основы.**

Поэтому:

`pede → ped`

но:

`creat → creat`.

Это не shortest-string algorithm.

## 57. Центральное правило ускорения

Не ускорять процесс ослаблением критерия.

Ускорять его переносом дорогого решения с:

`lemma-family`

на:

`lexical-head-family`.

Но только после доказательства lexical-head identity.

Правильная цель:

**один исследованный head → десятки или сотни конкретных deterministic lemma decisions**

вместо:

**одно исследование → одна lemma**.

## 58. Финальная цель всей работы

Весь старый массив:

`2,456,540` v5 family-like objects

не должен проверяться вручную как 2.46M families.

Он должен использоваться как:

- component candidate layer;
- etymological evidence layer;
- corpus evidence layer.

Поверх него должен постепенно формироваться существенно меньший catalog настоящих associative families.

Настоящая дорогая работа должна свестись к:

- canonical associative roots;
- lexical heads;
- head→family edges;
- national reflexes;
- ambiguous senses;
- promotion candidates.

Именно это позволит закончить полный индекс за разумное время без потери лингвистической точности.

## 59. Итоговый отчёт каждого значительного continuation

Показывать:

current HEAD;

commits;

v6 family count;

new promoted roots;

canonical decisions;

realization reclassifications;

shared lexical heads;

exact-record units before/after;

active records before/after;

actual review reduction factor;

accepted/excluded/uncertain/pending;

generated memberships;

unexpected differential count;

targeted tests;

full tests;

v5 preservation audit;

v6 audit;

deterministic replay;

remote Actions;

следующий этап.

Не заявлять ускорение, если measurement его ещё не показывает.

Не заявлять linguistic completeness по structural test pass.

Главная задача теперь:

**не строить ещё одну архитектуру, а заставить уже созданную v6 архитектуру реально заменить десятки тысяч индивидуальных проверок небольшим числом доказанных lexical-head decisions, одновременно постепенно выявляя все настоящие associative families во всём индексе.**
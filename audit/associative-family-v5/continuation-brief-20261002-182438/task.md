Продолжай полную лингвистическую проверку и исправление exhaustive associative family index v5 в репозитории `landquart/interal`.

Работай непрерывно по всему известному backlog. Не останавливайся после одного небольшого batch, одной семьи или одного commit. После завершения каждого самостоятельного этапа сохраняй durable checkpoint/commit и переходи к следующей задаче.

Вся работа должна быть полностью восстанавливаема только из Git history и файлов `audit/associative-family-v5/`, без зависимости от памяти чата или временного workspace.

## 1. Сначала перепроверь actual remote state

На момент составления этого задания:

`main`
\= `78182754c4254b6c26aba42e556cb67158bb8c14`

PR #650:
`fix/associative-information-20260930`

HEAD:
`3da2717f7de702f68cf465c7434e15ff7abd2d50`

PR #651:
`fix/associative-component-membership-20261001`

HEAD:
`7514aeda230e7e3e67b3b41bb2063f068f38a364`

\#651 основан на #650.

Перед любыми изменениями:

- получить актуальный HEAD #651;
- проверить новые commits;
- проверить GitHub Actions именно текущего HEAD;
- прочитать:
  `audit/associative-family-v5/WORK-CHECKPOINT-20261002-CONTINUATION.md`;
- затем при необходимости:
  `WORK-CHECKPOINT-20261002.md`;
- использовать самые новые stage-specific inventories как authoritative continuation state;
- не использовать старые промежуточные counts, если более поздний overlay их изменил.

На HEAD `7514aeda...`:

GitHub `Tests` — success;

Vercel — success;

`Audit repository associative family v5` на момент составления задания ещё выполнялся.

Сначала проверить его окончательный результат.

Локальное сохранённое доказательство уже существует:

полный test suite — pass;

109 discovered test files — pass;

exhaustive repository audit — pass.

Но remote CI текущего HEAD проверяется отдельно.

Не merge PR.

Не создавать новую stale branch от `main`.

## 2. Определение ассоциативной семьи

Ассоциативная семья строится вокруг узнаваемого международного лексического элемента и его конкретных прозрачных национальных реализаций.

Ассоциативная семья НЕ равна:

- literal substring;
- полному Latin etymon;
- всему историческому этимологическому дереву;
- общему suffix;
- словам с далёким общим предком;
- случайному совпадению букв.

Образцовый случай:

`observ`

Italian:

`osserv-`

является регулярной и узнаваемой национальной реализацией `observ`.

Поэтому:

`observe`
`observer`
`observation`
`osservare`
`osservazione`
`osservatore`
`osservatorio`

могут принадлежать `family:observ`.

Но это НЕ создаёт универсальное правило:

`ob → os`.

National reflex должен быть доказан именно для конкретного root и языка.

Одновременно нужны:

- формальная узнаваемость;
- правильная morphology;
- etymological continuity;
- принадлежность той же lexical branch;
- современная associative transparency.

Сохранять отрицательные controls:

`nat` ≠ `naive`;

`loc` ≠ `lieu`;

`loc` ≠ `lieutenant`;

incidental `inter` внутри `winter`, `printer`, `splinter` ≠ associative `inter`;

`Actium/Azio` ≠ lexical `act`.

Exact substring — только retrieval signal, а не окончательное membership rule.

## 3. Не повторять уже выполненные runtime stages

Если current HEAD сохраняет существующее состояние, не запускать повторно:

- initial `nat/loc/inter` materializer;
- initial `observ/inform` materializer;
- six-record observ/inform extension;
- eighteen-record observ/inform heads extension;
- initial `act` materializer;
- 170-record action positive extension;
- `creat` materializer;
- `relat` materializer;
- `oper` materializer;
- `mut` materializer;
- `loc~lok/лок` materializer.

Все они имеют guarded/repeat-refusal behaviour.

Не ослаблять эти guards ради удобства.

Исторические artifacts immutable.

Если старый artifact содержит `ready_to_materialize`, а следующий commit уже materialized его — это историческое состояние, а не ошибка файла.

Не переписывать прошлое.

Создавать новый continuation artifact.

## 4. Текущее runtime-состояние

По последнему сохранённому exhaustive audit:

families:
`2,456,540`

aliases:
`1,934,055`

lemmas:
`4,924,980`

components:
`9,349,982`

memberships:
`10,049,761`

materialized unique lemmas:
`4,924,151`

multi-family lemmas:
`3,335,533`

lemmas without materialized family:
`829`

Language memberships:

en:
`2,619,277`

de:
`2,211,171`

fr:
`1,144,211`

es:
`1,798,420`

it:
`1,148,982`

ru:
`1,127,700`

Все repository-static-integrity invariants сохранены как true.

Это software/data-integrity доказательство, а не linguistic certification.

## 5. Первый приоритет — полностью закончить текущий `observ/inform` frame

Полный continuation frame:

`762` records.

Актуальное composed состояние:

accepted and applied:
`24`

excluded:
`162`

investigated uncertain:
`62`

pending review:
`514`

Сумма обязана оставаться:

`762`.

Runtime:

`family:observ`:
`309`

`family:inform`:
`1,455`

Не использовать более старые состояния:

730 pending;

553 pending;

539 pending;

527 pending.

Это historical stage counts.

Authoritative latest state:

`24 + 162 + 62 + 514 = 762`.

Продолжать из latest pending queue, указанной в:

`WORK-CHECKPOINT-20261002-CONTINUATION.md`

и соответствующем latest reflex review artifact.

### Уже обработанные виды проблем не повторять

Уже отдельно разобраны:

- `informal` / negative `in- + formal`;
- French/Spanish/Italian nonformal branches;
- Italian `informicolarsi`;
- phrase fusions;
- Stein + Form / rein + Form;
- foreign forms without context;
- attested named compounds;
- ImageObserver;
- German Informatisierung-related heads;
- Russian information names;
- Italian Assinform;
- Spanish voseo/enclitic forms;
- Latin observation forms with unresolved usage context;
- independent Latin `informis`.

Не повторять эти decisions без новой конкретной причины.

### Что делать с 514 pending

Группировать не по буквам, а по lexical head.

Искать finite groups:

- valid information/informer/informatics derivatives;
- valid observation/observer/observatory derivatives;
- national `osserv-`;
- compounds с отдельным доказанным head;
- proper-name prefix + valid lexical head;
- malformed/fused tokens;
- independent form/formal roots;
- foreign quotations;
- spelling noise;
- unrelated etymologies.

Для каждой группы:

1. определить lexical head;
2. проверить этимологию;
3. проверить morphology;
4. установить national realization;
5. сохранить конечный список affected lemma IDs;
6. принять `accepted`, `excluded` или реально исследованный `uncertain`.

`pending_review` нельзя переводить в `uncertain` просто потому, что очередь большая.

Цель этого этапа — довести 514 pending максимально близко к нулю.

## 6. Не уничтожать реальные uncertainties

Сейчас имеются 62 `investigated uncertain`.

Это уже исследованные случаи, в отличие от pending.

Не заставлять их искусственно становиться binary decisions.

Например source aggregate может не позволять отличить:

- native lexical use;
- quotation;
- title;
- foreign-language insertion;
- homographic sense.

Если дополнительные corpus contexts недоступны, сохранение `uncertain` правильно.

Но обязательно отличать:

`uncertain after investigation`

от:

`not reviewed`.

## 7. Затем быстро закрыть маленькую `relat` queue

Current:

runtime accepted:
`487`

pending:
`325`

Полный original frame:
`4,356`.

Недавно отдельно исключены 84 fused phrase records.

Не повторять их.

Продолжить remaining 325.

Различать:

- relation;
- relative;
- correlate/interrelate;
- report-related reflexes, где этимология и современная association соответствуют принятой семье;
- French `frelater`;
- prelate/praelatus;
- Spanish lazo/entrelazar;
- names;
- fused phrase boundaries;
- accidental `relat`.

Поскольку queue небольшая, постараться довести её до полного reviewed state до перехода к следующей крупной семье.

## 8. Завершить `loc` reflex queue

Current runtime support:

`1,218`.

Остаётся:

`842 unresolved`.

Это уже отдельный reflex frame.

Не смешивать его механически со старым 38k `nat/loc/inter` backlog.

Сохранять уже подтверждённые:

`loc ~ lok` German;

`loc ~ лок` Russian.

Проверять:

- local;
- localization;
- location;
- locus;
- locomotive;
- locomotion;
- German lokal/Lokation/Lokomotiv;
- Russian локал-/локац-/локомотив-;
- compounds;
- named formations.

Отделять:

- kilo + calorie-like accidental boundary;
- block-derived strings;
- native unrelated roots;
- names;
- malformed corpus tokens.

`lieu` и `lieutenant` остаются negative controls.

Не возвращать их через далёкую этимологию.

## 9. Продолжить `creat`

Runtime accepted:
`574`.

Latest pending:
`2,315`.

Предыдущие 2 389 / 2 356 / 2 335 — historical counts.

Последние stages уже исключили:

- creak;
- crease;
- creed;
- creel;
- acreage-type heads;
- Spanish creer/credit branches;
- increase/decrease/crease growth/fold branches;
- отдельные медицинские/Greek branches.

Не повторять эти decisions.

Продолжить оставшиеся lexical heads.

Различать:

- create / creation;
- creative;
- German `kreat-`;
- German `kreier-`;
- French créer/création;
- Spanish crear/creación;
- Italian creare/creazione;
- Russian креат-/креац-;

от:

- creatine;
- independent Greek medical heads;
- croire;
- creer when unrelated;
- growth/fold ancestry without modern creat association;
- proper names;
- opaque strings.

Distant PIE/Latin ancestry не является достаточной associative связь.

## 10. Продолжить `oper`

Runtime accepted:
`1,595`.

Pending:
`2,082`.

Проверять operation/operate lexical family и productive German compounds.

Не считать большой German branch ложным только из-за размера.

Уже исключённые boundary problems не повторять.

Отделять:

- blooper/trooper-like strings;
- unrelated native heads;
- Russian `o + пере...` boundary;
- proper names;
- corpus fusions.

Для productive compounds достаточно доказанного lexical head + transparent morphology; отдельная dictionary article на каждое сложное слово не требуется.

## 11. Продолжить `mut`

Runtime accepted:
`569`.

Latest pending:
`2,652`.

Уже разобраны, среди прочего:

- German Mütze forms;
- Anmut;
- Edelmut;
- Italian mute/ammutolire/mutezza;
- другие явно независимые heads.

Не возвращать их.

Продолжать различать genuine mutation/change/exchange family от:

- German Mut;
- mutus/silence;
- mutilation;
- Wismut;
- azimuth;
- unrelated names;
- accidental mut string.

Historical `mutare` ancestry сама по себе недостаточна, если modern recognizable element отсутствует.

## 12. Four-root контрольная сумма

На текущем checkpoint:

creat:
`2,315 pending`

relat:
`325 pending`

oper:
`2,082 pending`

mut:
`2,652 pending`

Total:
`7,374 pending`.

Runtime accepted:

creat:
`574`

relat:
`487`

oper:
`1,595`

mut:
`569`.

После каждого continuation stage сохранять новый composed count.

Никогда не путать старый pending count с новым.

## 13. Затем продолжить `act`

Frozen frame:

`52,277`.

Current:

applied accepted:
`2,268`

excluded:
`33,224`

investigated uncertain:
`143`

pending:
`16,642`

Сумма:

`52,277`.

`family:act` уже materialized.

Не запускать предыдущие materializers повторно.

Compose decisions из:

- initial action review;
- action continuation;
- Italian action exclusions;
- independent English/French heads;
- Russian action heads;
- positive extension.

### Review pending по lexical heads

Различать:

- act;
- action;
- active;
- activation;
- actor;
- actual;
- actuarial;
- German Akt/Aktion/aktiv и действительно связанные branches;
- Spanish act-/acción;
- Italian atto/attore/attivo/attuale/azione там, где доказана branch;
- Russian акт-/акц-;

от:

- Actium/Azio;
- Greek actin-;
- protein actin;
- fact;
- pact;
- tact;
- tract;
- fract;
- lact;
- character-like sequences;
- Italian unrelated att-;
- unrelated Russian акц-/акт-;
- proper names;
- fused garbage.

Никаких open rules:

`att* = act`

`azion* = act`

`akt* = act`.

National reflex определяется lexical-head evidence.

## 14. Legacy `actio/acti` удалить только в конце review

Containers:

`ety:751cdacbf4a9`

`ety:9a86a987fafc`

пока сохраняются правильно.

Не retire их, пока остаётся большой pending frame.

Перед eventual retirement необходимо доказать:

- lexical act records перенесены;
- Actium/Azio отделён;
- independent routes сохранены;
- unresolved records не теряются;
- aliases корректны;
- corpus metadata сохранена.

Retirement — отдельный review/preflight/application/validation stage.

## 15. После локальных reflex queues reconcile historical `nat/loc/inter`

Старый component frame содержит:

accepted:
`6,911`

literal-absence screens:
`10,688`

old pending:
`38,087`.

Это historical classification.

Не считать:

`38,087`

современным независимым backlog без overlay новых decisions.

Особенно `loc` уже существенно изменён новым reflex review.

Нужно создать современный composed state:

historical frame
\+
new reflex decisions
\+
materialized additions
\+
subsequent exclusions.

Не собирать старые кандидаты заново, если frozen arrays уже достаточны.

### `nat`

Positive conceptual examples:

nation;
national;
natural;
natalism.

Если `natalism` по-прежнему отсутствует в locked corpus:

`corpus_gap`.

Не придумывать record.

Не вводить автоматически:

`nasc`
`naci`

как nat-reflexes.

`naive` остаётся exclusion.

### `inter`

Сохранять genuine:

international;
interval;
internet;
и другие реальные inter formations.

Исключать incidental overlap:

winter;
printer;
splinter;
midwinter;
teleprinter.

Не вводить `entre` автоматически.

Independent components сохраняются.

`international` может одновременно иметь `inter` и `nat`.

Это не объединяет семьи.

## 16. Русские короткие buckets

Уже обработаны:

`na`
`u`
`da`
`ma`
`ga`.

Не повторять.

Остаются:

`surface:ru:kh`

`surface:ru:nl`

`surface:ru:lo`

`surface:ru:ca`

`surface:ru:um`.

Для каждого выяснить:

существует ли настоящий associative head вообще.

Не применять exact-token-only policy.

Особенно `um`:

если `ум`, `умно`, `умный` и т. п. действительно образуют transparent lexical family, сохранять её.

Но не объединять всё когнитивно связанное словообразование только по meaning.

## 17. Полностью разобрать `val`

Retained reverse alias сейчас имеет 15 uncertified targets:

`ety:082a0688243f`
`ety:74e7854bc739`
`ety:88d0d6fc2226`
`ety:90cc3df5865e`
`ety:961ca0038bb5`
`ety:acab8c629de8`
`ety:d8d34e574c18`
`ety:ddf6d676859e`
`ety:e12cdb45881f`
`ety:e8bac130ca91`
`ety:f00bcab16c95`
`ety:f6fe7a68b637`
`ety:f7c173d84c24`
`surface:it:val`
`surface:ru:val`

Retention — только routing quarantine.

Не считать эти 15 правильными families.

Провести полный membership review.

Разделять потенциальные ветви:

- value / valor;
- valid / strength;
- valence;
- vale / valley / vallis;
- Valerius/personal names;
- unrelated named branches;
- Italian surface val;
- Russian surface val;
- accidental segmentation.

Saved overlap diagnostics показывают большие nearly-identical и identical массивы.

Это сильный технический warning.

Одинаковые arrays не доказывают одинаковую лингвистическую семью.

Для каждого target определить:

- настоящий etymon;
- настоящий associative root;
- valid modern forms;
- national realizations;
- correct members;
- false members;
- duplicate-container status;
- user-facing alias routing.

Особенно внимательно проверять `interval`:

если независимый `val` component действительно существует по принятой модели, сохранить его вместе с `inter`.

## 18. Family size не ограничивать

Никакого:

20-word cap;

100-word cap;

frequency top-N.

Полная реальная productive family может иметь тысячи слов.

Большой support — risk signal, не verdict.

Удалять чужие memberships, а не настоящие редкие derivatives.

## 19. Corpus integrity

Никогда не создавать искусственно:

lemma_id;

frequency;

category breakdown;

source;

sense frequency;

provenance.

Если нужное слово отсутствует:

`corpus_gap`.

Existing source records должны сохраняться byte-equivalent по измеренным fields.

Membership может меняться.

Corpus evidence — нет.

## 20. Статусы review

Использовать строго:

`accepted`
\= исследовано и принято;

`excluded`
\= исследовано и отвергнуто;

`uncertain`
\= исследовано, но evidence реально недостаточна;

`pending_review`
\= ещё не исследовано.

Запрещено массово переименовывать pending → uncertain ради красивой статистики.

## 21. Способ разбора больших очередей

Не проверять случайные слова по одному.

Группировать по hypothesized lexical head.

Для head:

1. найти dictionary/etymology evidence;
2. установить morphology;
3. определить national reflex;
4. собрать конечный список конкретных corpus forms;
5. проверить исключения;
6. записать decision на каждый lemma ID;
7. сохранить source records.

Допустим finite morphological inference от доказанного head.

Недопустимо превращать его в unlimited substring rule.

## 22. Evidence

Для спорных cases использовать качественные lexical/etymological источники.

Фиксировать:

source URL;

что конкретно источник доказывает;

что является dictionary fact;

что является reviewer morphological inference.

Не писать, что dictionary «подтверждает» compound, если dictionary подтверждает только head.

## 23. Checkpoint discipline

Каждый самостоятельный stage должен иметь минимум:

- decisions;
- inventory;
- source records;
- pending queue;
- hashes;
- reproduction script;
- targeted tests;
- commit.

Review commit отдельно.

Runtime preflight отдельно.

Runtime application отдельно.

Final validation отдельно.

Эта схема уже используется в #651 — продолжать её.

## 24. Materialization

Перед mutation:

проверить exact baseline HEAD;

artifact hashes;

current family bytes;

member prefixes;

source records;

aliases;

metadata;

unrelated shard checksums;

existing components.

Materializer должен:

- отказать на неожиданном baseline;
- отказать при source mismatch;
- отказать при repeated application;
- не трогать unrelated records;
- добавлять component, не заменяя независимые components.

## 25. Validation после runtime mutation

Сначала targeted tests.

Никаких skipped application assertions.

После существенного runtime stage:

`npm test`

затем:

`node scripts/audit-repository-associative-family-v5.mjs`

Сохранять logs/hashes.

Проверять:

support;

language_support;

family count;

membership count;

aliases;

reverse routing;

manifest/report;

provenance;

independent components;

historical source preservation;

negative controls;

positive controls;

repeat-application refusal.

## 26. Audit entrypoint regression

Ранее remote exhaustive audit один раз упал ещё до самого audit из-за того, что import оказался перед hashbang.

Исправление:

`a1160fe0dbaf27a251df2096d11c6dad8dfeea0a`

вернуло hashbang на первую строку.

Не возвращать этот regression.

Если новый audit падает:

сначала определить, дошёл ли он вообще до scanning.

Не трактовать syntax/entrypoint failure как linguistic или index failure.

## 27. После известного backlog провести новый high-risk scan

Когда известные queues существенно сокращены, найти следующие проблемные families.

Искать:

- huge short roots;
- strong one-language imbalance;
- identical arrays у разных etymons;
- Jaccard near 1;
- huge alias fan-out;
- suffix masquerading as root;
- whole Latin etymon вместо associative root;
- proper-name contamination;
- phrase fusion;
- foreign-word contamination;
- national reflex lost by exact matching;
- safe_automatic family с явно heterogeneous examples.

Risk scan определяет порядок review.

Он не является automatic deletion algorithm.

## 28. Рабочий порядок от текущего состояния

Если новый remote HEAD не добавил более свежих решений, продолжать примерно так:

1. проверить завершение current remote exhaustive-audit workflow;
2. закончить 514 pending `observ/inform`;
3. закрыть 325 pending `relat`;
4. закрыть 842 `loc` reflex cases;
5. продолжить `creat` 2,315;
6. продолжить `oper` 2,082;
7. продолжить `mut` 2,652;
8. продолжить `act` 16,642 pending и отдельно 143 genuine uncertain;
9. при готовности безопасно retire legacy actio/acti;
10. reconcile modern `nat/loc/inter`;
11. проверить Russian `kh/nl/lo/ca/um`;
12. полностью разобрать 15 `val` routes;
13. сделать следующий high-risk scan;
14. продолжать следующую группу без остановки.

Если очередной root легко закрывается раньше, разумно довести его до completion, а не оставлять маленький хвост ради перехода к большему.

## 29. Текущий resume snapshot

Использовать это только как sanity check после чтения actual remote artifacts.

### observ/inform

frame:
762

applied:
24

excluded:
162

investigated uncertain:
62

pending:
514

runtime:

observ:
309

inform:
1,455

### act

frame:
52,277

applied:
2,268

excluded:
33,224

investigated uncertain:
143

pending:
16,642

legacy actio/acti retained.

### creat

runtime:
574

pending:
2,315

### relat

runtime:
487

pending:
325

### oper

runtime:
1,595

pending:
2,082

### mut

runtime:
569

pending:
2,652

Combined pending creat/relat/oper/mut:

`7,374`

### loc

runtime:
1,218

unresolved reflex:
842

### historical nat/loc/inter

old accepted:
6,911

literal-absence screens:
10,688

old pending:
38,087

Эти числа требуют modern overlay.

### Russian short

remaining:

kh
nl
lo
ca
um

### val

15 retained uncertified routes.

## 30. Git workflow

Сохранять:

\#650 → #651.

Не merge.

Не rebase на `main` без отдельной причины/разрешения.

Не терять durable commits.

После каждого push проверять remote commit SHA.

Не считать только local workspace сохранением работы.

## 31. Что считать завершением family

Family можно назвать complete только если:

- canonical associative root правильно определён;
- national reflexes определены;
- candidate frame сохранён;
- pending = 0;
- каждый uncertain действительно исследован;
- accepted materialized;
- false memberships отсутствуют;
- missing corpus records не выдуманы;
- independent components сохранены;
- aliases проверены;
- technical duplicate containers обработаны;
- source metadata сохранена;
- reproducible repair существует;
- targeted tests проходят;
- full validation после runtime mutation проходит.

Нельзя объявлять family законченной при тысячах untouched pending.

## 32. Итоговый отчёт после значительного этапа

Указать:

current HEAD;

commits created;

families reviewed;

runtime changes;

accepted;

excluded;

investigated uncertain;

pending;

confirmed national reflexes;

rejected reflex hypotheses;

retired containers;

corpus gaps;

targeted tests;

full tests;

exhaustive audit;

remote GitHub Actions;

remaining queues;

следующий high-risk cluster.

Но не прекращать общую работу только ради промежуточного отчёта.

Главный принцип:

**ассоциативный корень — это узнаваемый международный элемент и его доказанные национальные реализации, а не просто совпадающие буквы и не всё этимологическое древо.**

`observ ~ osserv` — правильная ассоциация.

`loc ~ lok/лок` — правильная ассоциация.

`nat ~ naive` — неправильная.

`loc ~ lieu` — неправильная.

`act ~ Actium` — неправильная.
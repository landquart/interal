# Строгая типизация морфологических отношений

Версия `external-morphology/1.0-draft`, **DESIGN_ONLY**. Relation — NEW пропозиция из [ENTITY-SCHEMA.md](ENTITY-SCHEMA.md), не существующий V head→family edge. Source strings, native labels, порядок столбцов и raw arrows сохраняются в Evidence независимо от нормализованной интерпретации.

## 1. Направление и участники

- `directed`: установлены откуда/куда; from_slots/to_slots непустые и не пересекаются. Для многокомпонентного образования несколько component slots указывают на result slot.
- `undirected`: по смыслу тип симметричен, происхождение/производность не утверждается. Это не две направленные связи.
- `unknown`: у направленного по природе процесса направление пока не установлено. Для такого Relation нельзя вывести reverse edge или membership path. Внутренний порядок колонок не доказательство.

Два независимых направленных процесса A→B и B→A, если они реально доказаны в своих исторических/смысловых scopes, представляются двумя Relations с отдельными Evidence/Verdict. `source_encoding=bidirectional_pair` в Evidence не означает этого случая.

`participants` содержит typed Endpoint, semantic role и, где нужно, порядок. Допустимые kinds: lexeme/sense/head/allomorph/form; definition Form value object дана в ENTITY-SCHEMA. Одно и то же слово может участвовать несколькими sense refs или component slots. Идентичные spelling не разрешают сокращать n-ary Relation до пары строк.

## 2. Основные типы

| type_id | Содержание и endpoints | Direction | Обязательные semantic parameters / условия подтверждения | Роль для membership |
|---|---|---|---|---|
| `derivation_direct` | Parent lexeme/sense → непосредственно образованный derivative lexeme/sense | directed; unknown допустим только как нерешённая гипотеза | `process`, `base_realization`, `output_realization`, `sense_scope`; отсутствие промежуточного деривационного звена должно быть обосновано. Conversion допустима с тем же spelling, но разными POS/lexemes | Только основание для finite проверки identity/boundary; не наследование всех членов |
| `derivation_indirect` | Base lexeme/sense → descendant через ≥2 образований | directed; unknown для нерешённого claim | `asserted_path_refs` и exact intermediate refs, либо `unresolved_intermediate:true`. Для разрешающего пути нужны все промежуточные звенья и reviewed transitions; отсутствие звеньев не заполняется предположением | Неполный path — только очередь. Полный path всё равно не даёт автоматическое closure |
| `shared_base` | Две или более lexeme/sense имеют одну установленную lexical base | undirected | `base_ref` (точная lexeme/head), scope/смысл и доказанные bindings каждой ветви. Если base ещё не идентифицирована — pending relation, не принятая связь | Не превращается в A→B или family merge; каждую ветвь проверять отдельно |
| `compounding` | N components → compound/result; сохраняются head/modifier/connector roles | directed; unknown если анализ не установлен | `recipe` с component slots/positions/boundaries, result slot, `component_role`, exact segmentation. Полный recipe требует всех lexical components; partial component claim помечается `analysis_scope=component_only`, не выдаётся за полный состав | Членство только по доказанному компоненту; другие компоненты и весь compound не объявляются той же лексемой |
| `inflection` | Lexeme/sense → Form value object той же лексемы | directed lexeme→form | `features`, paradigm slot при наличии, evidence формы и принадлежности той же lexeme. Омонимичная форма не подтверждает sense другого lexeme | Не новая derivational model/family; использовать только finite listed forms |
| `allomorphy` | Две scoped реализации одной головы/морфемы | undirected | `owner_head_ref` или reviewed family realization scope, язык, environment, тип реализации, формальная/лексическая непрерывность | Применимо только в перечисленном языке/head scope; не глобальная замена строки |
| `orthographic_variant` | Две формы одной lexical identity, различающиеся письмом | undirected | `identity_alignment_ref`, language/script/orthographic convention, допустимые формы. Историческое изменение может быть отдельной etymological relation | Lookup equivalence после identity review; не равен allomorphy/borrowing |
| `borrowing` | Donor lexeme/sense → recipient lexeme/sense | directed; unknown только pending | `donor_language`, `recipient_language`, historical scope, semantic continuity, допустимое national realization. Обычно языки различны; dialect/intralanguage case требует explicit subtype | Межъязыковой переход отдельно проверяется; сходный перевод не borrowing proof |
| `etymological_relation` | Historical/ancestral/cognate связь lexeme/sense | directed для ancestry, undirected для cognacy, unknown при неясном процессе | `subtype:ancestry\|cognacy\|historical_connection`, chronology если известна, scope и uncertainty. Distant ancestor не подменяет текущую recognizable base | Контекст/кандидат; сам по себе не достаточен для family membership |
| `surface_similarity` | Измеренное формальное сходство двух форм/написаний | undirected для зарегистрированных симметричных metrics | `metric_ref`, normalized inputs, normalization policy, score/range, grapheme basis. Асимметричный metric требует отдельного subtype/extension с явной direction semantics | Только retrieval. Даже accepted численный результат не подтверждает lexical identity или family |

`base_realization/output_realization` могут описывать исходные segment/exponent strings без привязки к V Allomorph, если они ещё не проверены. Null границы/семантика явно сохраняются; они не получают автоматически «полный» статус.

Accepted direct/indirect/borrowing/shared-base linguistic relation требует совместимых установленных sense scopes или доказанного общего компонента всех конкурирующих analyses. Непроверенная леммная пара может храниться с unresolved scope, но не становится разрешающим proof. Accepted inflection/allomorphy/orthographic_variant требует identity, а accepted surface_similarity подтверждает лишь вычисление. Решения разных доменов не копируются друг в друга.

## 3. Дополнительные типы и незавершённая классификация

Registry типов входит в mapping-policy snapshot. Новый type ID: `ext:<namespace>:<name>@<major>`. Запись registry обязана задавать endpoint kinds, arity, semantic roles, direction constraints, обязательные параметры, validator version, symmetry/canonicalization rule и `membership_use:never|finite_review_only`.

Первый необходимый extension: `ext:core:morphological_relatedness@1` — источниковая морфологически связанная пара без установленного точного процесса/base/direction. Допустимы два lexeme/sense endpoints, direction=unknown, membership_use=never. Это карантин классификации, а не новый способ автоматического принятия.

Неизвестный native relation label → этот нейтральный тип либо quarantine с исходной строкой; не маппить всё в derivation_direct. Незарегистрированный extension может храниться как raw claim, но не участвует в typed path queries/projection. Смена правил interpretation создаёт новые Evidence/Relations, не переклассифицирует старые записи на месте.

## 4. Разные типы одной пары не схлопываются

Relation semantic key включает type, participants с POS/sense/roles, direction и параметры процесса. Поэтому возможны одновременно:

- Формально похожие формы и подтверждённая direct derivation: два Relations.
- Современная orthographic variant и отдельная historical borrowing гипотеза: два Relations с разным смыслом.
- A и B происходят от общей C: shared_base(A,B,C), derivation(C,A), derivation(C,B) не тождественны.
- Альтернативные compound analyses одного spelling: разные segmentation/roles/analysis IDs; одна не уничтожает другую.

Evidence об одинаковой пропозиции может ссылаться на общий Relation; отдельные source occurrences и lineage при этом сохраняются. Выравнивание разных source lexeme identities к общей голове — отдельное reviewed CorpusAlignment, не автоматический merge Relation по строкам.

## 5. Source-specific mapping

| Источник | Первичное сохранение | Ограничение нормализации |
|---|---|---|
| UDer | Native lexeme IDs/POS и graph edges/type; выбранный subresource/release | Не выводить type/направление только из tree parent: проверять schema конкретного подресурса. Root tree не равен Family Интераля |
| GLeMM | Оба lexeme/POS endpoints, stem/exponents, definitions, native pair encoding | Bidirectional/symmetrized rows — одно исходное парное наблюдение; их зеркальные occurrences можно связать duplicate_group. По умолчанию precise derivational direction неизвестна; stem — formal descriptor, не canonical head |
| MorphyNet | Деривационные и флексионные records отдельно, native POS/morpheme/type | Native source→target — утверждение источника; принятие lexical/sense/process требует проверки. Compounding не превращать в equivalence двух лексем |
| Flexor | Registration placeholder со статусом unidentified | Ни format, ни direction/type mapping не назначаются до canonical artifact/schema |

Первичные источники: [UDer, ÚFAL](https://ufal.mff.cuni.cz/universal-derivations), [GLeMM, §§4.4 и 6.2](https://arxiv.org/html/2604.12442v1), [MorphyNet README](https://github.com/kbatsuren/MorphyNet/blob/main/README.md). GLeMM использует MorphyNet и симметризует соответствующие пары; из этого не следует независимая reverse derivation. Правило действует независимо от того, повторяется ли строка в конкретном release один или два раза.

## 6. Paths и запреты вывода

| Комбинация | Что можно получить | Что запрещено |
|---|---|---|
| A→B derivation, B→C derivation | Предложить indirect relation и dossier с двумя exact edges | Автоматически membership(C,F) из membership(A,F) |
| A shared_base B | Проверить обе ветви к base отдельно | Изобрести направление A→B |
| Source pair A↔B | Сохранить encoding, duplicates/lineage | Создать два accepted derivation_direct |
| A borrowed B, B derived C | Предложить межъязыковой finite path с отдельными national/semantic checks | Перенести все B/C descendants без доказательств |
| A similar B, B etymologically_related C | Retrieval hypotheses | Membership, lexical equivalence или автоматический family merge |
| Component H внутри compound C | Проверить точную H-сегментацию C | Приписать C все смыслы/частоты самостоятельного H или объединить остальные components |

Path хранит ordered refs на каждый шаг/ревизию и все языковые переходы. Цикл graph relationships допустим как предмет исследования (например, источники спорят), но proof/dossier с циклическим обоснованием запрещён. Неизвестное направление, пропущенное intermediate звено или semantic shift создают blockers; обход их альтернативным alias/fallback не разрешается.

## 7. Минимальные контрпримеры будущей проверки

1. Одинаковые endpoints с direct/inflection/surface_similarity создают три разных keys.
2. Зеркальные source rows GLeMM не порождают reverse accepted derivation.
3. Unknown direction и undirected symmetry имеют разные keys и различные разрешённые queries.
4. Изменение source POS/sense/compound role не теряется при dedup.
5. Наличие path через общую дальнюю этимологию не materializes membership.
6. Accepted similarity или accepted inflection не устанавливают head-family edge.
7. Внешний suffix/exponent не становится V canonical_reflex без scoped identity/boundary решения.

Эти условия — будущие спецификационные tests; функциональные tests/код в данном этапе не добавлены.

# Валидация отношений

Relation — отдельная пропозиция, Evidence — исходное утверждение, Verdict — scoped решение. Accepted relation не становится accepted lexical identity или membership. В реальной пробе внешние reviewed decisions не создавались.

| Классификация | Условие и границы |
|---|---|
| Подтверждаемая прямая деривация | Directed source relation + Evidence + доверенный relation review с exact sense scope участников. До review: proposed derivation_direct, insufficient_evidence |
| Подтверждаемая косвенная деривация | Полная конечная ordered chain принятых direct segments; совпадают endpoints и все intermediates, нет циклов. Не транзитивная семья |
| Общая основа | Отдельный shared_base; явный reviewed base_ref. GLeMM stem его не заполняет |
| Словосложение | Отдельный compounding с component slots; для принятия требуется reviewed recipe. Compound не отождествляется с компонентом |
| Словоизменение | Lexeme → Form, grammatical features, segmentation. Не derivational модель и не lexical bridge |
| Орфографическое соответствие | Отдельный variant claim; native source arrow сохранена отдельно от undirected proposal. Не автоматический identity bridge |
| Только формальное сходство | surface_similarity, retrieval_only. Не доказательство основы/значения |
| Недостаточно доказательств | Unknown POS/senses/identity, neutral relatedness, неполный source analysis, competing review hold |
| Противоречие существующему решению | Proposal пересекается с действующим запрещённым семейным вопросом; exact blockers сохранены. Не автоматическое опровержение базы |

Каждый classify result содержит label, proposed_category, validation_status, explanation, exact Relation/Evidence refs, Verdict Ref при наличии, uncertainties, family guard и establishes_membership=false. В реальной пробе direct assertions не выданы за подтверждённые отношения.

## Структура и identity

Проверяются зарегистрированный type, arity, уникальные participant slots, direction slots, exact refs/hashes, form owner и immutable predecessor. Unknown extension не участвует в typed graph. Lexeme revision не меняет язык/лемму/POS/native key под прежним ID; semantic Relation identity включает type, participants, direction, parameters и analysis scope.

NFC/casefold используется только для поиска; диакритика и кириллица сохраняются, транслитерация не выполняется. Одинаковая строка в двух source-local узлах не соединяет цепи. У MorphyNet/GLeMM без entry IDs запись/роль остаётся консервативной unresolved identity. Поэтому некоторые потенциальные цепи намеренно остаются разорванными до identity review.

POS сравнивается как compatible/conflict/unknown; unknown не считается совместимостью. Реальные v6 heads/links этой версии не имеют POS: все comparisons unknown. GLeMM definitions сохраняются, но без надёжного sense discriminator универсальный Sense не создаётся. Совпадение gloss не доказывает тождество.

UDer native parent, ordered Sources и OTHERRELS не теряются. Conversion хранится как direct source claim с исходным process; нулевая морфема автоматически не доказывается. Неразрешённые endpoints остаются в original observations. GLeMM пары не становятся direct derivation по порядку столбцов, а шаблон stem — canonical head. Возможная dataset-level зависимость от MorphyNet сохранена; совпадения не считаются независимыми голосами.

## Конечные пути

Simple-path BFS сохраняет каждый intermediate Ref, тип/направление ребра, source revision/locator/lineage, uncertainty и confirmed flag. Обязательны depth/path/expansion budgets; truncation записан. Обычное транзитивное замыкание не используется как membership proof.

Unknown/undirected relatedness не проходит derivational search по умолчанию. Явное включение сохраняет unknown и hypothesis_only. Inflection, orthographic variants, similarity и historical context не используются мостами. Compound шаг — component scope. Семьи не объединяются по общей омонимичной форме.

Review API требует правильный subject domain, basis/dependency refs, trusted grant и exact sense identities всех lexical участников. Indirect review дополнительно проверяет каждую принятую direct relation и точную ordered chain. Неполная chain или unreviewed segment отвергаются. Конкурирующие reviews удерживаются без latest-wins. Это ограниченный read-only прототип; полный будущий workflow авторизации/adjudication и применение к membership здесь не реализованы.

Положительные reviewed controls в unit tests явно искусственные, а не утверждения о реальных словах. Внешние корпусные записи ими не подменяются.

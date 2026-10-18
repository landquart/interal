# Свидетельства, происхождение, решения и membership

Спецификация `external-morphology/1.0-draft`, **DESIGN_ONLY**. Структуры определены в [ENTITY-SCHEMA.md](ENTITY-SCHEMA.md), relation semantics — в [RELATION-TAXONOMY.md](RELATION-TAXONOMY.md). Этот документ задаёт resolver/application contract для будущей реализации; не выполняет разметку.

## 1. Три независимых статуса

| Домен | Что именно принято/отклонено | Чего решение не означает |
|---|---|---|
| `evidence` | Верность атрибуции/extraction конкретной записи в заданном scope | Accepted extraction не означает правильную этимологию/деривацию |
| `relation` | Лингвистическая или формальная пропозиция данного типа/направления/senses | Accepted relation не подтверждает head-family edge |
| `membership` | Разрешённость exact corpus/head/component/family вопроса | Не принимает другие значения, не меняет frequencies и не разрешает descendants |

Дополнительные домены Verdict: `lexical_identity`, `allomorph`, `family_boundary`. Они нужны для формальной процедуры, а не заменяют три основных.

Operational поле `ingestion_status ∈ valid/quarantined/unavailable` — только производная диагностика manifest. Оно не Verdict: broken JSON/hash mismatch не превращается в linguistic rejection. Source disappearance не доказывает ложность отношения.

У исходного Evidence обязательно есть source revision, raw locator/hash, related lexemes, interpretation, extraction/mapping policy, lineage, initial_status=needs_review и rationale исходного claim. Reviewed статус/rationale берётся из scoped Verdict. При отсутствии Verdict view возвращает needs_review с reason `no_reviewed_verdict`; не изобретает проверяющего или отрицательную оценку.

## 2. Семантика пяти состояний

| Статус Verdict | Значение | Новый membership |
|---|---|---|
| `accepted` | Точный subject подтверждён в перечисленном scope и на pinned зависимостях | Только для отдельного membership Verdict при выполнении всей процедуры |
| `rejected` | Есть проверенное основание отвергнуть точный claim/связь/членство | Нет; не расширять rejection на другие senses/семьи без scope |
| `needs_review` | Решение ещё не принято либо требуется актуальная adjudication | Нет |
| `split_required` | Вход объединяет несовместимые identities/значения/компоненты; нужен доказанный partition/common-component scope | Нет для смешанного вопроса; доказанную отдельную часть рассматривать отдельным dossier |
| `insufficient_data` | Проверка выполнена, но данных недостаточно для принятия или отклонения | Нет; это не отрицательное доказательство |

Если metadata источника говорит rejected, это **source claim**, а не manual_verified Verdict Интераля. Автоматический classifier может предложить любой label в `proposed_analysis`, но его effective authority остаётся automatic_hypothesis; оно не выпускает accepted reviewed projection.

## 3. Source lineage

Минимальный value object `Evidence.body.source_lineage`:

```text
origin: {source_revision_ref, raw_locator_key}
parents: [{parent_kind, ref, dependency, mapping_precision, justification_ref}]
completeness: exact | partial | unknown
independence_attestation_ref: optional
```

`parent_kind ∈ evidence/raw_record/source_revision`; `dependency ∈ copied/derived/symmetrized/reextracted/possible_shared_origin`; `mapping_precision ∈ exact_record/dataset_level/unknown`. Parents указывают на реальные pinned записи или зарегистрированные source revisions. Отсутствующий parent сохраняется как unresolved lineage reference в quarantine/review frame, не заменяется придуманным exact mapping.

Lineage — ациклический граф происхождения. Он не смешивается с лингвистическим графом Relation, где могут быть противоречия/циклы. Self-parent/cycle/изменённый parent hash запрещает publish normalized snapshot как проверенный; raw bytes и причина сохраняются.

### GLeMM ↔ MorphyNet

[Статья GLeMM, §4.4](https://arxiv.org/html/2604.12442v1) прямо описывает использование MorphyNet и симметризацию его пар. Поэтому:

1. Если конкретная GLeMM запись связана с конкретной MorphyNet записью, lineage отмечает exact_record parent и transformation. Это один исходный факт с несколькими occurrences.
2. Если известна зависимость datasets, но source не даёт row-level parent, сохраняется dataset_level/partial. Нельзя объявить каждую GLeMM пару точной копией; нельзя и считать её независимой.
3. Общий Wiktionary/Kaikki upstream учитывается аналогично: одна и та же upstream dictionary assertion не получает дополнительный голос от смены упаковки.
4. Mirrored pair и повторная extraction другой версией алгоритма не создают новый независимый факт.

Не используется формула «два источника совпали → accepted». Resolver сообщает отдельно `occurrence_count`, `distinct_source_revisions`, `proven_origin_groups` и `independence_status ∈ correlated/possibly_correlated/independently_attested/unknown`.

`proven_origin_groups` — только группы с разрешёнными roots по проверенным parent refs. Неизвестные roots остаются unknown, а не по одному независимому root на каждый source name. Disjoint roots позволяют назвать свидетельства независимо аттестованными только при completeness=exact и отдельном review независимости процесса/сбора данных; отсутствие найденного общего предка этого не доказывает. Эти показатели не входят в A/P/F и не дают автоматический порог принятия.

## 4. Приоритеты и conflicts

Порядок применяется **внутри одного decision domain и пересекающегося scope**:

| Приоритет | Решения | Условия |
|---|---|---|
| 1 | Проверенный ручной запрет | active manual_verified rejected, trusted actor/grant, scope overlap; отзыв только отдельным уполномоченным reviewed решением |
| 2 | Проверенное ручное разрешение | active manual_verified accepted, без запрета priority 1; prerequisites не отменяются |
| 3 | Ранее подтверждённое решение | prior_confirmed с exact baseline/version/proof; не распространяется на новую row/sense/head |
| 4 | Новые проверенные свидетельства | reviewed_evidence Verdict с полноценным review method; может инициировать membership dossier, но не заменить отдельный membership Verdict |
| 5 | Автоматические гипотезы | Только proposals/очередь, не право materialization |

**Алгоритм effective decision:**

1. Выбрать pinned snapshot; проверить signatures/grants/authority registry и hash dependencies. Source boolean `manual=true` не даёт manual_verified.
2. Разрешить только explicit supersession/revocation chains. Старое решение не исчезает из-за нового timestamp, релиза данных или более высокого native confidence.
3. Найти все решения по тому же semantic вопросу и пересекающемуся scope. Проверять language/corpus/family/sense/component и locked alignment identities; поиск не ограничивается equality нового proposed_head ID.
4. Любой применимый active manual_verified запрет блокирует новое принятие. Concurrent ручное разрешение не перевешивает его. Возможная, но не установленная identity overlap создаёт needs_review/hold, не позволяет обойти запрет новым source ID.
5. Для остальных активных decisions выбрать наивысший применимый priority. Совместимые duplicate reviews не увеличивают силу/частоту. Несовместимые решения одного priority требуют adjudication: split_required при смешанной identity, иначе needs_review; latest-wins запрещён.
6. Проверить prerequisites независимо от priority. Ручное разрешение не заменяет отсутствующий source identity, boundary proof или finite grant. Stale зависимости дают shadow hold/needs_review; не являются автоматической правкой исторического production snapshot.
7. Записать derived result с использованными/блокирующими Verdict refs, причиной, policy hash и dependency lock. Это view, не самопроизвольный новый reviewed Verdict.

Scope-specific manual exclusion evidence не запрещает все другие evidence той же пары. Rejection relation не становится глобальным запретом Family; membership prohibition применяется к membership вопросу. Но запрещённый proof исключается из prerequisites, и dossier, который без него неполон, не может пройти.

Если priority 3 сохраняет старое acceptance, а новое lower-priority evidence его оспаривает, baseline не меняется: создаётся conflict review task. Для нового расширения требуется свежий reviewed dossier; отсутствие решения по новому scope не наследует старое разрешение.

## 5. Совместимость старых статусов

| Existing M/V | NEW interpretation | Экспорт обратно |
|---|---|---|
| V `accepted` | accepted только точного прежнего edge/proof | Сохранить exact existing scope; новые IDs не добавлять |
| V `excluded` | rejected соответствующего вопроса | NEW rejected→V excluded только с verified translation/grant |
| V `uncertain` | Обычно insufficient_data; при ещё не выполненном review — needs_review, причина обязательна | NEW insufficient_data/split_required→V uncertain с typed reason sidecar |
| V `pending`, historical pending_review | needs_review | V pending |
| M `split_required` | split_required | Не превращать в accepted family, negative lookup сохраняет блокировку |
| M `rejected`/blocked_from_runtime | Exact exclusion либо operational quarantine по сохранённой причине | Не повышать operational blocker до лингвистического rejected без review |

Imported historical mapping сама проходит review: невозможно восстановить rationale/authority только по строковому label. NEW split_required и insufficient_data не теряются в V enum: sidecar сохраняет точное состояние, generator получает только безопасный nonaccepted статус. Этот контракт проектируется, не применяется к действующему индексу.

## 6. Формальная процедура нового membership

Пусть `q` — MembershipQuestion из ENTITY-SCHEMA, `S` — pinned source/catalog/review snapshot. Для нового членства определены предикаты:

| Предикат | Что проверяется |
|---|---|
| `SourceOK(q,S)` | Исходные records существуют, bytes/hash/версии/license availability проверены; trusted proof refs доступны |
| `AlignOK(q,S)` | Exact corpus identity, язык/word/record hash, связь с source Lexeme; роль whole_lexeme/inflection/component установлена |
| `SenseOK(q,S)` | Все известные конфликтующие analyses pinned frame разобраны; exact sense или доказанный общий компонент. unresolved omnibus row → false |
| `HeadOK(q,S)` | Проверена lexical head identity и язык/sense; legacy_exact_record не используется для нового propagation |
| `BoundaryOK(q,S)` | Exact formal continuity/сегментация, полный компонент; не случайная подстрока или gloss |
| `AllomorphOK(q,S)` | Canonical realization либо допустимый typed allomorph в этом language/head/environment/finite scope; historical/query alias недостаточен |
| `RouteOK(q,S)` | Подтверждён тип и, где требуется, направление каждого используемого отношения, все intermediate звенья, отдельные межъязыковые переходы. При прямом reviewed identity proof route имеет нулевую длину и эту причину; выдумывать derivation не требуется |
| `NoVeto(q,S)` | Нет active intersecting manual запрета; resolver §4 не выдал effective rejected/conflict/hold по остальным applicable решениям; negative index доступен |
| `EdgeOK(q,S)` | Самостоятельный accepted reviewed head→family edge и canonical family boundary в точном scope |
| `GrantOK(q,S)` | Отдельный accepted membership Verdict, exact affected corpus IDs, source/grant locks и non-stale predecessors |

Нормативное условие:

`NewMembership(q,S) ⇔ SourceOK ∧ AlignOK ∧ SenseOK ∧ HeadOK ∧ BoundaryOK ∧ AllomorphOK ∧ RouteOK ∧ NoVeto ∧ EdgeOK ∧ GrantOK`.

Это проверка конечного dossier, а не классификатор, вычисляющий linguistic truth по числу рёбер. Несколько evidence могут поддерживать один предикат; никакой multiplicity не обходит отсутствующий предикат.

Процедура применения (в будущем, отдельным этапом):

1. Зафиксировать q/S, исходные corpus rows, competing analyses, exact alignment и candidate path; выполнить отрицательный lookup **до** дорогостоящего review. Недоступность authoritative verdict index → hold, не fallback acceptance.
2. Проверить значения и identity независимо от Family. При несовместимых омонимах — split_required; не делить IPM между ними. Допускается finite common-component scope по политике V `decideLexicalRow`.
3. Проверить boundaries и scoped allomorph, роли inflection/component, реальный язык. Lookup normalization не равна национальному formal continuity.
4. Для route перечислить каждый шаг с exact Relation/Verdict refs. Каждый borrowing/исторический переход требует собственной проверки смысла и допустимой формы. Unknown direction/неизвестный intermediate → insufficient_data либо needs_review по причине.
5. Отдельно принять head-family edge и exact membership вопрос, записать rationale/negative checks/finite scope/dependency lock. Если нужный head уже существует — использовать его версию; не создавать дубликат.
6. Выпустить finite dossier под existing V full loaders/grants, а не прямо передать NEW Relation в generator. Сначала projection_shadow, независимый oracle/diff и проверка protected trees.
7. Внутри eventual authorized application повторно проверить все locks/NoVeto перед atomic publication; TOCTOU любого входа отклоняет batch целиком. Публикация production отдельно от сохранения reviewed dossiers.

`Reachable(lexeme,family)` или `same_connected_component` **никогда не используются** вместо этих предикатов. Даже fully accepted directed derivation path разрешает лишь подготовить finite q; каждый затронутый corpus ID должен быть перечислен. Unknown sense/внешний кандидат не получают Membership objects.

### Сохранение существующих принятых записей

Для baseline существует отдельное правило `CarryForwardExact(m,S_baseline)`: совпадают key/object/source hashes, scope не расширен, исторический proof сохранён. Оно не выводит новый Sense/Head/Relation и не допускает новые corpus IDs. Shadow-противоречие создаёт review task; старые families/production bytes не меняются автоматически. Поэтому более строгие требования нового proof не удаляют ретроспективно старый словарь.

## 7. OCUL — гипотетический положительный finite пример

**Все данные разделов 7–9 синтетические.** `ex:*` — зарезервированные fixture IDs, не реальные записи UDer/GLeMM/MorphyNet/Flexor и не реальные решения Интераля. В production imports/dossiers такие IDs запрещены. JSON ниже — body-views: общие envelope/hash/source records по ENTITY-SCHEMA опущены для читаемости; это не готовые файлы application.

```json
{
  "example_only": true,
  "family": "ex:family:OCUL",
  "lexeme": {"id":"ex:lexeme:ocular","language":"en","lemma":"ocular","pos":"ADJ"},
  "sense": {"id":"ex:sense:ocular-vision","lexeme_id":"ex:lexeme:ocular","definition":"synthetic vision-related scope"},
  "head": {"existing_ref":"ex:head:ocular","sense":"ex:sense:ocular-vision","identity_kind":"lexical_head"},
  "alignment": {
    "id":"ex:alignment:ocular",
    "corpus_lemma_id":"ex:corpus:en-ocular",
    "link_role":"reviewed_lexical_base_component",
    "segmentation":{"before":"","component":"ocul","after":"ar","boundary_evidence_ref":"ex:evidence:ocul-boundary"}
  },
  "allomorph_view": {"form":"ocul","language":"en","head_scope":["ex:head:ocular"],"establishes_membership":false},
  "membership_verdict": {"id":"ex:verdict:ocul","domain":"membership","status":"accepted","authority":"manual_verified","rationale":"All ten finite predicates satisfied in the synthetic dossier"},
  "membership_projection": {"language":"en","family_id":"ex:family:OCUL","lemma_id":"ex:corpus:en-ocular","head_id":"ex:head:ocular","accepted_verdict_ref":"ex:verdict:ocul"}
}
```

В fixture заранее даны отдельные accepted identity/boundary/allomorph/head-family decisions, exact source/negative-index locks и finite grant; они являются предпосылками примера, не следуют из JSON spelling. RouteOK использует прямой reviewed component identity, без выдуманного derivation path. Добавление второй строки «ocular» без этих refs не создаёт второго membership. Гипотетическая немецкая форма `okul` потребовала бы отдельного DE scope; этот EN dossier её не разрешает.

## 8. REGUL — зависимые источники и неопределённость

Синтетический pair `regolare/regolazione` используется только для демонстрации формата; linguistic derivation/смысл не объявлены проверенными реальными ресурсами.

```json
{
  "example_only": true,
  "relation": {
    "id":"ex:relation:regul-pair",
    "type_id":"ext:core:morphological_relatedness@1",
    "participants":["ex:lexeme:regolare","ex:lexeme:regolazione"],
    "direction":{"state":"unknown","from_slots":[],"to_slots":[]},
    "proposition_only":true
  },
  "evidence": [
    {"id":"ex:evidence:mn-shaped","source_revision":"ex:source-revision:mn-shaped","interpretation":"ex:relation:regul-pair","initial_status":"needs_review","rationale":"Synthetic source pair; no accepted head-family edge"},
    {"id":"ex:evidence:gl-shaped","source_revision":"ex:source-revision:gl-shaped","interpretation":"ex:relation:regul-pair","initial_status":"needs_review","source_encoding":"bidirectional_pair","source_lineage":{"parents":[{"ref":"ex:evidence:mn-shaped","dependency":"symmetrized","mapping_precision":"exact_record"}],"completeness":"exact"},"rationale":"Synthetic derived occurrence of the same assertion"}
  ],
  "lineage_view":{"occurrence_count":2,"proven_origin_groups":1,"independence_status":"correlated"},
  "membership_question":{"family_id":"ex:family:REGUL","language":"it","corpus_lemma_id":"ex:corpus:regolazione"},
  "membership_verdict":{"domain":"membership","status":"insufficient_data","reason_codes":["unreviewed_lexical_identity","unproved_national_realization"],"rationale":"External pair is insufficient for finite REGUL membership"},
  "memberships":[]
}
```

Даже если extraction двух evidence будет принята, process/direction могут остаться needs_review, а membership — insufficient_data. Нельзя превратить source_encoding в две derivation_direct стрелки или объявить regul→regol универсальной заменой.

Другой **гипотетический** REGUL question объединяет две несовместимые sense analyses одного corpus spelling. Его статус — split_required, пока не доказан partition/common component. После появления manual_verified запрета на точный corpus/family scope будущий внешний accepted relation не меняет membership rejected; требуется explicit authorized revocation. Ни один из этих примеров не изменяет текущие реальные regul annotations.

## 9. INTER — формальное совпадение и ручной запрет

```json
{
  "example_only": true,
  "family":"ex:family:INTER",
  "lexeme":{"id":"ex:lexeme:winter","language":"en","lemma":"winter","pos":"N"},
  "relation":{"id":"ex:relation:winter-inter-form","type_id":"surface_similarity","participants":["ex:form:winter","ex:form:inter-query"],"direction":{"state":"undirected","from_slots":[],"to_slots":[]},"proposition_only":true},
  "relation_verdict":{"domain":"relation","status":"accepted","rationale":"Synthetic check confirms only the shared character sequence; metric/input refs are fixed in the fixture"},
  "membership_verdict":{"domain":"membership","status":"rejected","authority":"manual_verified","reason_codes":["unproved_lexical_boundary","explicit_finite_exclusion"],"rationale":"Synthetic reviewed exclusion of this exact INTER question"},
  "memberships":[]
}
```

Здесь accepted относится лишь к формальному факту, а не к словообразованию. Поиск может вернуть вопрос и объяснение запрета, но transport failure не позволяет снять prohibition. Иная новая строка с `inter` и недостаточными доказательствами получает needs_review/insufficient_data, а не rejected только за отсутствие в словаре. Exclusion winter не распространяется на все слова с такой подстрокой без отдельного scope.

## 10. Независимая проверка

Future oracle должен строить expected membership set непосредственно по exact accepted verdict scopes, отрицательным решениям, trusted grants, alignment/boundary/path locks и source rows. Он не вызывает тот же materializer для expected результата. Проверять как минимум: veto > allow, unresolved overlap, stale source/lineage/catalog, reversed pair, missing intermediate, mixed senses, national allomorph scope, zero-frequency сохранность, отсутствие дублирующего F и exact legacy carry-forward.

Переиспользовать V `scripts/audit-associative-v6-independent.mjs`, но добавлять внешние assertions отдельно: существующий oracle не знает нового source registry автоматически. Полнота structural oracle не равна независимой лингвистической оценке; для массовых решений нужны отдельные held-out annotated frames с сохранённым uncertain.

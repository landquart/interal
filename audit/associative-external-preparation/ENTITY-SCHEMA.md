# Сущности и идентификаторы

Спецификация `external-morphology/1.0-draft`; **DESIGN_ONLY**. M/V и повторно проверенные функции определены в [02-DATA-ARCHITECTURE.md](02-DATA-ARCHITECTURE.md). Ниже новые структуры обозначены как **NEW**, существующие как **REUSE/VIEW**. Таблицы — технический контракт для последующей JSON Schema/DDL реализации, а не уже установленная runtime schema.

## 1. Общие правила сериализации и ссылок

### Новые версионированные записи

Обязательный envelope NEW: `schema_version`, `entity`, `id`, `revision` (целое ≥1), `content_sha256` (64 hex), `supersedes` (null для первой ревизии, иначе exact Ref предыдущей), `body`. `content_sha256 = sha256(JCS({entity,id,revision,supersedes,body}))`; schema_version и версия JCS/нормализации фиксируются manifest. Любое исправление body создаёт новую revision, прежние bytes остаются доступны. Цепь одного id линейна, concurrent successor запрещён publication CAS. Запись с устаревшим predecessor не перезаписывает текущую.

`Ref = {entity, id, revision, content_sha256}`. Для существующих V объектов вместо искусственной revision допускается `ExistingRef = {entity, id, snapshot_sha256, object_sha256, version?}`; version берётся из реального head/edge, если есть. Любой Ref в proof должен быть exact, а не `latest`. Для непроверенных обратных discovery-ссылок отдельно разрешён `IdentityRef={entity,id}`: он не содержит content hash, не является proof и разрешён только в явно названных полях ниже. JSON Pointer/locator — дополнительный адрес объекта, не его identity.

Одинаковые id/revision с разными content_sha256 — hard integrity conflict: обе raw occurrences удерживаются, ни одна не перезаписывает другую.

Receipt (`run_id`, observed_at, machine, elapsed) хранится отдельно и не входит в semantic identity/build_id. Отсутствующий optional key не равен null; null разрешён только там, где ниже прямо означает неизвестность. Денежные/частотные поля не вводятся в NEW лексические сущности.

Идентичностные строки — UTF-8/NFC; язык — registry code, сохраняется оригинальный source code. `buildSearchForm`, transliteration, removal of accents и lowercasing используются только для lookup. IDs не включают текущее имя файла или номер строки как единственный discriminator, если источник даёт стабильный native ID.

### Форматы новых IDs

`H(x)` ниже — полный SHA-256 JCS упорядоченного tuple x, не короткий hash. `source_id` — постоянный зарегистрированный namespace (например, `source:morphynet`), а не человекочитаемое имя версии.

| Объект | ID/key | Что не разрешено |
|---|---|---|
| SourceRevision | `source-revision:<H(source_id, artifact_hashes, release_identity)>` | Использовать только изменяемый URL/latest |
| Lexeme | `lexeme:<H(source_id, native_namespace, language, native_lexeme_key)>` | Склеивать разные sources по spelling; версия release не входит в ID при устойчивом native key |
| LexemeSense | `sense:<H(lexeme_id, native_sense_key)>` | Присваивать один sense всем омографам |
| Relation | `relation:<H(type_id, participants, direction, semantic_parameters)>` | Склеивать разные типы/direction/analyses или использовать только пару строк |
| Evidence | `evidence:<H(source_revision_id, raw_record_hash, raw_locator_key, claim_ordinal, extractor_policy_id)>` | Зависеть от времени запуска; считать новый extractor независимым источником |
| Verdict | `verdict:<H(authority_namespace, review_series_uuid, subject_key)>` | Автоимпорт не создаёт review_series и reviewed решения |
| CorpusAlignment | `alignment:<H(source_lexeme_ref, sense_scope, corpus_ref, proposed_head_ref, component_slot)>` | Дедуплицировать все варианты по normalized spelling |
| ReviewTask | `review-task:<H(subject_key, scope_key, question_type)>` | Новый run не должен создавать вторую ту же задачу |

Если источник не имеет стабильных lexeme/sense IDs, `native_key_policy` в SourceRevision задаёт детерминированный discriminator из source entry/POS/homonym section. При отсутствии доказуемой межрелизной идентичности ключ включает source revision и запись считается новой; continuity оформляется explicit alignment, а не угадывается по строке. Это сохраняет данные, не создавая фиктивной постоянной лексемы.

## 2. Lexeme — NEW

**Назначение:** отдельная источниковая лексическая единица. Несколько sources могут описывать одну реальную лексему, но их source identities сохраняются; проверенное совпадение представляется alignment к общей V голове, не string merge.

| Поля | Контракт |
|---|---|
| Обязательные body | `source_id`, `source_revision_ref`, `native_lexeme_key`, `native_key_policy`, `language`, `lemma`, `pos`, `identity_resolution`, `origin_evidence_refs` |
| Optional | `native_pos`, `homonym_key`, `script`, `orthographic_forms`, `sense_refs`, `dictionary_refs`, `lookup_keys`, `source_labels` |
| Допустимая неизвестность | `pos:null` только при `identity_resolution=unresolved`; не означает «любая POS». `identity_resolution ∈ {source_identified, unresolved}` не linguistic verdict |
| Связи | SourceRevision; 0..N LexemeSense; Relation participants; Evidence; CorpusAlignment; через reviewed alignment — существующий LexicalHead |
| Целостность | Язык/POS/entry discriminator не должны незаметно меняться под старым ID. Разделение/слияние источниковых entries создаёт новые IDs и явные supersession mappings. Пустая lemma запрещена; sense другого lexeme запрещён |
| Версии | Новые атрибуты/исправленный gloss → revision; изменение identity key/language → новый id. Новая source release не переписывает старые refs |

Source identity ещё не устанавливает linguistic identity. `origin_evidence_refs` и optional `sense_refs` у Lexeme — массивы **IdentityRef**, только discovery backlinks. Они не входят в proof как доказательство сами по себе. Raw source identity Lexeme проверяется через SourceRevision/native key; Evidence ссылается на уже хешированную Lexeme exact Ref. Это устраняет цикл content hashes Lexeme↔Evidence и Lexeme↔Sense. Самоописание лексемы и evidence её extraction не являются двумя подтверждениями.

## 3. LexemeSense — NEW

**Назначение:** семантическая область, необходимая для различения омонимии/полисемии, проверки relation и membership.

| Поля | Контракт |
|---|---|
| Обязательные body | `lexeme_ref`, `source_revision_ref`, `native_sense_key`, `definition`, `definition_language`, `resolution`, `origin_evidence_refs` |
| Optional | `usage_labels`, `domain`, `examples`, `etymology_section_key`, `external_sense_refs`, `translation_glosses` |
| Неизвестность | `definition:null` допускается только при `resolution=unresolved` и известном source sense discriminator. Если source вообще не делит значения — не создавать универсальный Sense, использовать `sense_scope.mode=unresolved` |
| Связи | Ровно один Lexeme по exact Ref; origin_evidence_refs — только IdentityRef discovery backlinks. Relation/Evidence, CorpusAlignment; explicit cross-source alignment не равен переводу |
| Целостность | Совпавшие gloss/translation не дают lexical identity. Sense range хранится списком exact refs, не «все будущие смыслы». Sense другого языка не подменяет semantic continuity |
| Версии | Исправление definition без изменения значения → revision; split/reinterpretation meaning → новые IDs + миграционное решение. Старые head sense strings не автоматически заменяются Sense IDs |

`SenseScope` — value object: `{mode: exact|common_component|unresolved, sense_refs: Ref[], analysis_refs: AnalysisRef[], coverage_reason}`. exact требует непустых sense_refs; common_component — непустых установленных analyses и отдельно проверенного общего компонента; unresolved не разрешает новое membership. Предикат «проверены все известные конкурирующие analyses» относится к pinned input frame, не ко всем возможным значениям языка.

## 4. LexicalHead — REUSE V

**Назначение:** reusable лексическая голова; не сокращённая подстрока и не автоматически найденный stem. Использовать V `family-index-v6/schema.json::$defs.head`, builder `headId`, `validateLexicalFacts/recognizeFiniteHeadBindings`.

| Поля | Контракт |
|---|---|
| Обязательные existing | `id`, `language`, `normalized_head`, `identity_kind`, `sense`, `version`, `evidence` |
| Optional existing/sidecar | `head_scope`, `finite_component_stems`; sidecar `lexeme_sense_alignments`, `external_evidence_refs`, `identity_verdict_ref` с exact ExistingRef головы |
| ID | Сохранить реальный `head:<language>:<existing digest>`; `head:legacy:*` сохраняется как legacy_exact_record. Не пересчитать IDs новым H и не придумывать head IDs при ingestion |
| Связи | Существующие finite lemma-head links, head-family edges, typed realizations; новые external alignments в sidecar |
| Целостность | Language/head/sense identity задаётся V; новые evidence не меняют sense старой головы. Legacy exact record не разрешает propagation. Конфликтующий meaning → новая review task/отдельная голова после решения |
| Версии | Существующие `version` и `replayHeadLifecycle` predecessor hashes. Новые source claims до решения не увеличивают V version |

Identity решения и head→family решения независимы: признание одной головы не даёт ей все семейные edges другой.

## 5. Allomorph — REUSE typed realizations + VIEW

**Назначение:** представление допустимой реализации конкретной головы/семьи, языка и morphological scope. V `schema.json::$defs.reflex`, `associative-family-v6.js::REALIZATION_TYPES/validateRealizations` остаются authority.

| Поля | Контракт |
|---|---|
| Обязательные view | `realization_ref` (ExistingRef/entry locator), `family_id`, `language`, `form`, `realization_type`, `head_scope`, `status`, `evidence_refs`, `establishes_membership:false` |
| Optional | `phonological_form`, `script`, `environment`, `component_boundary_refs`, `external_candidate_refs` |
| ID | View key `allomorph:<H(family_id,language,realization_type,NFC(form))>` + revision/hash конкретного existing entry. Это адрес view, не новая запись authoritative catalog |
| Связи | Existing Family/Head, scoped Evidence/Verdict. Внешнее предложение хранится Evidence+Relation и ReviewTask, а не accepted view |
| Целостность | canonical_reflex, lexical_branch_realization, derivational_stem могут участвовать только в своих scopes. inflectional_form — форма, а не общий алломорф; query_alias и historical_evidence_form не допускают runtime binding. Не обобщать итальянскую реализацию на EN/DE |
| Версии | Изменение head_scope/условий требует нового pinned catalog entry snapshot и reviewed решения; старый snapshot сохраняется. Existing status не преобразуется автоматически в новый Verdict |

Allomorph здесь — прикладной view над подходящими realization types, а не утверждение, что все шесть V типов лингвистически являются алломорфами.

## 6. Family — REUSE V catalog / M baseline

**Назначение:** ассоциативная семья Интераля с явным canonical решением. V `catalog.json::families`, `validateCatalog`; M v5 сохраняется отдельным baseline.

| Поля | Контракт |
|---|---|
| Обязательные existing V | `id`, `canonical`, `legacy_ids`, `canonical_decision`, `aliases`; связанные `reflexes` и finite policies сохраняются по текущему catalog |
| Optional sidecar | `external_review_task_refs`, `documentation_refs` по exact Family ExistingRef; не добавлять поля в действующий catalog этим этапом |
| ID | Existing `family:<canonical>` сохраняется. Canonical boundary/ID migration — только отдельное рассмотренное изменение, не stemming rule импортёра |
| Связи | Heads через независимые edges; typed realizations; Membership, Verdict; lookup aliases не equivalent families |
| Целостность | Два family IDs с совпадающим alias не объединяются. `ety:*` и `surface:*` не повышаются до Family автоматически |
| Версии | Git snapshot hash + object hash; canonical decision version при наличии. Новая порция Evidence не меняет family version |

## 7. Relation — NEW, не v6 head-family edge

**Назначение:** одна точная морфологическая/этимологическая/формальная пропозиция, независимая от источника её утверждения.

| Поля | Контракт |
|---|---|
| Обязательные body | `type_id`, `participants`, `direction`, `semantic_parameters`, `analysis_scope`, `proposition_only:true` |
| Optional | `refines_relation_refs`, `notes`; внутри semantic_parameters — `source_pattern_locators`, `asserted_path_refs`, `intermediate_refs`, `base_ref`, `unresolved_intermediate`, `language_transition` согласно taxonomy. Proof/source backwards indexes не хранятся в Relation |
| ID | H(type + semantic participants/roles/positions + direction + semantic parameters). Evidence refs/status не входят в identity; это отдельные inverted indexes |
| Связи | Typed participants, supporting/opposing Evidence, scoped Verdict. Не содержит family membership flag |
| Целостность | Направление/тип — по [taxonomy](RELATION-TAXONOMY.md). Отношения разных типов одной пары сохраняются отдельно; неизвестная стрелка не выводится из порядка columns. Нельзя `latest` refs |
| Версии | Смена типа, endpoints, direction или asserted intermediate path → **новый Relation id**, `refines_relation_refs` сохраняет связь. Revision старого id только для несемантических notes. Evidence additions не переписывают Relation |

`Endpoint = {slot, kind, ref}`; kind ∈ lexeme/sense/head/allomorph/form. Для form вместо ref: `{owner_lexeme_ref, text, grammatical_features, script, native_form_key}` — value object, не отдельный новый Lexeme. У каждой slot уникальное имя; role/position хранятся в participant. Для undirected и unknown бинарных pairs без различных semantic roles slots канонизируются по refs; direction.state остаётся различным. Сырой порядок сохраняется в Evidence. Head/allomorph endpoints требуют уже существующие exact refs, не изготовленные из external stem.

`analysis_scope = {level:whole_lexeme|component_only|formal_only, sense_scope:SenseScope, analysis_key}`; taxonomy shorthand component_only обозначает level, не заменяет весь object. analysis_key относится к source/mapping interpretation, не к номеру строки runtime.

`Direction = {state: directed|undirected|unknown, from_slots:[], to_slots:[]}`. directed требует непустых непересекающихся slot lists; undirected/unknown — пустых. Основания направления находятся в Evidence и Relation Verdict, **не** обратными exact Evidence refs в Relation: это исключает цикл хешей Evidence↔Relation. Unknown и undirected имеют разный смысл; правила подтверждения заданы taxonomy.

## 8. Evidence — NEW source assertions

**Назначение:** кто, в какой версии/записи и каким способом утверждает пропозицию. Не заменяет `evidence` существующих V heads/links; reviewed bridge переносит только проверенные ссылки.

| Поля | Контракт |
|---|---|
| Обязательные body | `source_revision_ref`, `raw_locator`, `raw_record_sha256`, `evidence_kind`, `related_lexeme_refs`, `interpretations`, `source_lineage`, `extraction`, `initial_status:needs_review`, `rationale` |
| Optional | `native_assertion_id`, `reextracts_evidence_refs`, `native_confidence`, `supporting_span`, `native_labels`, `human_annotation_ref`, `definition_refs`, `opposes_relation_refs` |
| interpretations | Непустой список `{relation_ref, proposed_analysis, stance:supports\|opposes\|context_only}`; mutually exclusive analyses остаются отдельными relation refs. Нет автоматического выбора победителя |
| proposed_analysis | Обязательный object с `kind`, `sense_scope`, `segmentation` (null если source не даёт границ), `mapping_policy_ref`, `limitations:[]`; null не дополняется выдуманными границами |
| evidence_kind | `source_assertion`, `formal_pattern`, `dictionary_history`, `manual_observation`, `algorithmic_hypothesis`; source label сохранён отдельно |
| Связи | SourceRevision, raw bytes, Lexeme/Sense, Relations, lineage parents, Verdicts через subject index |
| Целостность | RawLocator/hash проверяются отдельно от semantic truth; native confidence не переводится в reviewed status. related_lexeme_refs непусты для lexical pair records; head-only evidence допускает пустой список только с `lexeme_resolution:head_only` и точными head refs |
| Версии | ID exact extraction claim. Исправление interpretation/extractor policy → новый Evidence ID с `supersedes` на предыдущую extraction branch, связь `reextracted_from`; старое evidence не удаляется и не считается независимым |

`initial_status` неизменно needs_review у импортируемого Evidence; проверенный статус и rationale выдаёт отдельный Verdict. `rationale` в Evidence — объяснение исходного claim/mapping, не притворный результат проверки. `effective_status` разрешён только в производном view вместе с `effective_verdict_refs` и policy hash.

## 9. Verdict — NEW журнал; reuse V decisions через точные адаптеры

**Назначение:** решение в одном домене. Domain `evidence` не равен `relation`, а accepted relation не равен accepted membership.

| Поля | Контракт |
|---|---|
| Обязательные body | `subject`, `scope`, `status`, `authority`, `rationale`, `reason_codes`, `basis_refs`, `dependency_lock`, `policy_ref`, `reviewed_at`, `revokes_verdict_refs:[]` |
| Optional | `independent_review_refs`, `adjudication_ref`, `migration_note`, `validity_conditions`, `expiry_review_date` |
| subject | `{domain:evidence\|relation\|lexical_identity\|allomorph\|family_boundary\|membership, key, target_ref}`; membership target — конечный MembershipQuestion, не несуществующий положительный объект |
| status | Только `accepted`, `rejected`, `needs_review`, `split_required`, `insufficient_data` |
| authority | `{tier:manual_verified\|prior_confirmed\|reviewed_evidence\|automatic_hypothesis, actor_id, review_method, authorization_ref}`. manual_verified подтверждается trusted review/grant registry, не source boolean |
| scope | Exact language, sense_scope, head/component, family, corpus IDs/Relation refs по domain; пустые обязательные dimensions запрещены. Широкий prohibition может задавать перечисленный finite set; wildcard propagation запрещён |
| Связи | Subject, проверенные Evidence/Relations/identity/boundary decisions, prior Verdicts, exact grants |
| Целостность | reason/basis обязательны даже для rejection. Отзыв manual запрета отдельным уполномоченным reviewed решением; внешняя source release/import не может supersede/revoke его |
| Версии | Новая revision серии использует envelope.supersedes как единственный predecessor; adjudication другой серии ссылается через independent_review_refs/revokes_verdict_refs, не создаёт cross-ID envelope predecessor. Конкурирующие independent reviews — разные серии, не latest-wins. Dependency changes делают решение stale в shadow effective view, не переписывают историю/production |

Приоритеты и conflict resolver полностью определены в [EVIDENCE-AND-VERDICTS.md](EVIDENCE-AND-VERDICTS.md). Автоматическая hypothesis может описать need-review, но не приобрести manual_verified через metadata source.

## 10. Membership — REUSE finite V projection

**Назначение:** материализованное подтверждённое членство конкретной corpus row/компонента в Family. Новая внешняя Lexeme без CorpusAlignment не получает выдуманного corpus ID или frequency.

| Поля | Контракт |
|---|---|
| Обязательные existing V | `language`, `family_id`, `lemma_id`, `word`, `head_id`, `edge_version`, `source_proof` — output `generateV6Memberships` |
| Обязательные bridge sidecar для новых проекций | `membership_question`, `accepted_verdict_ref`, `alignment_refs`, `sense_scope`, `dependency_lock`, `projection_manifest_ref`, `frequency_status:aggregate_only_not_sense_frequency` |
| Optional sidecar | `path_refs`, `allomorph_refs`, `independent_validation_ref`; существующие bytes membership не расширяются в shadow |
| ID | **Существующий composite key** `{language, family_id, lemma_id}` внутри pinned snapshot; строковый новый Membership ID не вводится. Несколько proofs агрегируются в sidecar без дублирования строки |
| Связи | CorpusRecord, Head, Family, accepted head-family edge/finite link, отдельный membership Verdict, component/sense proofs |
| Целостность | Active projection содержит только confirmed rows; nonaccepted вопросы остаются Verdict+ReviewTask, не Membership. Один corpus ID может принадлежать нескольким семьям, но одна measurement row учитывается один раз по существующему расчётному контракту |
| Версии | Новый immutable projection snapshot/edge_version. Retraction/hold описываются новыми Verdict/manifest; старый snapshot остаётся доступен. В shadow запрещено менять original V/M membership bytes |

`MembershipQuestion = {language, family_id, corpus_lemma_id, proposed_head_ref, component_slot, sense_scope, source_snapshot_ref}`. Resolver и запреты проверяют пересечение семантического scope, а не только equality hash: смена proposed head/sense не обходит запрет на ту же corpus/family/компонентную область. Для текущего V binding export на одну language/family/lemma допускается одна разрешённая identity; альтернативы/несколько несовместимых component scopes удерживаются вне generator до решения.

## 11. Инфраструктура

| Структура | Обязательные поля/условия |
|---|---|
| SourceRevision | source_id, release_label (может `unversioned` при точном hash), canonical_url, artifacts[{sha256, bytes, codec, decoded_sha256}], native_key_policy, license_records[{expression_or_unknown, source_url, file_sha256, attribution}], lineage_declarations, availability_status, registration_status, acquisition_receipt_ref. Неустановленный Flexor имеет registration_status=unidentified и не допускает acquisition/import |
| RawLocator | artifact_sha256, native_record_key (или null), decoded_byte_start/end (half-open) либо deterministic record path, record_index, raw_record_sha256. Byte range относится к decoded UTF-8 stream, не gzip offsets; hash exact выбранных bytes, включая delimiters только если они входят в range |
| CorpusAlignment | Envelope NEW, source_lexeme_ref, sense_scope, corpus_ref {snapshot,language,lemma_id,record_sha256}, proposed_head_ref (может null до recognition), component_slot, link_role, segmentation (может null), evidence_refs, initial_status=needs_review. accepted alignment требует отдельного lexical_identity Verdict; source/word совпадение недостаточно |
| Segmentation | `before`, `component`, `after`, `head_ref`, `start/end`, `offset_unit:unicode_codepoint`, `text_sha256`, `normalization:NFC`, `boundary_evidence_refs`; before+component+after == exact word. Конверсия в existing V string slices обязана учитывать UTF-16 и иметь round-trip test |
| ReviewTask | subject/scope, question_type, trigger_refs, blockers, queue_state, priority_components, predecessor_task_ref?, input_manifest_ref. queue_state — workflow (`open/in_progress/closed/deferred`), не linguistic status |
| DependencyLock | sorted exact entity refs + raw/artifact hashes + source/lineage/policy/catalog snapshot hashes; includes negative-verdict index snapshot. Пропущенные обязательные input refs → stale/unpublishable |

Связи lineage описаны отдельно; это DAG происхождения, а не логический граф derivation. Additional source-specific fields допустимы только в namespaced `extensions`; неизвестные поля не дают прав application.

## 12. Ссылки на analyses и отсутствие хеш-циклов

`AnalysisRef={evidence_id, interpretation_index}` — value pointer на интерпретацию Evidence, не десятая доменная сущность. Он применяется только для перечисления competing analyses/SenseScope, не является самостоятельным proof. Перед решением DependencyLock обязан разрешить его в exact Evidence Ref и зафиксировать interpretation body/hash. Неизвестный/изменённый analysis pointer блокирует dossier.

Порядок хеширования: SourceRevision/raw → Lexeme → LexemeSense → Relation → Evidence → CorpusAlignment → Verdict → membership sidecar/manifest. Discovery IdentityRefs/AnalysisRefs могут ссылаться вперёд по ID; они не несут content-hash зависимости и не сертифицируют данные. Если proposed Relation сам требует ещё не разрешённый analysis, хранить это как unresolved annotation/value parameter, а не exact Ref на evidence, которое утверждает саму Relation. Proof/DAG validation запрещает циклическое обоснование и требует отдельно закрепить все discovery refs, использованные для решения.

## 13. Правила миграции

Existing IDs/versions/sense strings/aliases не переписываются. Новая модель хранит source Lexemes и explicit alignments рядом с M/V, пользуясь exact ExistingRef. Existing V `$defs.edge` остаётся head→family; NEW Relation никогда не сериализуется в него напрямую. Existing evidence arrays остаются прежними; bridge может ссылаться на NEW evidence только после reviewed translation в finite dossier. Legacy exact proofs сохраняют старые scopes; отсутствие sense annotations не заполняется ретроспективным фиктивным Sense.

# Промпт 03 — reuse, extension и correction

Блок выполнен в parallel v6. Production остаётся v5; merge не выполнялся. Цепочка main → #650 → #651 → #652 сохранена. Завершение этого блока не означает завершения словаря.

## Durable checkpoints

| Этап | Опубликованный SHA | Локальный проверенный checkpoint |
|---|---|---|
| Исходное завершение Prompt 02 | 6330df5c8d182f5418c18d5f87b454d4d36c3cfb | a1604e37e258d7dc7f73b34140285feedc286abd |
| Research | 41f5014396303708166f05fd100a5a0cc82dd794 | 8c86044 |
| Решение | 30d137750ffc841f8bd13e3b5dce3904da9fdecc | b4b22f3 |
| Применение | ed71acc2b5ce8e2f9aa41751339dfa43923aeb29 | e381cc8a20afa344de66a2b45795cd5e8b33a9f0 |
| Validation | отдельный commit этого отчёта, validator и proof artifacts | см. git log |

Shell push не имел credentials; публикация выполнена через подключённый GitHub API с fast-forward ref update. Для каждого опубликованного checkpoint SHA Git tree проверен на точное равенство локальному дереву; изменились commit metadata, не содержимое. Tests 37202185711 и v6 Audit 37202185705 исходного Prompt 02 завершились success. Research/decision workflows также success. CI применения и окончательного validation SHA проверяется отдельно; окончательная проверка точного опубликованного HEAD фиксируется в PR #652. Не использовать старые local SHA как отсутствующие remote commit URLs.

## Решения и реализация

Исследованы initial integrator, promotion loader/materializer, applyHeadReview, builder, registry, audit и reviewBenchmarks. Готового high-level extension/revision path не было. Initial duplicate guards сохранены. Добавлены `head-lifecycle.json`, отдельный source-bound dossier loader, atomic replay engine и CLI `integrate-associative-v6-head-lifecycle.mjs` с dry-run/apply.

Операции разделены: `extend_links`, `extend_forms`, `new_family_edge`, `revise_verdict`, `clarify_sense`. Extension promoted family выполняется после первоначальной promotion через lifecycle, без повторения initial promotion. Язык, normalized_head и sense сохраняются. Sense clarification добавляет evidence annotation; изменение identity sense требует отдельного migration adjudication и отклоняется reuse engine, включая выдуманный sense для обхода duplicate guard.

Каждый dossier содержит predecessor head/edge versions, полные адресуемые snapshots и SHA-256 head/edge/finite scope, exact real IDs, неизменные corpus records и locators, identity decisions, boundary proofs, permissions и отдельное новое finite edge решение. Старые proofs остаются в immutable inputs и predecessor history. Новый link никогда не наследует старый accepted verdict: private-copy transaction добавляет links и обязана выполнить свежий review полного finite списка перед генерацией memberships.

Один head поддерживает независимые accepted/excluded/uncertain edges к разным existing families. Correction accepted → excluded/uncertain удаляет только memberships соответствующего finite edge; source links, lemma IDs и прочие family relations сохраняются. Synthetic tests демонстрируют эти операции отдельно от реального corpus. Registry, builder и audit воспроизводят explicit версионную последовательность; stale, duplicate, conflicting, unknown predecessor, identity mutation и неподтверждённый scope отвергаются. Повторное реальное CLI применение также проверено и отвергнуто.

## Реальное применение и exact differential

Существующий доказанный German system / structured_assembly_or_scheme_noun переиспользован без новой identity. Дополнительный corpus ID найден exact-form scan всех immutable member shards; в прежнем выбранном etymological route его не было. Duden независимо подтверждает plural Systeme и происхождение System. Полная основа system сохранена: system + e, без universal suffix rule.

Новый ID: **lemma:e0e390279d7daf67fbc3**, word **systeme**, source `associativvordes/family-index-v5/members/de/f3.json.gz`, locator `surface:de:systeme`. Scope содержит ровно system, systems, systeme. Новый family-edge review явно принимает все три; head и edge переходят v1 → v2. Membership остаётся lexical row/proved component; token senses не установлены, frequency — aggregate-only.

| Показатель | До | После |
|---|---:|---:|
| Catalog families | 18 | 18 |
| Accepted memberships | 21 554 | 21 555 |
| Lexical heads | 216 | 216 |
| Legacy exact units | 18 857 | 18 857 |
| Family system memberships | 12 | 13 |
| Known active records | 23 240 | 23 240 |

Differential: **+1, −0**. У двух прежних German system memberships изменён только edge_version 1 → 2; word, IDs и source proofs идентичны. Остальные **21 552 предыдущих membership objects** идентичны. Все **21 950 прежних lemma–head links** идентичны, добавлен один. Все head identities сохранены; изменён один head version/evidence и один edge. Точные объекты и защищённые Git trees — в `prompt03-validation-20261004/exact-differential.json`.

## Метрики и проверки

Lifecycle stage: один extension/versioned review, new heads 0, new head–family edges 0, revisions 1, new finite links 1, review incidences 3, repeated corpus record reviews 2. Cumulative review universe, включая initial promotions: unique reviewed corpus IDs **1 981 → 1 982**, unique resolved corpus IDs **1 978 → 1 979**; current resolved head–family record states **1 980 → 1 981**. Один corpus ID может иметь разные independently reviewed relations: этот случай не увеличивает unique corpus count.

Known queues сохраняют прежние 1 965 reviewed relation records и 1 962 resolved relation records; после устранения смешения метрик явно показаны также **1 963 unique reviewed corpus IDs** и **1 960 unique resolved corpus IDs**. Это разные review universes, их нельзя складывать с corpus membership totals. Повторный review не увеличивает unique count; latest uncertain verdict вновь оставляет соответствующий queue record активным.

Проверки: **41 targeted tests**, **129 файлов полного npm test**, independent v6 audit pass (**2 493 locked inputs, 2 456 540 classified objects**), byte-identical deterministic replay **274 artifacts**. Synthetic fixtures проверяют обе correction цели, stale/conflict/duplicate/unknown predecessor, недоказанные identity/boundary/scope, независимые edges, отсутствие автоматической propagation, sense clarification и latest-state benchmarks. Реальные locator/hash и synthetic registry rejection проверены отдельно. V5, frequency lists и historical v5 audit Git trees идентичны исходному снимку; общий production runtime не изменён.

Dry-run и разрешённое применение имеют идентичный exact differential. Их proofs повторно проверены final engine после уточнения metadata/unique metrics; registry scope сохранён. Logs, code/input SHA-256, integrity, exact differential и replay hashes сохранены в `prompt03-validation-20261004/validation.json` и соседних artifacts. Independent validator использует **опубликованный** baseline 6330df5c, поэтому воспроизводим после нового clone.

## Evidence blockers и следующий этап

Другие запрошенные точные plural forms системных heads и English anises не найдены в materialized v5 shards; memberships для них не придуманы. Real positive second-family edge в этом блоке не утверждается: механизм доказан synthetic независимыми решениями, linguistic reuse требует нового реального dossier. Identity-changing sense migration остаётся отдельным adjudication, не фиктивным alias.

Turr/tower blockers Prompt 02 остаются: семь core rows withheld; anis имеет только шесть ранее доказанных memberships. Known active 23 240, historical unadjudicated 46 390 и 16 055 candidate packets не объявлены завершёнными. Следующий этап — применять reuse к конечным oper/relat dossiers при независимо доказанных новых real IDs, boundaries и family-edge decisions.

# Независимая готовность фундаментальной части v6

**Итог: FAIL. Независимая проверка Prompt 10 завершена; фундамент нельзя закрыть до исправления application guards.** Это не требование закончить словарь. Большинство механизмов работают на конечных scopes, но три технических механизма допускают обходы. Production остаётся v5, merge/rollout не выполнялись, `full_linguistic_certification=false`.

Исходный свежий SHA: `ec43ff50383e6b632a95a5f6b9a4b8d7b0d44003`. Проверенный код независимого gate: `43bee7b0a4ee45ef2538d351ebeb0894ce321871`. Research `3d139742c3685260666dbd6cdcf7357133278f06`, decision `613d5f7eed65be57d89f05601e45a53be280f4b2`, application `33e66dda255c6c4074134bef461d8c0be3c39a34`, уточнение sense assertions `43bee7b0a4ee45ef2538d351ebeb0894ce321871` опубликованы отдельно. Validation/documentation сохраняются следующим отдельным commit. Публикация использует GitHub connector с проверкой каждого blob/tree и fast-forward lease; локальные transport commits имеют другие SHA, но идентичные деревья.

Цепочка `main → #650 → #651 → draft #652` проверена: все три PR открыты и unmerged; #652 по-прежнему основан на #651 `22e6293f72a22e80e364079d83031a1f8f2a36d6`. Старые блоки 08/09 прочитаны по текущим artifacts, не повторно применены.

## Readiness matrix

Статус pass относится только к указанному механизму и проверенному scope. Он не сертифицирует все принятые слова.

| Механизм | Статус | Независимое доказательство / предел | Blocker |
|---|---|---|---|
| Permissions на finite stage CLI | **fail** | Отсутствующие и явно false exclusion/uncertainty permissions приводят к записи registry: четыре воспроизведения. Denied binding/accepted отклоняются без записи. | F01 |
| Permissions сохранённого lexical review | **fail** | Frozen grants действительно покрывают 2 843 bindings / 39 decisions, но loader принимает явно отозванный grant и вообще не читает registry авторизаций. Существование правильных grants не доказывает enforcement. | F02 |
| Source identity и полный scope при записи CLI | **fail** | Несуществующий ID, подмена языка, корня и widened scope сохраняются: четыре воспроизведения. Recognition проверяет переданные stage records против них самих, а не исходной очереди. | F03 |
| Сохранённые source locators / payloads | pass | Независимо проверены все 21 962 link locators, file/language/ID/word/record hashes; v6 output не содержит этих forged fixtures. Downstream rejection не исправляет более раннюю неразрешённую запись. | Нет в текущем output; F03 на application path |
| Corpus-sense policy | **fail** | Конфликтующие analyses отклоняются при наличии policy; удаление `senses_policy` позволяет тому же promotion loader принять их. Политика действует как необязательная. | F04 |
| Canonical / realization / head / edge / alias identities | pass | Independent edge/link oracle, finite national controls ped/nat/observ~osserv, alias и collision tests. Никакого generic stripping или size cap не добавлено. | Лингвистическая проверка оставшихся forms отдельна |
| Finite grouping / competing senses / proposals | pass | Substring, ending-strip, gloss, duplicate-array, homonym, proper-name и malformed controls не становятся bindings; proposals не дают identity/membership. Scope preservation проверен. | Не даёт права на нерассмотренный scope |
| Versioned reuse / extension / revision | pass | Реальный Systeme dossier даёт ровно 2→3 finite memberships; caller input сохраняется. Stale version/hash, changed sense, widened scope, wrong transition, translation, denied acceptance и unproved boundary отклонены. Targeted lifecycle tests дополнительно проверяют revision и независимые edges. | Нет технического blocker в проверенных paths |
| Approved baseline corrections | pass | Targeted synthetic corrections проверяют accepted→excluded/uncertain, no mutation of source/history, сохранение другого component и точные previous hashes. Реальных correction dossiers пока 0. | L01: два найденных baseline links требуют отдельной correction |
| Historical/current/promotion cross-references | pass | Текущий v6 audit, неизменные prior trees и существующие frozen/replay checks. Frame counts взяты из текущего planning report, не сложены между собой. | Полная история не adjudicated |
| Реестр source IDs | pass | Свежая enumeration байт-в-байт совпала с оригиналом: 4 924 980 IDs, 829 без v5 membership, identity mismatches пусты. | Потеря family edge ≠ потеря source word |
| Surface-only gap | pass как измерение; deferred как linguistic recall | 3 999 388 surface-only IDs; отдельный saved rank frame 600 и новый diagnostic 18. Полного gold inventory нет. | L03 |
| Finite promotion / отсутствие pool import | pass для конечных dossiers; **fail по sense guard** | Литеральный edge/link oracle, negative source locators/IDs/hashes, сохраняемые остатки packets. Promotion loader не может обойти F04. | F04 |
| Shadow normalization / aliases / route dedup | pass | Независимые literal RU ожидания: операция 138, мутация 41; совпадают точные наборы IDs. 21 371 measured rows сохраняют 21 566 component proofs без frequency double-count. Все 829 zero-v5 records доступны в targeted tests. | Snapshot следует reload после revisions |
| Consistency audit / deterministic replay | pass | V6 integrity pass; 277 migration artifacts побайтно совпали; свежая source enumeration совпала. Shadow replay и receipts сохранены отдельно. | Это не независимое словарное доказательство |
| Независимые adversarial application assertions | **fail** | 50 assertions: 40 pass / 10 fail. Failure receipts содержат exit codes и before/after registry hashes; строгий gate возвращает exit 1. | F01–F04 |
| Correctness всего словаря | deferred | Ни CI, ни выборка этого не доказывают. | Масштабная лингвистическая работа после guard repair |

## Exact differential и сохранность

Против свежего baseline: **memberships +0 / −0 / changed 0**. Не изменены каталоги, heads, edges, membership objects, решения и source measurements. По идентичным Git trees сохранены v5, frequency lists, historical v5 audit, все 277 generated v6 artifacts и Prompt 06–09 artifacts. Catalog 19; accepted memberships 21 566; dictionary lexical heads 222; total head objects 19 079, включая 18 857 legacy exact units; finite links 21 962. Ни synthetic fixture, ни independent annotation не внесены в реальные registries.

Независимый oracle не импортирует `generateV6Memberships`, `materializeLexicalReviews` или `materializeFamilyPromotions` для expected результата. Он строит exact accepted question map непосредственно по сохранённым edge statuses/scopes, link identities и corrections и сравнивает каждое membership object. Отдельно сопоставляет каждый locator с оригинальным v5 shard. Проверяемые loaders/recognizers вызываются только как предмет adversarial теста.

## Реальные annotations и статистические пределы

Annotation unit — `language/family/lemma/head/version` в lexical-row или finite-component scope, не token/sense occurrence. Public seed и SHA-256 ordering зафиксированы до labels. Все непустые language × origin strata имеют explicit denominators: seed inherited, newly reviewed, promoted. Выбраны до трёх вопросов на страту: **40 из 15 непустых страт**. Это фиксированная deterministic выборка; не заявлена случайная probability sample.

Результат: **15 independently supported, 2 excluded recommendations, 23 uncertain**. Два baseline вопроса `de personalverwalter → alter` и `de altersbestimmung → alter` конфликтуют с независимыми lexical histories Verwalter/verwalten и немецкого age noun Alter, в отличие от Latin alter/alterare. Исходные links сохранены; automatic exclusion не применялся. Dictionary sources, exact IDs, source proofs и reasons находятся в `annotated-accepted-sample.json` и `independent-sources.json`.

На 17 adjudicated binary labels Wilson 95% interval для error fraction равен **[0.03288, 0.34336]**. Это только описательная sensitivity для условного subset; не доверительный интервал ошибки всего индекса: annotation missingness неслучайна, strata неодинаковы, seed фиксирован, нет blind второго annotator. Если все 23 uncertain окажутся правильными/неправильными, finite-sample error bounds будут **[2/40, 25/40]**. Population error rate не определена. Нельзя использовать эти числа как процент готовности или mandatory accuracy.

Отдельный purposive withheld/control frame содержит 11 вопросов: 3 supported positives (один уже принят), 2 negatives, 6 uncertain. Exact derivatives **atomic** (`en lemma:97df563df64033609e43`) и **atomar** (`de lemma:d71ccaf503ddab530fd1`) независимо поддержаны словарями и отсутствуют в accepted atom snapshot. Это два конкретных coverage omissions для будущих finite dossiers, не потеря source IDs и не rate оценка recall. Attimo и protein actin остаются uncertain; documented ancestry не заменяет recognizable complete component.

Дополнительные три purposive positive controls проверяют short ped/nat и национальное observ~osserv. Они отделены от основной выборки. Surface-only diagnostic — 18 hash-selected вопросов из предшествующего enriched rank frame 600; все оставлены uncertain в отсутствие proved target-family gold label. Coverage на ety routes не маскирует этот gap. Overlapping samples не суммируются в «общую случайную выборку».

## Проверки и CI

Локально прошли **121 targeted test**, полный `npm test` на **135 files**, existing v6 integrity audit и source enumeration. Byte-identical migration replay: **277 artifacts**. Existing tests/runtime files не менялись; добавлены независимый review script и CI gate, без shared production engine изменений. Receipts сохраняют точные команды, checked code SHA, input/code/output hashes и compressed logs. Synthetic application probes только в disposable directories; negative rejections проверены на отсутствие registry write.

Новый последний шаг workflow `Audit parallel associative family v6` запускает independent checker с `--strict`. Его failure по десяти воспроизведениям — ожидаемый **незакрытый blocker**, не success и не техническое завершение фундаментальной части. Полный Tests workflow и все предшествующие consistency Audit steps проверяются отдельно на exact published final SHA; running не считается success. Финальный remote outcome сообщается после publication. Не заменять результаты final SHA результатами research/application SHA.

## Следующий этап

Сначала prospective repair F01–F04 с independent no-write/actual-source/sense gates, frozen grant locking и повторными v6/source-lock/planning/replay checks. Критерий закрытия: strict independent CI gate действительно проходит, все отказные paths сохраняют исходные bytes, positive controls остаются рабочими. Только затем архитектуру можно назвать готовой к масштабной лингвистической работе. L01/L02 и большие незакрытые словарные frames при этом остаются отдельной работой, а не автоматически закрываются тестами.

Подробный handoff: `prompt10-independent-20261007/BACKLOG-HANDOFF.md`. Никакого merge/rollout; `full_linguistic_certification=false`.

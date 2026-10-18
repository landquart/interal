# Контрольная точка подготовки внешних ресурсов

Дата: 18.10.2026. Этап 01 завершён как исследовательский аудит. Проверенный main: `39d8a47d2588b55c4c750cdd9985b5d6ba26ec73`; v6: `9fff76431a86a06df6db69b64d7f2ca4c871f1b7`, дерево равно CI head `1c04d9ae48d079b56b6c37f854f96280b1915a10`. Remote и PR сверены заново, а не восстановлены по памяти.

## 1. Итог по пяти вопросам

| Вопрос | Ответ и основания |
|---|---|
| Что существует и работает? | Git-backed v5 и его repository integrity audit; morphology parser с альтернативами; частоты/F→A→P; ручные/blocked статусы; в V — catalog, lexical heads, finite links/edges, отрицательные решения, revisions, очереди, shadow/source proofs и strict independent gate. Файлы/символы — [карта компонентов](REUSABLE-COMPONENTS.md), CI — baseline §4 |
| Что существует, но требует исправления/уточнения? | Fallback отрицательных решений и проекция identity/provenance в M; контракт омонимии/aggregate frequency; согласование нескольких registry authorities; открытые AC-011/013/015; устаревшие test/отчётные assumptions. Точные пути и границы — [BLOCKERS.md](BLOCKERS.md), EP-04–08 и §3 |
| Чего действительно не хватает? | Source-neutral external observation/relation schema, source/release/license/dependency registry, адаптеры четырёх форматов, external↔corpus alignment, внешние quarantine/evaluation fixtures. Для Flexor пока даже не установлен canonical artifact. V6 head architecture и review queues **не отсутствуют** |
| Что необходимо перед интеграцией? | Выбрать base/ref; спроектировать additive source assertions; зафиксировать releases/licenses; создать изолированный staging/validation; затем обеспечить negative/manual precedence, identity/provenance adapter и совместимость расчётов до любого применения |
| Можно ли перейти к проектированию общей структуры данных? | **Да.** Исследованная v6 даёт достаточную опору. Не нужно повторно создавать lemma→head→family или заканчивать все лингвистические очереди. Design не разрешает ни membership import, ни merge/production switch |

## 2. Матрица готовности

| Следующий вид работы | Статус | Условия |
|---|---|---|
| Проектирование общей схемы | **READY** | Использовать проверенные M/V distinctions; external claims отдельно от reviewed facts |
| Проектирование source adapters | **READY_WITH_RESOURCE_GAPS** | UDer/GLeMM/MorphyNet первично описаны; Flexor требует URL/release; версии файлов ещё не locked |
| Малый изолированный ingestion прототип | **NOT_IMPLEMENTED / CONDITIONAL** | Сначала минимальные EP-02/03/10, quarantine и запрет application; не выдавать текущее состояние за готовый importer |
| Read-only сопоставление внешнего источника и corpus | **CONDITIONAL** | Exact IDs, конкурирующие analyses, сохранение provenance; отсутствие relation не равно rejected |
| Автоматическое изменение действующих семей | **NOT_READY** | EP-04/05/06/08/09, явные finite dossiers и независимая validation |
| Production integration | **NOT_READY** | Дополнительно совместимость main/v6, runtime policy и актуальные regression/deployment checks; остаётся v5 |

Статусы описывают техническую готовность, а не новые пользовательские разрешения. Настоящий этап не выполняет перечисленные будущие действия.

## 3. Обязательные решения для следующего design-этапа

Это входные требования к проектированию, не финальная реализация схемы:

1. **Единица внешнего утверждения.** Отделить raw row, external lexeme/POS/sense, morphological analysis, relation и corpus alignment. Сохранить направление/тип, unordered пары и исходные графовые связи без превращения connected component в семью. Основа: V `schema.json::$defs`, `associative-family-v6.js::generateV6Memberships`.
2. **Порядок авторитетности.** Manual/current reviewed verdict выше external proposal; исторический accepted proof не разрешает новый propagation; rejected/uncertain/pending/error/absence — разные состояния. Основа: M `FamilyIndexLoader.candidateEntries`, V `loadLexicalReview/replayBaselineCorrections/replayHeadLifecycle`; дефект fallback — EP-04.
3. **Сохранение значений и частот.** External homonyms не делят старый corpus ID автоматически. При несовместимых histories — deferred или доказанный общий component; F остаётся агрегированным. Основа: V `decideLexicalRow`, M `stableLemmaId/getFrequencyProfile`.
4. **Ресурсные snapshots.** Source, upstream dependencies, release/checksum, license/attribution, importer/mapping version и raw locator должны связывать каждое наблюдение. M/V internal source locks переиспользуются, но не являются готовым external registry.
5. **Изоляция.** Staging storage/manifest не должен писаться в v5/v6 accepted catalogs/generated membership. Сначала diff только proposals/evidence; application — отдельный guarded finite stage, если он позже будет поручен.
6. **Независимость validation.** Expected accepted map не строить тем же materializer, который проверяется. Сохранить V independent oracle, добавив source-format tests и независимый linguistic evaluation frame.
7. **Runtime adapter.** Обязательная передача corpus/head/edge/proof IDs, dedup измерений без потери memberships и неизменные F-представитель/top-five P/N-веса. Основа: V `deduplicateV6CorpusRows`; M `findCandidatesForRoot` нуждается в будущем изменении, сейчас не исправлен.

Flexor можно оставить source entry со статусом `unidentified` на design-этапе. Нельзя подставлять другой похожий ресурс без подтверждения идентичности.

## 4. Что не требуется делать перед design

- Повторно разрабатывать v6 lexical heads, finite review/lifecycle, очереди и shadow runtime: они уже существуют в V.
- Запускать весь v5/v6 rebuild/replay ещё раз без изменения относящегося к проверке дерева: результаты финального V-CI и M repository audit доступны.
- Исправлять PH mater ради начала external schema design; он независим, хотя общий main Tests остаётся красным.
- Массово чистить старые families или доводить все uncertain до бинарного решения.
- Переключать production и объединять цепочку #650/#651: настоящее исследование этого не требует и не выполняет.

## 5. Аудиторская воспроизводимость

Выполненные дешёвые проверки:

```bash
git fetch --prune origin
git rev-parse origin/main
git rev-parse origin/fix/associative-component-membership-20261001
git diff --stat origin/feat/associative-family-v6-head-architecture-20261003 origin/fix/associative-component-membership-20261001
git merge-base --is-ancestor origin/feat/associative-family-v6-head-architecture-20261003 origin/main
git merge-base --is-ancestor bdc24d2a5ab377b1bfd4278909f76edb337ed965 origin/main
```

Ожидания проверенного снимка: первый ancestor exit 1, второй 0, diff V-CI→V пуст. Код читался напрямую из M и через `git show V:<path>`; gzip heads/edges/memberships прочитаны без записи. PR metadata и Actions runs/jobs/logs получены через GitHub API. Точные CI URLs и ошибки сохранены в baseline §4.

Свежие Node stdin diagnostics: transport failure→retrieval fallback; explicit rejected→0 entries; candidate projection теряет три identity/proof поля; stableLemmaId без sense. Детали/результаты baseline §7. Это исследовательские probes с synthetic объектами в памяти, не новый test suite и не linguistic acceptance.

Не выполнялись: `npm test`, full replay/build, production E2E, запросы к платным LLM, external data import, application/очистка, изменение существующих PR/merge. Существующие достоверные дорогие проверки использованы в пределах их SHA и scope; main failure не скрыт.

## 6. Документы этапа и сохранность

Созданы только пять Markdown-файлов в `audit/associative-external-preparation/`:

- [01-BASELINE-AUDIT.md](01-BASELINE-AUDIT.md) — refs/PR/CI, current counts, актуальность отчётов и диагностика.
- [CURRENT-ARCHITECTURE.md](CURRENT-ARCHITECTURE.md) — два контура, девять сущностей, расчёт и ограничения identity.
- [REUSABLE-COMPONENTS.md](REUSABLE-COMPONENTS.md) — пути/символы, повторное использование и external gaps.
- [BLOCKERS.md](BLOCKERS.md) — препятствия по стадиям, AC/F-статусы, лицензии/производительность/тесты.
- [PREPARATION-CHECKPOINT.md](PREPARATION-CHECKPOINT.md) — этот handoff.

Код, v5/v6 семейные данные, frequency lists, existing audit evidence и production config не изменены. Финальная проверка документационного diff должна включать `git diff --cached --check` и список только этих пяти путей. Полный SHA коммита документации сообщается отдельно, чтобы не записывать самоссылку внутрь коммита.

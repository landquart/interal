# 00. Стабилизация после merge PR #670

Проверяемый main: `0b3faf2215d2008be5abc0ac7fe66f7eb03e0891`. Проверка выполняется заново на отдельной ветке; массовая разметка и изменение решений по семьям не запускаются.

## Обнаруженные неисправности

GitHub Pages run `39338729838`, job `118354697909`: Jekyll 3.10.0 / github-pages 232 интерпретирует оригинальную библиографию UDer как Liquid. Подтверждён Liquid::SyntaxError в `data/morphology-evidence/sources/UDer/fr-Demonette/README.md:27`; предупреждения есть и в других README. Deploy пропущен. Live Pages отвечает 200, но сохраняет прежнюю публикацию от 9 октября; HTTP 200 сам по себе не подтверждает успешный post-merge build.

Основной Tests run `39338731659` на merge commit прошёл. Vercel production `dpl_8mEBS7kvbigGCkkoDSsjFP61tXKM` имеет READY и exact Git SHA merge commit; домен `interal.vercel.app` отвечает 200. Исторический production-audit `37994612402` завершился failure ещё на дообъединительном main `39d8a47...`; он не объявляется новой регрессией или успешным аудитом всего корпуса.

## Исправление

Новый `_config.yml` исключает `data/morphology-evidence/sources` из Jekyll rendering/copying. Оригиналы, лицензии, README, source locks и контрольные суммы остаются в Git без изменений и используются офлайн-импортёрами. Публичный runtime к этой директории не обращается. `node_modules` также исключён из публикации.

Добавлена независимая PR/push-проверка Pages validation: официальный закреплённый Jekyll action собирает весь сайт без deployment. Затем проверяются наличие и точные байты всех tracked HTML-страниц, скачиваемых PDF/DOCX/EPUB, runtime JS, manifests v5/search-index, shared assets, sitemap и robots; исходные корпуса не должны попасть в Pages output.

## Дополнительная неисправность production-аудита

Старый live-тест ошибочно требует `source_lemmas == classified_unique_lemmas` и нулевого `lemmas_with_zero_family`. Действующий repository materialization и независимый repository audit используют `source = materialized + unassigned`: 4 924 980 = 4 924 281 + 699. Исправляется только контракт browser-аудита, не данные: точные counters берутся из committed repository-integrity receipt, все нулевые structural-error проверки сохраняются. Добавлена более строгая сверка SHA-256 всего production manifest/report/provenance с Git checkout; произвольный новый ненулевой unassigned count не допускается. Запущен свежий исчерпывающий read-only repository audit с неизменённым скриптом и сравнением результата с committed receipt. Новый live browser audit запускается в PR отдельно; до завершения оба результата не объявляются PASS.

## Новые регрессионные результаты

- `npm test`: все 93 существующих test files PASS.
- Associative Verification: 25 Node tests PASS; model routing и runtime index проверки PASS.
- Importers: 23 PASS; graph: 18 PASS; candidate search: 16 PASS; pilot: 15 PASS; Flexor/HanTa preparation: 8 PASS.
- Независимый verifier этапа 08: 35 PASS / 0 FAIL. IV-001 exact lexical identity, IV-002 scoped reverse decisions, IV-003 cross-language paths, IV-004 mixed-chain classification остаются исправленными.
- Реальные Vercel build gates проходят без изменения их условий.
- Local browser BLOCKED: Chromium отсутствует, официальный download несколько раз возвращает повреждённый ZIP. Исходная локальная ошибка и download logs сохраняются; браузерная проверка в GitHub CI проверяется отдельно.
- Первая настоящая Jekyll-сборка исправленной ветки прошла в CI `39340350276`: все 13 HTML-страниц и 9 runtime assets совпали по SHA-256. Новый guard дополнен проверкой скачиваемых документов; его новая CI-проверка ещё ожидается. Локально Ruby/Jekyll отсутствуют.

## Сохранность данных

Tracked data и associativvordes не отличаются от проверяемого main; исправление не меняет научные формулы, manual/rejected/split решения, частоты, membership, lexical heads или переключение v5/v6. Полные корпусы не добавляются в PR. Независимо сверены 14 protected Git objects и фактические байты 52 source/provenance файлов против main Git blobs; исходники полностью совпали. Повторно проверены размеры/SHA-256 всех 12 реальных raw файлов GLeMM; все pins совпали. Квитанции сохраняются отдельно.

## Ограничения перед массовой разметкой

Существующие реализации изучаются вместе с новыми тестами, а не только с прежними отчётами. Импорт сохраняет unreviewed observations; граф не принимает membership; очередь хранит решения; пилот не создаёт gold из автоматических меток. Ручной gold, actual baseline/calculator captures, новая совместная сертификация global source catalog и измерение большого графа/очереди остаются отдельными задачами. Успешный импорт и merge не доказывают морфологическую или семантическую корректность разметки.

Это промежуточная контрольная точка: окончательный вердикт Pages и browser CI будет добавлен после выполнения проверок. Merge этого исправления пока не выполняется.

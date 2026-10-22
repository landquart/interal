# Предварительная автоматическая разметка — этап 05

Исследовательский Python-модуль поверх графа, массовых очередей и журнала разметки. Его результат — версионированные **предложения**, а не решения человека и не изменения утверждённых семей. Python 3.12+, стандартная библиотека, локальный POSIX-диск с `flock`, `fsync` и атомарным переименованием.

По умолчанию — `dry-run`, ноль сетевых генераций и ноль разрешённых запросов. Калиброванных порогов пока нет: **каждое предложение требует человека**, `calibrated_reliability=null`. Недостающие значение, POS, частота, направление, независимость и фактическая стоимость остаются unknown/null. Отсутствие морфологии — `LOW_EVIDENCE`, а не отрицательное решение.

## Методология и границы

Прочитана действующая `Metodologiya_Interalya_updated.docx`, версия 4, стр. 30–36 и 50–53. Краткие правила и ссылка на методологию зафиксированы в `contract.RULES`; методологические утверждения отделены от исходных морфологических строк. Морфологическая родственность даёт гипотезу, но не устанавливает автоматически семантическую восстанавливаемость и принадлежность ассоциативной семье. Историческая связь и общая тема недостаточны. Значения и омонимы не объединяются по написанию. Оценки узнаваемости Di/Pr/Sh не заменяют решение о семье.

Пять отдельных осей: `formal_morphology`, `derivation`, `semantics`, `lexeme_identity`, `family_membership`. У каждой — supported/refuted/unknown и собственные evidence refs. Сохранены семь типов отношения из review: direct derivation, indirect derivation, compound, inflection, orthographic variant, mixed path, unresolved. Орфографический вариант не обязан иметь производность; инфлекция не становится отдельной деривационной связью.

* A: без LLM проверяет область семьи/языка, native ID, POS, историю, конфликты, направления и языки узлов. Формальное свидетельство не даёт семантический ответ.
* B: модель получает карточку, правила и строгую JSON-схему. Дополнительные поля, вероятность, несуществующие refs/значения и противоречивые положительные решения отклоняются. Отказ требует цитированного противоречия именно этой семье.
* C: получает исходную карточку, **без ответа B**. Запускается для рисков, неопределённости и предлагаемого решения. Повтор той же модели использует кеш и помечается как отсутствие независимости.
* D: человек разбирает риски, слабые свидетельства, расхождения и всё, что не прошло независимую калибровку. Сейчас семантические автоматические допуски закрыты, включая объединения семей.

Свободное объяснение модели всегда помечено как непроверенная интерпретация. Машинная проверка refs не доказывает истинность текста или цитирования — это остаётся задачей независимой оценки. Все внешние строки и тексты вложены как недоверенные данные; запрос не имеет tools, браузера или доступа к ключам.

## Offline и dry-run

Из корня checkout, все состояния и выгрузки — **вне Git**:

```bash
python3 associativvordes/auto_annotation/pipeline.py \
  --input audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz \
  --store /srv/interal-research/preannotation/pilot \
  --config associativvordes/auto_annotation/config.offline.json \
  --run-id frozen-offline-01
```

Отсутствующий mode означает `dry-run`. `offline` и `dry-run` не делают сетевых обращений даже при настроенных провайдерах; они могут повторно использовать уже сохранённый валидный ответ. Они создают только исследовательские карточки/предложения/журнал в указанном store. Отчёт показывает прогноз для 100, 1 000 и всего числа native-кандидатов; без провайдера и проверенных тарифов стоимость LLM — unknown, а не выдуманная цена.

Настоящая очередь промпта 02:

```bash
python3 associativvordes/auto_annotation/pipeline.py offline \
  --input /srv/interal-research/mass02/releases/RELEASE_VERSION \
  --registry /srv/interal-research/registry/registry.sqlite \
  --source-index /srv/interal-research/index/index.sqlite \
  --aux-index /srv/interal-research/aux/aux.sqlite \
  --store /srv/interal-research/preannotation/all \
  --run-id registry-offline-01
```

Проверяются manifest/version, checksum/count вопросов, canonical family IDs настоящего реестра, checksum реестра и индексов, upstream question ID и зависимости. Ошибка входа обнаруживается **до генераций**. Новых canonical family ID модуль не создаёт. Каждая native-альтернатива — отдельный candidate ID на основе question ID + native ID; совпадение написаний не сливает лексемы. Точные повторы считаются, противоречащие повторные native ID отклоняются.

`--source-index` сверяет лексемы, нормализованные утверждения и исходные строки по bytes/hash/locator/revision, добавляет реальные языки узлов. Инфлекционные лексемы намеренно отсутствуют в деривационном индексе: `--aux-index` проверяет их отдельно по сертифицированным записям. Без auxiliary такие ID остаются явно непроверенными. Без source-index пути остаются переданными гипотезами с непроверенным языком узлов. Frozen pilot имеет другой формат графовых ссылок; ему нельзя подставлять native index как будто это тот же граф.

Опциональный `--family-context /private/family-context.json` — объект с существующими family ID и документированными значениями/ссылками. Нельзя подставлять предполагаемое значение из написания корня. Подтверждённые значения конкретной лексемы передаются как `verified_senses` со стабильными ID и свидетельствами. По умолчанию таких семантических подтверждений нет.

Выполнение — ограниченное число futures, `concurrency` 1–32. Порядок сбалансирован по языку × классу пути; `--max-candidates N` не разрешается, если он уничтожит хотя бы одну непустую полосу. Отчёт показывает выбранные и пропущенные количества по языкам; точные выбранные карточки закреплены в run. `--stop-after N` имитирует прерывание после N обработок; остальные карточки остаются в плане для resume.

## Провайдеры и стоимость

Используется совместимый HTTP Chat Completions контракт проекта, без новой TypeScript-зависимости. Параметры `endpoint`, `model`, `model_version` задаёт оператор; автоматического выбора модели/платного fallback нет. Поддержаны `json_object` с локальной строгой валидацией и опциональный `json_schema` для совместимых поставщиков. Не все модели поддерживают этот протокол: несовместимый ответ остаётся ошибкой/abstain, а не «починенным» ответом.

`config.local.example.json` требует замены всех REPLACE-полей. Для Ollama закрепляется digest **установленной** модели, проверяется `/api/tags`, отклоняются `remote_host`, `remote_model` и cloud-имена. Localhost сам по себе не доказывает отсутствие облачного прокси: обязательна проверяемая оператором `local_attestation`. Модуль не скачивает и не устанавливает модели.

```bash
python3 associativvordes/auto_annotation/pipeline.py pilot \
  --input audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz \
  --store /srv/interal-research/preannotation/local-pilot \
  --config /private/preannotation-local.json \
  --run-id local-pilot-01 --stop-after 10
```

Удалённый провайдер требует HTTPS без credentials/query/fragment; редиректы запрещены. Provider-конфигурация:

```json
{
  "endpoint": "https://PROVIDER_HOST/v1/chat/completions",
  "model": "EXACT_PROVIDER_MODEL_ID",
  "model_version": "VERIFIED_MODEL_VERSION",
  "key_env": "INTERAL_ANNOTATION_API_KEY",
  "auth_scheme": "Bearer",
  "local_only": false,
  "response_format": "json_schema",
  "input_per_million_usd": "VERIFIED_RATE",
  "output_per_million_usd": "VERIFIED_RATE",
  "price_ref": "VERIFIABLE_PRICING_REFERENCE",
  "price_verified_at": "YYYY-MM-DD"
}
```

Она помещается в `providers.NAME`, роли назначаются через `roles: {"B":"NAME", "C":"SECOND_NAME"}`. Для совместимого Yandex endpoint предусмотрены `auth_scheme: "Api-Key"`, `folder_env` и `{folder}` в model. Существующие пользовательские ключи передаются через окружение worker; браузерное хранилище ключей не читается. Реальный endpoint/модель/тарифы нужно проверить у поставщика, пример не является готовой платной конфигурацией.

**Платный режим требует одновременно** `allow_paid=true`, положительный `budget_usd`, `permission_ref` с явно данным разрешением/бюджетом, `max_requests>0`, проверенные цены и ключ в заданной env-переменной. По умолчанию всё закрыто. Настоящих платных вызовов при разработке не было.

Настраиваются `route` (deterministic/single/multi/mixed), `concurrency`, `requests_per_minute`, `max_requests`, `max_attempts` (1–3), `timeout_seconds` (1–60), `max_input_tokens`, `max_output_tokens`. Общие лимиты запросов/денег относятся к **всему store**, не обнуляются новым run ID. Перед каждым вызовом fsync-ится резерв стоимости по консервативной оценке UTF-8 bytes + overhead и пределу output tokens. Карточки не обрезаются молча. Счётчики admission атомарны; независимые запросы могут идти параллельно.

Фактические usage tokens поставщика сохраняются. `rated_microusd` — расчёт по заданным ставкам, **не счёт поставщика**. `actual_billed_microusd=null` до сверки с реальной квитанцией. При неизвестном результате/usage или нарушении token cap резерв сохраняется, дальнейшие платные запросы блокируются. Неизвестный семантический результат не отправляется повторно даже после финансовой сверки. Недействительный JSON с известным usage может повторяться лишь в пределах долговечного `max_attempts`. HTTP/error body и секреты в отчёты/журнал не попадают; echo ключа отклоняется.

```bash
python3 associativvordes/auto_annotation/pipeline.py record-cost \
  --store /srv/interal-research/preannotation/paid \
  --receipt /private/verified-provider-receipt.json
```

Квитанция содержит reservation_id, целое billed_microusd, currency="USD", provider_receipt_ref, author, verified_at. Оператор сверяет её с настоящим счётом; это не автоматическая подстановка тарифа. Ключи и личные финансовые файлы не включать в Git.

## Batch, resume и обновление

`batch` выполняет настроенную очередь; `pilot` использует тот же механизм с явно установленными малыми лимитами/stop-after. `resume` повторяет команду с теми же input/config/run-id/store, пропускает завершённые карточки и сохраняет историю повторов ограниченных задач. Запуск модели после offline продолжает исследование с новой версией результата, а не теряет карточку из-за уже записанного abstain.

Кеш зависит от точного запроса, карточки, правил, endpoint и версии модели; цены/имя env-переменной не заставляют покупать идентичный ответ снова. Повтор B/C той же модели не считается независимым. При новой версии источника, параметрах или алгоритме используйте `re-evaluate-changed` и **новый run ID** в том же store. Неизменённые запросы используют кеш; прежние результаты и ссылки на них сохраняются. Несовместимый resume со старым run ID отклоняется. Запросы действительно воспроизводимы по сохранённому payload hash и ответу, но temperature=0 и alias модели не гарантируют побитовую повторяемость провайдера.

Алгоритм закрепляет SHA всех используемых Python-модулей auto_annotation/candidate_search/evidence_graph/importers/review/pilot_evaluation, а run — input, source versions, конфигурацию и список карточек. Обновление алгоритма не переписывает замороженные cases или gold.

## Выгрузка и ручная работа

```bash
python3 associativvordes/auto_annotation/pipeline.py export-proposals \
  --store /srv/interal-research/preannotation/all --run-id registry-offline-01 \
  --output /srv/interal-research/releases/proposals-01

python3 associativvordes/auto_annotation/pipeline.py export-handoff \
  --store /srv/interal-research/preannotation/all --run-id registry-offline-01 \
  --output /srv/interal-research/releases/review-01
```

Требуется новый output directory. Детерминированный порядок, hashes в manifest. Handoff сохраняет исходный вопрос и его историю, добавляет отдельный `automated_proposals`; записи решений человека не создаются. Импортируйте handoff существующим `review/server.py import` согласно [RUNBOOK](../review/RUNBOOK.md). Основная карточка показывает предложения безопасным текстом; серверный allowlist слепой роли не передаёт это поле вообще. Обычное `ACCEPT_PROPOSED` по-прежнему не меняет production.

## Сохранность и восстановление

Authority — immutable content-addressed JSON + последовательный hash-linked fsynced журнал и HEAD; единственной SQLite-копии нет. Один process lease на store, mutex на транзакции потоков. Потерянный committed tail, повреждённый объект и несовпадение цепочки обнаруживаются; незавершённые pending-файлы игнорируются. Полностью записанная транзакция до прерванного HEAD rename восстанавливается. Приватные журналы содержат исходные вопросы; идентификаторы разметчиков удаляются из отправляемой модели истории.

```bash
python3 associativvordes/auto_annotation/pipeline.py backup \
  --store /srv/interal-research/preannotation/all \
  --output /srv/backups/preannotation-20261022.zip

python3 associativvordes/auto_annotation/pipeline.py restore \
  --input /srv/backups/preannotation-20261022.zip \
  --store /srv/interal-research/preannotation/restored
```

Восстановление только в пустой каталог; проверяются inventory, path traversal, hashes, цепочка и биллинг. ZIP включает все версии результатов, исходные карточки/вопросы, резервы, квитанции и runs. Proposals export **не является полным backup**. Регулярно копируйте versioned backup на независимый долговечный носитель; временный sandbox не годится для единственной копии. Файловая система и хранилище остаются ответственностью оператора.

## Оценка и испытания

Протокол [protocol05.json](protocol05.json) зафиксирован до платных вызовов и человеческих ответов. Offline smoke не выдаётся за preregistered качество. Используются только замороженные 1 406 cases и существующий human gold contract; прежние accepted, корпусные метки, найденные пути и LLM не являются gold.

```bash
python3 -m unittest discover -s associativvordes/auto_annotation -v
node --test tests/associative-auto-annotation.test.mjs
python3 associativvordes/auto_annotation/benchmark.py \
  --cases audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz \
  --store /srv/interal-research/evaluation05/run-01 \
  --output /srv/interal-research/evaluation05/report-01
```

Benchmark **сам никогда не включает сеть**. Для оценки реальных моделей сначала явно выполните разрешённые pilot/batch в нужных stores `STORE/single`, `STORE/multi`, `STORE/mixed`, с run IDs single/multi/mixed и соответствующим route, затем передайте ту же конфигурацию benchmark. Он использует валидные сохранённые результаты/кеш. Для нового отчёта нужен свежий каталог экспортов; при переносе используйте backup/restore. Без настоящих ответов маршруты явно помечены `NO_REAL_MODEL_OUTPUTS`, даже если инфраструктура обработала все cases.

`--judgments`, `--roster`, `--adjudications` принимают только независимые человеческие проверки контракта промпта 04. Для заранее выбранных 180 случаев требуются обе независимые проверки. Формируются confusion tables с знаменателями и Wilson CI, разрезы языка/типа и межэкспертное согласие. Без gold TP/FP/FN/precision/recall — null/BLOCKED. Времена машинного запуска не являются временем разметчика; показатели ускорения и правильно проверенных случаев/час не выдумываются.

`HUMAN-STUDY.json` закрепляет подвыборку и независимые gold/timing slots. Нужно минимум 360 gold-проверок на 180 случаях, отдельно 360 измеренных проверок времени разными людьми без повторного предъявления leakage group в разных условиях; арбитраж — дополнительно. Полный исходный пилот требует минимум 1 787 gold-проверок (1 406 + 381). План не назначает реальных людей и не подменяет их ответы. Для LLM timing нужен отдельный экспериментальный handoff/монтаж условий; прежние morphology-only timings нельзя назвать эффектом LLM.

Архив результатов использует существующий `pilot_evaluation/archive04.py`; точный JSON roundtrip проверяется. Текущий отчёт: [REPORT](../../audit/associative-external-preparation/pilot05-preannotation/REPORT.md). Flexor не включён. До независимой калибровки допустимы автоматические проверки целостности, подготовка карточек, маршрутизация, кеширование и предварительные предложения; окончательные семантические решения и объединения семей остаются за человеком.

Протокол совместимости проверен по [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) и [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility). Версии источников и права на исходные строки — в закреплённых manifest/source-lock этапов 01–04 и их ATTRIBUTION.

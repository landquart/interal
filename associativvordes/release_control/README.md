# Контролируемые выпуски ассоциативных семей

Этап 07 добавляет отдельную границу между исследовательской очередью и
утверждённой версией данных. Текущий выпуск этапа 06 **BLOCKED**: независимого
gold нет, все предложения ABSTAIN. Ни один из них этим модулем не одобрен.
Production v5 не переключается. Архивный shadow v6 содержит 19 семей.

## Контракт

`control.py` хранит полные неизменяемые версии внешнего реестра и атомарный
`CURRENT`. Изменение — точные `before`/`after` записи, family ID, язык, concrete
native candidate ID, question ID, evidence refs, основание и явно перечисленные
superseded решения. Старые решения остаются в history и предыдущих версиях.
Никаких расширений по строке, создания canonical roots, изменения aliases,
lexical heads, частот или методологических формул.

Пять классов: ADD_MEMBER, EXCLUDE_MEMBER, CORRECT_RELATION,
CORRECT_IDENTITY, CORRECT_FAMILY. Новые основы и спорные случаи не применяются.
Изменение family ID требует двух семейных областей: `question_id` задаётся
объектом `{source_family: source_question, target_family: target_question}`.
Обычная операция использует один question ID. При неудобном представлении
перенос оформляется двумя отдельно подтверждёнными конечными операциями.
Инфлекция не может создавать самостоятельного нового деривационного члена.

Каждая операция требует двух текущих совпадающих человеческих решений из
существующего [review ledger](../review/RUNBOOK.md), ролей reviewer и blind,
разных ключей и подписанных подтверждений **именно этой операции**. Обычный
ACCEPT_PROPOSED сам ничего не применяет. EXCLUDE_MEMBER дополнительно требует
явно подписанного подтверждения исключения: один REJECT кандидатуры недостаточен.
При расхождении сохраняется блокировка; после арбитража нужны новые согласованные
независимые подтверждения. Код не разрешает арбитру изображать двух разметчиков.

Проверки независимого verifier и подпись owner — разные действия. Owner разрешает
конкретный digest плана, checks, parent и внешний store. Число операций, семьи,
старые решения и полный diff находятся в `plan.summary` / `plan.operations`.
Все обязательные gates должны быть PASS. Качество дополнительно проверяется
по связанному файлу: gold > 0, thresholds_passed и semantic_application_allowed.
Одной выставленной строки PASS недостаточно.

Проверяются реальные bytes snapshot/source-lock/algorithm/controller/registry/
index/aux/project. `inputs.files` содержит для каждого `{path, sha256}`; первые
три SHA совпадают с соответствующими полями inputs. После изменения данных или
кода старое разрешение неприменимо. Локальный POSIX flock удерживается одновременно
для версии данных и журнала человеческих решений до завершения записи.

## Доверенная граница

Нужны Python 3.12+, Node, OpenSSL с Ed25519 и локальная файловая система с flock,
fsync и atomic rename. Объектные/FUSE mounts не поддерживаются. Внешние входы
неизменяемы на время выпуска. Classifier имеет доступ только на чтение к коду,
trust, public keys и store. Приватные ключи owner/verifier/reviewer находятся
на отдельных доверенных рабочих местах; не в Git, сервере очереди или клиенте.
Разные ключи — техническая защита от повтора, не доказательство независимости
самих людей: это обязанность владельца roster. Оператор, способный изменить код
или trust, находится внутри доверенной границы.

`trust.json` вне checkout: `{"principals":{"owner-id":{"role":"owner",
"public_key_pem":"..."},"verifier-id":{"role":"verifier","public_key_pem":"..."},
"reviewer-id":{"role":"reviewer","public_key_pem":"..."},
"blind-id":{"role":"blind","public_key_pem":"..."}}}`.
`revoked:true` запрещает ключ. Идентификаторы разметчиков псевдонимные.
Ключи создаёт владелец, например `openssl genpkey -algorithm ED25519 -out
/private/owner.key` с mode 0600; публичный ключ получают через `openssl pkey
-in /private/owner.key -pubout`. Ни один реальный ключ или approval в PR не включён.

## Подготовка и проверка

Из корня полного Git checkout с закреплённым v6 commit:

```sh
python3 associativvordes/release_control/inputs.py \
  --output /external/release07/INPUTS.json \
  --state-output /external/release07/BASELINE.json \
  --registry /external/mass02/registry/registry.sqlite
python3 associativvordes/release_control/control.py init \
  --state /external/release07/BASELINE.json --store /external/releases
python3 associativvordes/release_control/control.py preview \
  --state /external/release07/BASELINE.json --operations /external/operations.json \
  --inputs /external/current-inputs.json --verdicts /external/verdicts.json \
  --output /external/plan.json
```

`operations` — список конечных объектов с полями `id`, `kind`, `question_id`,
`candidate_id`, `before`, `after`, `evidence_refs`, `reason`, `supersedes`.
`before/after` — native membership records; расширять остальные поля при
исправлении типа связи нельзя. Неизвестные значения не заменяют нулём.
Подготовка не подписывает и не применяет. Пустой preview допустим для отчёта,
но не считается применимым выпуском.

`control.verdict_payload(operation, inputs)` создаёт точный запрос подтверждения.
`control.py sign --payload FILE --private-key KEY --signer ID --output TOKEN`
подписывает его только после явного запуска владельцем соответствующего ключа.
Вердикты кладутся в `verdicts[operation_id]` до окончательного digest плана.

`checks` содержит `plan`, `base`, `after` (SHA-256), `checks` с полным списком
gates из `evidence_gate`, `calculator_complete`, `quality_file`, `calculator_file`
и `evidence_files: {path: sha256}`. Verifier подписывает
`{schema, purpose:"verified-checks", checks: sha256(checks_without_attestation)}`.
Полученный envelope помещается в `checks.attestation`. Файлы качества и
калькулятора входят в evidence_files. Результаты tests/fixtures не являются gold.

## Калькулятор и влияние

```sh
python3 associativvordes/release_control/recordings.py \
  --state /external/release07/BASELINE.json --repo . \
  --destination /external/release07/recordings --receipt /external/release07/CAPTURE.json
node associativvordes/release_control/calculator.mjs \
  /external/before-recording.json /external/after-recording.json /external/comparison.json
```

Адаптер вызывает существующий `runAssociativeCalculation`, его ordering,
selection и итоговые формулы. Частотные строки принимаются только при совпадении
native source locator и исходного JSON.stringify hash. Семантические A/P не
генерируются: нужны реальные сохранённые анализы и их проверяемое происхождение.
Recording содержит `state_sha256`, input и languages с неизменёнными данными.
Проверяются top five, represented languages, model/head IDs, международность и
пропуски частот. Verifier проверяет полноту набора записей, отсутствие подмены
identity и реальную независимость моделей; совпадение source IDs её не доказывает.
Без полных наблюдений `complete=false`; применение блокируется. Сравнение
baseline с самим собой при нуле разрешённых операций не является оценкой
влияния одобренных изменений.

## Разрешение, запись, резервирование, откат

```sh
python3 associativvordes/release_control/workflow.py request-approval \
  --store /external/releases --plan /external/plan.json --checks /external/checks.json \
  --current-inputs /external/current-inputs.json --trust /private/trust.json \
  --review-ledger /external/review-ledger --output /external/owner-request.json
# Owner просматривает полный plan/checks и отдельно подписывает owner-request.
python3 associativvordes/release_control/control.py sign \
  --payload /external/owner-request.json --private-key /private/owner.key \
  --signer owner-id --output /external/owner-approval.json
python3 associativvordes/release_control/control.py apply \
  --store /external/releases --plan /external/plan.json --checks /external/checks.json \
  --current-inputs /external/current-inputs.json --trust /private/trust.json \
  --review-ledger /external/review-ledger --approval /external/owner-approval.json
python3 associativvordes/release_control/control.py audit \
  --store /external/releases --trust /private/trust.json
python3 associativvordes/release_control/control.py backup \
  --store /external/releases --output /backups/approved-release.zip
python3 associativvordes/release_control/control.py restore \
  --archive /backups/approved-release.zip --store /external/restored \
  --expected-sha256 BACKUP_SHA256
```

Сначала fsync новой версии с полным plan, signatures, прежним parent и архивом
проверок (до 128 MiB), затем единственный atomic CURRENT. Исключение до pointer
оставляет старую версию; orphan не считается утверждённым. Повтор после commit
возвращает тот же ID. Другая текущая версия вызывает CAS conflict. Предыдущая
версия — резервная копия; внешний checksummed ZIP дополнительно переносится в
независимое долговременное хранилище. Не храните единственную копию store в VM.

Откат требует отдельной owner подписи payload
`{schema,purpose:"approve-rollback",current,target,store}` и команды
`control.py rollback --store ... --target ... --expected-current ... --approval ...
--trust ...`. Target должен быть предком. Создаётся новая компенсирующая версия;
полная старая история сохраняется. Восстановление не переиспользует разрешение
на запись в другом store: последующие изменения требуют нового разрешения.

`graph_view.py --store ... --trust ... --destination ...` после отдельного аудита
строит новый изолированный граф существующим load_registry и конечными грантами.
Откат не воскресит отозванные гранты. Его receipt намеренно не выдаётся за
mass-registry/production receipt. Готовность материализатора production v5/v6
по этому графу **не установлена**; публикационный пакет не переключает runtime.

`workflow.py package --store ... --destination ... --approval ... --trust ...`
требует отдельной owner подписи
`{schema,purpose:"approve-publication-package",version,release,store}`.
Пакет содержит точный RELEASE, STATE и checksums, без человеческих транзакций
в публичной сводке. Это вход для отдельного PR. Слияние и production switch
не разрешаются этим envelope и командой не выполняются.

## Регулярный цикл

`workflow.py incremental --previous OLD --current NEW --dependencies DEPENDENCIES
--reviewed QUESTION_IDS --config CONFIG --output PLAN` принимает нормализованный
inventory по partition IDs (`revision`, `sha256`, `license_status=VERIFIED`,
`license_sha256`), полную карту partition → существующие family IDs и прежние
рассмотренные question IDs. Неизвестная зависимость или лицензия блокирует запуск.
При отсутствии изменений commands пуст. CONFIG задаёт index, registry, aux,
project, source-lock, output и prior-queue. PLAN содержит shell-free argv
существующего mass_run только с affected families, --changed-only и --prior-queue.
Он не запускает никакой процесс в фоне.

После проверенного обновления соответствующих source partitions выполняются
эти команды, существующий offline annotation pipeline и review handoff. Старый
Ledger сохраняется: изменившиеся рассмотренные вопросы — повторная проверка,
а не новые неизвестные вопросы. Затем новый preview, независимая оценка, checks,
owner approval, изолированная запись, аудит и отдельное разрешение публикации.
При изменении зависимостей строится новая карта; неполная карта не оправдывает
бесконтрольный полный пересчёт. Production integration требует отдельного
проверенного материализатора и одобренного выпуска.

## Испытания и текущая готовность

```sh
node --test tests/associative-release-control.test.mjs
npm test
npm run test:browser
```

Тесты явно TEST_ONLY и проверяют механизм, а не лингвистическое качество.
Фактические результаты, стоимость, ресурсные измерения и все блокеры —
[отчёт этапа 07](../../audit/associative-external-preparation/release07-control/REPORT.md).
Наличие этого модуля не означает допуска массовых семантических изменений.

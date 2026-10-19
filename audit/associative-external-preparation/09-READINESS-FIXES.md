# 09. Исправления готовности

Пользователь после независимого аудита запросил работоспособность системы. Отдельный этап исправлений, без merge, production, автоматического membership или изменения формул.

Промежуточный результат: четыре IV-001–004 исправлены. Независимый скрипт этапа 08 без изменения его ожиданий теперь даёт 35 PASS / 0 FAIL. Старые targeted suites также проходят. Добавлен обязательный Node regression wrapper для этих controls.

- Pilot matching использует exact source Lexeme ID + language + family, проверяет spelling/POS. Неизвестное соответствие project/source остаётся abstain; новый policy version 2.
- Reverse сохраняет scoped prior prohibitions и exact refs, фиксирует автоматический context hold в истории, переводит только open в deferred. Это не глобальный rejection слова и не ручной вердикт; прежние reviewed/rejected не стираются.
- Cross-language source assertions сохраняются, но исключены из продуктивных paths и не могут быть приняты как обычная derivation без отдельного borrowing/alignment analysis. Это действует и для старых snapshots.
- Многошаговые смешанные пути имеют mixed_morphological_path; indirect применяется только к directed direct-derivation chain.

Итоговая техническая проверка приведена ниже. Массовая/лингвистическая готовность не объявляется: остаются внешняя недоступность GLeMM и отсутствие ручного эталона.

## PH/mater

История `9d982a3` уже содержала нынешние PH v4 weights и одновременно ошибочное итоговое ожидание. Production-файлы метрики после этого не менялись. Независимый exhaustive oracle `tests/mater-reference.test.mjs` перебирает все выравнивания девяти вручную заданных IPA token sequences, самостоятельно вычисляет feature costs по зафиксированным весам/ranges, проверяет graphic scores и взвешенную сумму. Он не вызывает production distance/DP для построения ожидаемых затрат. Получено 60.515946719946726, а не 60.03928052899482. Исправлено только устаревшее тестовое ожидание, формулы/веса/результаты runtime не изменены. Methodology controls и missing-data controls проходят.

## Полные источники

Добавлены `importers/validate_sources.py` и отдельный branch-scoped workflow `verify-morphology-sources.yml`. Он проверяет все locked bytes, импортирует каждый partition, независимо аудирует каждую исходную строку, сравнивает counts и logical outputs с опубликованными manifests и строит каталог. Квитанции сохраняются после каждого partition и при ошибке. В артефакт попадают только отчёты, не raw corpora и не memberships. Runtime-specific build IDs не подменяют исходные pins.

Локальная среда ограничивает большие CNRS downloads примерно 5 KB/s; попытки с ограниченным временем сохраняются как ошибки, не PASS. Итог full-source gate определяется реальным результатом workflow, не фактом его добавления. Ручной gold, actual A/B и calculator captures не фабрикуются.

Первый full-source workflow реально запущен: run 39298111367. Он сохранил FAIL receipt: CNRS закрыл соединение до ответа Python urllib. Добавлен fallback на официальный GitLab API **того же commit/path**, с обязательными прежними size/SHA checks и явным User-Agent. Для HTTP-локатора доступна HTTPS-версия того же URL. Неправильные байты останавливают публикацию, версии/лицензии не меняются. Три новые acquisition-регрессии проходят (16 importer tests всего). Исправлена и переносимость temporary catalog plan: относительные locks вместо machine-specific абсолютных путей.

Source checks разделены на 13 независимых pinned partitions с fail-fast=false. Недоступность GLeMM не должна мешать проверять доступные UDer/MorphyNet. Каждый PASS явно ограничен partition; full_corpus_certified остаётся false до отдельной полной сборки/каталога. Это не замена отсутствующего источника и не ложный глобальный PASS.

CNRS закрыл оба Python HTTP/1 запроса и с GitHub runner (run 39298534586). Предусмотрен optional curl HTTP/2 transport к тем же официальным URLs с теми же pins. UA явно идентифицирует проект; TLS/проверки целостности не отключаются. Отдельная регрессия проверяет успешный exact-hash fallback и отказ неправильных байтов. Importer tests теперь 17. Глобальный PASS не объявляется до получения реальных квитанций.

## Итоговая проверка исправлений

Проверенный functional commit: `791e727ce8a40665879a834780f91ae0edcd258b` (дерево `be0246f97a85229d4f03d42f38ca89e0b9a57636`).

| Проверка | Результат | Подтверждение |
|---|---|---|
| Независимый аудит 08 с исходными ожиданиями | PASS: 35/35 | `fix09/INDEPENDENT-RECHECK.json` |
| Полный Tests CI | PASS | [run 39298959063](https://github.com/landquart/interal/actions/runs/39298959063) |
| Associative Verification, включая браузер | PASS | [run 39298959170](https://github.com/landquart/interal/actions/runs/39298959170) |
| PH/mater exhaustive oracle | PASS | `fix09/MATER-ORACLE.txt`, `tests/mater-reference.test.mjs` |
| Importer/acquisition unit tests | PASS: 17 | `fix09/IMPORTER-TESTS.txt` |
| Полные UDer и MorphyNet partitions | PASS: 7 partitions | [run 39298947197](https://github.com/landquart/interal/actions/runs/39298947197), `fix09/ci/` |
| GLeMM свежая загрузка | BLOCKED: 6 partitions | Тот же run; Python и curl получают закрытие соединения от официального сервера |

В GLeMM workflow conclusion — failure: это acquisition failure до импорта, а не доказательство ошибки парсера. Никакие отсутствующие записи не подменялись. Доступность mutable latest не используется как замена закреплённому commit.

| Partition | Прочитано | Принято | Изолировано |
|---|---:|---:|---:|
| UDer, 10 файлов | 1 175 804 | 1 175 804 | 0 |
| MorphyNet EN | 874 724 | 874 724 | 0 |
| MorphyNet DE | 519 712 | 519 712 | 0 |
| MorphyNet FR | 526 180 | 526 180 | 0 |
| MorphyNet ES | 1 320 101 | 1 320 077 | 24 |
| MorphyNet IT | 770 869 | 770 869 | 0 |
| MorphyNet RU | 1 414 063 | 1 414 063 | 0 |
| **Всего перепроверено** | **6 601 453** | **6 601 429** | **24** |

Проверены SHA/размеры входов, каждая физическая запись и исходные поля, исходные counts и опубликованные output hashes. Все семь build IDs совпали. Runtime: Python 3.12.3 / SQLite 3.45.1 / Unicode 15.0.0 / zlib 1.3. Измеренный peak RSS importer — 37 784–41 368 KiB; это не измерение памяти общего графа. Время независимого построчного аудита каждого partition — 4.315–30.326 s; не следует выдавать его за полный end-to-end импорт с загрузкой/индексацией. Свежая общая сборка каталога всех 13 partitions ещё не выполнена, поэтому `full_corpus_certified=false`. ZIP digests GitHub artifacts проверены при извлечении квитанций; IDs/digests сохранены в `fix09/FINAL-STATUS.json`. Подписанные временные download URLs не сохраняются.

`fix09/PROTECTED.json` сравнивает Git objects с началом исправлений. Формулы, runtime JS, production-конфигурация, реестры и частотные данные не изменены. Историческое заключение этапа 08 оставлено без переписывания: оно описывает состояние до исправлений.

## Что можно запускать и что остаётся

**GO для изолированного ручного пилота** на доступных проверенных данных, с явно проверенным соответствием lexical identity. Непривязанный source ID остаётся abstain; качество сопоставления нельзя доказывать отсутствием автоматического решения. Сбор разметки не меняет membership.

**NO-GO для массовой разметки и окончательного A–E сравнения.** Нужны: восстановление доступа/доверенный offline cache GLeMM того же commit и SHA; затем полная сборка каталога; реальные независимые human judgments с арбитражем; actual baseline/source predictions и calculator captures на одном frozen наборе. Полный CI не заменяет эти научные условия. HanTa/Flexor не получают новый GO из этих технических исправлений.

Для воспроизведения всех источников после восстановления доступа (из корня checkout, выходы вне него; каталог receipts должен быть новым):

```sh
/usr/bin/python3 associativvordes/importers/validate_sources.py \
  --raw-root /tmp/interal-raw \
  --output-root /tmp/interal-builds \
  --receipts /tmp/interal-receipts-release01 --fetch
```

Можно убрать `--fetch` и использовать локальный cache: все исходные size/SHA всё равно обязательны. Для отдельной проверки добавить, например, `--partition uder-v1.0.2` и новый receipts path. В репозиторий публикуются код и отчёты; raw corpora остаются отдельно. PR 669 опубликован как draft, merge и production switch не выполнялись.

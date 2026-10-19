# GLeMM: завершение полного повторного импорта

Дата: 2026-10-19 UTC. **PASS для всех шести закреплённых разделов GLeMM.** Получение данных, полный импорт, независимый построчный аудит и повторная сборка завершены. Сетевой блокер GLeMM из отчётов 10–11 снят для прямого официального HTTP и автономного кеша; исторические неудачные запуски не переписаны.

## Версия и источник

GLeMM 2.0, exact commit `395020177a96a81177582fb59664509ff015f934`. Все 12 оригинальных `pairs.tsv.bz2` / `defs.tsv.bz2` получены с официального `src.koda.cnrs.fr`, без смены версии, синтетических замен или сторонних копий. Полный размер: **32 292 210 bytes**. Каждый файл совпал с прежним доверенным lock по размеру и SHA-256; квитанция: `glemm13/ACQUISITION.json`. Итальянский defs получен первым отдельным официальным запросом и затем повторно проверен как cache. Частичные download-файлы не импортировались.

## Свежие измерения

Ниже фактически прочитанные записи каждого из двух полных запусков, не переписанные ожидания старых manifests. Заголовки исключены: 12 отдельно учтённых строк. Дубликаты исходных строк по контракту импортёра: 0; все исходные occurrences и provenance сохраняются. Нормализованные представления не считаются тождеством лексем; пересечение pairs/defs объединяет только представление отношения, сохраняя оба исходных свидетельства.

| Язык upstream | pairs | defs | Принято | Отклонено | Независимый replay |
|---|---:|---:|---:|---:|---|
| deu | 136248 | 42438 | 178686 | 0 | PASS |
| eng | 779170 | 271496 | 1050666 | 0 | PASS |
| esp | 70531 | 19548 | 90079 | 0 | PASS |
| fra | 271343 | 86526 | 357869 | 0 | PASS |
| ita | 121400 | 9569 | 130969 | 0 | PASS |
| rus | 732633 | 261713 | 994346 | 0 | PASS |
| Всего | 2111325 | 691290 | 2802615 | 0 | PASS |

Каждый раздел собран в двух разных свежих output roots. Независимый `audit_import.py` повторно прочитал каждый физический исходный ряд, сверил original bytes, original fields, provenance и counts, без использования parser adapter для независимого чтения. Все outputs, build IDs и SHA-256 manifests двух сборок совпали. В том числе воспроизведены исходные manifests этапа 03: exact published build для всех шести разделов. `glemm13/verification/` содержит исходные квитанции обоих запусков и сравнения; `COMPLETION.json` — сводку. Пустые quarantine/conflicts означают отсутствие выявленных технических конфликтов данного контракта, а не отсутствие лингвистических противоречий.

Среда: Python 3.12.3, SQLite 3.45.1, Unicode 15.0.0, zlib 1.3. Измеренные времена полного импорта вместе с аудитом, размеры выходов и process high-water RSS приведены в `COMPLETION.json`; RSS относится к процессу проверки, а не ко всему параллельному заданию. Проверка 23 importer/acquisition/cache/Git tests: PASS (`IMPORTER-TESTS.txt`). Это проверка реализации, отдельно от полного корпусного аудита.

## Безопасная интерпретация

`stem` и exponents остаются оригинальными шаблонами. Например, `ita/defs.tsv.bz2:2`: abbacchiare/V — abbacchiamento/N, stem `abbacchi`, exponents `^(.+)are$` / `^(.+)amento$`, definition `l'abbacchiare`. В импорте это morphological_relatedness с direction unknown, unresolved lexical identities, unreviewed и establishes_membership=false. Никакого lexical head из stem, направления из порядка колонок или ручного accepted решения не создаётся. Доступные definition2 и lemmatized_definition2 сохраняются; отсутствие значений в pairs не восполняется выдумками.

Возможная dataset-level зависимость от MorphyNet отмечена отдельно; exact row lineage остаётся неизвестной. GLeMM и MorphyNet не становятся независимыми голосами автоматически.

## Переносимый кеш

Создан `GLeMM-2.0-39502017.zip`: оригинальные 12 файлов плюс точный source-lock и upstream LICENSE/README/attribution. Кеш остаётся вне Git и сохранён для дальнейшего использования. `glemm13/CACHE.json` фиксирует размер и SHA-256. Pack выполнил встроенное восстановление во временный новый каталог; дополнительный restore в ещё один новый каталог снова проверил все 12 size/SHA. Независимая повторная упаковка полного корпуса дала тот же SHA-256 архива. Никакого сетевого запроса для импорта из восстановленной копии не требуется.

Upstream указывает CC-BY-4.0. Сохраняются оригинальные attribution и сведения о MorphyNet/Kaikki/GLAWI; упаковка не отменяет обязанностей исходных ресурсов. Полные корпуса в публичный репозиторий не добавлены.

Из корня checkout, с внешними абсолютными каталогами:

```sh
/usr/bin/python3 associativvordes/importers/glemm_cache.py restore \
  --archive /external/GLeMM-2.0-39502017.zip --raw-root /external/raw
for lang in deu eng esp fra ita rus; do
  /usr/bin/python3 associativvordes/importers/validate_sources.py \
    --partition "glemm-$lang-v1.0.2" --raw-root /external/raw \
    --output-root /external/builds-first --receipts "/external/receipts-first/$lang"
  /usr/bin/python3 associativvordes/importers/validate_sources.py \
    --partition "glemm-$lang-v1.0.2" --raw-root /external/raw \
    --output-root /external/builds-replay --receipts "/external/receipts-replay/$lang"
done
```

Для каждой новой проверки используются свежие receipts/output roots. Проверять равенство outputs, build_id и manifest_sha256, а не только успешный exit code или путь повторного использования готового build. Скрипты не меняют закреплённые версии и не публикуют membership.

## Оставшиеся границы

- Официальный Git из macOS CI всё ещё отвечает Empty reply from server: run 39305913110, attempt 2, job 118345703132. Импорт в том CI пропущен, не PASS. Локальные полные два импорта используют проверенные оригинальные raw bytes; транспортная ошибка другого способа загрузки не скрывается (`GIT-CI.json`).
- Проверена именно полная GLeMM-область. Совместный новый global catalog всех 35 файлов UDer/GLeMM/MorphyNet этим запуском не сертифицируется. partition receipts обоснованно сохраняют full_corpus_certified=false.
- Нет ручного gold и измеренного прироста качества членства. Полный импорт не доказывает корректность морфологии, этимологии или членства; NO-GO для автоматического принятия/массовой очистки остаётся.
- Все 14 защищённых Git objects совпадают с исходным audit base (`PROTECTED.json`): семьи, ручные данные, частоты, формулы и production wiring не изменены. Нового accepted membership, переключения v5/v6, merge или production deployment нет.

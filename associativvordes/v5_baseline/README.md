# Независимая сертификация статического production v5

Python 3.12+ и стандартная библиотека; SQLite с WAL/FULL, локальная файловая
система с atomic rename и fsync; полный Git checkout с закреплёнными commits.
Production-файлы и исторические решения читаются без изменения.

## Полный воспроизводимый цикл

Рабочая директория должна быть новой и находиться вне checkout. Требуется
несколько GiB для исходного снимка, двух SQLite-пересчётов, архива и восстановления.
Для изменяемых SQLite-файлов используйте локальный каталог без фоновой
синхронизации, например `/tmp`: в этой сессии синхронизируемый workspace
создавал дополнительные копии WAL и исчерпал диск. Это прерывание и успешное
возобновление отдельно отражены в отчётах; исходные данные не менялись.

```sh
python3 associativvordes/v5_baseline/certify.py \
  --repo /absolute/checkout \
  --commit 47723611112610945cb09b34e18588b7bd151911 \
  --work /external/new-v5-baseline
```

Capture извлекает production из закреплённого Git commit; исходные carriers —
из первой полной Git-материализации `ee6637b266f4bbb4acd77cccf597ed75b2b44aef`;
код генерации — из `3d71828f9bfa7ce6ea5f1814442a6604cb180c96`.
Это три различные версии. Новая процедура не реконструирует исходные assignments
из удалённых/ложных связей и не приписывает историческим carriers их provenance.
Отсутствие оригинальных assignments остаётся блокером независимо от совпадения чисел.

## Возобновление census

```sh
python3 associativvordes/v5_baseline/census.py census \
  --snapshot /external/new-v5-baseline/snapshot \
  --work /external/new-v5-baseline/run
```

Каждый bucket — одна транзакция вместе с checkpoint. При прерывании незавершённый
bucket откатывается. На повторном запуске заново проверяются SHA-256 файлов,
закреплённых в receipts завершённых buckets; изменение input/code запрещает
использование прежних checkpoints. `--crash-after 2` намеренно завершает процесс
с кодом 75 внутри второй транзакции. `--stop-after N` — штатный короткий прогон.

Парсер постепенно читает top-level JSON object из gzip. В памяти остаётся один
JSON value, текущие family metadata и агрегаты одного bucket; глобальные ID и
алиасы находятся в SQLite. Duplicate top-level keys не теряются при JSON.parse.
Пропуски и повреждения журналируются; неверная checksum входа прерывает запуск.
Ни ошибочные связи, ни unassigned леммы не исправляются.

`FULL-CENSUS.json` получает фактические множества исходных и материализованных
лексем; unassigned — реальный SQL anti-join, а не разность чисел из manifest.
`UNASSIGNED-LEMMAS.jsonl.gz` содержит конечный список. `ISSUES.jsonl.gz` — полный
журнал дефектов. Файлы и большая SQLite-база остаются вне Git.

## Реальное восстановление

```sh
python3 associativvordes/v5_baseline/census.py restore \
  --archive /external/baseline.tar \
  --destination /external/restored-new-directory \
  --sha256 EXPECTED_ARCHIVE_SHA256
python3 /external/restored-new-directory/tool/census.py census \
  --snapshot /external/restored-new-directory \
  --work /external/restored-recount
```

Restore проверяет hash архива до распаковки, запрещает traversal, symlink,
необычные/повторные элементы и перезапись существующей директории. Файлы сначала
пишутся под временными именами, затем проверяются по полному inventory, и только
после этого каталог получает окончательное имя. Архив нельзя считать единственной
копией, пока он находится только в scratch: его и receipt нужно отдельно сохранить.

Если архив разбит на части: проверить SHA-256/размер каждой части по PARTS.json,
соединить **в указанном manifest порядке**, затем проверить SHA-256 полного tar.
Сохранённые имена и hashes опубликованного baseline — в BACKUP-RESTORE-REPORT.json.

## Тесты и область утверждений

```sh
python3 -m unittest discover -s associativvordes/v5_baseline -p 'test_*.py' -v
node tests/associative-v5-baseline.test.mjs
```

Структурная целостность не является лингвистической сертификацией memberships.
У v5 отсутствует отдельный head registry v6; head-проверки v6 ему не приписываются.
`reverse_only_alias_pairs` подсчитывается отдельно: направленная маршрутизация
алиасов не означает равенства двух множеств. Нет автоматического снятия старых
отрицательных решений, изменения формул, production switch или массовой очистки.

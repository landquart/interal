# Prompt 16 — фактическая доступность источников и холодное восстановление

**Результат: доступные архивы сертифицированы по байтам; вся первоначальная генерация и массовый выпуск остаются BLOCKED.**

Проверен source snapshot `78f73c0b4e151088c5ce2e7daab6dcd4472de52e` (исследовательский implementation PR698). Наблюдённый main: `1a28f5235f3b99bf227013b9ba25c031008df2a4`. Новые наблюдения сделаны 25.10.2026; точное UTC-время есть в JSON. Проверки из прежней очищенной рабочей среды не выданы за сохранившиеся журналы: необходимые архивы заново получены после очистки, результаты этого запуска сохранены рядом.

## Что проверено сейчас

- Все **69 сохранённых частей, 11 904 093 107 bytes**, повторно получены из постоянных owner-authenticated Library-записей. Идентификаторы, имена, размеры и SHA-256 находятся в `plans/` и `ARTIFACT-INVENTORY.json`. Это доступ при авторизации владельца, не анонимная публичная раздача.
- Из частей собраны **14 архивов** без подмены pinned bytes. Проверены их полные SHA-256, ZIP CRC/чтение tar, нормализованные имена, отсутствие symlink/hardlink и повторяющихся файлов.
- **15 607 файлов, 33 641 847 278 bytes** физически восстановлены и повторно хешированы. Проверены **128 экземпляров SQLite-баз, 110 уникальных содержимых**, `PRAGMA integrity_check = ok`.
- Baseline: **4 307 файлов**, включая **2 048 current и 2 048 original gzip-шардов**, manifests, aliases, инструменты и служебный snapshot. Исторические materialized carriers не названы original assignments.
- Архив источников: все **35** закреплённых морфологических артефактов сверены по individual source-lock hashes. Исторический архив: **2 578 Git source blobs + 2 файла реестра**. Сверены и SHA-256 файлов, и Git blob SHA-1 для content-addressed исторических объектов.
- Frozen packets/quality, surface, morphology, semantic, family-boundary, dry-run и финальные research-replays проверены в пределах содержимого сохранённых архивов. Исходный GitHub annotation artifact `10603949468` заново скачан; 2 808 130 bytes и SHA-256 `0e19c9d40961da7be037a63156576db0d8a5093c2e61134b6c10bb3c7dc593f8` совпадают.

Архивы stages 00–13 не выдуманы по названиям: каталог описывает существующие контейнеры и их точные members. Отдельного архива для каждого номера этапа не найдено/не предположено. Stage13 metadata/package и связанные locks сохранены в Git и в архивном каталоге исходников; контроль происхождения не означает разрешения data release.

## Способ холодного восстановления и его пределы

Каждый архив проверяется из новых скачанных частей в **новом пустом каталоге**, без чтения старой research database из исходного рабочего окружения. Каждый member записывается в отдельный физический временный файл, fsync, повторно хешируется и проверяется; SQLite открывается read-only/immutable. Затем удаляется только этот точно созданный временный файл. Этот последовательный способ ограничивает диск и не является одновременным разворачиванием всех 33,6 ГБ.

Первая попытка восстановления `diagnostic-final.zip` остановилась с ENOSPC. После освобождения только собственных уже проверенных копий скачанных архивов новая попытка в другом пустом каталоге завершилась. Старый interrupted directory не переиспользован как завершённый checkpoint.

Восемь adversarial-тестов нового verifier проходят: seek через части, реальный SQLite, traversal, нормализованные дубликаты, неверный part hash, непустой restore directory отсутствующий locked member и запрет восстановления/записи receipt внутри source checkout. Заново прошёл инженерный TEST_ONLY end-to-end `v5 → adapter → evidence → candidates → review → decision → quality → preview → BLOCKED release gate`. Точный журнал и receipt — `evidence/KEY-REPLAY*`. Это fixture-проверка, не новое human gold и не полный production-corpus replay. Полная production pipeline в одновременно развёрнутом холодном окружении **не выполнялась**.

## Upstream и доступная история

Прямой URL-probe: 13 MorphyNet файлов совпали; 12 GLeMM URL вернули HTTP 503. Для UDer source-lock фиксирует member общего `UDer-1.1.tgz`, а не весь HTTP response: контейнер SHA-256 `980ec9f8fb1b707d6681b3406e8f7527d2c3174ac7c3d4e4852b8193e450316a` и все 10 pinned members совпали. Поэтому 10 первоначальных `HASH_MISMATCH` в низкоуровневом URL-probe — сравнение контейнера с member, **не доказательство изменения UDer**. Каноническое исправленное наблюдение — `evidence/UDER-CONTAINER-RETRIEVAL.json`. Итого upstream даёт 23 точных источника; все 35 доступны через проверенную сохранённую копию.

Получены все доступные branch refs и их reachable history: **3 074 commit, 31 339 Git object entries**. У promisor clone остаются **11 792** неполученных blob-объекта; имена доступны, но их локальные bytes не названы проверенными. Из 2 578 исторических source blobs 717 присутствуют также в полученной Git object database. Поиск по именам не обнаружил original assignments/Kaikki; это ограниченное отрицательное наблюдение, не доказательство отсутствия любых возможных внешних backup.

Важное уточнение к старому baseline: commit генерации `3d71828f9bfa7ce6ea5f1814442a6604cb180c96` доступен через GitHub, его полный tree прочитан без truncation; historical scripts/workflows получены отдельным архивом. Прежнее «не находится в обычном checkout» не означает «удалён с GitHub». Доступность кода не восстанавливает отсутствующие inputs.

GitHub artifacts `10665305365`, `10665150741`, `10550262690` снова дали 404. Run `35461412225` перечисляет только input-lock artifact, не assignments/members. Старый Kaikki URL изменяемый: текущая выгрузка не заменяет исторический snapshot с SHA-256 `42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9`.

## Лицензии и резервные копии

`LICENSE-AUDIT.json` связывает 35 source artifacts с сохранёнными текстами лицензий и их SHA-256. UDer включает NC, SA, Apache-2.0 и OSL-1.1; GLeMM декларирует CC-BY-4.0, MorphyNet — CC-BY-SA-3.0. GLeMM/MorphyNet lineage overlap не превращается в независимые голоса. Это аудит сохранённых деклараций; отсутствие per-source license manifest первоначального v5 остаётся блокером публичного/коммерческого data release. CELEX payloads не включены: имеются только документы лицензирования/гармонизации.

Для raw morphology ZIP создана независимая private Drive-копия: https://drive.google.com/file/d/1MQKFEfVF80VNuDZa_Kk9FkIFe8ySVeK0/view . Повторное скачивание из Drive совпало по полному SHA-256. В permissions наблюдён только user owner; personal email не включён в отчёт.

**Независимый backup всех крупных research archives не установлен.** Попытка upload истории 444 874 943 bytes отклонена до изменения Drive с HTTP 413: предел маршрута 104 857 600 bytes. Эта попытка не названа сохранённой копией. Разбиение на части меньше 100 МиБ и byte-verified повторное скачивание из второго хранилища — точное условие снятия блокера. Дубли в той же Library не названы независимым storage provider.

В Git публикуются инструменты, hashes, manifests и отчёты. Большие данные, private keys, секреты, transfer tokens, подписанные download URLs и персональные сведения в новые публичные архивы не включены. Private recovery capsule хранит исходники/нормативные документы/locks, не даёт дополнительных прав на исходные корпуса.

## Невосстановимые пока источники и последствия

`PROVENANCE-GAPS.json` сохраняет точные ограничения. По доступным словарям/UDer/GLeMM/MorphyNet можно заново проверить **конкретную** связь с language, native lemma/lexeme, POS, sense, relation type, source revision, exact locator/hash и областью решения. Новая запись должна иметь происхождение `NEW_INDEPENDENT_ATTESTATION` и собственную проверку.

Такая проверка не восстанавливает original assignment, прежний candidate universe, frequency, историческую полноту, первоначальную лицензионную lineage или recall. При омонимии, неизвестном sense, недокументированном пути либо конфликте разных оснований связь остаётся UNRESOLVED. Отсутствие записи в неполном источнике не является основанием для удаления.

358 historical scope/authority conflicts, независимый human gold/holdout, exact approvals и materializer/rollback не исправляются скачиванием архивов. Массовые необратимые изменения на основании утраченного provenance остаются запрещёнными. Этот отчёт не снимает release gates.

## Сохранение инструментария и метаданных

SOURCE-CAPSULE.json фиксирует отдельный private archive исходников/нормативных файлов, всех 139 inventoried manifests/source locks/license files, планов и snapshot отчётов до добавления собственных locators. Независимая Drive-копия заново скачана и сверена по полному SHA-256 и по каждому из 139 metadata hashes. Это резервная копия метаданных и кода, не недостающий independent backup 11,9 ГБ исследовательских архивов.

Дополнительные nested проверки в evidence/NESTED-*.json: исходный annotation kit (7 файлов), annotation-backup (339 файлов) и внутренний MorphyNet ZIP (1 файл). В них нет дополнительных SQLite. ARTIFACT-INVENTORY.json содержит отдельные nested descriptors и member hashes; основные 15 607 файлов относятся к 14 исходным внешним архивам.

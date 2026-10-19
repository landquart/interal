# 09. Исправления готовности

Пользователь после независимого аудита запросил работоспособность системы. Отдельный этап исправлений, без merge, production, автоматического membership или изменения формул.

Промежуточный результат: четыре IV-001–004 исправлены. Независимый скрипт этапа 08 без изменения его ожиданий теперь даёт 35 PASS / 0 FAIL. Старые targeted suites также проходят. Добавлен обязательный Node regression wrapper для этих controls.

- Pilot matching использует exact source Lexeme ID + language + family, проверяет spelling/POS. Неизвестное соответствие project/source остаётся abstain; новый policy version 2.
- Reverse сохраняет scoped prior prohibitions и exact refs, фиксирует автоматический context hold в истории, переводит только open в deferred. Это не глобальный rejection слова и не ручной вердикт; прежние reviewed/rejected не стираются.
- Cross-language source assertions сохраняются, но исключены из продуктивных paths и не могут быть приняты как обычная derivation без отдельного borrowing/alignment analysis. Это действует и для старых snapshots.
- Многошаговые смешанные пути имеют mixed_morphological_path; indirect применяется только к directed direct-derivation chain.

Проверка PH/mater, восстановление полных источников и итоговая повторная верификация продолжаются. Этот checkpoint не объявляет массовую/лингвистическую готовность.

## PH/mater

История `9d982a3` уже содержала нынешние PH v4 weights и одновременно ошибочное итоговое ожидание. Production-файлы метрики после этого не менялись. Независимый exhaustive oracle `tests/mater-reference.test.mjs` перебирает все выравнивания девяти вручную заданных IPA token sequences, самостоятельно вычисляет feature costs по зафиксированным весам/ranges, проверяет graphic scores и взвешенную сумму. Он не вызывает production distance/DP для построения ожидаемых затрат. Получено 60.515946719946726, а не 60.03928052899482. Исправлено только устаревшее тестовое ожидание, формулы/веса/результаты runtime не изменены. Methodology controls и missing-data controls проходят.

## Полные источники

Добавлены `importers/validate_sources.py` и отдельный branch-scoped workflow `verify-morphology-sources.yml`. Он проверяет все locked bytes, импортирует каждый partition, независимо аудирует каждую исходную строку, сравнивает counts и logical outputs с опубликованными manifests и строит каталог. Квитанции сохраняются после каждого partition и при ошибке. В артефакт попадают только отчёты, не raw corpora и не memberships. Runtime-specific build IDs не подменяют исходные pins.

Локальная среда ограничивает большие CNRS downloads примерно 5 KB/s; попытки с ограниченным временем сохраняются как ошибки, не PASS. Итог full-source gate определяется реальным результатом workflow, не фактом его добавления. Ручной gold, actual A/B и calculator captures не фабрикуются.

Первый full-source workflow реально запущен: run 39298111367. Он сохранил FAIL receipt: CNRS закрыл соединение до ответа Python urllib. Добавлен fallback на официальный GitLab API **того же commit/path**, с обязательными прежними size/SHA checks и явным User-Agent. Для HTTP-локатора доступна HTTPS-версия того же URL. Неправильные байты останавливают публикацию, версии/лицензии не меняются. Три новые acquisition-регрессии проходят (16 importer tests всего). Исправлена и переносимость temporary catalog plan: относительные locks вместо machine-specific абсолютных путей.

Source checks разделены на 13 независимых pinned partitions с fail-fast=false. Недоступность GLeMM не должна мешать проверять доступные UDer/MorphyNet. Каждый PASS явно ограничен partition; full_corpus_certified остаётся false до отдельной полной сборки/каталога. Это не замена отсутствующего источника и не ложный глобальный PASS.

CNRS закрыл оба Python HTTP/1 запроса и с GitHub runner (run 39298534586). Предусмотрен optional curl HTTP/2 transport к тем же официальным URLs с теми же pins. UA явно идентифицирует проект; TLS/проверки целостности не отключаются. Отдельная регрессия проверяет успешный exact-hash fallback и отказ неправильных байтов. Importer tests теперь 17. Глобальный PASS не объявляется до получения реальных квитанций.

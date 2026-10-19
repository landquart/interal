# 09. Исправления готовности

Пользователь после независимого аудита запросил работоспособность системы. Отдельный этап исправлений, без merge, production, автоматического membership или изменения формул.

Промежуточный результат: четыре IV-001–004 исправлены. Независимый скрипт этапа 08 без изменения его ожиданий теперь даёт 35 PASS / 0 FAIL. Старые targeted suites также проходят. Добавлен обязательный Node regression wrapper для этих controls.

- Pilot matching использует exact source Lexeme ID + language + family, проверяет spelling/POS. Неизвестное соответствие project/source остаётся abstain; новый policy version 2.
- Reverse сохраняет scoped prior prohibitions и exact refs, фиксирует автоматический context hold в истории, переводит только open в deferred. Это не глобальный rejection слова и не ручной вердикт; прежние reviewed/rejected не стираются.
- Cross-language source assertions сохраняются, но исключены из продуктивных paths и не могут быть приняты как обычная derivation без отдельного borrowing/alignment analysis. Это действует и для старых snapshots.
- Многошаговые смешанные пути имеют mixed_morphological_path; indirect применяется только к directed direct-derivation chain.

Проверка PH/mater, восстановление полных источников и итоговая повторная верификация продолжаются. Этот checkpoint не объявляет массовую/лингвистическую готовность.

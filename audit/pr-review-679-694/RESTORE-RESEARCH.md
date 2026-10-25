# Восстановление исследовательских архивов

Старые locators и проверки: ARCHIVE-AVAILABILITY.json. Новые полные outputs: NEW-RESEARCH-ARCHIVES.json. Доступ authenticated owner-only. Для каждого архива скачать все parts, проверить bytes/SHA256 каждого тома, соединить строго в порядке parts и сверить SHA256 целого архива.

Diagnostic archive:

```bash
python3 associativvordes/v5_diagnostics/tools/backup.py --restore-archive /absolute/diagnostic-final.zip --expected-sha256 3b8f61690fcb48a21325878685f3dd7c4920e645233ef083955ebd28fd61774a --restore-target /absolute/fresh-directory --receipt /absolute/restore-receipt.json
```

Нужны новый destination и место для9 639 982 982 распакованных bytes. DIAGNOSTIC-COLD-RESTORE.json содержит квитанцию реального полного восстановления окончательным кодом, индивидуальных file hashes и SQLite quick_check. Исходный native replay отдельно закреплён INDEPENDENT-ENDING-AND-PRIORITY.json. Восстановленная копия сохраняет старые execution identity/output path и не является новым независимым run.

В research-replays-final.zip сохранены surface, morphology v1/v2, два final quality packets/evaluations, external row index, independently reconstructed profiles и diagnostic affected IDs. INVENTORY.json закрепляет каждый файл. Перед распаковкой запретить absolute paths, '..', ссылки и duplicate names. В новом каталоге проверить точное множество путей, bytes и SHA256 каждого файла. ARCHIVE-RECOVERY-PROOF.json фиксирует фактическое восстановление всех1978 файлов; каждый индивидуальный hash проверен.

Оригинальный baseline состоит из6 частей. Оригинальный history archive закреплён audit/associative-history-registry/SOURCE-ARCHIVE.json; все2578 объектов повторно проверены по snapshot. Для native sampling proof выполнить из корня репозитория `PYTHONPATH=. python3 audit/pr-review-679-694/verify_native_quality.py`; скрипт ожидает восстановленные quality-final/replay/evaluation outputs в `/tmp/interal-audit-work` и читает все256 native production buckets. Он ничего не записывает в production.

Архивные identities не обходят нынешние code/source guards. После изменения соответствующего исполняемого кода требуется новая проверка. Старые stage12/13 release receipts не являются разрешением нового выпуска. Human gold отсутствует, nonempty release BLOCKED.

# Production v5: контролируемая проверка готовности

Это read-only дополнение к `release_control/` из объединённого PR №678.
Оно повторно использует canonical SHA-256, atomic/fsync writes и ограничение
внешнего store. Исходный release controller и его требования к независимым
reviewer/blind verdicts, verifier и owner signatures не изменяются.

Текущий результат — **BLOCKED_NO_RELEASE_CANDIDATE**. Это пакет причин отказа,
не готовый к утверждению выпуск. Нет непустого v5 materializer, staging данных,
promotion, новой owner подписи или data PR. Ни одна команда не пишет production,
не генерирует ключи и не выдаёт автоматические approvals.

## Воспроизведение

Из полного checkout ветки с этапами 00–12 и completion patch №693:

```sh
python3 -m associativvordes.v5_release_control.package prepare \
  --repo . \
  --observations audit/associative-v5-controlled-release/REMOTE-OBSERVATIONS.json \
  --destination /external/fresh-v5-readiness
python3 -m associativvordes.v5_release_control.package verify \
  --package /external/fresh-v5-readiness
node associativvordes/v5_release_control/verify.mjs \
  /external/fresh-v5-readiness .
python3 -m associativvordes.v5_release_control.package replay \
  --repo . --package /external/fresh-v5-readiness \
  --destination /external/independent-v5-readiness
python3 -m associativvordes.v5_release_control.package check-application \
  --package /external/fresh-v5-readiness
```

Последняя команда обязана завершиться отказом. Успех prepare/verify/replay
означает целостность **пакета отказа**, а не PASS очистки. Повторение использует
сохранённое наблюдение GitHub и не делает нового network read. Для новой оценки
сначала получить актуальные main ref, v5 subtree и состояния PR через доверенный
GitHub reader; заменить observation с новой датой. При изменении исходных
артефактов нужен новый reviewable INPUTS.json и новый пакет. Наблюдение point-in-time
не заменяет production CAS непосредственно перед будущим применением.

INPUTS.json закрепляет точные bytes/SHA всех небольших отчётов и восьми текущих
proposed manifests; NDJSON читается последовательно. Отсутствующие, повреждённые
или устаревшие входы не превращаются в нулевые значения. SOURCE-LOCK сохраняет
происхождение, хеши и расхождение текущего кода с реально исполненным dry-run.
PACKAGE-INDEX проверяет каждый выходной файл и запрещает лишние/недостающие файлы.
replay заново строит пакет из источников и сравнивает все bytes. Хеши не являются
подписями и не доказывают независимость людей.

Node verifier независимо от Python повторяет byte/inventory/source/code проверки.
Он проверяет только небольшие артефакты пакета; это не full-corpus recount,
лингвистическая экспертиза или signed verifier attestation.

## Что необходимо до настоящего выпуска

1. Полные история, provenance, применимые scoped negatives и национальные
   соответствия; разрешение конфликтов по evidence и authority.
2. Независимый human gold и holdout, фактические строгие v5/v6 quality gates.
3. Точные finite before/after operations и current signed verdicts существующего
   controller; пустой план не считается выпуском.
4. Отдельный full-v5 materializer: streaming buckets, disk indices, exact
   source lemma preservation, aliases/counts, bounded staging, atomic publish,
   checkpoints/SIGKILL, независимый непустой replay, backup/rollback.
5. Реальный полный patched dry-run этого exact scope, шесть языков, runtime,
   browser и calculator regressions без искусственных семантических inputs.
6. Подписанные verifier checks и owner authorization для digest плана, checks,
   parent/store; отдельное разрешение publication package по текущему controller.
   Его approval не разрешает production switch. Нужен отдельный проверенный
   контракт v5 promotion, fresh HEAD/CAS и итоговый аудит реальных bytes.

До выполнения этих пунктов невозможно выпустить очищенные данные. Не создаётся
пустой Data release PR и не переиспользуется OWNER_ACCEPTED_AT_RISK. Старые
журналы, baseline receipts и methodology calculations сохраняются без изменений.

```sh
node --test tests/associative-v5-release-readiness.test.mjs
```

Engineering tests не являются gold. Результаты текущего этапа находятся в
`audit/associative-v5-controlled-release/package/FINAL-CLEANUP-AUDIT.md`.

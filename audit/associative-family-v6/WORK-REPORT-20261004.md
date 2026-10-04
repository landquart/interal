# Промпт 02 — итоговая локальная validation, 04.10.2026

Лингвистический, implementation и локальный validation блок выполнен. Публикация и CI нового SHA заблокированы автоматической проверкой разрешений; удалённый PR пока не содержит эти изменения. Завершение этого блока не означает завершения словаря.

Исходный актуальный SHA: `08a5ce1e6453c0d3a2ccad08b8dd5ee92b774c75`. Итоговое применение: `e4f515202d585bd87c131875145e492b137b5d50`. Цепочка main → #650 → #651 → #652 сохранена; merge не выполнялся, production остаётся v5.

## Решения

Membership явно относится к агрегированной lexical row либо её доказанному компоненту, а не к каждому употреблению. Политика сохраняет POS uncertainty, различает полисемию, доказанные разные истории и только гипотетическое имя. Отдельный frequency status — `aggregate_only_not_sense_frequency`: ни одна частота значения не выдумана.

| Объект | Итог |
|---|---|
| anis | Шесть индивидуально принятых реальных IDs: en anise, de/fr anis, es anís, it anice, ru анис. Canonical anis отдельно одобрен для finite promotion. Яблочное значение имеет отдельное доказательство связи через аромат. |
| anice / anic | Anice — whole lexical form (`lexical_branch_realization`), без продуктивного s↔c. Anic — отдельно типизированный research-only derivational stem для словарного anicino; новых corpus IDs или memberships этой ветви нет. |
| botanical anis / scientific aniso | Раздельные истории и frame; научный компонент «неравный» не импортируется в botanical family. Спекулятивная глубокая этимология из дополнительного источника не принята. |
| turr | Canonical boundary остаётся research-only по конкретной парадигме turris/turrim/turrem/turri/turre/turres. Семь core IDs получили индивидуальные blockers, zero promotion. |
| es torre | Существительное от turris и документированная форма torrar от torrere. Общий доказанный tower component отсутствует; нужен проверяемый source partition или producer annotation. |
| it torre | Существительное от turris и документированный инфинитив togliere/torre от tollere. Литературная редкость не устраняет разные histories. |
| fr tour / ru тура | Разные подтверждённые лексические истории; частое значение не заменяет partition. |
| en tower / de Turm / en turret | Сохранена словарная история; ancestry сама по себе не доказывает современную узнаваемую национальную реализацию turr. Нужны отдельные finite correspondence и controls. |
| system / it sistema | Все 12 memberships через семь heads сохранены. У noun sistema и формы sistemare независимо доказан общий sistem component; это отличается от разных histories обеих torre. |

Полная таблица **25 core IDs** находится в `PROMPT02-ROW-TABLE-20261004.md`, machine-readable решения — в `prompt02-row-decisions-20261004.json`. Сохранённые шесть anis IDs, 18 frequency scans, источники и их locks переиспользованы; базовая словарная работа не повторена. Теоретические имена не объявлены наблюдаемым загрязнением.

Canonical, head, branch stem, inflection и alias имеют независимые роли. Исходные 17 catalog decisions проверены; их canonicals и реализации не изменены. Ни один realization type сам по себе не даёт membership. Ped/pede, creat/cre, observ/osserv, loc/lok/лок, nat/naive, system/состав и botanical/scientific anis controls прошли. Размер настоящей семьи не ограничивался.

## Exact differential и проверки

| Показатель | До блока | После |
|---|---:|---:|
| Catalog families | 17 | 18 |
| Accepted memberships | 21 548 | 21 554 |
| Lexical heads | 210 | 216 |
| Legacy exact units | 18 857 | 18 857 |
| Known active queue records | 23 240 | 23 240 |

**+6 anis; −0 относительно исходного SHA; unexpected differential = 0.** Все прежние 21 548 membership objects идентичны. Сохранены 19 967 baseline memberships, 1 569 earlier reviewed additions и 12 system additions. V5, частотные данные и исторический v5 audit имеют те же Git trees, что исходный SHA и architecture source `22e6293f`. Исходные IDs, частоты и evidence не изменены.

Прошли 35 targeted tests без failures/skips; весь `npm test` — 128 test files; независимый v6 audit — pass, 2 456 540 объектов и 2 489 input locks; deterministic replay всех 273 generated artifacts побайтово идентичен; repeated decision preparation также идентична; `git diff --check` — pass. Полный suite завершён после установки отсутствовавшей зависимости по существующему lockfile. Production calculator не менялся. Logs, hashes, integrity и exact differential сохранены в `prompt02-validation-20261004/`.

## Отдельные этапы и ограничения

Research: `e5b7f38`; initial decisions: `d94f1b5`; дополнительные источники об омонимах torre: `eed2677`; пересмотр решений: `454dc58` и `700087d`; итоговое применение: `e4f515202d585bd87c131875145e492b137b5d50`. Промежуточный локальный `221eafb` с двумя provisional torre admissions superseded и **не опубликован**. Не повторять его применение. Validation сохранена отдельным следующим коммитом.

Для anis нет blanket verdict по 801 identities, для tower — по 1 083. Не включён ни один целый source container; turr dossier явно unauthorized. Другие 795 anis IDs не promoted этим блоком. Known queues, historical unadjudicated 46 390 и global candidate packets 16 055 остаются отдельной незавершённой работой.

Следующие лингвистические этапы: provenanced partitions для tour/тура/обеих torre либо доказанные ограничения producer annotations; индивидуальная современная formal realization для tower/Turm/turret; реальные finite corpus records для anicino и остальных anis derivatives. Контекст не требуется для каждой однозначной lexical row, но нужен разделяющий evidence для доказанной омонимии.

Два push были отклонены automatic approval review: требуется явное разрешение пользователя на внешнюю публикацию новых audit/decision/code файлов. Проверки публичности repository, наличия push access и происхождения IDs не сняли отказ. Обход не выполнялся. После разрешения остаётся опубликовать текущую ветку существующего PR #652 и проверить Tests/Audit на **точном новом SHA**; локальные проверки не выданы за remote CI.

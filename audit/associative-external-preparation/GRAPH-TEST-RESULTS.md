# Проверки графа

Повторно выполнены после восстановления рабочей среды: **18 Python tests проходят**, оба Node wrapper запуска проходят (2 Node tests; внутри также 13 importer tests этапа 03). [UNIT-TESTS.txt](graph-validation/UNIT-TESTS.txt), [NODE-TESTS.txt](graph-validation/NODE-TESTS.txt).

Тестовые реальные fixtures содержат 70 исходных строк — по две из всех 35 официальных artifacts, все пять форматов. Отдельно используется конечная проекция настоящих v6/v5 objects с original file hashes. Искусственные записи есть только в adversarial controls, явно test-only.

Проверены:

- Exact source revision/locator/raw bytes и повторный stage-03 parse; подмена normalized claim отклоняется.
- Реальные current corrections; alias/fallback/path не восстанавливают historical acceptance.
- Manual prohibition выше concurrent permission; неавторизованный marker не даёт grant.
- Омонимы с одинаковой строкой не соединяют путь.
- Finite paths сохраняют intermediates/evidence/directions/sources; циклы и budgets ограничены.
- Unknown direction не восстанавливается по порядку полей.
- Inflection создаёт form value object, не derivational lexical bridge.
- Review domain/grant/exact sense scope; relation acceptance не даёт membership.
- Indirect review требует полной принятой direct chain и exact intermediates.
- Конкурирующие reviews дают hold, не latest-wins.
- Same id/revision conflict сохраняет обе версии; stale predecessor отвергается.
- Типы отношений не сливаются; formal similarity — retrieval-only.
- POS conflict/unknown не превращается в reviewed alignment.
- Input lock mismatch, missing input, повреждённый cached output и output внутри checkout отклоняются.
- Экспорт повторно открывается с manifest/output checksum checks и без корпусов.
- Две независимые свежие сборки малых реальных fixtures побайтово совпадают.

## Полная ограниченная проба

Две дополнительные свежие сборки **всех 6940 выбранных записей** дали одинаковый manifest и все data outputs. Это не cache-only проверка и не повторная полная графовая обработка всех 9,4 млн строк. [REPLAY.json](graph-validation/REPLAY.json).

Build ID `5527705c4a33d1b7f892cd0bc43337be5f6d34d8cca8ba4a4587bd6cfbf59a5a`. 11 018 Lexeme, 6775 Relation, 8297 candidate alignments, 10 competing-direction ReviewTask. Новых принятых external Verdict/canonical roots/membership — 0. 7 source claims имеют endpoint за границей конечной пробы; все original observations сохранены.

[PILOT-RESULTS.json.gz](graph-validation/PILOT-RESULTS.json.gz) сохраняет 210 пробных путей, классификации и negative probes всех семи основ. Reopened CREAT/creel — blocked; OCUL/ocular — source matches, establishes_membership=false. [QUERY-NEGATIVE.json](graph-validation/QUERY-NEGATIVE.json), [QUERY-POSITIVE.json](graph-validation/QUERY-POSITIVE.json).

Закреплены Python 3.12.3 / SQLite 3.45.1 / Unicode 15.0.0, code/input/output hashes; Node wrappers дополнительно прошли со своим python3 из PATH. SQLite bytes не контракт; логические exports детерминированы.

Полный npm suite на этапе 04 повторно не запускался. На этапе 03 уже зафиксирован существующий PH/mater assertion: 60.515946719946726 против 60.03928052899482. Формулы/ожидания здесь не менялись; зелёный общий suite не заявляется. [Предыдущий baseline log](import-validation/FULL-SUITE-BASELINE.txt).

[PROTECTED-PATHS.json](graph-validation/PROTECTED-PATHS.json) подтверждает неизменность защищённых Git trees, импортёров и исходных pins. Production не переключался; merge не выполнялся. Структурный успех не доказывает морфологическую корректность источников.

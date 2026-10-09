# Контрольная точка — аудит расчёта ассоциативности

Дата: 09.10.2026. Проверенный исходный SHA: `b266c92f00d111c1df53da05221fefac0db1dc3a`.
Ветка: `audit/associativvordes-calculation-20261009`; base=main. Production deployment: dpl_Era2Mu6evrdJF1zXwa68jZPFJGqx; methodology=2026-09-09; runtime data route=v5. PR публикации фиксируется отдельно в ответе и metadata GitHub, чтобы не создавать циклическую ссылку на ещё не созданный коммит.

## Статус направлений

| Направление | Статус | Результат/ограничение |
|---|---|---|
| Remote/ветки/PR/production | завершено | полный ls-remote, open REST PR snapshot, production SHA и live hashes |
| Исходный regul | механизмы подтверждены; exact source ограничен | каждый симптом имеет причину или documented limit в AUDIT §10; исходный export не получен |
| Живое воспроизведение | ограничено, run остановлен | >8 минут, дошёл до немецкого анализа, не до финальной таблицы; meaning=правило — допущение |
| Подключение v5 | подтверждён дефект AC-001 | raw gzip+overridden json parser; local v5 regul/en=2, fallback=152 |
| A/P/поля/review | завершено | штатные поля согласованы, stored A исключается при incomplete; review gate методологически обоснован |
| Демография/renderer | завершено | справочные N есть; top-level speakers отсутствует вне represented; Intl→NaN |
| Представленность/FA | завершено | found/selected/scored/verified/included разные множества; нули — отдельный вопрос |
| Состояния/async | статический trace завершён; races открыты | main guards существуют, manual guards отсутствуют; lifecycle/status conflicts reproduced isolated |
| Методология | сверено с repository edition | A/P/maxP/weighted aggregate соответствуют; внешний более поздний документ не получен |
| Сравнение семей/случаев | локальные v5 counts и mock cases выполнены | нет full live successful alternative root; inter root-route не считать preposition-route |
| Внешний сервис | настоящие ответы получены, upstream причина открыта | primary200/null fields, review403; mock success/failure разделены |
| Существующие тесты | 9/10 файлов прошли | methodology test baseline PH mater failure; subsequent assertions не выполнены |
| Четыре обязательных отчёта | готовы | AUDIT.md, ISSUES.md, FIX-PLAN.md, CHECKPOINT.md |

## Доказательства

REMOTE-SNAPSHOT.md; REMOTE-BRANCHES.txt; LIVE-ASSETS.txt; LIVE-QWEN.txt; LIVE-SESSION.md; DIAGNOSTICS.txt; EXISTING-TESTS.txt; ADDITIONAL-TESTS.txt. Это текстовые диагностические материалы; временных harness/script файлов и новых тестов нет. Команды диагностик выполнялись через stdin и не изменяли исходные модули.

Полный repo suite и глобальная повторная этимологическая проверка не заявлены. Девять проходящих файлов не означают green CI. Достоверные прежние structural family audit результаты не повторялись и не трактуются как проверка расчётного UI.

## Следующий этап

1. Прочитать AUDIT/ISSUES/FIX-PLAN, обновить remote/production и сверить SHA. Если код не изменился, не повторять gzip/null/NaN proof.
2. Получить source snapshot regul, exact meaning и safe review traces. До этого не заявлять доказанную первопричину исходного Qwen сбоя.
3. Исправлять сначала AC-001/002/005 в **другой** ветке и отдельном PR; сохранять методологические review guards, данные v5, frequency/lemma IDs.
4. Отдельно решать AC-011/013/015; не менять формулы/denominator без утверждённого решения.
5. Независимая верификация по FIX-PLAN этап 6; реальные сервисы и mocks маркировать отдельно.
6. AC-014 не исправлять автоматически заменой expected PH числа; требуется самостоятельная диагностика.

Merge, изменение существующих PR, пересборка данных и переключение production v5→v6 не выполнялись. Этот аудит не содержит функциональных исправлений.

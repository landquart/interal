# Промпт 04 — очереди и общие доказательства

Блок выполнен поверх опубликованного baseline **63b8f44539f752cad6e4fc875bba85be39035bb9**. Research: **92281be5ea672b46a5173f37332b8fcad4d82620**; решение: **21d31039f0876da1b520c80aba908c7b0b0c7ed3**; application: **317abb0d524d7cab4dd410422e72907dc795ac91**. Initial validation: **09663df51ae7c8dc5ccb0daac055bf6d35ee987c**. Уточнение ranking всего open scope: **8b190c1aa2ea02a9485cfc20f625d86f0d1c5881**. Final validation публикуется отдельным commit; его точный SHA и CI закреплены в PR #652. Remote trees проверяются на равенство локальным checkpoint trees.

Сохранена main → #650 → #651 → #652; PR draft, merge не выполнен, production v5. Промпт 03 уже завершён и не повторялся. Новый слой занимается организацией и reuse исследования: он не создаёт lexical identities, family verdicts или memberships.

## Решение и воспроизводимость

Использованы существующие backlog, шесть benchmark/frame snapshots, historical overlay, 16 055 candidate packets, lexical review/evidence cache, heads/edges/links, promotion и lifecycle ledgers, val/Russian pools и tower source frame. Source clustering не пересобирался. Для отсутствовавшего точного packet overlap проведён один bounded lookup: 1 536 неизменных member shards, только 100 670 заранее определённых corpus IDs. Каждый hash и конечный scope сохранены в packet-finite-routes cache. Обычный replay читает этот cache, сверяет scope, packet-index hash и source lock; независимый audit дополнительно проверяет реальные bytes всех 1 536 shards.

Corpus identity — language + lemma ID; membership question добавляет root; head сохраняет language/normalized_head/sense; head-family decision содержит свой version; occurrence содержит отдельный frame/locator/route. Один ID сохраняет несколько components, questions и routes. Excluded или uncertain edge не удаляет слово из других задач.

Cache содержит 216 существующих heads: de 55, en 64, es 27, fr 27, it 34, ru 9. В нём сохранены sources, evidence type, finite scope, original identity facts, независимые family decisions, decision history и version snapshots. German system имеет версии 1 и 2, три прежние finite links; новое применение здесь отсутствует. Reuse другого head означает ссылку на исследования, а не перенос accepted verdict в другую family.

`scripts/build-associative-v6-queue-organization.mjs` создаёт отдельные planning artifacts. Шесть языковых shards перечислены в cross-frame descriptor; все occurrence locators и packet locators сохранены. Atomic writes защищают публикацию shards. Membership engine, исходный builder и прежние generated artifacts не изменены. `scripts/audit-associative-v6-queue-organization.mjs` независимо проверяет hashes, finite scopes, original source universes и conservation; CI также сравнивает deterministic replay planning artifacts.

## Exact differential

| Измерение | До | После | Изменение |
|---|---:|---:|---:|
| Accepted v6 memberships | 21 555 | 21 555 | 0 |
| Catalog families | 18 | 18 | 0 |
| Lexical heads | 216 | 216 | 0 |
| Legacy exact units | 18 857 | 18 857 | 0 |
| Head-family edges | 19 241 | 19 241 | 0 |
| Current corpus IDs | 23 223 | 23 223 | 0 |
| Current membership candidates | 23 240 | 23 240 | 0 |
| Current unresolved units | 23 238 | 23 238 | 0 |
| Current proven identity groups | 1 | 1 | 0 |
| Current proposal units | 23 237 | 23 237 | 0 |
| Current disputed identity groups | 0 | 0 | 0 |
| Все indexed corpus IDs | 100 670 | 100 670 | 0 |
| Все indexed membership questions | 102 314 | 102 314 | 0 |
| Source-frame occurrences | 133 054 | 133 054 | 0 |
| Exact packet-route incidences для этих IDs | 181 136 | 181 136 | 0 |

До/после последних четырёх строк относится к одним и тем же исходным occurrence universes и результату regroup, а не к сумме независимых решений. Они впервые измерены этим блоком. Complete sorted sets представлены в index/questions; `conservation.json.gz` содержит одинаковые before/after counts/hashes, адреса shards и exact added/removed sets **[]/[]**. Все **274** прежних v6 artifacts байт-в-байт идентичны baseline. Не изменены ни один прежний membership object, link, head, edge, source ID, frequency или исторический proof.

В объединённом planning view: 92 proven groups, 124 disputed historical identity groups, 98 896 proposal groups. Это не новое ускорение current остатка. Current queue содержит один proven actin head на три uncertain records и 23 237 singleton proposals, итого прежние 23 238 units. **Новое доказанное сокращение = 0**; текущий ratio 23 240 / 23 238 = 1.0000860659. Stage factor 1 962 / 36 = 54.5 и historical representation 872 / 6 остаются отдельно уже проведённой работой.

Ranking явно учитывает open scope всех saved frames: **78 927 unique membership questions**, включая historical unresolved, val/Russian и promotion pools. Current open scope 23 240 учитывается отдельно; это не сумма независимых decisions. Completed/revision occurrences сохраняют историю. Отдельный regression test и независимый audit проверяют, что все 46 390 historical unresolved records и все candidate-pool questions остаются open и адресуемыми.

Ranking использует finite fanout, количество open questions, evidence confidence и явную стоимость boundary review: proved finite identity — один review на head-edge, unproved scope — один review на record. Morphology proposal имеет нулевую доказательную confidence. Огромный prefix pool не получает proved reduction. Семейного top-N ограничения нет; все реальные saved branches и все packets адресуемы. 53 существующих morphology proposal references сохранены отдельно от bindings.

## Измеренные пересечения

| Пространства | Общие corpus IDs |
|---|---:|
| Current ∩ historical unresolved | 544 |
| Current ∩ packet routes | 11 698 |
| Historical unresolved ∩ packet routes | 11 678 |
| Current ∩ val | 4 |
| Current ∩ Russian short pools | 5 |
| Historical unresolved ∩ val | 42 |
| Historical unresolved ∩ Russian short pools | 8 |
| Val ∩ Russian short pools | 0 |
| Val ∩ packet routes | 5 347 |
| Russian short pools ∩ packet routes | 82 |

Exact sets каждой пары находятся в overlap-report.json.gz. Historical overlay содержит 55 686 questions / 55 270 corpus IDs; его unresolved часть — прежние **46 390 records**, не самостоятельный дополнительный corpus. Val: 24 896 route incidences / 5 516 IDs. Russian: 2 637 incidences / 2 633 IDs. Tower: 2 166 incidences / 1 083 IDs. Promotion и revision incidences сохраняют историю, а не увеличивают unique resolution count.

Packet intersection точен для каждого ID в indexed frames. **Общий unique corpus size всех packet-only records не измерен**: 16 055 — packets, не words и не independent decisions. Их support не суммируется с текущим или историческим остатком.

## Проверки и evidence blockers

52 targeted tests и полный npm test **130 files** проходят. Отдельно проверены synthetic accepted/excluded/uncertain edges к разным families, несколько components одного ID, correction/revision и promotion occurrences без потери источников, отсутствие propagation, конфликтующие corpus words, дубли occurrences и неизвестный/out-of-scope packet route. Синтетические IDs отделены от real corpus artifacts. Реальная проверка охватывает все шесть языков и existing positive/negative/uncertain branches; actin остаётся uncertain, system history адресуем, все finite scopes ссылаются на original proofs.

Независимые v6 audit и planning audit проходят; byte replay **274 migration artifacts + 16 planning artifacts** совпадает. Exact Prompt 03 differential по-прежнему +1 Systeme / −0 против его собственного baseline, две version changes; exact Prompt 04 differential — полностью нулевой. Protected v5/frequency/historical trees идентичны. Final durable logs, hashes, integrity и exact differential: queue-organization-20261004/final-validation/. Initial 51-test proofs остаются адресуемыми в validation/ и commit 09663df5.

У большинства current records отсутствуют independently proved identity/boundary bindings. Historical labels без отдельной современной finite boundary validation помечены disputed, а не silently promoted. Homonym/sense и национальные continuity blockers anis/turr и других предыдущих stages сохранены. Подстрока, перевод, равенство массивов и distant ancestor не становятся membership proof.

Следующий этап — конечные oper/relat и оставшиеся act/component dossiers: использовать cross-frame references и cache, проверять новые boundaries/real IDs и выносить независимые family-edge решения через существующий versioned lifecycle. Этот блок организации завершён; current 23 240, historical unresolved 46 390 и candidate packet work остаются незавершённой словарной работой.

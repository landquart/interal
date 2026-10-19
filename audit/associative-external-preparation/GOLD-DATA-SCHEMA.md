# Схема данных эталона — версия 1

Отдельные неизменяемые сущности: cases → индивидуальные judgments → adjudications → GOLD. Импортированные статусы и source labels не являются judgment.

| Сущность | Обязательный смысл |
|---|---|
| Case | id по [family, language, source-native/project lexeme ID], точная target.lemma, наблюдённый POS или null, исходный head ID или null, unresolved sense scope |
| Provenance | snapshot/graph manifest SHA-256, хеш исходного объекта или конечный путь, kind с явной пометкой not_gold |
| Sampling | origin, hypothesis_tags_not_gold, leakage_group, development/evaluation, double_review, content_sha256 |
| Blinded task | Case ID/hash, family/language/target, число независимых проверок; ответов и prior labels нет |
| Rater roster | id → kind=human, authorized_by, authorization_ref; полномочия проверяет владелец проекта, не алгоритм |
| Judgment | case ID/hash, annotator_id, mode=human, independent_review=true, blind_to_test_predictions=true, reviewed_at, decision, relation, reason, evidence |
| Linguistic labels | sense и pos обязательны для yes/no; phenomena — дополнительные типы; boundaries — внутренние codepoint offsets или null; correct_families — проверенный список или null; independent_model_id — ручная группировка или null |
| Adjudication | Полный judgment третьего человека + disputed_judgment_sha256 всех исходных ответов |
| Gold row | case ID/hash, state, согласованная label или null, ссылки на judgments/adjudication |
| Annotation receipt | Все предоставленные judgments, adjudications и roster, отдельно от исходных cases и предсказаний |

Основной relation: direct, indirect, compound, allomorph, homonym, orthographic_variant, substring_only, semantic_distant, unrelated, inflection, uncertain. phenomena может перечислять несколько этих явлений. decision: yes/no/uncertain; это ручной эталон для эксперимента, не автоматическое accepted membership в проекте.

Gold states: unannotated; single_review (не хватает обязательного второго ответа); disagreement; resolved; adjudicated. Итоговая uncertain-метка сохраняется отдельно и не попадает в бинарные знаменатели. Один человеческий ответ может разрешить case без double_review; это не межэкспертный консенсус.

Запрещены повторный ID, повреждённый case hash, неизвестный case в ответах, несколько активных ответов одного автора в одном выпуске, неавторизованный/автоматический mode, противоречивые family labels, некорректные границы и арбитраж исходным участником. Смена решения — новый выпуск, не тихая замена. Импорт результатов тестируемой конфигурации в gold отсутствует.

case_set_sha256 вычисляется по канонической упорядоченной коллекции cases; source objects с исходными численными значениями сохраняются как реальные данные, не как приоритет или P. Предсказание обязано присутствовать для каждого case и хранить тот же content hash: yes/no/abstain, requires_manual_review, evidence, необязательные границы и явно наблюдённые merged_families. Отсутствие результата — abstain, а не no.

Директории выпусков неизменяемы: sampler/runner/reproduce отказываются записывать поверх непустого выпуска, в том числе поверх человеческих ответов. Файлы roster/judgments по умолчанию пусты. Human authorization — внешняя граница доверия: checksum доказывает целостность, но не личность разметчика или правдивость самоаттестации.

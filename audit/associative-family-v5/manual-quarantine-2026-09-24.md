# Manual runtime quarantine of twenty-two mixed v5 families

The repository-backed v5 member shards are retained byte-for-byte. The runtime loader excludes these twenty-two family IDs before loading member shards. This is a bounded safety decision based on individual record inspection, not a complete annotation of each family or an estimate of precision.

| Family ID | Materialized support | Inspected records and defect | Disposition |
|---|---:|---|---|
| `surface:de:ten` | 17,618 | `a-kader-athleten`, `abarbeiten`, `abbauprodukten`: each has only `compound_morphology` on final `ten`; the words have different stems. The earlier case review removed `gelten`, `retten`, `erwarten`, but left this general suffix mechanism. | Quarantine pending a real lexical root and a reviewed member set. |
| `ety:cf2897b18b16` (`grc:γενεα`) | 14,936 | `abaugen`, `abbildungen`, `abborgen`, `abendbeschäftigungen`: German `gen` is matched as a word ending with `compound_morphology`, not as the Greek lineage of the whole lemma. The earlier case review removed three more examples. | Quarantine pending separation of real `gene` descendants from German endings. |
| `surface:ru:sja` | 13,090 | `абасся`, `аблудиться`, `абираться`, `аботиться`: the shared evidence is only final `-ся`/`-ться` through `compound_morphology`. Reflexive endings do not make these distinct verbs one lexical family. | Quarantine pending a lexical-root treatment; leave suffix morphology outside associative family membership. |
| `surface:ru:ka` | 5,949 | `абилка`, `абишка`, `абиссинийка`, `абвгдейка`: the shared evidence is only final `-ка`, a productive ending across unrelated stems. | Quarantine pending a lexical-root treatment. |
| `surface:ru:skij` | 11,871 | `аахенский`, `аароновский`, `абаканский`: different place/name stems share only the adjective ending `-ский`. | Quarantine pending a lexical-root treatment. |
| `surface:ru:nie` | 8,341 | `аблуждение`, `аболевание`, `абортирование`: different stems share only `-ние`/`-ение`. | Quarantine pending a lexical-root treatment. |
| `surface:de:nen` | 7,888 | `aaltonen`, `abbau-plänen`, `abbruchmaschinen`: different names/compounds share the letter sequence `nen`. | Quarantine pending a lexical-root treatment. |
| `surface:es:ado` | 6,830 | `aalcanzado`, `abalanazado`, `abanderado`: distinct verb stems share the participial ending `-ado`. | Quarantine pending a lexical-root treatment. |
| `surface:it:are` | 6,820 | `abbagliare`, `abbaiare` and unrelated verbs share the infinitive ending `-are`. | Quarantine pending a lexical-root treatment. |
| `surface:ru:vat` | 6,528 | `абонировать`, `абортировать`, `абрасывать`: unrelated verbs are grouped by final `-вать`/`-ировать` sequences. | Quarantine pending a lexical-root treatment. |
| `surface:es:nos` | 5,551 | `abalanzarnos`, `abandonarnos`, `abandónenos`: distinct verbs share the clitic `nos`. | Quarantine pending a lexical-root treatment. |
| `surface:ru:ija` | 5,132 | `аберрация`, `аббревиация`, `абдукция`: different stems share final `-ция`/`-ия`. | Quarantine pending a lexical-root treatment. |
| `surface:es:ria` | 5,000 | `aalmería`, `abandonaria`, `abarrotería`: unrelated words share only `ria` at the end. | Quarantine pending a lexical-root treatment. |
| `ety:1e9cc0c12192` (`la:illas`) | 7,738 | Spanish `abandónalas`, `abandonarlas`, `abastécelas` enter by the clitic `las`, not by descent of each complete word from Latin *illas*. Genuine pronouns may exist in the same family. | Quarantine pending pronoun/verb-clitic split. |
| `ety:d4e12af70156` (`la:ens`) | 7,200 | Spanish `aaparentemente`, `aasionadamente`, `abducente` enter by `ente` inside adverbs/adjectives, not by whole-word descent from Latin *ens*. Genuine forms may exist in the same family. | Quarantine pending root/suffix split. |
| `ety:315724e202e2` (`la:illos`) | 7,179 | Spanish `abalearlos`, `abandonarlos`, `abastecerlos` enter by the attached clitic `los`; the complete verbs do not descend from Latin *illos*. | Quarantine pending pronoun/clitic split. |
| `ety:ca11c4d91dcb` (`la:illis`) | 6,957 | Italian `abbaiargli`, `abbassargli`, `accendergli` share the attached clitic `gli` across unrelated verbs. | Quarantine pending pronoun/clitic split. |
| `ety:1e7afcab5044` (`la:sonus`) | 6,670 | Italian `sonetto` and `suono` coexist with malformed or unrelated forms such as `suonamu`, `suoneck` on a `suon` component. | Quarantine pending reviewed sound/sonnet branches and corpus cleanup. |
| `ety:579f4e520ecd` (`la:ago`) | 5,582 | French `agir` coexists with concatenations `agirainsi`, `agiravec`, `agirnen` admitted by the `agir` sequence. | Quarantine pending corpus cleanup and a reviewed verb family. |
| `ety:00ff06cbe8c8` (`la:actor`) | 11,112 | German `abbe-refraktometers`, `abenteuer-charakter`, `abfangkontakt` are grouped by internal `akt`, though they are unrelated to *actor*. | Quarantine pending a genuine actor branch. |
| `ety:3b5769fa0463` (`la:acta`) | 9,371 | English `abfraction`, `abstract`, `abstractedly` enter on internal `act` without whole-word descent from *acta*. | Quarantine pending acta/root split. |
| `ety:fb8a2c387e83` (`fr:acteur`) | 5,578 | The same German `abbe-refraktometers`, `abenteuer-charakter`, `abfangkontakt` are grouped by internal `akt`, unrelated to French *acteur*. | Quarantine pending a genuine actor branch. |

The support figures are the current `report.json` family counts, not a count of false memberships. Some words in these families may have valid relationships that require a split. The runtime change neither deletes those records nor changes the immutable source run (`35647932153`), static shard hashes, report counts, or provenance. The family metadata still says `needs_review`; the effective runtime quarantine is defined in `associativvordes/js/family-index-loader.js`.

Two `action` families (`ety:9a86a987fafc`, `ety:751cdacbf4a9`) and `ety:5bed7c192e10` (`actu`) also need sense-level review. Individual records such as German `abbe-refraktometers`, `abfangkontakt` and English `abstract` carry `compound_morphology` on an internal `akt`/`act` sequence with a `manually_verified` source label, which is not whole-word etymological evidence. The same families contain genuine `Aktion`, `action` and `act`; this review does not quarantine or mass-remove them. The `manually_verified` source label in those component records must not be treated as an independent linguistic annotation.

No build, automated semantic labeling, full repository audit, or test suite was run for this manual review. A future correction should split valid roots from suffix/subsequence matches, update the materialized shards and provenance together, and reassess runtime controls.

## Follow-up: maximum 20 returned members per family and language

The owner specified a maximum of 20 per language and chose to show the best available 20 when an unreviewed family is larger. The runtime now applies this limit **inside each family/language group**, before merging overlapping families. Explicit `manual_override` evidence ranks first; direct etymological evidence ranks next; a word beginning with the relevant family alias ranks above an internal substring; corpus rank and frequency resolve remaining comparisons. Ties use lemma ID. This is a deterministic retrieval rule, not a claim that all 20 are semantically correct. The underlying gzip shards and their support counts are unchanged.

I inspected the most frequent entries of three particularly noisy branches and constrained two language slices more tightly:

| Branch | Language | Examples rejected from the frequent results | Selected shortlist |
|---|---|---|---:|
| `ety:5bed7c192e10` (`la:actus`) | English | `contract` (from *contrahere*), `impact` (from *impingere*), `character` (Greek *kharaktēr*), `manufacturer` (*manus* + *facere*), `abstract` (*abstrahere*), `attract` (*attrahere*); `active`/`activist` descend through *activus* and are left for a separate branch decision. | 13 words |
| `ety:9a86a987fafc` (`la:acti`) | German | `Kontakt`, `Charakter`, `abstrakt`, and `abbe-refraktometers` share only an internal `akt` sequence; `aktuell` follows *actualis* and `Akt` follows *actus*, whereas `Aktie` follows *actio*. | 4 words |
| `ety:751cdacbf4a9` (`la:actio`) | German | The same contaminated German `akt` postings appear in this near-duplicate family; compounds such as `Aktienmarkt` need a separate whole-word decision. | 4 words |

These shortlists are recorded as exact words in the runtime loader. They are conservative retrieval selections, not a completed independent etymological annotation. For the other language slices and the remaining millions of families, a top-20 ranking only limits output size. It cannot establish that every selected word is appropriate, and it does not reduce the number of stored memberships. A claim that **every** family contains no more than 20 truly appropriate words would require case review of every selected record and a separate definition of whether inflected forms and compounds count as distinct words.

Lexical cross-checks for the narrowed lists: [English *actuate*](https://en.wiktionary.org/wiki/actuate), [English *actuary*](https://en.wiktionary.org/wiki/actuary), [English *action*](https://en.wiktionary.org/wiki/action), [German *Aktie*](https://de.wiktionary.org/wiki/Aktie), [German *Aktionär*](https://de.wiktionary.org/wiki/Aktion%C3%A4r), and [German *aktuell*](https://de.wiktionary.org/wiki/aktuell). They support the stated branches, but are not independent adjudication of every retained form.

As a targeted preservation check, the seven verified seed families in English have respectively 2, 3, 2, 2, 2, 2 and 2 members carrying `manual_override` evidence (`alter`, `ocul`, `pede`, `manu`, `regul`, `inter`, `liber`). These remain ahead of automatically inferred entries under the 20-result rule. This inspection was read-only and did not run the test suite.

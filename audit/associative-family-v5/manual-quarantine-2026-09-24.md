# Manual runtime quarantine of four mixed v5 families

The repository-backed v5 member shards are retained byte-for-byte. The runtime loader excludes these four family IDs before loading member shards. This is a bounded safety decision based on individual record inspection, not a complete annotation of each family or an estimate of precision.

| Family ID | Materialized support | Inspected records and defect | Disposition |
|---|---:|---|---|
| `surface:de:ten` | 17,618 | `a-kader-athleten`, `abarbeiten`, `abbauprodukten`: each has only `compound_morphology` on final `ten`; the words have different stems. The earlier case review removed `gelten`, `retten`, `erwarten`, but left this general suffix mechanism. | Quarantine pending a real lexical root and a reviewed member set. |
| `ety:cf2897b18b16` (`grc:γενεα`) | 14,936 | `abaugen`, `abbildungen`, `abborgen`, `abendbeschäftigungen`: German `gen` is matched as a word ending with `compound_morphology`, not as the Greek lineage of the whole lemma. The earlier case review removed three more examples. | Quarantine pending separation of real `gene` descendants from German endings. |
| `surface:ru:sja` | 13,090 | `абасся`, `аблудиться`, `абираться`, `аботиться`: the shared evidence is only final `-ся`/`-ться` through `compound_morphology`. Reflexive endings do not make these distinct verbs one lexical family. | Quarantine pending a lexical-root treatment; leave suffix morphology outside associative family membership. |
| `surface:ru:ka` | 5,949 | `абилка`, `абишка`, `абиссинийка`, `абвгдейка`: the shared evidence is only final `-ка`, a productive ending across unrelated stems. | Quarantine pending a lexical-root treatment. |

The support figures are the current `report.json` family counts, not a count of false memberships. Some words in these families may have valid relationships that require a split. The runtime change neither deletes those records nor changes the immutable source run (`35647932153`), static shard hashes, report counts, or provenance. The family metadata still says `needs_review`; the effective runtime quarantine is defined in `associativvordes/js/family-index-loader.js`.

Two `action` families (`ety:9a86a987fafc`, `ety:751cdacbf4a9`) and `ety:5bed7c192e10` (`actu`) also need sense-level review. Individual records such as German `abbe-refraktometers`, `abfangkontakt` and English `abstract` carry `compound_morphology` on an internal `akt`/`act` sequence with a `manually_verified` source label, which is not whole-word etymological evidence. The same families contain genuine `Aktion`, `action` and `act`; this review does not quarantine or mass-remove them. The `manually_verified` source label in those component records must not be treated as an independent linguistic annotation.

No build, automated semantic labeling, full repository audit, or test suite was run for this manual review. A future correction should split valid roots from suffix/subsequence matches, update the materialized shards and provenance together, and reassess runtime controls.

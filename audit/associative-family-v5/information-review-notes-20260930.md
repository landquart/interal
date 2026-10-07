# Information pair: bounded lexical review

Base materialization: merge commit `78182754c4254b6c26aba42e556cb67158bb8c14` (PR #649).
Immutable source run: `35647932153`. No rebuild and no source lemma deletion.

The exact `la:informatio` and truncated `la:informati` families had identical six source relation records and identical full ordered membership arrays, 3,598 records each. The `azion` canonical and alias arose from Italian suffix expansion; they do not identify the lexical information root. The full Latin key is retained; the duplicate is removed. Original extraction evidence is preserved, with borrowed ancestry distinguished from inheritance. English has French mediation; the extraction template `der` alone cannot certify direct inheritance.

| Language | Each original duplicate | Retained from original list | Added from existing corpus membership | Final |
|---|---:|---:|---:|---:|
| en | 45 | 6 | 0 | 6 |
| de | 159 | 152 | 2 | 154 |
| fr | 5 | 5 | 0 | 5 |
| es | 23 | 7 | 0 | 7 |
| it | 3,366 | 12 | 0 | 12 |
| ru | 0 | 0 | 1 | 1 |
| Total | 3,598 | 182 | 3 | 185 |

The two original families contributed 7,196 memberships. Removed: 3,598 duplicate links plus 3,416 rejected or unresolved links in the retained family, 7,014 total. Added: three already existing lemma records, not invented source IDs. Net reduction: 7,011.

The German additions, `informationsbildschirm` and `informationsflut`, were already in `surface:de:informatio`. Their inclusion prevents curated precedence under the newly corrected root alias from hiding genuine pre-existing positive results. Russian `информация` was already in `surface:ru:informacij`. Those source arrays and their original components remain unchanged.

## Decisions and limits

Every retained word has an explicit lexical or morphological analysis in `information-decisions-20260930.json`. German Information compounds exceed twenty; the productive lexical component justifies a documented exception, not arbitrary truncation. These analyses establish root membership, not dictionary certification of every rare compound. Family metadata remains `verified: false`, `needs_review`; there is no claim of exhaustive human etymological annotation.

English `informations` is retained because the legal count-noun sense and plural are attested; the original token's sense remains unresolved. Spanish accentless corpus forms are explicit variants, not new lemmas. Fused phrases, malformed accents, spelling/truncation artifacts and the InformationWeek publication name are classified separately. An unresolved spelling is not declared a nonexistent word.

Italian suffix-only peers such as `abitazione`, `integrazione`, `votazione` and `zombificazione` are excluded from this root. `informatizzazione` has a distinct computerisation branch through French `informatisation` / `informatiser`; this bounded repair does not automatically merge broader historically related inform- lines.

Five lexical aliases route to the corrected family: `informacion`, `informacija`, `informatio`, `information`, `informazione`. The two information targets are removed from `azion`; its fourteen remaining targets are unchanged and still require their own review. Nineteen neighbouring families have full ordered member and metadata hashes locked in the ledger. Their source arrays remain present. Curated precedence suppresses their candidate-only noise only when this family's language-specific reviewed list exists.

## Supporting sources

These support specific lexical heads, morphology or terminology, not every expanded corpus record. The full retained/excluded lists and unchanged-neighbour hashes are the executable decision record.

- [Merriam-Webster: information](https://www.merriam-webster.com/dictionary/information): lexical head and the legal count sense, explicitly including `informations`.
- [Original NIH informationist research](https://pmc.ncbi.nlm.nih.gov/articles/PMC2859271/): attested profession, not a fused phrase.
- [Wiktionary: counterinformation](https://en.wiktionary.org/wiki/counterinformation): `counter-` + `information`.
- [Duden: Information](https://www.duden.de/rechtschreibung/Information): German headword and inflection.
- [CNRTL: informationnel](https://www.cnrtl.fr/definition/informationnel): French derivative.
- [Légifrance: avis de préinformation](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000037701019/LEGISCTA000037723896/): primary attestation of the French prefixed form.
- [UNAM Bioinformación laboratory](https://sites.google.com/bioinformacion.org/lab/Home): explicit biological-information sense of Spanish `bioinformación`.
- [UNESCO curriculum, Spanish module 4](https://www.unesco.org/mil4teachers/sites/default/files/medias/fichiers/2024/03/MIL_Curriculum_Module_4_SP.pdf): `malinformación`, `informacional`.
- [Treccani: controinformazione](https://www.treccani.it/vocabolario/controinformazione/), [informazionale](https://www.treccani.it/vocabolario/informazionale/), [informatizzazione](https://www.treccani.it/vocabolario/informatizzazione/): distinguish information derivatives from the computerisation branch.
- [Italian public purchasing: preinformazione](https://www.acquistinretepa.it/opencms/opencms/preinformative.html) and [regional geodata: metainformazione](https://dati.regione.basilicata.it/catalog/tr/dataset/database-topografico-tema-informazioni-cartografiche-e-metainformazione): primary institutional attestations.

## Continuation

Finish this branch's exact runtime tests, clean byte-identical replay, exhaustive repository audit and CI before merging it. Next work: remaining azion concept pairs, deferred Russian `kh/nl/lo/ca/um`, full retained val membership/key review, then act/akt/att. The global linguistic-validation goal remains open.

## Materialization counts after the completed repair

| Field | Before | After |
|---|---:|---:|
| Families | 2,456,543 | 2,456,542 |
| Aliases | 1,934,050 | 1,934,051 |
| Memberships | 10,078,319 | 10,071,308 |
| Materialized unique lemmas | 4,924,281 | 4,924,275 |
| Lemmas without a materialized family | 699 | 705 |
| Multi-family lemmas | 3,332,240 | 3,332,183 |
| Families requiring review | 4,025 | 4,026 |

The six additional unassigned lemmas remain in the source corpus. This repair rejects their last materialized family relationship; it does not invent a replacement relation. Source lemma/component totals remain 4,924,980 / 9,349,982.

Twenty-four relevant runtime/materialization tests passed after the final support correction. Replay and exhaustive audit evidence are separate committed JSON records. `azion-continuation-20261001.json` records the fourteen remaining routes: five exact duplicate concept pairs, the nonidentical actio/acti pair, and two surface groups. That inventory is diagnostic; it does not approve those lists or merge them.

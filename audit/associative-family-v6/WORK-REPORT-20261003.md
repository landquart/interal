# Associative family v6: durable continuation, 2026-10-03

The parallel v6 now preserves investigated uncertainty without losing active records, resolves finite compound scopes through shared lexical heads, and separates historical provenance, promotion candidates and actual new linguistic resolutions. PR #652 remains draft in the dependency chain main → #650 → #651 → #652. No merge or production switch; production remains v5.

This report compares the original task HEAD `5a986fc9bed17de344d5df8127727f4ca7b6dd04` with the validated Aktion integration `97d0652816f3087904694e3c682bf1bc3da7f508`. Russian and val provenance stages were subsequently published at `e22ec0ad580372553a36294befa3666d83f78bf7` and `9e5959cf75a6d6990af47d104ad931b67607c505`. Global candidate packets were published at `7a40c30e9d95f8c64d9e0cd40d2d560bbc6808e0`. The later commit containing the system research dossier and this updated report is available from this file's Git history.

## Measured outcomes

| Measure | Task baseline | Current validated v6 |
|---|---:|---:|
| Accepted memberships | 19,970 | 21,009 |
| Preserved original manual memberships | 19,967 | 19,967 |
| Active records | 25,199 | 24,037 |
| Pending records | 24,214 | 23,067 |
| Investigated uncertain records | 985 | 970 |
| Lexical heads | 170 | 189 |
| Legacy exact-record units | 18,857 | 18,857 |
| Catalog families | 16 | 16 |
| New catalog promotions | 0 | 0 |
| Unexpected differential | 0 | 0 |

Since the task baseline: 1,147 previously pending records and 15 previously investigated uncertainties were resolved by 19 new head reviews. There are 1,039 new accepted memberships and 123 linguistic exclusions of previously withheld candidates. No already accepted membership was removed. One additional actin identity review retains three uncertain records and counts in the decision denominator.

The generated cumulative benchmark includes the three observ/inform resolutions completed before this task baseline: 1,165 resolved records / 22 head decisions = **52.95**. Pending-only: 1,150 / 15 = **76.67**. Historical representation reuse remains **872 / 6 = 145.33**, separate from new resolution. No new historical representation compression was claimed in this continuation. The remaining active frame still has 24,035 review units for 24,037 records; its strict factor is only 1.00008. Finite successes do not establish index-wide tenfold acceleration or linguistic certification.

| Active queue | Task baseline | Current |
|---|---:|---:|
| observ/inform | 198 | 198 |
| relat | 325 | 317 |
| loc | 842 | 827 |
| creat/mut | 4,967 | 4,864 |
| oper | 2,082 | 2,077 |
| act | 16,785 | 15,754 |

## Decisions and safeguards

Relat: eight exclusions through three independently evidenced lexical heads. Loc: eight accepted German components and seven Russian exclusions through six heads; all fifteen were investigated uncertainties. Creat/mut: 103 exclusions through five separate Screen/Screening/Mammut senses. Oper: five military trooper compounds excluded through one head. Act: 340 financial Aktie components, 165 documentary Akte components and 526 deliberate Aktion components accepted through three heads.

All new component identities have exact existing lemma IDs and frozen boundaries. They grant no unrestricted suffix/substring membership, national reflex or whole-compound identity. Company/organizer labels remain opaque components.

A provisional positive actin recipe was withdrawn before any accepted membership was published. Three protein records now share a proved lexical identity while the act-family relation stays uncertain. They remain active. Non-resolving reviews count in costs. The integrator rejects explicitly unauthorized research recipes before mutation.

Ped remains ped, not pede; creat remains creat, not cre. No canonical or realization decision changed. Alias navigation remains separate from family identity. The source corpus and v5 evidence remain intact.

## Separately saved fronts

Historical nat/loc/inter: all 55,686 saved candidate records reconciled against current evidence. All 6,819 historical accepted decisions survive. All 498 superseded exclusions have specific loc evidence. There are still 46,390 historical records without a current decision: nat 25,780; loc 9,928; inter 10,682. This provenance check creates zero new memberships or linguistic resolutions and does not silently fold that frame into the six current queues.

Russian kh/nl/lo/ca/um: all 2,637 source records preserved. Whole-container promotion is withheld. Um is examined beyond exact-token-only: the actual ум and умно records preserve the dictionary mental row including умный. That row alone does not establish an international associative base. Finer source partitions stay pending; the international relation is investigated uncertain. No corpus word or frequency was invented.

Val: all 15 independent routes preserved, containing 24,896 route-record incidences and 5,516 unique corpus identities. Eleven of the thirteen etymological routes repeat the same 1,126 French records; two valence routes have no French pool. Those repeated records all contain a proposed val component, including real cheval, independently from Latin caballus. Exact arrays, aliases and old manually_verified proposal labels cannot prove shared lexical identity. Validity, value/strength, valence, valley, fortification and names remain separate research targets; no automatic family merge or promotion.

Global candidate grouping: all 20,755 etymological evidence clusters covered exactly once in 16,055 packets, with 4,252 multi-cluster packets and at most five evidence clusters per packet. Grouping requires a shared proposed base and a shared full declared source term. There are 4,847 grouping proposal edges and 22,580 weaker spelling/duplicate links that cannot join packets. 4,904 etymological duplicate pairs inform risk review. Existing head spellings are only candidate pointers; all canonical decisions and family IDs stay null. Support is an incidence upper bound, not a unique-member estimate. Source terms, homonyms, national continuity and canonical boundaries still require independent review.

## Durable stages after the latest continuation request

| Commit | Stage |
|---|---|
| eedae6ca | Uncertain reviews remain active; complete engine validation |
| ea5fa769 | Historical nat/loc/inter provenance reconciliation |
| e07637d4 | Documentary Akte evidence |
| 388deb7a | 165-record Akte integration and validation |
| 17b0acba | Deliberate Aktion evidence |
| 97d06528 | 526-record Aktion integration and validation |
| e22ec0ad | Five Russian short-candidate reviews |
| 9e5959cf | Fifteen val routes and contamination diagnosis |
| 7a40c30e | Global candidate packets and complete checkpoint |
| This report's latest commit | First non-seed system promotion research dossier |

Earlier separately saved relat, loc, creat/mut, oper, Aktie and actin research/integration commits remain in branch history and CHECKPOINT.md.

## Validation and remote checks

Shared-engine stage eedae6ca: 22 targeted tests, all 126 test files, independent v6 audit, byte-identical v5 exhaustive preservation audit and byte-identical replay of all 272 generated artifacts passed. Remote Tests and Audit parallel associative family v6 succeeded.

Akte and Aktion integrations: 22 targeted tests, independent v6 audits and byte-identical replay of all 272 artifacts passed. Their shared runtime is unchanged from eedae6ca. Remote Tests and v6 audit also succeeded for Akte integration 388deb7a and Aktion evidence 17b0acba. Remote Tests and v6 audit subsequently succeeded at Aktion integration 97d06528 and global candidate checkpoint 7a40c30e. The subsequent research-only commit has no runtime changes; its fresh workflow state must still be read from GitHub.

Historical, Russian and val standalone audits passed their identity/provenance invariants and each repeated run produced two byte-identical artifacts. Global clustering passed full coverage/non-promotion invariants and its repeated run produced three byte-identical artifacts. Scripts, source SHA-256 maps, generated results and integration logs are committed separately.

## First non-seed promotion research

The system international row is independently supported by Merriam-Webster, Duden, Académie française, RAE, Treccani and Gramota. Six source IDs are frozen, one per language; no IDs or frequencies were fabricated. Greek/Latin mediation connects two candidate packets covering four etymological containers as research evidence. The proposed modern compact base system remains an explicit linguistic recommendation, with canonical approval still null. systemat- is a branch stem; no generic ending stripping or general national reflex is approved.

The old Greek container incorrectly carries a 24-record Russian translation pool under sostav/состав. Semantic translation is not borrowed lexical continuity. The actual система record is independently sourced from surface:ru:sistem. Corpus noun/verb ambiguity, finite morphology, the new-family review frame and catalog integration remain to be handled. Binding authorization is false; this is a six-language promotion dossier, not a seventeenth family. Repeated preparation is byte-identical.

## Remaining work

The known queues remain partly unreviewed. Continue finite heads with strict sense identity; do not treat source spelling, alias pools or remote technical success as linguistic certainty. Historical partitions, Russian finer heads and all val branches require further evidence. Review the highest-value global candidate packets through national lexical heads and explicit canonical boundaries, then extend the finite promotion frame to genuinely new associative families. Promotion beyond the sixteen seed families has not happened yet. Preserve existing version/evidence/exact-ID/duplicate/production guards.

# Prompt 07 — contamination and independent lexical branch review

Baseline: **1a96aa4512be66319d085704640921fb3cda6f32**, the completed Prompt 06 snapshot. The requested older 2d84b206 snapshot is historical. No repeated val route audit, Russian source audit or provenance census; their exact saved inputs are reused and hash-locked. main → #650 → #651 → #652 remains intact; no merge, production v5.

## Durable stages

| Stage | Published SHA | Local checkpoint with identical tree |
|---|---|---|
| Research | 10f2efdba674bcb4b521c699156698ebb5790e9a | 13c4dce3 |
| Decision | 48202f44aab6a2bc62731bc1207233857c2ad796 | 2f2011fd |
| Application | 2485f79ef7cf8fe6a5ccf3982e5cdf9dee4124fa | 12d21a50e69cb7cecd1d53d5658a30a49d558e7c |
| Source language/route guard | 9b139be26c01d34ca72de1653c2ebd9585af4ec6 | 8221102e2b0b1c668a7b41dc0c1e27c824418945 |
| Validation | Following separate commit containing this report and validation.json | Recorded independently |

The application tree is **2b8578a61f33a9ba159c94761c332ff3225585e0**. Shell push has no GitHub credentials; the connected API published the same trees as separate fast-forward commits. All uploaded blob SHAs and the resulting tree were verified against local Git objects. Research and decision local commit IDs inside the saved decision are local provenance, not claimed remote commit IDs.

## Concrete mechanism

`scripts/lib/associative-v6-contamination.mjs` exposes a reusable review-only finite partition engine. The builder consumes exact saved source records and research/decision hashes; the independent audit reconstructs every source occurrence from its original locator and compares every payload, including component evidence and measured frequency data. No source row is rewritten, deduplicated away or normalized into an invented lemma. Storage shards have exact hashes and counts; partial, stale or unsafe shards fail closed.

Eight reusable flag kinds are available: semantic translation/gloss, alias pool reuse, unrelated homonym, suffix ending, accidental fragment, proper-name identity, damaged spelling and duplicate routing. Exact repeated route-language identity sets produce alias-pool warnings; multiple independent routes of an ID produce duplicate-routing warnings. Other flags are finite researched annotations, with explicit evidence or an unresolved evidence gap. Noise/name/spelling/borrowing-looking triage remains **suspected**, not a certified lexical identity or final negative verdict. Flags change the overlay's review state and priority, and cannot create an exclusion, family edge, canonical approval or membership. Warning absence also cannot certify a record.

The partition unit is an exact `(frame, language, lemma_id)` question. More than one branch can reference an aggregate ID when separate senses/histories need review. Branch annotation does not assert that every token or its frequency belongs to a selected sense. Residual partitions remain separate by frame, original route and language; equal arrays never merge routes or establish identity. National-only heads are supported as **research objects outside the international family catalog**. The new overlay has its own priority/state view; it does not overwrite the existing Prompt 06 planning frame or claim new queue resolutions.

Outputs include a partition dossier with unique corpus IDs and separate immutable route occurrences, an alias val navigation index, explicit unresolved partition tables (JSON.gz and CSV), positive/negative controls, input/code locks and metrics. The 40 generated artifacts replay byte-for-byte.

## Branch decisions and limits

Val research separates valid/validus, value/valor/valere, chemical valence, linguistic valence, valley/vallis, fortification vallum, personal Valerius, geographic Valentia and Italian/Russian surface material. Dictionary-supported heads, formal histories, candidate bases, national forms, exact IDs, related/different senses and gaps are saved per finite branch.

Merriam-Webster, Académie and Treccani directly connect validus/valid, valor/valeur and technical valentia/valenza to valere. The dossier supports a **research relationship at recognizable val**, while retaining full branch stems valid and valent and independent national lexical heads. This is an explicitly bounded linguistic inference from documented direct developments, not a catalog promotion or authorization for residual IDs. English value has its own Anglo-French participial route; it is not inaccurately said to descend directly from valor. Chemical and linguistic valence have a documented analogical relation: separate research questions do not force separate families.

Val/vale/valley continue vallis through national developments and remain separate from valere. Candidate stem **vall** is based on the full Latin stem, not arbitrary stripping of English valley. Vallum fortification remains another branch despite the same candidate spelling. Crucially, Treccani distinguishes **vallo1** (vallum fortification) and **vallo2** (variant of valle): the real Italian vallo ID appears in both independent questions and is not admitted as one whole-row identity. Italian vale is investigated as a valere form rather than assigned English vale meaning. Italian stivale is a separately supported boot noun, an accidental-fragment control. Cheval ← caballus retains the frozen negative lexical control.

Valerius and Valentia remain independent onomastic questions. Editorial name evidence relates Valerius to valeo but its cited primary Latin dictionary could not be retrieved; this remains an explicit blocker. Municipal history supports Valentia/Valencia, without certifying every namesake, lowercase aggregate reading or associative boundary. Candidate onomastic bases are proposals only. Russian вал has shaft/embankment/wave questions and no automatic Latin vallum or valere admission. Alias **val** navigates several independent research results and cannot merge them.

Russian pools now have finite research branches for genuine native rows, local inflections, borrowings, real components, probable names, suspected encoding/OCR material and damaged spellings, plus explicit unreviewed residuals. Ум/умно form a dictionary-supported native mental row; no international continuity is inferred, and умный's absence is only a selected-route gap. Крыло/антикрыло and finite авиакрыло component research preserve full крыл rather than lo. Американца is analyzed through the dictionary's американец/американца paradigm, not as a ca associative root. Пицца, умлаут and атриум have independently sourced loan histories; умыть is a separate washing row. Probable names, spellings such as апостло/ленолиум and transliteration-looking анкх/хоум/аплоад remain triage questions needing individual evidence. None is silently normalized or blanket-excluded.

The same engine runs on the independent **tower packet**: its two routes, seven saved dictionary head facts and ten previous negative/withheld controls remain addressable. Candidate turr refers to the earlier saved boundary research, which is neither repeated nor promoted here. Tour/тура/tor/torres ambiguities retain their prior limits. Permanent real negative controls **system→состав** and **botanical anis→scientific anisotropy/aniso** remain outside the unrelated accepted search, while positive система/anise memberships survive.

## Exact scope and differential

| Saved frame | Original route occurrences | Unique corpus IDs | Unassigned research questions |
|---|---:|---:|---:|
| val | 24,896 | 5,516 | 5,489 |
| Russian kh/nl/lo/ca/um | 2,637 | 2,633 | 2,604 |
| Independent tower | 2,166 | 1,083 | 1,066 |
| Permanent real controls | 2 | 2 | 0 |

The original “2,637 source records” is an occurrence count: four Russian IDs are routed through multiple pools. This does not rewrite its original report. The combined dossier has **29,701 occurrences**, **9,232 unique corpus IDs** and **9,234 frame questions**. Val/tower share the two real English IDs valtor and valletor; their frame questions remain independent. Exact sets are saved instead of treating counts as disjoint workloads.

There are **41 finite research branches plus 2 permanent controls**, **75 branch-annotated frame questions**, **5 overlapping branch questions**, **56 unresolved route/language partitions** and **9,159 unassigned questions**. Annotations include provisional triage and inherited controls; these counts are not new dictionary adjudications. The 16 alias-pool warning groups and 5,926 duplicate-routing warning groups measure routing properties, not counts of linguistically wrong words.

Differential against baseline: **+0/−0 memberships, zero changed membership objects, zero promotions, zero current queue resolutions and zero new linguistic exclusions**. Current catalog 18; accepted 21,561; heads/edges/finite links and all 277 existing migration artifacts unchanged. V5, frequency lists, lemma IDs, historical evidence, original route dossiers and previous planning outputs retain exact Git objects. Ped remains ped, creat remains creat, observ~osserv remains independently evidenced; no family-size cap is introduced.

## Verification

See `prompt07-contamination-20261005/validation/validation.json` for final statuses, compressed logs and artifact/code hashes. Targeted tests cover all eight flags, unknown/wrong-ID branch scopes, stale payloads, language/source-route swaps, duplicate occurrences, unauthorized memberships/canonical/family links, missing dictionary proof, multiple homonymous branches, route-specific residuals, deterministic input permutation/reconstruction, conserved source evidence and sibling links, and real system/anis positive and negative search controls. Independent source reconstruction and partition audit pass; the full v6 audit passes. **17 targeted tests and full npm test on 133 files pass on the final source-binding guard.** Full suite was repeated after that refinement. Byte replay of all 277 old migration artifacts and 40 new contamination artifacts passes; independent planning/history audits and 5-artifact certification replay also pass. Application SHA 2485f79e has successful Tests (37309134451) and Audit (37309134425), including planning replay and corpus enumeration. Exact final validation SHA CI is checked independently and recorded in PR #652; a prior SHA result is never substituted for final-SHA proof.

An initial development real-replay test did not complete successfully. Input/branch ordering was canonicalized, and lookup maps now avoid expensive repeated scans. A storage refactor changed only top-level JSON property order; structural equality verifies reconstruction. Interrupted/failed development attempts are not counted as successful validation.

## Evidence blockers and next stage

This engineering block does not adjudicate every 5,516 val or 2,633 Russian identity. Remaining head morphology, named-entity readings, possible encoding/OCR causes, national formal continuity and exact corpus components need separate linguistic decisions. Source etymons and meanings alone neither split nor unite all families. Residuals retain sources and uncertainty. Next: prioritize dictionary-supported finite branches and investigate their remaining national forms; when justified, use the existing versioned head/edge, promotion or correction dossiers with explicit authorization. Do not promote whole containers, infer membership from flags, or claim global dictionary certification from this finite overlay.

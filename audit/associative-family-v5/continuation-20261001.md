# Continuation — 2026-10-01

Repository: `landquart/interal`. PR #649 is merged into main at `78182754c4254b6c26aba42e556cb67158bb8c14`.
Current branch: `fix/associative-information-20260930`. Immutable source run: `35647932153`.

## Completed bounded information repair

- `ety:497564008159` / `la:informatio` is retained with canonical `informatio`; exact extraction/member duplicate `ety:b34a3a0ff582` / `la:informati` is deleted.
- 7,196 original links become 185 reviewed memberships: en 6, de 154, fr 5, es 7, it 12, ru 1.
- Removed 7,014 links (3,598 technical duplicate links plus 3,416 rejected/unresolved memberships). Added three pre-existing corpus records: German informationsbildschirm/informationsflut and Russian информация.
- Neither source lemmas nor other memberships are deleted. All nineteen neighbouring families retain full ordered arrays and metadata hashes.
- Five lexical aliases route to the corrected family. The pair is removed from azion; fourteen other azion targets remain.
- German productive compounds have a documented exception to twenty. Family is still verified:false / needs_review; morphology review does not claim dictionary certification of every rare formation.
- Twenty-four relevant tests passed. Executable decisions were checkpointed before applying the materialization. Clean replay and exhaustive audit evidence accompany the final correction.

Final counts: families 2,456,542; aliases 1,934,051; memberships 10,071,308; materialized unique lemmas 4,924,275; unassigned 705; multi-family lemmas 3,332,183; review-required families 4,026. Source lemmas/components remain 4,924,980 / 9,349,982.

## Next work

1. Verify the information branch's current PR state/HEAD and final Tests + exhaustive repository audit before changing data. Preserve any user changes; do not reuse a merged branch. Do not rebuild the index.
2. Full review of the remaining five exact azion duplicate pairs, in a bounded batch. Complete diagnostics, source terms and non-Italian member lists are in azion-continuation-20261001.json:
   - relatio: ety:474b418e1004 / ety:dd07667af787 (relati)
   - operatio: ety:58143b06b35a / ety:8ef5f06ceb40 (operati)
   - mutatio: ety:61108b488e06 / ety:727be1d24fa1 (mutati)
   - creatio: ety:a3b640366c27 / ety:ab1eaa1c14b6 (creati)
   - observatio: ety:c28863eb7595 / ety:c80365cdd174 (observati)
3. Do not merge concepts through -azione. Identical expanded lists diagnose a technical duplicate, not correctness of their memberships. Inspect all retained derivatives; preserve legitimate compounds, classify fused phrases and spelling artifacts, and verify absent source headwords before adding records.
4. actio ety:751cdacbf4a9 / acti ety:9a86a987fafc are NOT exact duplicates. The latter includes extra Azio/Actium name evidence; review their sense/source difference with act/akt/att. Preserve distinct branches until justified.
5. Deferred Russian surface:ru:kh/nl/lo/ca/um. In ум, mental derivatives such as умно must not be discarded by an exact-token filter. Verify lexical heads/senses rather than guessing from transliteration.
6. Retained val families still need full membership/key review; routing cleanup did not approve their contents. Preserve value/strength versus valley distinction.

## Verification and persistence

Every materialized repair updates membership/coverage counts, family summaries, provenance and the exhaustive audit's ledger arithmetic. Test exact full lists, positive neighbouring routes and absence of broad fallback. Adding a curated route must not hide true words already present under another family; the two German additions in this repair protect precisely that case.

The information repair is scripts/repair-associative-information-20260930.mjs <root> plan|apply. It validates source run, locked family/member arrays, aliases, additions and untouched neighbours. All metadata are produced by the script. Reapply only to an unmodified base materialization; it refuses repeated application.

Workspace resets occurred between messages. GitHub checkpoints retain executable decisions. Save subsequent scripts/ledgers early and publish audited final data atomically. Do not rely on scratch files or a local running process surviving the next user message. The global linguistic-validation goal remains open.

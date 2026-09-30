# Continuation checkpoint — 2026-09-30

Repository: `landquart/interal`. Continue PR #649 and its existing branch.
Immutable source run remains `35647932153`.

## Completed bounded decisions

- Twelve incidental `val` reverse routes are removed. Fanout is 27 → 15.
- Every original `val` family and all its member arrays are preserved. Alternate aliases, including `value`, `valor`, `vale` and `vaux`, remain indexed. Value/strength and valley lines are separate.
- Five Russian surface families are pruned: `na` 594 → 1, `u` 564 → 1, `da` 483 → 1, `ma` 476 → 2, `ga` 445 → 1.
- Retained words: `на`, `у`, `да`, `ма`, `ма-ма`, `га`. Removed memberships: 2,556. Source lemmas and their other memberships remain.
- Full decisions, original ordered member hashes, evidence classes and val overlap matrix are in `val-and-ru-short-decisions-20260930.json`.
- `repair-associative-family-val-ru-20260930.mjs <root> plan|apply` validates the locked state before mutation. Membership validation streams language shards rather than retaining all six language sets in memory.
- Twenty-two relevant tests passed. Clean replay gave 2,051 byte-identical materialization files, including report and provenance. See `repair-reproducibility-20260930.json`.

## Counts after this repair

| Field | Before | After |
|---|---:|---:|
| Families | 2,456,543 | 2,456,543 |
| Aliases | 1,934,050 | 1,934,050 |
| Memberships | 10,080,875 | 10,078,319 |
| Unique materialized lemmas | 4,924,295 | 4,924,281 |
| Lemmas without materialized family | 685 | 699 |
| Multi-family lemmas | 3,334,263 | 3,332,240 |
| Families requiring review | 4,025 | 4,025 |

The fourteen newly unassigned lemmas are not deleted from the source corpus. Their former sole family link was rejected; a replacement relationship must be justified independently.

## Next work, in order

1. Verify PR #649's latest HEAD and final GitHub Tests/repository audit before changing its materialization again. The checkpoint commits containing the script and ledger precede the final data commit.
2. Fully review `ety:497564008159` (`la:informatio`) and `ety:b34a3a0ff582` (`la:informati`). Each has 3,598 members: en 45, de 159, fr 5, es 23, it 3,366. Both use the same six relation-evidence records and identical members. The canonical `azion` is suffix contamination, not a lexical information root. Decide duplicate normalization using exact source terms before consolidation.
3. Do not indiscriminately retain only headwords in the information pair. Many German compounds are genuine; English and Spanish arrays include fused phrases, misspellings and valid prefixed derivatives. Italian suffix peers such as `abitazione`, `integrazione`, `votazione`, `zombificazione` do not belong to information. Lock an explicit retained/removed ledger; use accurate relation classes and review metadata.
4. The five deferred Russian families are `surface:ru:kh` (601), `nl` (553), `lo` (506), `ca` (497), `um` (480). In particular `умно` is a genuine mental-root derivative; `вдумчиво` needs a distinct root/sense decision. Do not mechanically reduce these to an exact token or discard genuine lexical heads without checking them.
5. Review retained val families' membership noise and duplicate keys. Routing repair alone does not validate those sets. `la:vale` / `la:valeo`, `la:valid` / `la:validus`, `la:vall` / `la:vallis`, `la:valenti` / `la-lat:valentia`, and name-line keys need separate source-sensitive decisions. Preserve the valley/value distinction.
6. Remaining azion pairs and the large `act/akt/att` cluster remain open. Do not start a full rebuild.

Any new materialized repair must update counts, provenance, exact positive/negative runtime regressions and exhaustive integrity evidence. Persist its executable decisions in GitHub early: this session's initial local working environment was wiped before its first full audit could be saved.

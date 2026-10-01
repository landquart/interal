# Component membership continuation — 2026-10-01

Working PR: #651, stacked on #650. Source run: 35647932153.

Associative membership follows a recognizable lexical or prepositional element across branches: nat in nation/natural/natalism; loc in location/local/locomotive; inter in international/interval/internet. A compound can belong to multiple component families without merging those families. Semantic divergence alone does not reject a member.

## Materialized in this continuation

- Removed the eleven individually reviewed false English inter memberships recorded in component-review-20261001.json from the stored member array. All other 1,584 English inter records remain byte-identical as JSON objects, checked by reconstruction of the locked original array hash.
- Removed nat → ety:496b7cec5a43 (NATO) in both reverse lookup and family aliases. The acronym family, its nato route and all memberships remain.
- Kept international, interdisciplinary, interval and internet in actual runtime results.
- Recounted all materialized memberships/coverage, refreshed family summaries and provenance, and extended the exhaustive audit with rejection, positive and alias controls.
- Exhaustive audit passes: 10,071,297 memberships; 4,924,272 materialized unique lemmas; 708 source lemmas without a materialized family. Three newly unassigned lemmas are still in the immutable corpus; no replacement relationship is guessed.

## Next bounded work

The five exact existing English heads nation/natural/location/local/locomotive and their real lemma IDs, frequency records and current family targets are preserved in component-head-continuation-20261001.json. Their nat/loc links are NOT materialized yet. All 256 English membership shards were searched for natalism, which is absent; retrieve the locked source corpus before adding it. Do not fabricate corpus evidence.

Review complete nat/loc arrays and lexical branches before adding curated precedence: approving only these examples could hide other genuinely related existing words. Do not treat shared letters as an identified component. Keep existing branches and allow multiple memberships.

The inter family is not fully linguistically certified: eleven removals do not review its remaining 2,056 memberships across six languages. Continue reviewing the lists themselves, preserving legitimate formations. The global validation task remains open.

Reproduction: scripts/repair-associative-components-20261001.mjs applies to the unmodified data at PR #651's original commit 437a38a3. It locks metadata/member hashes, preflights all decisions before writing, and refuses repeat application.

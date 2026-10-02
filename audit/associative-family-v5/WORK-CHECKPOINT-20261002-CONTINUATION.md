# Current continuation checkpoint

Current state: 24 reviewed continuation memberships applied (six earlier and
18 in the latest extension). Latest support: observ 309 / inform 1,455.
All 15 targeted application tests passed, no failures or skips. The full
109-file suite and exhaustive audit passed; two later review test files each
passed 2 tests, no skips. Latest continuation queue: 514 pending,
62 investigated uncertain, 162 excluded. Earlier sections below are dated stage history.
Latest relation overlay: `relation-phrase-boundaries-20261002` (325 pending).
Resume from the stage-specific inventories,
`continuation-validation-20261002/validation.json` and the complete
`continuation-task-20261002.txt`. Never repeat applied materialization.


Branch: fix/associative-component-membership-20261001; PR #651 depends on #650.
No merge. Source run 35647932153.

Read `continuation-task-20261002.txt` for the complete authorized task and
`WORK-CHECKPOINT-20261002.md` for immutable earlier stages.

Baseline 970cf1009d11242fe1c8a913a1bf0c74309c631e was rechecked remotely.
Both GitHub Tests (37019725894) and exhaustive audit (37019726892) succeeded.

## Observ/inform preflight

Six existing reviewed positives are prepared, not yet applied in this commit.
`reflex-continuation-materialization-20261002/materialization-ledger.json`
contains exact selections, immutable source hashes, complete prior prefix
hashes, original families, every independent source route record, unchanged
file digest, and guarded metadata hashes. No aliases or containers change.

Prepare: `node scripts/materialize-associative-reflex-continuation-20261002.mjs --expected-head <current 40-character HEAD>`.
Apply once, after the preflight commit is durable: same command plus `--apply`.
The expected HEAD must match; source records, runtime tree and the complete
preflight must still match. The materializer refuses repeated application.

The pre-application tests passed 4, failed 0, and skipped the single application
audit. Application tests must later pass with no skips.

## Open queues

- act: 2,268 applied, 33,224 excluded, 143 investigated uncertain, 16,642 pending;
  actio/acti legacy containers intentionally retained.
- observ/inform continuation: 6 positive awaiting application, 23 excluded,
  3 investigated uncertain, 730 pending.
- creat/relat/oper/mut: 574/487/1,595/569 applied; pending 2,356/409/2,082/2,662.
- loc: 1,218 applied and 842 unresolved reflex records.
- nat/loc/inter: reconcile old 6,911 accepted, 10,688 literal-absence screens
  and 38,087 old pending with newer decisions, not an independent modern count.
- Russian short kh/nl/lo/ca/um remain; val has 15 retained, uncertified routes.
- Further high-risk scan remains after known queues.

Continue immediately with additive application, targeted tests, then review
of the saved 730-record observ/inform queue while complete runtime checks run.
Preserve pending versus investigated uncertainty. Save every stage separately.

## Six-record application

Preflight is durable in 53102f85a5390234962458192db9014fe53ae1d1.
The six records are now applied additively: observ 298, inform 1,448.
Removed memberships 0, retired families 0, alias delta 0. All 11 targeted tests
passed without skips, including compatibility routes, old action preservation,
complete prior prefixes, original source routes, ambiguous/excluded controls
and repeated-application refusal. The complete npm suite and exhaustive audit
are running; their final results belong to the next separate validation stage.
The 762-record continuation remains 6 accepted/applied, 23 excluded, 3 genuine
uncertain and 730 pending until a later review overlay is saved.

## Runtime validation integration

Six-record runtime stage is durable in 3295d6b3d064a3e6722f4d429921ee9e1030e9d0.
The first broad tests exposed an old whole-shard checksum that necessarily
changed when an unrelated observ record was appended. Historical Italian
proof now reconstructs the exact old gzip shard and still demands the original
checksum, while independently checking every current verb base record. Both
Italian tests pass without skips. The exhaustive audit's total-delta equation
also now includes the independently audited +6. This integration changes no
runtime records or historical ledgers. Full checks were restarted after these
changes; no success is claimed until final logs say pass.

## Further observ/inform lexical review

After applying the six reviewed positives, a separate finite review resolves
143 of the 730 pending records. 129 are excluded phrase fusions or independent
lexical boundaries (including rein + Form and Stein + Form). Every phrase has
an explicit segmentation. Fourteen actually investigated foreign forms retain
context uncertainty: the head is attested in another language, but the source
record cannot distinguish a quotation/title from a genuine lexical use in the
record's language. No spelling-only generalization is used.

Latest composed continuation: 6 accepted/applied, 152 excluded, 17 genuine
uncertain, 587 pending. Total remains 762. The pending queue and source proofs
are `reflex-phrase-boundary-review-20261002`. Two source/conservation and
byte-identical reconstruction tests passed without skips.
Reproduce with `python scripts/review-associative-reflex-phrases-20261002.py`.
Old 730-count notes above are historical. Current runtime supports remain
observ 298 and inform 1,448. All other open queues are unchanged by this stage.

## Compatibility-test composition

The older information repair test also compared compatibility queries against
its immutable original selection. It now composes that selection with the
separately audited extension, and preserves the new records' independent
components rather than demanding inform-only arrays. Both information repair
tests pass without skips. Full npm tests are restarted with every new review
and runtime test included. No further runtime mutation occurred.

## Credit and silence heads

A separate finite review excludes 21 Spanish creer/credit/credibility forms
from creat and 10 Italian ammutolire/mutezza forms from mut. These are
independent credere and mutus branches, not creation or mutation/change.
No runtime or corpus spellings were changed. Full source records and exact
pending partitions are saved in `credit-mute-heads-review-20261002`; both
targeted conservation/reproduction tests pass without skips.

Latest creat pending 2,335; relat 409; oper 2,082; mut 2,652.
Combined four-root pending is 7,478. Runtime accepted remains 574/487/1,595/569.
The successful full npm runtime test log is archived in
`continuation-validation-20261002/full-tests.log.gz`; exhaustive audit succeeded
and refreshed `repository-static-integrity.json` with 10,049,743 memberships.

## Additional foreign-form/context review

The separate `reflex-foreign-forms-review-20261002` stage reviews 34 exact
source records: three syntactic fusions excluded, and 31 dictionary-investigated
foreign forms remain genuinely uncertain because only aggregate frequencies
are available, without original sentences or sense labels. This does not certify
foreign words as native realizations and changes no runtime records.
Both source-conservation and independent reproduction tests pass without skips.
Latest continuation: 6 applied accepted, 155 excluded, 48 investigated uncertain,
553 pending. The latest pending queue is this stage's `pending-review.json`.

## Durable complete validation

`continuation-validation-20261002` archives the successful full npm run of
104 test files, the later foreign-form test (2 pass, 0 fail, 0 skips), and the
exhaustive audit output. `validation.json` includes source/script/log hashes,
exact index counts, all latest queue pointers, prior CI findings and resume steps.
The integrity report is updated to 10,049,743 memberships, with 2,456,540
families and 1,934,055 aliases unchanged. The prior remote audit itself passed;
its report comparison failed because the committed report was still old.
This separate validation stage saves that refreshed report. New HEAD CI must
still be checked. Linguistic work is incomplete; no family-wide certification.

## Relation phrase-boundary overlay

A later independent review excludes 84 exact fused phrase records from relat:
67 English, 2 German, 5 French and 10 Spanish. Explicit space segmentations
are saved per token, including the independent `are late today` boundary.
Lexical compounds such as entity-relationship/exchange-correlation and the
reviewed relation head itself are not swept into this stage. Original accepted
records and historical source measurements are unchanged. Both exact
conservation/source-proof and byte-identical reproduction tests pass, no skips.
Latest relat pending is 325 (487 applied unchanged); combined creat/relat/oper/mut
pending is now 7,394 (2,335 / 325 / 2,082 / 2,652).
This stage changes no runtime and does not invalidate the prior exhaustive audit.
The preceding validation JSON is immutable evidence for its stated earlier
queue counts; use this overlay for the latest relation state.

## Attested heads and name boundaries

Remote HEAD 39ee0895576053fdf04a539fb69e701b17eafb82 passed both workflows:
Tests 37025974160 and Audit repository associative family v5 37025974188.
The committed integrity report now matches the exhaustive audit.

`reflex-attested-heads-review-20261002` investigates 14 exact source records:
7 accepted (ImageObserver, Informatisierung, four Russian information names
and Italian Assinform), 5 excluded (independent Forms/Serve and nonformal
heads), 2 genuinely uncertain (Spanish informale and German informel).
Spanish informale can be a correctly spelled voseo imperative with le; it
also matches Italian nonformal informale. No automatic spelling repair or
foreign-word exclusion resolves that sense ambiguity.

Both source-conservation and byte-identical reproduction tests pass without
skips. The 7 newly accepted records are NOT applied yet. Runtime support
remains observ 298 / inform 1,448. Latest total continuation: 13 accepted
(6 applied + 7 unapplied), 160 excluded, 50 genuine uncertain, 539 pending.
Resume from this stage's pending-review.json and accepted decision ledger.

## Spanish enclitic morphology

`reflex-spanish-enclitics-review-20261002` independently reviews 12 exact
Spanish tokens: 11 accepted inflections and one fused phrase excluded.
Seven unaccented observar imperatives are correctly spelled voseo forms
with one enclitic. Three accented forms follow regular imperative stress
and pronoun attachment (including preserved nn in infórmennos). One
observádote record has an explicitly historical participle + te analysis
documented as a possible archaic construction by RAE. No corrected lemma
or open accent-removal rule is introduced. Both conservation/reproduction
tests pass without skips.

Latest continuation: 24 accepted (6 applied + 18 unapplied), 161 excluded,
50 genuine uncertain, 527 pending. Runtime remains observ 298 / inform 1,448.
Resume from this pending queue and combine the two new accepted ledgers
for the next guarded additive application. Do not repeat the applied six.

## Eighteen-record independent preflight

`reflex-heads-materialization-20261002/materialization-ledger.json` freezes
18 accepted records from the two latest reviews, current families, complete
ordered member prefixes, every source route, source hashes, metadata hashes,
all affected old shard checksums and the digest of every unaffected file.
The expected additive result is observ 309 / inform 1,455. Alias/family delta
and removed memberships are zero. Runtime is still unchanged in this stage.

Prepare/apply script: materialize-associative-reflex-heads-20261002.mjs.
It requires an explicit current HEAD and refuses repeat application.
The new audit checks the latest extension independently. Older ledgers see
their exact previous shard bytes reconstructed with the frozen old checksum,
so prior preservation checks are composed instead of loosened.
Nine preflight tests pass; only the not-yet-applied audit is skipped. After
this preflight is committed, apply once with the new HEAD and then require
all targeted application tests, the complete suite and exhaustive audit.

## Eighteen-record application recovered and verified

The transient workspace was reset before the prior local application was saved.
It was reconstructed from durable HEAD 5c2bd4b66d7d27e00a56d217cd96ce1c1cf74d1f,
then applied with all original guards; no historical ledger was rewritten.
The same ledger checksum and 18/0 delta were reproduced. All 15 application
tests pass without skips. Runtime support is observ 309 / inform 1,455;
24 accepted continuation records are now applied, 161 excluded, 50 genuine
uncertain and 527 pending. Families and aliases unchanged; source fields and
independent routes preserved. Never rerun this application.

Remote preflight Tests passed, but audit 37028152256 failed before scanning:
import was before the hashbang. Separate fix a1160fe0dbaf27a251df2096d11c6dad8dfeea0a
restores the first-line hashbang. Full checks now run with the corrected script.
Their final logs and refreshed report require a separate validation stage.

## Growth and fold lexical heads

Runtime application is durable in e4d1ed1c55ea2fbfdd68483c46b1ef6283312912.
Separate growth-fold-heads-review-20261002 excludes 20 exact English records
with increase/decrease or crease heads, including explicit phrase boundaries.
The distant growth ancestry does not establish the modern creat/create element.
The proposed crease/crest history remains qualified probable. Other lookalikes,
names and unresolved forms remain pending. Source records, prior positives and
all other-root pending records are conserved; both conservation/reproduction
tests pass without skips. Runtime is unchanged by this review.
Latest creat pending 2,315; relat 325; oper 2,082; mut 2,652, total 7,374.
Resume creat/mut from this pending file and relat/oper from their own overlays.

## Latin observation forms and negative form head

reflex-latin-context-review-20261002 investigates 13 exact source records:
12 Latin observation verb/noun inflections remain genuinely uncertain because
aggregate corpus sources cannot prove native use versus Latin quotation/title.
Dictionary identity and morphology are documented; this is researched uncertainty,
not a bulk reclassification of untouched pending. English informis is excluded
as the independent Latin negative shape adjective (in- + forma).
Both exact source/frame conservation and byte-identical reproduction tests pass.
The complete 762-ID frame is now 24 applied, 162 excluded, 62 investigated
uncertain and 514 pending. Runtime support remains observ 309 / inform 1,455.
Full 109-file suite and exhaustive audit have now passed; their evidence is
being saved in the following separate validation stage. No family is certified.

## Complete heads-extension validation

heads-extension-validation-20261002 saves full successful logs, exact tested
code hashes and current queue pointers. Full suite: 109 files passed. Later
growth/fold and Latin-context review files: 4 tests passed in total, no skips.
Exhaustive audit: pass, 10,049,761 memberships, 2,456,540 families, 1,934,055
aliases. Multi-family lemmas 3,335,533; unmaterialized lemmas remain 829.
The committed repository-static-integrity.json is refreshed to the exact audit
output. New HEAD CI remains a separate remote check; old runtime commits had
a stale report until this validation stage. Structural success does not certify
linguistic completeness. Continue from the latest queues above; never reapply.

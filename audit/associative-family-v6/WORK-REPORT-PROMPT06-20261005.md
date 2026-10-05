# Prompt 06 — historical decisions, correction overlay and certification

The finite block adds a safe independent path for revising an accepted v6 membership while retaining its historical acceptance and original v5 proof. No erroneous accepted baseline link was established in the representative sample, so the real correction registry deliberately remains empty. No merge or production switch: main → #650 → #651 → #652; production v5.

## Separately published stages

Frozen task start: **a29a3184336b981f2ca1c5cea019ad43e4b42729**. Earlier Prompt 02–05 decisions remain untouched and their validators run in exact frozen snapshots.

| Stage | Published SHA | Identical local checkpoint |
|---|---|---|
| Research | bb411263b14fd98720c38940649d06c0802641af | 993602e6779a32663a974e2066e3d7ea197dd4be |
| Decision | a60602bb013e1b1fef23f33651e26991812c4c90 | 5a7244b6b39dfc6294c89b35a80661f7ac5465eb |
| Application | b6d6d6fc4ce7c54e3a1c3ed60fd2d04f98369fb1 | 663daaa3778fb10d9941b4af94c74532bce05aa8 |
| Initial validation | 0bf4fc46d9b98480378436881bffcac45bbf50dd | 4333aae6, identical tree |
| Guard refinement decision | c837dfa4e807151ddf7764f2f141f926d8938574 | caf5c2fba9aec20c0b279057909c6ebfe9b2d5ac |
| Guard refinement application | 25cc15eaa41d3f740d8009272d97050179a83b4c | f98304903a126f343f9988325f906272dceea504 |
| Overlap scope decision/implementation | ebc962b27c5a16389e5f60d09ab6bc669fdf832a | c6a459d222207bdcf8021ad0ac7bdea9866c2022 |
| Full overlap data application | 276e7f7745fb17d507d55c608bbedd6ad4fcce01 | 055aa515aa22cc566fe217d8577c39caa3e96751 |
| Final validation | This report/checkpoint's following separate commit | See prompt06-history-20261005/final-validation/validation.json |

Shell push lacked credentials; the connected GitHub API published each stage separately. Every returned tree SHA was checked equal to the corresponding local tree before fast-forwarding the branch; no force update or merge was used.

## Correction semantics and exact differential

Original baseline is now separately addressable at `generated/baseline-memberships.json.gz`: **19,967** original accepted links. This artifact is generated from immutable v5 records and audited against exact original family/lemma identities. Current memberships are reconstructed from this historical baseline, approved finite additions/lifecycle decisions and the independently replayed correction overlay. Historical acceptance never becomes a veto on new linguistic evidence.

A versioned correction dossier enumerates exact language/family/lemma IDs, original source snapshots and source proofs, prior verdict, complete predecessor membership/link/head/edge hashes, previous overlay hash, fresh evidence, reason, explicit authorization and finite scope hash. Unknown, duplicate, stale, omitted or partly mismatched IDs fail atomically. Synthetic dossiers are forbidden in the real registry. Accepted→excluded and accepted→uncertain both remove only the selected question from current accepted search; original heads, edges, finite links, measured corpus rows, evidence and sibling family links remain unchanged. Subsequent correction revisions require the exact prior overlay state.

Audit independently replays the registry and distinguishes permitted corrections from baseline loss. Arbitrary membership removal, changed old object, unsupported addition or leaking a corrected verdict into accepted search fails. Differential, replay and metrics expose approved corrections explicitly. A separate final refinement also requires every original baseline key to exist **before** the overlay. This closes a possible future lifecycle bypass; only the independent correction dossier may subtract a baseline question. A count-preserving wrong-ID replacement also fails, while ordinary edge-version updates remain possible. Initial validation remains preserved separately; the refinement received fresh tests/audit/replay.

The real registry has zero entries; this stage introduces **+0/−0 memberships, 0 changed memberships, 0 real corrections**. All **21,561 accepted memberships**, **19,076 heads (219 lexical + 18,857 legacy exact)** and all **21,957 finite links** retain their prior objects. Catalog remains **18**: all seventeen requested families plus the subsequently promoted anis.

## Historical decisions and representative review

Saved accepted selections, selected etymological-only exclusions and automatic retrieval screens have different meanings. The old `excluded_absent_exact_fragment` is generated mechanically by `continue-associative-components-20261001.mjs`; it is not an independent current linguistic verdict. Its source status remains preserved, but root-specific proved realizations may supersede it. Absence of exact spelling still does not grant membership.

The new nonmutating reconciliation preserves every field/locator of the **55,686** historical rows and adds current membership/verdict/screen classification. It does not repeat or replace the completed provenance-count work. The original **46,390** unresolved frame remains an addressable historical reference; the effective modern review is separate.

Nineteen exact representative existing corpus rows were rechecked: **10 accepted retained**, **5 excluded**, **4 uncertain withheld**. Saved decisions include native dictionary/etymology evidence and exact source snapshots. Nat nation/natural survive; naive stays outside. Loc local/location/locomotive and separately proved German lokal/Russian локальный survive; lieu/lieutenant stay outside despite locus ancestry. Inter international/interval/internet survive; winter/printer receive independent negative component verdicts. Nacer/nacimiento/nascere and Spanish entre remain withheld: documented history does not approve general nat↔nasc/naci or inter↔entre realization. Natalism remains a dictionary/concept control without a fabricated corpus ID or frequency. Ped remains ped; creat remains creat. Observ~osserv is unchanged and separately evidenced.

The planner retains every source occurrence and historical accepted edge while displaying finite per-question current verdicts. Winter/printer close two formerly open historical questions; nacer/nacimiento/nascere reopen three formerly screened questions as investigated uncertainty. Entre remains open uncertainty. Open cross-frame questions therefore change **78,921 → 78,922**, not a false new-resolution gain. All 100,670 indexed corpus IDs, 102,314 family questions, 133,060 frame occurrences and 181,136 packet-route references remain identical exact source sets. Current known queue remains 23,234 questions / 23,232 units. Newly proved grouping reduction remains zero.

## Certification and overlap

`prompt06-history-20261005/generated/family-certification.json` lists each actual catalog family: canonical approval, typed-realization coverage, inherited proofs, imported historical heads, fresh finite reviewed heads/decisions, representative rechecks, current/historical queue scope, known unreviewed negative/screen decisions and blockers. Imported acceptance is explicitly not new linguistic review. Alter/ocul/ped/manu/regul/liber have no active current queue and receive explicit missing-coverage warnings rather than full certification. Known negative counts are scope-bounded; no exhaustive all-source negative inventory is falsely claimed. **8,807** historical absent-fragment screens still lack a current finite/specific review.

Root-bound identity is `(language, family/root, lemma_id)`: historical unresolved 46,390 and current 23,234 intersect in **0 family questions**, with exact union **69,624**. Their corpus-only intersection is **544 IDs**, whose family questions differ. These are the **original unresolved reference scope**, not the entire historical frame. The complete 55,686-question historical frame intersects current in **827 root-bound loc questions**, already represented as investigated uncertainties. The revised historical **review-eligible** scope (unreviewed or uncertain, including known old negative decisions needing review) has **47,723 questions**, intersects current in **827**, and has exact bounded union **70,130**. Review eligibility creates neither a linguistic verdict nor an automatic activation of every old negative in the planner. All scope-specific exact sets are saved; these measurements do not imply global dictionary completeness. Frozen historical overlay and both previous planning outputs remain unchanged/addressable.

## Verification

**75 targeted tests and full npm test on 132 files passed on the final guard engine.** Tests cover accepted→excluded/uncertain, unknown correction, stale membership/edge/overlay hashes, partial wrong-ID and omitted scope, explicit authorization, source/frequency conservation, sibling records/other families, forbidden synthetic real-registry import, arbitrary baseline loss, search visibility, subsequent versioned revision and deterministic reconstruction.

Independent v6 audit, planning audit, history/certification exact-set audit and deterministic byte replay all passed; logs/hashes are saved in final-validation/; initial validation/ is retained as historical proof. Migration replay covers **277 artifacts**; certification **5**; planning **16**. Frozen Prompt 03, Prompt 04 and oper/relat historical validators pass at their exact published snapshots. V5/frequency/historical proof trees remain byte-identical. One initially concurrent audit was killed by the 8 GiB workspace memory limit; its isolated rerun is recorded separately and no interrupted run is represented as a pass. Both GitHub workflows passed for initial validation 0bf4fc46: Tests 37245810172 and Audit 37245810241. The exact final guard/validation SHA is checked independently; initial-SHA CI is not substituted for it.

## Evidence blockers and next stage

The correction mechanism is complete for this block; the dictionary is not. Independently review the remaining historical nat/loc/inter head/reflex branches and the 8,807 unreviewed screens, including individually scoped national forms. Restore explicit review queues for inherited seed branches where current coverage is absent. Apply a real correction only after a versioned dossier proves the error and exact IDs. Known queues, historical unresolved records, promotions and packet-only corpus coverage remain broader linguistic work; the saved union is a bounded workload, not a global backlog census.

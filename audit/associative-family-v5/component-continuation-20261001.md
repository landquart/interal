# Component family continuation — 2026-10-01

Working PR: #651, stacked on #650. Locked source run: 35647932153.

The user requires the entire requested element plus an etymologically supported component. Naive/naïve is excluded from nat and lieutenant from loc even though they have historical links. Existing search normalization v4 is retained, with no nat/nasc/naci, loc/lok or inter/entre spelling substitution. Shared letters alone cannot approve interment, teleprinter or midwinter. There is no arbitrary family size cap.

## Saved checkpoints

Remote checkpoint commit: 6301dfe35040032adf3c705c4060fcab562f5546. The complete 18 candidate arrays, original corpus records, preliminary selections, corrected exact-fragment decisions and selection notebooks are saved under component-checkpoint-20261001. Candidate artifact hashes are recorded in decisions.json. The initial materialization passed an exhaustive audit; its decisions, audit and materializer are saved there separately.

A recall pass over undecided candidates found additional transparent derivatives and compounds. Its explicit choices are saved in component-completion-supplement-20261001.json. exact-components-20261001.json is the final frozen accepted list and source-preservation authority. exact-components-original-inter-20261001.json.gz preserves all six original ordered inter arrays.

## Materialized scope

- New exact component families family:nat and family:loc; existing family:inter is replaced with reviewed exact-fragment records. All unrelated lexical branches and memberships remain unchanged. A compound can belong independently to nat and inter without merging the entire families.
- Counts by language (en/de/fr/es/it/ru): nat 200/1364/114/70/102/62; loc 132/8/107/267/188/0; inter 736/1393/560/638/601/354. Total 6,896 reviewed memberships. The existing 2,056 inter records are superseded by the reviewed arrays; source copies are preserved.
- Every accepted record preserves its real lemma ID, frequency, category breakdown and corpus sources. No new corpus words or frequency records are fabricated.
- Exact-component runtime guards reject a stale manually linked word without the whole fragment. An intentionally empty reviewed language result cannot fall back to incidental legacy matches. Thus loc/lok are not silently interchanged.
- Saved page state retains all candidate records; the old twenty-record truncation was removed. Model scoring and selection settings are separate from family membership.

## Limits and remaining work

English natalism is absent from all locked materialized English shards and from the four repository English frequency input files. The source gap is recorded; no fake lemma ID or frequency is supplied.

Retrieved-but-undecided candidates remain saved for continued review. The three accepted component lists and exact matching are audited; this does not certify every rare formation individually in a dictionary or all millions of other families. Other existing backlog includes observation and remaining azion families; the observation checkpoint was not applied in this change.

Reproduction: materialize-associative-components-20261001.mjs prepares and applies on the index at base commit 139e2b64. It locks checkpoint/supplement bytes, checks every source record, preflights all changes, preserves unrelated shard contents and refuses repeat application.

## Final validation

All 85 test files pass with npm test. The exhaustive repository audit passes: 2,456,544 families, 10,076,137 memberships, 4,924,157 materialized unique lemmas; 823 source lemmas have no materialized membership. The 115 newly unassigned records lost unverified inter links, remain saved in the source corpus and checkpoint, and are not assigned a guessed replacement. Validation results and exact index byte hash are recorded in component-validation-20261001.json.

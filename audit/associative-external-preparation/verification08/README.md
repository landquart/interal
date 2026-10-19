# Independent verification 08

Audit code only; never imported by the application. No family, formula, runtime or
membership changes. Graph fixtures are explicitly adversarial controls, not real
corpus or manual gold. Real carriers use tracked stage-03/04/06 excerpts and cases.

```sh
/usr/bin/python3 audit/associative-external-preparation/verification08/verify.py --out /tmp/verify08-results.json
node --test tests/associative-flexor-research.test.mjs tests/associative-pilot-evaluation.test.mjs tests/associative-candidate-search.test.mjs tests/associative-evidence-graph.test.mjs tests/associative-external-import.test.mjs
node tests/methodology-20260909.test.mjs
```

The last command needs the unchanged `indoeuropanvordes/aline.js` materialized in a
sparse checkout. It currently fails the documented PH/mater assertion. The audit
script records 31 PASS / 4 FAIL; its completion means observation collection, not
that known defects passed. Timings and RSS vary; fresh logical exports/manifests
must match between the two isolated builds in one pinned runtime.

RESULTS contains exact fixture counterexamples, raw-field checks for 257 records,
input failures, two fresh importer/graph builds and real negative CREAT/creel guard.
PILOT-IDENTITY is independently recalculated from tracked CASES/RUNS; counts measure
unresolved exact-native-identity transfers, not proven linguistic false positives.
PROTECTION compares original/current Git objects. REMOTE-CI captures fresh API state.
REPORT-INVENTORY lists source reports. Earlier full-corpus and large-graph receipts
were not published before workspace maintenance and were lost; they are explicitly
not reconstructed as fresh successful checks. Recover raw by existing source locks
and repeat full verification before claiming that scope certified.

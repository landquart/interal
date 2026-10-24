# Full v5 family-boundary research audit

Read-only research. No production merge, deletion, root creation or calculation change is implemented. Equal member-ID fingerprints are discovery signals, never linguistic identity proofs. IDs always retain language; unknown POS/senses remain unknown. Connected overlap groups are never unioned.

This version restores the checksum-certified diagnostic database from stage04, retains its exact legacy IDs and per-record provenance hashes, and enriches family metadata from the actual locked v5 buckets. It independently rereads all 256 production buckets with JavaScript. Legacy memberships and old accepted labels remain unreviewed claims, not gold.

The source archive is reconstructed using `associativvordes/v5_diagnostics/tools/join_volumes.py` and the committed ARCHIVE-VOLUMES.json. Restore `registry.sqlite` only after validating the complete archive and its pinned database SHA-256; use the committed REGISTRY-MANIFEST.json as MANIFEST.json beside it. Store mutable multi-GB databases outside the checkout on a research volume.

```sh
python3 -m associativvordes.family_boundary.build --prior /absolute/prior --output /absolute/first --stop-after 2
python3 -m associativvordes.family_boundary.build --prior /absolute/prior --output /absolute/first
python3 -m associativvordes.family_boundary.build --prior /absolute/prior --output /absolute/replay
node associativvordes/family_boundary/verify.mjs "$PWD" /absolute/independent
node associativvordes/family_boundary/v6_proofs.mjs "$PWD" /absolute/pinned-v6
python3 -m associativvordes.family_boundary.analyze --index /absolute/first --prior /absolute/prior --v6 /absolute/pinned-v6 --stop-after-phase overlap
python3 -m associativvordes.family_boundary.analyze --index /absolute/first --prior /absolute/prior --v6 /absolute/pinned-v6
python3 -m associativvordes.family_boundary.analyze --index /absolute/replay --prior /absolute/prior --v6 /absolute/pinned-v6
python3 -m associativvordes.family_boundary.replay --first /absolute/first --replay /absolute/replay --independent /absolute/independent --receipt /absolute/REPLAY-RECEIPT.json
node tests/associative-family-boundary.test.mjs
```

The v6 input is pinned to commit 9fff76431a86a06df6db69b64d7f2ca4c871f1b7. Extract catalog.json and generated/{heads.json.gz,edges.json.gz,memberships.json.gz,source-lock.json,manifest.json} through `git show COMMIT:associativvordes/family-index-v6/PATH`, preserving exact bytes and recording each path, byte size and SHA-256 in SOURCE-LOCK.json. No checkout or production rollout of v6 is required. Historical v6 proof hashes use JavaScript JSON.stringify insertion order, separately from the canonical record hashes used by the diagnostic index. Different serialization contracts do not establish damaged source data.

Candidate sets use exact sorted family IDs, with one independent signal list. Near overlap means Jaccard >=4/5 and at least two members per family. Every nonzero overlap is preserved, including lower scores. Large means >=1000 members; skew means >=50 members and >=95% in one language. These are experimental discovery thresholds, unrelated to association formulas or the number of languages required for recognizing a root. A one-language family is retained.

Review admission is separate from category. All generated groups are held pending lexical/sense binding, independent morphological evidence, scoped history and correspondence checks. An external verified authority receipt can admit a finite proposal to further review; it never supplies production capability. Histories retain original family/language/lemma/POS/sense scopes. Missing history blocks operations; redirects never resolve conflicts by last-write-wins.

Large data stays outside Git. A final audit report and immutable artifact receipts accompany the completed release. Until those receipts exist, code checkpoints are implementation progress and must not be presented as certified results.

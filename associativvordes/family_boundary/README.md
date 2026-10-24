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

Large data stays outside Git. A final audit report and immutable artifact receipts accompany the completed release. The completed release receipts are in `audit/associative-v5-family-boundary/`; their certification concerns reproducible structural observations, not semantic verdicts.

## Restore and inspect the immutable release

Obtain all eight files named in `audit/associative-v5-family-boundary/ARCHIVE-VOLUMES.json`, place them beside a copy named BUNDLE-PARTS.json, and run:

```sh
python3 -m associativvordes.family_boundary.archive join --manifest /absolute/volumes/BUNDLE-PARTS.json --destination /absolute/boundary.zip
python3 -m associativvordes.family_boundary.archive restore --archive /absolute/boundary.zip --destination /absolute/restored --expected 7d386a7519bd2a92f04c26328dd32172c4b50b90354cd96206e6d5f9898df3a4
python3 -m associativvordes.family_boundary.query --index /absolute/restored/release --group boundary:c86f57f3d0d42c4ffcebcb3ef0b647fd3ddd4476ebbbe08fdd8a442bd63835cd --output /absolute/context.json --scope-output /absolute/scope.ndjson.gz
```

The restore validates every file hash before publishing a fresh directory and checks the actual SQLite database. Original v5 gzip files at the pinned baseline must be available in the checkout for source-record context inspection; they are not duplicated in the research archive. The archive contains the full derived database, all group/scoped-ID exports, 35 detailed contexts, independent raw-traversal fingerprints and pinned v6 input. BUNDLE-PARTS.json checks individual parts and the complete archive. Never rename a part without updating its explicit local path arrangement.

To rebuild from the earlier certified diagnostic archive, use its five volumes and `audit/associative-v5-diagnostics/ARCHIVE-VOLUMES.json` with the existing `join_volumes.py`, then:

```sh
python3 -m associativvordes.family_boundary.restore_prior --archive /absolute/interal-v5-diagnostics-20261023.zip --output /absolute/prior --receipt /absolute/SOURCE-RESTORE.json
```

Use the pinned v6 files under `restored/release/PINNED-V6` for the build commands above. Keep the prior database until **both** analyses have copied their legacy claim profiles. The restored release itself can be inspected without restoring the prior 9 GB database.

To archive a new completed research run (destinations must be fresh and outside the checkout):

```sh
python3 -m associativvordes.family_boundary.query --index /absolute/first --output /absolute/contexts
python3 -m associativvordes.family_boundary.report --help
python3 -m associativvordes.family_boundary.archive pack --archive /absolute/boundary.zip --release /absolute/first --contexts /absolute/contexts --independent /absolute/independent --replay /absolute/REPLAY-RECEIPT.json
python3 -m associativvordes.family_boundary.archive split --archive /absolute/boundary.zip --destination /absolute/volumes
npm test
```

No SQLite file or large export should be committed to Git. `CODE-LOCK.json` binds the executable implementation; `RELEASE-MANIFEST.json` binds the frozen research inputs and outputs. All accepted/excluded labels from earlier sources retain their original authority, scope and version. Missing history or unbound senses block further operations.

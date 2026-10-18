# Isolated morphology import (Prompt 03)

Run with Python 3.11+; standard library only. This directory is never imported by
browser or family builders. It produces **unreviewed ImportRecords**, not the
reviewed Lexeme/Relation/Verdict registry described by Prompt 02. Source lexical
keys and claims are embedded in these staging records; the later evidence-graph
stage must explicitly translate them into the versioned entity envelopes. No
frequency, model confidence, accepted head or membership is generated here.

```sh
python associativvordes/importers/morphology_import.py \
  --lock data/morphology-evidence/sources/source-lock.json \
  --raw-root /absolute/path/to/raw-parent \
  --output-root /absolute/path/outside/repository
python -m unittest discover -s associativvordes/importers -p 'test_*.py' -v
```

The raw parent must contain the relative paths in the lock. Download only the
pinned artifact URLs, preserving original bytes. Missing files, wrong bytes,
invalid headers and decompression failures abort before publication. No network
access occurs during import. ZIP members have their own size/hash locks.

## Products

* `records.ndjson.gz`: deterministic gzip (level 1, mtime 0, no filename), artifact-ID/physical-line order, lossless raw
  fields and original bytes, native IDs/POS, normalized claims, provenance.
* `quarantine.ndjson`: physical line, original bytes and diagnostic; failed
  records never partly contribute graph nodes/claims.
* `normalized-relations.ndjson`: sorted lookup representations. Equal keys
  mean equal normalized *claims*, never equal lexemes, senses or truth.
* `relation-evidence.ndjson`: all occurrences, including duplicates, with exact
  source artifact/revision/line/hash. No independent-vote count is inferred.
* `conflicts.ndjson`: potential incompatible relation types on the same endpoint
  representation; these are review tasks, not automatic rejections.
* `manifest.json`: code/policy/input locks, counts, data output SHA-256s.

SQLite is a bounded 8 MiB-cache disk work index, removed after deterministic
logical export. Physical SQLite layout is not an output contract. A fresh
snapshot is built in a private temporary directory and renamed atomically.
An existing build is reused only after all output hashes are verified. Rebuild
in a second output root to test independent replay, not merely the reuse path.
Granularity is the lock: use a lock containing one source artifact to reuse
unchanged partitions in an orchestration layer. No mutable `latest` is read or
written. No automatic corpus cleanup or promotion exists.

## Normalization and identities

UTF-8 is strict. Lemma/form NFC is separate from original Unicode. Diacritics,
case, spaces and Cyrillic are preserved; casefold is lookup only. No
transliteration or automatic allomorph inference. POS mapping is deliberately
small (`N,V,A/J,R/D` and UPOS); unknown tags remain native with null UPOS.
ISO aliases are explicit, including GLeMM `esp`. A word form is not made into
a derivational lexical node. Inflection features/segment slots are retained
exactly; `-` means absent segmentation, not an empty productive pattern.
MorphyNet derivation supplies no full morpheme segmentation: null is retained.

DeriNet numerical IDs are release-local; even LEMID can collide for homonyms.
UDer lexical IDs therefore include subresource/release/native ID. Resources
without reliable entry/sense IDs use conservative release/record/role keys.
Equal spellings across rows are **not** silently identified. This may retain
multiple unresolved lexical identities and is intentional until alignment.
GLeMM stem/exponents remain source patterns, without root or direction claims.
All GLeMM rows have possible dataset-level MorphyNet dependence; exact row
lineage is unknown unless a later source-specific matcher proves it.

DeriNet primary `Sources` is an ordered multi-parent slot list with its primary
parent preserved separately. All OTHERRELS dictionaries survive. Explicit
secondary IDs become references; unrecognized endpoint encodings remain
unresolved annotations and are counted, never discarded or guessed. The
adapter accepts a graph rather than requiring topological row order; it reports
missing endpoints after the complete resource. It does not certify graph
acyclicity, linguistic annotation, exhaustive homonymy or sense identity.

See the four Prompt 03 reports under `audit/associative-external-preparation/`
for actual source availability and tested coverage. Full snapshots stay outside
Git; only locks, reports and small attributed test excerpts are tracked.

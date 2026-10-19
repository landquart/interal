# Isolated morphological evidence graph — Prompt 04

Read-only analysis, Python standard library. Published checks use Python 3.12.3,
SQLite 3.45.1 and Unicode 15.0.0. No website/family-builder import or membership
writer exists. Source claims are never promoted to family decisions.

The graph has versioned SourceRevision, Lexeme, LexemeSense, Relation, Evidence,
CorpusAlignment, Verdict and ReviewTask records. Existing v6 families, heads,
finite bindings, memberships, allomorph views and historical findings retain
exact ExistingRefs. Envelopes use a JCS-compatible safe JSON subset (UTF-16 key
order; floats/unsafe integers excluded). Legacy numeric source records remain
original JSON strings. Revisions require exact predecessors; identity conflicts
retain both payloads and cannot overwrite the earlier record.

## Reproduce the finite pilot

All acquisition and output paths must be outside the checkout. `--repo` is read
only. Fetch the stage-03 pinned raw files with its existing fetch_sources.py.

```sh
python3 associativvordes/evidence_graph/prepare_registry.py \
  --repo . --cache /absolute/external/registry-original \
  --output /absolute/external/registry --fetch
python3 associativvordes/evidence_graph/select_pilot.py \
  --lock data/morphology-evidence/sources/source-lock.json \
  --raw-root /absolute/external/raw --seeds /absolute/external/registry/seeds.json \
  --output /absolute/external/selection
python3 associativvordes/evidence_graph/prepare_registry.py \
  --repo . --cache /absolute/external/registry-original \
  --records /absolute/external/selection/records.ndjson --output /absolute/external/registry
python3 associativvordes/evidence_graph/build_graph.py \
  --records /absolute/external/selection/records.ndjson \
  --registry data/morphology-evidence/sources/source-lock.json \
  --v6 /absolute/external/registry/v6.json --v6-lock /absolute/external/registry/v6-lock.json \
  --output /absolute/external/graphs
python3 associativvordes/evidence_graph/query_graph.py \
  --snapshot /absolute/external/graphs/BUILD_ID --family CREAT --language en --word creel
```

The approved stage-02 v6 commit is fixed in prepare_registry.py, with exact
upstream git blob checks. V5 controls are read from the immutable stage-03 base
commit. Cached mismatches fail. Omitting --fetch is offline. Generated locks
contain original byte sizes, SHA-256, blob IDs and the projection policy hash.
Existing v5/v6 files are never checked out over production or edited.

Selection chooses up to 12 exact existing lookup words per family/language,
prioritizing reviewed heads/finite links over legacy records. UDer includes a
native-ID neighborhood of radius two. Limits and every input/selection count
are explicit. Every selected record is reparsed by the stage-03 adapter and
compared against original bytes, source revision, locator and extraction ID.

## Semantics and queries

Equal strings never establish lexical identity. NFC/casefold is lookup only;
diagrams, aliases, glosses, stems, translations and transliteration do not merge
nodes. POS compatibility is compatible/conflict/unknown; absent v6 POS stays
unknown. GLeMM definitions are context, not invented sense identities. Native
source lexeme keys and unresolved source-local record/role IDs remain separate.

Relation types and directions stay separate, including shared base, compounding,
allomorphy, historical/etymological context, orthographic variants and formal
similarity. Inflection endpoints are form value objects, not lexical models.
UDer ordered multi-source slots and secondary claims are retained. Out-of-sample
endpoints are diagnosed; every original observation is exported, including roots
and claims which cannot yet be projected.

Graph.paths uses bounded simple-path BFS (depth <=6, <=1000 paths, an expansion
budget), records truncation, all intermediate refs, edge types/directions,
source refs/lineage and confirmed/unconfirmed sections. Homonymous nodes cannot
bridge a chain. Unknown direction requires an explicit hypothesis query.
Inflection, orthographic variants, formal similarity and historical context do
not bridge derivational paths. Compound steps are component scope only. No
transitive closure implies membership.

The same guard applies to direct/alias/fallback/path queries and intermediates.
Current negative/uncertain decisions dominate historical acceptance. Possible
identity overlap holds rather than evades a prohibition with a new source ID.
V5 manual_override is prior finite evidence, not a new manual_verified grant.
Trusted manual permission remains finite; a concurrent manual prohibition wins.
Imported booleans cannot supply grants. Competing relation reviews retain both
immutable decisions and create an effective hold. An indirect review requires
a complete reviewed direct chain, exact intermediates and no cycle. A relation
review is never a lexical-identity or membership verdict.

Snapshots export sorted logical NDJSON indexes and all source observations;
physical SQLite layout is temporary. Build IDs pin inputs/code/runtime and every
output has SHA-256. Graph.open_snapshot verifies and rehydrates indexes without
source corpora; query_graph.py supports --manifest-sha256. The SQLite cache is
8 MiB. Registry projection and comparison groups are bounded pilot data in
memory; this is not a benchmark of a full million-node graph.

```sh
python3 -m unittest discover -s associativvordes/evidence_graph -p 'test_*.py' -v
node --test tests/associative-evidence-graph.test.mjs tests/associative-external-import.test.mjs
```

See the four stage-04 reports in audit/associative-external-preparation. All real
external observations remain unreviewed. Synthetic adversarial controls occur
only in test code. No accepted external verdict, canonical root, membership,
production switch or merge is produced.

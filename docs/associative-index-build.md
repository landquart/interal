# Manual Associative Index Build

This repository provides a manual GitHub Actions workflow for building one Associativ vordes candidate index language at a time without committing generated shards.

## Start the workflow

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Build Associative Index**.
4. Choose **Run workflow**.
5. Select the `language` input. The allowed choices are `en`, `de`, `fr`, `es`, `it`, and `ru`.

Recommended run order when all supported languages are needed:

1. `en`;
2. `de`;
3. `fr`;
4. `es`;
5. `it`;
6. `ru`.

Each workflow run builds exactly one selected language. Select `ru` to build Russian, and run it separately from `en`, `de`, `fr`, `es`, and `it`. This keeps memory usage lower, reduces timeout risk, gives each language a separate artifact, and makes language-specific failures easier to diagnose.

## Build command

The workflow validates the selected language and then builds only that language with:

```sh
npm run build:associative-index -- --languages="${{ inputs.language }}" --report=associativvordes/candidate-index/build-report.json
```

The workflow never passes a combined language list such as `--languages=en,de,fr,es,it,ru` and does not use matrix parallelism. The generator processes source files sequentially and the workflow has a 45 minute timeout. If the build or validation cannot complete safely, the job fails instead of publishing a partial index.

## Download the artifact

After the workflow run finishes, open the completed run summary and download the artifact named **associative-index-&lt;language&gt;** from the **Artifacts** section.

Examples:

- `associative-index-en`;
- `associative-index-de`;
- `associative-index-fr`;
- `associative-index-es`;
- `associative-index-it`;
- `associative-index-ru` for Russian.

## Artifact contents

The artifact contains only the candidate index payload for the selected language:

- `manifest.json`, containing only the selected language manifest fragment in `languages`;
- `<language>/*.json` shard files for the selected language;
- `build-report.json` compact build report;
- checksum files, if the index architecture adds them later.

It must not contain source frequency corpora, `node_modules`, `.git`, fixture files, temporary files, full console logs, or shard data for other languages.

## Check `build-report.json`

Confirm that the report is compact and has this shape:

```json
{
  "language": "de",
  "entries": 0,
  "duplicates_merged": 0,
  "invalid_records": 0,
  "source_files": [],
  "shards": [],
  "total_bytes": 0,
  "transliteration": {
    "version": "1",
    "entries_with_search_form": 0,
    "entries_without_search_form": 0,
    "collisions": 0
  },
  "root_samples": {
    "alter": [],
    "regul": [],
    "ocul": [],
    "inter": []
  }
}
```

For a successful full build, `language` must match the workflow input, `entries` must be greater than zero, and `shards.length` must be greater than zero. `source_files` should list the real production source files used by the build. For Russian, the generator reads the production `LANGUAGE_SOURCES.ru` files in sequence; it does not use fixtures, default frequency tables, manually injected Russian words, or an old standalone `associativvordes/ru.json`. `root_samples` is diagnostic only: samples are derived from the generated index by `search_form`, show original Cyrillic words for Russian, are limited in size, and may be empty when a root has no matches. In the Russian `transliteration` section, check that `version` is `1`, `entries_with_search_form` equals `entries`, `entries_without_search_form` is `0`, and `collisions` is a non-negative count of shared Latin `search_form` values across different original lemmas.

## Validation before upload

Before uploading the artifact, the workflow validates that:

- the manifest contains only the selected language;
- `entries > 0`;
- `shards.length > 0`;
- every manifest shard exists on disk;
- shard counts match the manifest entry count;
- generated JSON contains no `NaN` or `Infinity` values;
- IPM values are not negative;
- `frequency_score` is in the `0`–`100` range;
- every candidate has `word`, `normalized`, and `search_form`;
- every candidate has at least one source;
- Russian `word` and `normalized` remain Cyrillic and are not replaced by transliteration;
- each shard filename matches the first Latin character of `search_form`;
- `build-report.json` matches the selected language and generated entry count.

A validation failure exits with a non-zero status, so upload-artifact is not reached and no incomplete artifact is published.

## What happens after download

For Russian entries, `word` and `normalized` remain Cyrillic, while `search_form` is the Latin representation used only for root matching and shard selection. `frequency_score` is calculated from source IPM values attached to the original normalized lemma, not from the transliterated search form. Search-form collisions do not deduplicate different Cyrillic lemmas; primary deduplication is by normalized original lemma.

Each artifact is language-scoped. If you download artifacts for several languages, merge their manifests in a separate reviewed step before using the generated index. The workflow does not combine manifests across separate runs.

## What the workflow does not do

The workflow does not commit generated index files, does not run `git add`, does not run `git commit`, does not run `git push`, does not open pull requests, and does not deploy or merge anything. Generated files exist only in the workflow workspace and in the downloaded artifact.

## Merge downloaded language artifacts

After the language-specific workflow runs finish, combine only the downloaded artifacts in a separate reviewed step. Do not run a production build during this merge step, do not download artifacts automatically from GitHub in the merge script, and do not copy individual language shards into production by hand.

1. Run the workflow separately for each supported language: `en`, `de`, `fr`, `es`, `it`, and `ru`. The merge requires all six artifacts; five language artifacts are incomplete and must be rejected.
2. Download each artifact from its completed workflow run.
3. Unpack the artifacts into one input directory so that it contains these sibling directories:
   - `associative-index-en`;
   - `associative-index-de`;
   - `associative-index-fr`;
   - `associative-index-es`;
   - `associative-index-it`;
   - `associative-index-ru`.
4. Run the merge command against that input directory and a reviewed output directory:

   ```sh
   npm run merge:associative-index -- --input-root=.tmp/associative-artifacts --output-root=.tmp/associative-index-merged
   ```

5. Inspect `.tmp/associative-index-merged/candidate-index/manifest.json` before using the merged index. The merged output keeps language shards separate under `candidate-index/en/`, `candidate-index/de/`, `candidate-index/fr/`, `candidate-index/es/`, `candidate-index/it/`, and `candidate-index/ru/`; it does not concatenate all languages into one JSON file.
6. Keep the merged `manifest.json` as the source of truth. Do not manually copy standalone shards from a single artifact into production, because that bypasses manifest and compatibility checks.
7. Never merge artifacts built with different schema versions, different `normalizer_version` values, different shard entry formats, or incompatible frequency configuration metadata. The merge command rejects those combinations instead of silently producing a mixed index.

The merge command validates every artifact before writing output. It requires a matching language directory and manifest language, `manifest.json`, `build-report.json`, existing shard files, positive `entries` and shard counts, matching entry metadata, candidates with non-empty `sources`, finite `frequency_score` values, supported versions, and a present config hash. It writes to `<output-root>.tmp`, validates the complete merged candidate index, and then atomically replaces `<output-root>` so a failed merge does not damage an existing output directory.

## Final candidate-index validation

Use the final validator for an already-built language artifact, a merged candidate-index directory, or a small fixture index. It does not build indexes and must not be used as a wrapper around a production corpus run.

Validate one downloaded artifact:

```sh
npm run validate:associative-index -- --index-root=.tmp/associative-index-en --languages=en --strict
```

Validate a merged index directory:

```sh
npm run validate:associative-index -- --index-root=.tmp/associative-index-merged/candidate-index --languages=en,de,fr,es,it,ru --strict --report=.tmp/associative-index-validation.json
```

The validator checks the manifest contract, supported `version` and `normalizer_version`, config hash presence, language metadata, relative shard paths, missing and extra shards, shard JSON shape, deterministic sorting, duplicate `normalized` lemmas per language, candidate fields, finite scores, IPM values, source paths, and forbidden files such as temporary files, source corpora, `node_modules`, fixtures, and build logs inside the index.

For Russian, validation keeps the original lemma as the deduplication key: Cyrillic words must not lose Cyrillic in `normalized`, Latin `search_form` is checked for root-search usability, and shared `search_form` values across different Cyrillic originals are allowed rather than treated as duplicate lemmas. This protects the runtime contract where `word` is displayed as the original form while `search_form` is only the lookup key.

Exit codes are stable:

- `0`: index is valid;
- `1`: validation errors were found in strict mode;
- `2`: CLI usage error;
- `3`: `manifest.json` is missing or unreadable;
- `4`: unsupported manifest `version` or `normalizer_version`.

Critical errors include missing or unreadable manifest, incompatible versions, invalid shard paths, absent shards, entry-count mismatches, non-finite values (`NaN`/`Infinity` after JSON corruption), negative IPM values, candidates without sources, absolute source paths, duplicate normalized lemmas, shard/search-form mismatches, and runtime-contract violations. Warnings are reserved for suspicious but potentially corpus-valid conditions, such as a Russian row that looks transliterated while retaining Cyrillic metadata.

When `--report=<path>` is supplied, the validator writes a compact JSON summary with top-level `valid`, `version`, `normalizer_version`, per-language counts (`entries`, `shards`, `bytes`, `errors`, `warnings`), `root_samples`, and capped top-level `errors`/`warnings`. The report never embeds the full dictionary; use `--max-errors=<number>` to cap stored diagnostics.

Root samples are diagnostic searches for `alter`, `regul`, `ocul`, and `inter` using the runtime-compatible candidate finder. A language may legitimately have no candidate for a sample root. However, `alter` returning `inter`, `international`, or `internet` is treated as a regression because it would recreate the false Associativ vordes match the index is designed to avoid.

Full production candidate-index builds are performed only by the manual GitHub Actions workflow. Do not run local full corpus builds for validation; validate downloaded artifacts, merged artifact directories, or fixtures instead.

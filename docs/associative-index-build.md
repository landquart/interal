# Manual Associative Index Build

This repository provides a manual GitHub Actions workflow for building one Associativ vordes candidate index language at a time without committing generated shards.

## Start the workflow

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Build Associative Index**.
4. Choose **Run workflow**.
5. Select the `language` input. The allowed choices are `en`, `de`, `fr`, `es`, and `it`.

Recommended run order when all supported languages are needed:

1. `en`;
2. `de`;
3. `fr`;
4. `es`;
5. `it`.

Each workflow run builds exactly one selected language. This keeps memory usage lower, reduces timeout risk, gives each language a separate artifact, and makes language-specific failures easier to diagnose.

## Build command

The workflow validates the selected language and then builds only that language with:

```sh
npm run build:associative-index -- --languages="${{ inputs.language }}" --report=associativvordes/candidate-index/build-report.json
```

The workflow never passes `--languages=en,de,fr,es,it` and does not use matrix parallelism. The generator processes source files sequentially and the workflow has a 45 minute timeout. If the build or validation cannot complete safely, the job fails instead of publishing a partial index.

## Download the artifact

After the workflow run finishes, open the completed run summary and download the artifact named **associative-index-&lt;language&gt;** from the **Artifacts** section.

Examples:

- `associative-index-en`;
- `associative-index-de`;
- `associative-index-fr`;
- `associative-index-es`;
- `associative-index-it`.

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
  "root_samples": {
    "alter": [],
    "regul": [],
    "ocul": [],
    "inter": []
  }
}
```

For a successful full build, `language` must match the workflow input, `entries` must be greater than zero, and `shards.length` must be greater than zero. `source_files` should list the real production source files used by the build. `root_samples` is diagnostic only: samples are derived from the generated index, are limited in size, and may be empty when a root has no matches.

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
- every candidate has at least one source;
- `build-report.json` matches the selected language and generated entry count.

A validation failure exits with a non-zero status, so upload-artifact is not reached and no incomplete artifact is published.

## What happens after download

Each artifact is language-scoped. If you download artifacts for several languages, merge their manifests in a separate reviewed step before using the generated index. The workflow does not combine manifests across separate runs.

## What the workflow does not do

The workflow does not commit generated index files, does not run `git add`, does not run `git commit`, does not run `git push`, does not open pull requests, and does not deploy or merge anything. Generated files exist only in the workflow workspace and in the downloaded artifact.

# Manual Associative Index Build

This repository provides a manual GitHub Actions workflow for building the full English Associativ vordes candidate index without committing generated shards.

## Start the workflow

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Build Associative Index**.
4. Choose **Run workflow**.
5. Keep `language` set to `en`. The workflow intentionally fails for any other value.

## Build command

The workflow builds the English index with:

```sh
npm run build:associative-index -- --languages=en --report=associativvordes/candidate-index/build-report.json
```

The generator processes source files sequentially and the workflow has a 45 minute timeout. If the build or validation cannot complete safely, the job fails instead of publishing a partial index.

## Download the artifact

After the workflow run finishes, open the completed run summary and download the artifact named **associative-index-en** from the **Artifacts** section.

## Artifact contents

The artifact contains only the candidate index payload:

- `manifest.json`;
- `en/*.json` English shard files;
- `build-report.json` compact build report.

It must not contain source frequency corpora, `node_modules`, temporary files, or logs with full dictionary contents.

## Check `build-report.json`

Confirm that the report is compact and has this shape:

```json
{
  "language": "en",
  "entries": 0,
  "duplicates_merged": 0,
  "invalid_records": 0,
  "source_files": [],
  "shards": [],
  "total_bytes": 0,
  "alter_candidates": []
}
```

For a successful full build, `entries` and `shards.length` should be greater than zero. `source_files` should list the real English source files used by the build. `alter_candidates` is limited to at most 20 words and is derived only from built entries.

## What the workflow does not do

The workflow does not commit generated index files, does not run `git push`, and does not deploy or merge anything. Generated files exist only in the workflow workspace and in the downloaded artifact.

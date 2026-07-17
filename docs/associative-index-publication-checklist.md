# Associative candidate-index publication checklist

This checklist is intentionally manual. It does not run workflows, merge pull requests, or deploy the site automatically.

## 1. Repository checks

Before building production artifacts:

- [ ] `npm test` passes.
- [ ] `scripts/build-associative-candidate-index.mjs` still builds exactly one selected language.
- [ ] `scripts/validate-associative-index.mjs` accepts the current manifest and normalizer versions.
- [ ] `scripts/merge-associative-index-artifacts.mjs` requires all six languages.
- [ ] `scripts/check-associative-index-deployment.mjs` requires `en`, `de`, `fr`, `es`, `it`, and `ru`.
- [ ] Every required file declared by `LANGUAGE_SOURCES` exists.
- [ ] No production API key, database URL, or token is stored in generated artifacts.

A bounded memory diagnostic can be run before a large build:

```sh
npm run audit:associative-index-memory -- \
  --language=en \
  --input-root="associativvordes/frequency lists" \
  --source-file=bnc-clean2.lemmatized_spacy_ipm6.json \
  --limits=1000,5000,25000 \
  --report=.tmp/associative-index-memory-en.json
```

The diagnostic is deliberately bounded. A successful sample does not prove that a complete production build fits in memory.

## 2. Build six language artifacts

Open **Actions → Build Associative Index → Run workflow** six separate times.

| Language | Workflow run ID | Artifact ID | Result |
| --- | --- | --- | --- |
| `en` |  |  |  |
| `de` |  |  |  |
| `fr` |  |  |  |
| `es` |  |  |  |
| `it` |  |  |  |
| `ru` |  |  |  |

For each run verify:

- [ ] The workflow completed successfully.
- [ ] The artifact is named `associative-index-<language>`.
- [ ] `build-report.json` has the same `language` value as the workflow input.
- [ ] `entries > 0`.
- [ ] At least one shard was produced.
- [ ] Every candidate has sources and a finite `frequency_score`.
- [ ] No source corpus, fixture, `node_modules`, temporary file, or full build log is included.
- [ ] `root_samples.alter` does not contain `inter`, `international`, or `internet`.
- [ ] Russian `word` and `normalized` remain original Cyrillic forms where applicable.

Stop publication when any required source is missing, validation fails, a build times out, a language produces zero entries, or an artifact contains forbidden files.

## 3. Open the publication pull request

After all six artifacts exist, open **Actions → Publish Associative Index Candidate**.

Choose one source mode:

- `run_ids`: fill all six workflow run IDs; or
- `artifact_ids`: fill all six artifact IDs.

Enter the exact confirmation phrase:

```text
PUBLISH_ASSOCIATIVE_INDEX
```

The workflow must:

1. download six named artifacts;
2. merge them atomically;
3. run strict validation;
4. confirm that the merged manifest contains exactly six languages;
5. copy the merged index to `associativvordes/candidate-index/`;
6. run the deployment gate;
7. open a review pull request.

It must not push directly to `main`, merge the pull request, or deploy the site.

## 4. Review the publication pull request

Before merging the pull request:

- [ ] `associativvordes/candidate-index/manifest.json` exists.
- [ ] The manifest contains `en`, `de`, `fr`, `es`, `it`, and `ru`.
- [ ] All language artifacts have the same `global_config_hash`.
- [ ] Every language has a non-empty `language_config_hash`.
- [ ] Every manifest shard exists in the pull request.
- [ ] Strict validation reports `valid: true`.
- [ ] Entry and shard counts match the build reports.
- [ ] `alter` does not return `inter`, `international`, or `internet`.
- [ ] Candidate source objects use `id`, `file`, `category`, and `ipm`.
- [ ] No full frequency corpus is committed.
- [ ] The pull request changes only generated candidate-index files unless another reviewed fix is intentionally included.

Run or confirm:

```sh
npm run validate:associative-index -- \
  --index-root=associativvordes/candidate-index \
  --languages=en,de,fr,es,it,ru \
  --strict

npm run check:associative-index-deployment
```

## 5. Deployment behavior

`vercel.json` runs `npm run check:associative-index-deployment` as the Vercel build command. A deployment is blocked when:

- the production manifest is absent;
- one of the six languages is absent;
- a language has zero entries or zero shards;
- a listed shard file is absent;
- manifest or normalizer versions are incompatible with the runtime loader;
- the browser-relative manifest URL cannot be served as valid JSON.

Do not bypass the gate with a fixture or empty manifest. Publish and review the real merged index instead.

## 6. Final stop conditions

Do not merge or deploy when any of the following is true:

- a workflow run failed or was cancelled;
- memory usage or duration is unbounded or unexplained;
- artifacts were built from different global configurations;
- strict validation reports errors;
- a generated candidate lacks source provenance;
- a Russian original was replaced by transliteration;
- the false `alter → inter` match reappears;
- the candidate-index contains source corpora or secrets;
- the deployment gate does not pass on the pull request.

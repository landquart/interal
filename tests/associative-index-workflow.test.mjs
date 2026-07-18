import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile('.github/workflows/build-associative-index.yml', 'utf8');

assert.match(workflow, /type:\s*choice/, 'language input uses a choice');
for (const language of ['en', 'de', 'fr', 'es', 'it', 'ru']) {
  assert.match(workflow, new RegExp(`- ${language}\\b`), `workflow allows ${language}`);
}
assert.match(workflow, /en\|de\|fr\|es\|it\|ru/, 'workflow validates the allowed language set before building');
assert.doesNotMatch(workflow, /matrix:/, 'workflow does not use matrix parallelism');
assert.doesNotMatch(workflow, /git\s+push/, 'workflow does not push');
assert.doesNotMatch(workflow, /git\s+commit/, 'workflow does not commit');
assert.match(workflow, /timeout-minutes:\s*45/, 'workflow has a 45 minute timeout');
assert.match(workflow, /name:\s*associative-index-\$\{\{ inputs\.language \}\}/, 'artifact name uses selected language, including associative-index-ru');
assert.match(workflow, /--languages="\$\{\{ inputs\.language \}\}"/, 'build command uses only selected language');
assert.doesNotMatch(workflow, /--languages=en,de,fr,es,it,ru/, 'build command does not build all languages at once');

const validateIndex = workflow.indexOf('Validate candidate index');
const uploadIndex = workflow.indexOf('Upload candidate index artifact');
assert.ok(validateIndex > 0, 'workflow validates generated index');
assert.ok(uploadIndex > validateIndex, 'validation runs before upload-artifact');
assert.doesNotMatch(workflow, /if:\s*always\(\)/, 'workflow does not force artifact upload after failures');
assert.doesNotMatch(workflow, /continue-on-error:\s*true/, 'workflow does not continue after build or validation errors');

const russianTestsIndex = workflow.indexOf('Run Russian normalization tests');
const buildIndex = workflow.indexOf('Build selected associative index');
assert.ok(russianTestsIndex > 0, 'workflow runs Russian normalization tests');
assert.ok(buildIndex > russianTestsIndex, 'Russian tests run before build');
const packageIndex = workflow.indexOf('Package candidate index');
assert.ok(packageIndex > buildIndex, 'workflow packages only after the build step succeeds');
assert.ok(uploadIndex > packageIndex, 'workflow uploads only after packaging succeeds');

const publishWorkflow = await readFile('.github/workflows/publish-associative-index.yml', 'utf8');

assert.match(publishWorkflow, /workflow_dispatch:/, 'publish workflow is manual only');
assert.match(publishWorkflow, /confirm_publish:[\s\S]*required:\s*true/, 'publish workflow requires confirmation input');
assert.match(publishWorkflow, /PUBLISH_ASSOCIATIVE_INDEX/, 'publish workflow requires the exact confirmation phrase');
assert.match(publishWorkflow, /artifact_source:[\s\S]*options:[\s\S]*- run_ids[\s\S]*- artifact_ids/, 'publish workflow supports run ID or artifact ID mode');
for (const language of ['en', 'de', 'fr', 'es', 'it', 'ru']) {
  assert.match(publishWorkflow, new RegExp(`${language}_run_id:`), `publish workflow accepts ${language} run ID`);
  assert.match(publishWorkflow, new RegExp(`${language}_artifact_id:`), `publish workflow accepts ${language} artifact ID`);
  assert.match(publishWorkflow, new RegExp(`associative-index-\\$language|associative-index-${language}`), `publish workflow checks ${language} artifact naming`);
}
assert.match(publishWorkflow, /gh run download/, 'publish workflow downloads artifacts by run ID without temporary artifact URLs');
assert.match(publishWorkflow, /actions\/download-artifact@v4/, 'publish workflow downloads artifacts by artifact ID');
assert.match(publishWorkflow, /npm run merge:associative-index/, 'publish workflow merges downloaded artifacts');
assert.match(publishWorkflow, /npm run validate:associative-index[\s\S]*--strict[\s\S]*--report=/, 'publish workflow runs strict validation with a report');
assert.match(publishWorkflow, /manifest languages mismatch/, 'publish workflow verifies the merged manifest language set');
assert.match(publishWorkflow, /associativvordes\/candidate-index/, 'publish workflow copies the result into the runtime candidate-index directory');
assert.match(publishWorkflow, /source corpora|forbidden source/, 'publish workflow checks for source corpora and temporary files');
assert.match(publishWorkflow, /peter-evans\/create-pull-request@v8/, 'publish workflow uses the Node 24 create-pull-request action');
assert.match(publishWorkflow, /id:\s*create_pr[\s\S]*continue-on-error:\s*true/, 'publish workflow tolerates a transient PR API timeout only at the PR action step');
assert.match(publishWorkflow, /name:\s*Verify review pull request/, 'publish workflow verifies that a review PR actually exists');
assert.match(publishWorkflow, /gh pr list[\s\S]*--head "\$PR_BRANCH"/, 'publish workflow polls GitHub for the publication PR');
assert.match(publishWorkflow, /timeout 120s gh pr create/, 'publish workflow has a bounded CLI fallback for PR creation');
assert.match(publishWorkflow, /branch:\s*publish\/associative-index-\$\{\{ github\.run_id \}\}/, 'publish workflow uses a separate publication branch');
assert.match(publishWorkflow, /base:\s*main/, 'publish workflow targets main through a pull request');
assert.doesNotMatch(publishWorkflow, /git\s+push\s+origin\s+main|git\s+push\s+[^\n]*main/, 'publish workflow does not directly push to main');
assert.doesNotMatch(publishWorkflow, /gh\s+pr\s+merge|auto-merge|merge-method/, 'publish workflow does not automatically merge the PR');
assert.doesNotMatch(publishWorkflow, /vercel|gh\s+deploy|vercel\s+deploy/i, 'publish workflow does not deploy before merge');
assert.match(publishWorkflow, /npm run check:associative-index-deployment/, 'publish workflow gates publication with the production candidate-index deployment check');
assert.match(publishWorkflow, /global_config_hash/, 'publish PR body includes global_config_hash');
assert.match(publishWorkflow, /language_config_hash/, 'publish PR body includes language_config_hash values');
assert.match(publishWorkflow, /Validator results/, 'publish PR body includes validator results');
assert.match(publishWorkflow, /Entries \| Shards/, 'publish PR body includes entry and shard counts');

const runtimeLoader = await readFile('associativvordes/js/candidate-index-loader.js', 'utf8');
assert.match(runtimeLoader, /DEFAULT_STATIC_BASE_URL = '\.\/search-index\/'/, 'runtime uses the static search index as its production source');
assert.match(runtimeLoader, /DEFAULT_LEGACY_BASE_URL = '\.\/candidate-index\/'/, 'runtime keeps the relative candidate-index fallback during migration');
assert.match(runtimeLoader, /joinUrl\(baseUrl, 'manifest\.json'\)/, 'runtime loads manifest.json through a relative index base URL');

const staticWorkflow = await readFile('.github/workflows/build-and-publish-associative-search-index.yml', 'utf8');
assert.match(staticWorkflow, /BUILD_AND_PUBLISH_STATIC_SEARCH_INDEX/, 'static publication requires an explicit confirmation phrase');
assert.match(staticWorkflow, /source_run_id:/, 'static publication can reuse a previously validated six-language artifact run');
assert.match(staticWorkflow, /if:\s*inputs\.source_run_id == ''/, 'static build jobs are skipped in artifact-reuse mode');
assert.match(staticWorkflow, /run-id:\s*\$\{\{ inputs\.source_run_id \}\}/, 'artifact-reuse mode downloads the selected workflow run');
assert.match(staticWorkflow, /matrix:[\s\S]*language:\s*\[en, de, fr, es, it, ru\]/, 'static publication builds all six languages separately');
assert.match(staticWorkflow, /build:associative-index[\s\S]*build:associative-search-index/, 'static index is generated directly from frequency-list candidate builds');
assert.match(staticWorkflow, /validate:associative-search-index[\s\S]*--strict/, 'static publication strictly validates generated indexes');
assert.match(staticWorkflow, /rm -rf associativvordes\/search-index associativvordes\/candidate-index/, 'static publication replaces rather than duplicates the legacy index');
assert.match(staticWorkflow, /ref:\s*\$\{\{ github\.ref_name \}\}/, 'static publication checks out the branch selected in Run workflow');
assert.match(staticWorkflow, /fetch-depth:\s*0/, 'publication checkout preserves source-branch history for the combined PR');
assert.match(staticWorkflow, /name:\s*Commit and push review branch/, 'static publication creates the review branch explicitly');
assert.match(staticWorkflow, /git switch -c "\$PR_BRANCH"/, 'static publication creates a real local review branch');
assert.match(staticWorkflow, /git push --force-with-lease origin "\$PR_BRANCH"/, 'static publication pushes the review branch before opening a PR');
assert.match(staticWorkflow, /gh pr create[\s\S]*--base main[\s\S]*--head "\$PR_BRANCH"/, 'static publication opens a PR from the pushed branch to main');
assert.doesNotMatch(staticWorkflow, /peter-evans\/create-pull-request/, 'static publication no longer relies on implicit branch creation by an action');
assert.doesNotMatch(staticWorkflow, /git\s+push\s+origin\s+main|git\s+push\s+[^\n]*main/, 'static publication never pushes directly to main');
assert.doesNotMatch(staticWorkflow, /gh\s+pr\s+merge|auto-merge|merge-method/, 'static publication does not merge automatically');

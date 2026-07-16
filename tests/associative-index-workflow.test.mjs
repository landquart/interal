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

const russianTestsIndex = workflow.indexOf('Run Russian normalization tests');
const buildIndex = workflow.indexOf('Build selected associative index');
assert.ok(russianTestsIndex > 0, 'workflow runs Russian normalization tests');
assert.ok(buildIndex > russianTestsIndex, 'Russian tests run before build');

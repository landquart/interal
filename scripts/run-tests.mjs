import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const testsDir = 'tests';

const excludedTests = new Map([
  // No tests are excluded right now. Add entries only for tests that require an external service,
  // and keep a reason comment next to each exception.
]);

function runNodeTest(testFile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [testFile], { stdio: 'inherit' });
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve({ ok: false, code: 1, signal });
        return;
      }
      resolve({ ok: code === 0, code: code ?? 1, signal: null });
    });
  });
}

const entries = await readdir(testsDir, { withFileTypes: true });
const testFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))
  .map((entry) => join(testsDir, entry.name))
  .sort((a, b) => a.localeCompare(b, 'en'));

const selectedTests = testFiles.filter((testFile) => !excludedTests.has(testFile));

if (!selectedTests.includes('tests/associativvordes-sources-diagnostics.test.mjs')) {
  console.error('Required test is not selected: tests/associativvordes-sources-diagnostics.test.mjs');
  process.exit(1);
}

console.log(`Discovered ${testFiles.length} test files; running ${selectedTests.length}.`);

for (const testFile of selectedTests) {
  console.log(`\n> node ${testFile}`);
  const result = await runNodeTest(testFile);
  if (!result.ok) {
    if (result.signal) {
      console.error(`Test failed: ${testFile} terminated by signal ${result.signal}`);
    } else {
      console.error(`Test failed: ${testFile} exited with code ${result.code}`);
    }
    process.exit(result.code || 1);
  }
}

console.log('\nAll tests passed.');

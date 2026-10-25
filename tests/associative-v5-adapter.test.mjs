import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
test('v5 projection: exact source locks, scoped IDs, history, recovery and modern bridges', () => {
  execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'associativvordes/v5_adapter', '-p', 'test_*.py'], {stdio:'pipe'});
});

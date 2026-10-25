import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
test('historical constraints: finite scopes, corruption, supersession, and restore', () => {
  execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'associativvordes/history_registry', '-p', 'test_*.py'], {stdio:'pipe'});
});

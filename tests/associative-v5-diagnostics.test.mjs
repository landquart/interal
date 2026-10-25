import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('full-v5 diagnostics retain observations, exact scopes and independent flags',()=>{
 execFileSync('python3',['-m','unittest','discover','-s','associativvordes/v5_diagnostics','-p','test_*.py'],{stdio:'pipe'});
});

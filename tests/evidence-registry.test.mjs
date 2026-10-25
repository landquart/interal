import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('research evidence graph adversarial contract',()=>{
 execFileSync('python3',['-m','unittest','associativvordes.evidence_registry.test_model','associativvordes.evidence_registry.test_view'],{stdio:'pipe'});
});

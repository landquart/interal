import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repo=fileURLToPath(new URL('..',import.meta.url));
const run=spawnSync('python3',['-m','unittest','discover','-s','associativvordes/v5_baseline','-p','test_*.py','-v'],{cwd:repo,stdio:'inherit'});
if(run.error) throw run.error;
process.exitCode=run.status??1;

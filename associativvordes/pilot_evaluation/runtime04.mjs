/** Actual current candidate loader + finder. No registry-to-prediction shortcut. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createCandidateIndexLoader} from '../js/candidate-index-loader.js';
import {findCandidatesForRoot} from '../js/candidate-finder.js';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [casesPath,output]=process.argv.slice(2);
if(!casesPath||!output)throw Error('usage: node runtime04.mjs CASES OUTPUT');
const cases=(await readFile(casesPath,'utf8')).trim().split('\n').map(JSON.parse);
const protocol=JSON.parse(await readFile(new URL('./protocol04.json',import.meta.url),'utf8'));
const inputs=new Map(),code=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
async function lockModule(path) {
 path=resolve(path);if(code.has(relative(repo,path)))return;
 const text=await readFile(path,'utf8');code.set(relative(repo,path),hash(text));
 for(const m of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g))if(m[1].startsWith('.'))await lockModule(resolve(dirname(path),m[1]));
}
await lockModule(resolve(repo,'associativvordes/js/candidate-index-loader.js'));
await lockModule(resolve(repo,'associativvordes/js/candidate-finder.js'));
const actualCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const inputCommit=protocol.base_commit;
async function fetchFile(url) {
 const path=String(url).startsWith('/')?resolve(repo,'.'+url):resolve(repo,'associativvordes',String(url));
 if(!path.startsWith(repo+'/'))throw Error('path escape');
 try {
  const bytes=await readFile(path), key=relative(repo,path);
  const expected=execFileSync('git',['rev-parse',inputCommit+':'+key],{cwd:repo,encoding:'utf8'}).trim();
  const blob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(blob!==expected)throw Error('changed runtime resource: '+key);
  inputs.set(key,{sha256:hash(bytes),git_blob:blob,bytes:bytes.length});
  const raw=bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes;
  return new Response(raw,{status:200,headers:{'Content-Type':'application/json'}});
 } catch(e) {if(e.code==='ENOENT')return new Response('{}',{status:404});throw e;}
}
const scopes=[...new Set(cases.map(c=>JSON.stringify([c.family,c.language])))].sort().map(JSON.parse);
const searches=[];
for(const [family,language]of scopes) {
 const start=performance.now();
 const loader=createCandidateIndexLoader({fetch:fetchFile,preferStatic:true});
 try {
  const root=family.slice(7);
  const entries=await loader.loadCandidateEntries(language,root,{elementType:'root'});
  const result=findCandidatesForRoot({entries,root,language,elementType:'root',maxCandidates:Infinity,groupModels:false});
  searches.push({family,language,root,complete:true,truncated:false,candidates:result.candidates,
    diagnostics:{...result.diagnostics,loader:loader.getCandidateIndexDiagnostics()},runtime_seconds:(performance.now()-start)/1000});
 }catch(e){searches.push({family,language,complete:false,truncated:false,candidates:[],error:String(e),runtime_seconds:(performance.now()-start)/1000});}
}
await writeFile(output,JSON.stringify({schema:'pilot04-actual-runtime/1',capture_kind:'actual_runtime',base_commit:inputCommit,runner_commit:actualCommit,
  node_versions:process.versions,cases_file_sha256:hash(await readFile(casesPath)),runtime_code_hashes:Object.fromEntries([...code].sort()),resource_receipts:Object.fromEntries([...inputs].sort()),searches,
  recorded_at:new Date().toISOString(),paid_model_calls:0,scope:'current candidate-generation stage only; semantic LLM scoring is not invoked'},null,2)+'\n');
console.log(JSON.stringify({searches:searches.length,complete:searches.filter(x=>x.complete).length,resources:inputs.size,candidates:searches.reduce((n,s)=>n+s.candidates.length,0)}));

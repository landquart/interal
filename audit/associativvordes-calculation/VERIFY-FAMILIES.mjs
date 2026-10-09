import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=path.resolve(process.argv[2]||'.');
const {createCandidateIndexLoader}=await import(pathToFileURL(path.join(dir,'associativvordes/js/candidate-index-loader.js')));
const calls=[];
const local=async url=>{calls.push(String(url));const u=new URL(url,'https://example.invalid/associativvordes/');try{return new Response(await readFile(path.join(dir,u.pathname)),{headers:{'Content-Type':u.pathname.endsWith('.gz')?'application/gzip':'application/json'}});}catch{return new Response('missing',{status:404});}};
const loader=createCandidateIndexLoader({fetch:local});
for(const root of ['regul','nat','loc','inter','zzzz']){
 const all=[];for(const lang of ['en','de','fr','es','it','ru']){const entries=await loader.loadCandidateEntries(lang,root);all.push({lang,count:entries.length,examples:entries.slice(0,3).map(x=>x.lemma||x.word),family:loader.getCandidateIndexDiagnostics().familyIndexStatus});}console.log(root,JSON.stringify(all));
}
for(const type of ['root','preposition']){const l=createCandidateIndexLoader({fetch:local});const e=await l.loadCandidateEntries('en','inter',{elementType:type});console.log('INTER_TYPE',type,e.length,e.slice(0,5).map(x=>x.word||x.lemma));}
console.log('resources',calls.length);
for(const [root,expected] of [['nat',['nation','natural','natalism']],['loc',['location','local','locomotive']],['inter',['international','interval','internet']]]){const e=await loader.loadCandidateEntries('en',root);console.log('REQUESTED_EXAMPLES',root,expected.map(w=>({word:w,present:e.some(x=>(x.word||x.lemma)===w)})));console.log('PROOF_SAMPLE',root,JSON.stringify(e[0]));}

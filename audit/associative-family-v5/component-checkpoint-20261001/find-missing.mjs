import{readFile,writeFile,readdir}from'node:fs/promises';import{gunzipSync}from'node:zlib';
const r='/workspace/scratch/dab7b6b0d8c3/review',root='/workspace/scratch/510f41b5cadf/interal/associativvordes/family-index-v5';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const words={nat:await read(r+'/nat-reviewed-words.json'),loc:await read(r+'/loc-reviewed-words.json')};
for(const lang of ['en','de','fr','es','it','ru']){
 const snapshots={},missing={};for(const key of ['nat','loc']){snapshots[key]=await read(`${r}/${key}-${lang}.json`);const have=new Set(snapshots[key].map(m=>m.word));missing[key]=new Set(words[key][lang].filter(w=>!have.has(w)));}
 let found=[];for(const file of (await readdir(`${root}/members/${lang}`)).sort()){
  const shard=JSON.parse(gunzipSync(await readFile(`${root}/members/${lang}/${file}`)));
  for(const [id,ms]of Object.entries(shard))for(const m of ms)for(const key of ['nat','loc'])if(missing[key].delete(m.word)){snapshots[key].push({...m,family_ids:[id],retrieval_only:true});found.push([key,m.word]);}
 }
 for(const key of ['nat','loc'])await writeFile(`${r}/${key}-${lang}.json`,JSON.stringify(snapshots[key].sort((a,b)=>a.word.localeCompare(b.word))));
 console.log(JSON.stringify({lang,found,absent:Object.fromEntries(Object.entries(missing).map(([k,s])=>[k,[...s]]))}));
}

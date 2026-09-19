import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const root = process.argv[2];
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const bucket = value => { let hash=0x811c9dc5; for (const char of String(value)) { hash^=char.codePointAt(0); hash=Math.imul(hash,0x01000193); } return ((hash>>>0)%256).toString(16).padStart(2,'0'); };
const stableLemmaId = (language, normalized) => `lemma:${createHash('sha256').update([language.toLowerCase(),String(normalized).normalize('NFC').toLocaleLowerCase('und')].join('\0')).digest('hex').slice(0,20)}`;
const sortedUnique = values => new Set(values).size===values.length && values.every((v,i)=>i===0||values[i-1]<v);

const manifest=await readJson(join(root,'manifest.json'));
const report=await readJson(join(root,'report.json'));
assert(manifest.version==='4',`manifest version ${manifest.version}`);
assert(report.controls_ok,'controls_ok=false');
for(const [name,value] of Object.entries(report.invariants)) if(typeof value==='boolean') assert(value,`invariant ${name}=false`);

const familyIds=new Set();
let familyCount=0;
const familyFiles=(await readdir(join(root,'families'))).filter(x=>x.endsWith('.json')).sort();
assert(familyFiles.length===256,`family shard count ${familyFiles.length}`);
for(const file of familyFiles){const shard=await readJson(join(root,'families',file));for(const [id,f] of Object.entries(shard)){assert(id===f.id,`family key mismatch ${id}`);assert(bucket(id)===basename(file,'.json'),`family bucket ${id}`);assert(!familyIds.has(id),`duplicate family ${id}`);assert(f.support>0&&f.aliases?.length&&f.canonical,`invalid family ${id}`);familyIds.add(id);familyCount++;}}
assert(familyCount===manifest.counts.families&&familyCount===report.total_families,`family count ${familyCount}`);

const aliasMap=new Map();
const aliasFiles=(await readdir(join(root,'aliases'))).filter(x=>x.endsWith('.json')).sort();
assert(aliasFiles.length===256,`alias shard count ${aliasFiles.length}`);
for(const file of aliasFiles){const shard=await readJson(join(root,'aliases',file));for(const [alias,ids] of Object.entries(shard)){assert(bucket(alias)===basename(file,'.json'),`alias bucket ${alias}`);assert(sortedUnique(ids),`alias ids ${alias}`);for(const id of ids)assert(familyIds.has(id),`alias ${alias}->${id}`);assert(!aliasMap.has(alias),`duplicate alias ${alias}`);aliasMap.set(alias,new Set(ids));}}
assert(aliasMap.size===manifest.counts.aliases&&aliasMap.size===report.aliases_in_lookup,`alias count ${aliasMap.size}`);
for(const file of familyFiles){const shard=await readJson(join(root,'families',file));for(const f of Object.values(shard))for(const alias of new Set(f.aliases))assert(aliasMap.get(alias)?.has(f.id),`missing reverse alias ${f.id}/${alias}`);}

const lemmas=Object.fromEntries(manifest.languages.map(x=>[x,new Set()]));
const assignedBuckets=Object.fromEntries(manifest.languages.map(x=>[x,Array(256).fill(0)]));
const assignmentRows={};let components=0,memberships=0;
for(const language of manifest.languages){const lines=createInterface({input:createReadStream(join(root,'assignments',`${language}.jsonl.gz`)).pipe(createGunzip()),crlfDelay:Infinity});let count=0;for await(const line of lines){if(!line)continue;const row=JSON.parse(line);assert(row.language===language,`${language} language mismatch`);assert(row.lemma_id===stableLemmaId(language,row.normalized||row.word),`${language} unstable id ${row.word}`);assert(!lemmas[language].has(row.lemma_id),`${language} duplicate ${row.lemma_id}`);assert(row.sources?.length,`${language} sources ${row.word}`);assert(sortedUnique(row.family_ids)&&row.family_ids.length,`${language} families ${row.word}`);for(const id of row.family_ids){assert(familyIds.has(id),`${language} missing ${id}`);assignedBuckets[language][parseInt(bucket(id),16)]++;memberships++;}const rowIds=new Set(row.family_ids);assert(row.components?.length,`${language} components ${row.word}`);for(const c of row.components){assert(c.canonical_candidate&&c.family_ids?.length&&c.evidence?.length,`${language} component ${row.word}`);for(const id of c.family_ids)assert(rowIds.has(id),`${language} component relation ${row.word}/${id}`);for(const e of c.evidence)assert(e.type&&e.source&&Array.isArray(e.path)&&Number.isFinite(e.confidence),`${language} evidence ${row.word}`);components++;}lemmas[language].add(row.lemma_id);count++;}assignmentRows[language]=count;assert(count===report.source_entries[language]&&count===report.assignment_stats[language].total,`${language} rows ${count}`);}
assert(components===manifest.counts.components&&components===report.components_assigned,`components ${components}`);

const materializedFamilies=new Set();const memberBuckets=Object.fromEntries(manifest.languages.map(x=>[x,Array(256).fill(0)]));const actualLanguageSupport=new Map();let materializedMemberships=0;
for(const language of manifest.languages){const dir=join(root,'members',language);const files=(await readdir(dir)).filter(x=>x.endsWith('.json')).sort();assert(files.length===256,`${language} member shards ${files.length}`);for(const file of files){const b=basename(file,'.json');const shard=await readJson(join(dir,file));for(const [id,values] of Object.entries(shard)){assert(bucket(id)===b,`${language} member bucket ${id}`);assert(familyIds.has(id),`${language} member family ${id}`);assert(values.length,`${language} empty family ${id}`);const counts=actualLanguageSupport.get(id)||{};counts[language]=values.length;actualLanguageSupport.set(id,counts);const seen=new Set();for(const value of values){assert(lemmas[language].has(value.lemma_id),`${language} unknown lemma ${value.lemma_id}`);assert(!seen.has(value.lemma_id),`${language} duplicate member ${id}/${value.lemma_id}`);assert(typeof value.word==='string'&&value.word&&typeof value.search_form==='string'&&value.search_form,`${language} runtime member text ${id}/${value.lemma_id}`);assert(Number.isFinite(value.frequency_score)&&value.frequency_score>=0&&value.frequency_score<=100,`${language} runtime member frequency ${id}/${value.lemma_id}`);assert(Array.isArray(value.sources)&&value.sources.length,`${language} runtime member sources ${id}/${value.lemma_id}`);assert(value.components?.length,`${language} member components ${id}`);for(const c of value.components)assert(c.canonical_candidate&&c.evidence?.length,`${language} member evidence ${id}`);seen.add(value.lemma_id);materializedMemberships++;memberBuckets[language][parseInt(b,16)]++;}materializedFamilies.add(id);}}}
assert(materializedMemberships===memberships,`membership count ${materializedMemberships}/${memberships}`);
for(const language of manifest.languages)for(let i=0;i<256;i++)assert(memberBuckets[language][i]===assignedBuckets[language][i],`${language}/${i.toString(16).padStart(2,'0')} membership ${memberBuckets[language][i]}/${assignedBuckets[language][i]}`);
for(const id of familyIds)assert(materializedFamilies.has(id),`family without members ${id}`);
for(const file of familyFiles){const shard=await readJson(join(root,'families',file));for(const family of Object.values(shard)){const actual=actualLanguageSupport.get(family.id)||{};const expected=family.language_support||{};for(const language of manifest.languages)assert((expected[language]||0)===(actual[language]||0),`language support mismatch ${family.id}/${language}: ${expected[language]||0}/${actual[language]||0}`);const support=Object.values(actual).reduce((sum,count)=>sum+count,0);assert(family.support===support,`family support mismatch ${family.id}: ${family.support}/${support}`);}}
const total=Object.values(assignmentRows).reduce((a,b)=>a+b,0);assert(total===manifest.counts.lemmas&&total===report.invariants.classified_unique_lemmas,`total rows ${total}`);
console.log(JSON.stringify({valid:true,families:familyCount,aliases:aliasMap.size,assignment_rows:assignmentRows,components,memberships,materialized_families:materializedFamilies.size,controls_ok:report.controls_ok},null,2));

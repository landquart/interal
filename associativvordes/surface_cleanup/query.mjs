// Exact complete candidate scope; a lookup never creates an exclusion.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const [run,family]=process.argv.slice(2);if(!family)throw Error('query.mjs RUN EXACT_FAMILY_ID');
let h=2166136261;for(const c of family)h=Math.imul(h^c.codePointAt(0),16777619);const b=((h>>>0)%256).toString(16).padStart(2,'0');
const manifest=JSON.parse(readFileSync(join(run,'MANIFEST.json')));const receipt=manifest.buckets.find(x=>x.bucket===b);
function rows(name){const bytes=readFileSync(join(run,'buckets',b,name));if(createHash('sha256').update(bytes).digest('hex')!==receipt.files[name].sha256)throw Error('changed scope artifact');return gunzipSync(bytes).toString().trim().split('\n').filter(Boolean).map(JSON.parse);}
const f=rows('FAMILIES.ndjson.gz').find(x=>x.family_id===family);if(!f)throw Error('unknown exact family ID');
console.log(JSON.stringify({observation:f,source_inventory_sha256:manifest.identity.source_inventory_sha256,source_commit:manifest.identity.source_commit}));
let count=0;
for(const [fid,language,lemma_id,ordinal]of rows('AFFECTED-IDS.ndjson.gz'))if(fid===family){
 console.log(JSON.stringify({family_id:fid,language,source_lemma_id:lemma_id,source_path:`members/${language}/${b}.json.gz`,source_ordinal:ordinal,linguistic_verdict:'UNRESOLVED'}));count++;
}
if(f.candidate&&count!==f.full_scope_memberships)throw Error('incomplete finite scope');

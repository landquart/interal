#!/usr/bin/env node
// Explicit bounded lexical decisions; no source corpus regeneration.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root=process.argv[2]||'associativvordes/family-index-v5',mode=process.argv[3]||'plan';
assert(['plan','apply'].includes(mode));
const ledgerPath='audit/associative-family-v5/information-decisions-20260930.json';
const repair='consolidate_and_prune_latin_informatio_20260930',base='78182754c4254b6c26aba42e556cb67158bb8c14',sourceRun=35647932153;
const id='ety:497564008159',duplicate='ety:b34a3a0ff582',languages=['en','de','fr','es','it','ru'];
const aliases=['informacion','informacija','informatio','information','informazione'].sort();
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const path=(part,key)=>join(root,part,familyBucket(key)+'.json.gz');
const cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p)};
// Full German list reviewed manually. Each retained compound contains lexical
// Information, not the dance-formation substring in Jugendlateinformation.
const retainedWords={
 en:'counterinformation disinformation information informationist informations misinformation'.split(' '),
 de:`adresseninformation anlegerinformation anreiseinformation arzneimittelinformation arzneistoffinformation berichtsentwurfsinformation besucherinformation bildungsinformation bürgerinformation bürgerinformationsabend durchwahlinformation einzelinformation erstinformation fahrerinformation fahrgastinformation fakteninformation feldinformation fluggastinformation folgeinformation gebietsinformation gebrauchsinformation gebühreninformation gegeninformationsbüro gehirninformation gepäckinformation hintergrundsinformation höheninformation homöopathieinformation information informationsabend informationsabruf informationsalarm informationsamt informationsangebot informationsanspruch informationsarbeit informationsarchitektur informationsauffangnetz informationsautomat informationsbank informationsbedarf informationsbegriff informationsbereich informationsbericht informationsbesuch informationsbüro informationschef informationsdefizit informationsdiebstahl informationsentzug informationsethik informationsfabrik informationsfahrt informationsfeld informationsfibel informationsforum informationsfrequenz informationsgehalt informationsgesellschaft informationsgespräch informationsgestalt informationsinfrastruktur informationskanal informationskapsel informationskiosk informationskluft informationskomfort informationskompetenz informationskomplex informationskrieg informationskultur informationslieferant informationsmail informationsmanko informationsmedium informationsmodell informationsmodul informationsmonopol informationsnachmittag informationsobjekt informationsorientiert informationspflicht informationsplattform informationspolitik informationspool informationsportal informationsprodukt informationsprofi informationspunkt informationsqualität informationsraum informationsreich informationsrohr informationsrundgang informationsschau informationssignal informationsspiel informationsstruktur informationstag informationsteam informationstechnik informationsteil informationsthema informationstransparenz informationstyp informationsübersicht informationsverlust informationsvielfalt informationsvortrag informationszentrum informationszettel jugendinformationszentrum klimainformation konsumenteninformation kontrollinformation kosteninformation kulturinformationszentrum kurzinformation lageinformation leserinformation medieninformation misinformation nachrichteninformation naehrwertinformation presseinformation produktinformation proteininformation renteninformation responderinformation sachinformation schwesterninformation sekundärinformation selbstinformation sonderinformation stadtinformation stelleninformation strukturinformation tarifinformation tourismusinformation touristeninformation touristinformation transinformation verbandinformation verbraucherinformation vorstandsinformation wahnsinnsinformation waldinformation weininformation weltinformationsgipfel werbeinformation wohninformation zellinformation`.split(' '),
 fr:'information informationnel mésinformation préinformation surinformation'.split(' '),
 es:'bioinformación desinformacion desinformación informacion información informacional malinformación'.split(' '),
 it:'contro-informazione controinformazione disinformazione informazionale informazionali informazioncina informazione informazione-formazione malinformazione metainformazione misinformazione preinformazione'.split(' '),
 ru:[]
};
const explicitExclusions={
 en:{brainformation:'incidental_substring: brain + formation',desinformation:'unverified_spelling_or_language_variant'},
 de:{berusinformationstag:'unverified_spelling: expected Berufsinformationstag',fürinformation:'fused_phrase: für Information',informations:'not_standard_German_inflection',informationschrift:'unverified_spelling: expected Informationsschrift',informationweek:'named_publication_not_lexical_derivative',jugendlateinformation:'incidental_substring: Jugend + Latein + Formation (dance)',pressinformation:'unverified_spelling_or_foreign_variant'},
 es:Object.fromEntries(['informacíon','informacíón','ínformación','ínformacíón','informaciona','informaciónes','informacioness'].map(w=>[w,'malformed_spelling_or_inflection'])),
 it:{informatizzazione:'different_lexical_branch: informatiser/informatizzare; suffix alone does not justify this link',informattazione:'unverified_spelling',informazion:'unverified_apocope_or_truncation',informzazione:'unverified_spelling',tminformazione:'unresolved_prefix_artifact',traffinformazione:'unresolved_truncation_artifact'},fr:{},ru:{}
};
const headwords={en:'information',de:'information',fr:'information',es:'información',it:'informazione',ru:'информация'};
function relation(lang,word){
 if(word===headwords[lang])return {relation:'borrowed_ancestry',analysis:lang==='en'?'Middle French information < Latin informatio':'lexical information headword with recorded Latin ancestry'};
 if(lang==='de'){
  if(word==='misinformation')return {relation:'borrowed_prefixed_derivative',analysis:'English mis- + information; corpus usage, language assignment not independently certified'};
  const at=word.indexOf('information');assert(at>=0);
  const prefix=word.slice(0,at),tail=word.slice(at+11),link=tail.startsWith('s')?'s':'',suffix=tail.slice(link.length);
  return {relation:'compound_or_compound_adjective',analysis:[prefix,'Information',link,suffix].filter(Boolean).join(' + ')};
 }
 const analyses={counterinformation:'counter- + information',disinformation:'dis- + information',informationist:'information + -ist',informations:'information + -s; legal count-noun sense; source token sense unresolved',misinformation:'mis- + information',informationnel:'information + -nel',mésinformation:'més- + information',préinformation:'pré- + information',surinformation:'sur- + information',bioinformación:'bio- + información',desinformacion:'des- + información; accentless corpus variant',desinformación:'des- + información',informacion:'información; accentless corpus variant',informacional:'información + -al',malinformación:'mal- + información','contro-informazione':'contro- + informazione',controinformazione:'contro- + informazione',disinformazione:'dis- + informazione',informazionale:'informazione + -ale',informazionali:'informazionale + plural -i',informazioncina:'informazione + diminutive -cina','informazione-formazione':'informazione + formazione; coordinated compound, not merged etymons',malinformazione:'mal- + informazione',metainformazione:'meta- + informazione',misinformazione:'mis- + informazione',preinformazione:'pre- + informazione'};
 assert(analyses[word],word);return {relation:'lexical_derivative_or_variant',analysis:analyses[word]};
}
const manifest=await read(join(root,'manifest.json')),report=await read(join(root,'report.json')),provenance=await read(join(root,'repository-provenance.json'));
assert.equal(manifest.repository_storage.immutable_source_run_id,sourceRun);assert.equal(provenance.source_run_id,sourceRun);
assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
const family=(await get(path('families',id)))[id],other=(await get(path('families',duplicate)))[duplicate];
assert.deepEqual(family.etymon_keys,['la:informatio']);assert.deepEqual(other.etymon_keys,['la:informati']);
assert.deepEqual(family.relation_evidence,other.relation_evidence);assert.equal(family.support,3598);assert.equal(other.support,3598);
if(mode==='plan'){
 const decisions=[];
 for(const language of languages){
  const ms=(await read(path('members/'+language,id)))[id]||[],dm=(await read(path('members/'+language,duplicate)))[duplicate]||[];
  assert.deepEqual(ms,dm,'Duplicate arrays differ');
  const kept=ms.filter(m=>retainedWords[language].includes(m.word)).map(m=>({lemma_id:m.lemma_id,word:m.word,...relation(language,m.word)}));
  assert.equal(kept.length,retainedWords[language].length);assert.equal(new Set(retainedWords[language]).size,kept.length);
  const excluded=ms.filter(m=>!retainedWords[language].includes(m.word)).map(m=>({lemma_id:m.lemma_id,word:m.word,reason:explicitExclusions[language][m.word]||(language==='it'&&!m.word.includes('inform')?'suffix_only_unrelated_lexeme':'fused_phrase_or_unverified_artifact')}));
  decisions.push({language,original_count:ms.length,ordered_member_sha256:digest(ms),retained:kept,excluded});
 }
 let anchors=[];
 for(const n of (await readdir(join(root,'members/ru'))).sort())for(const [fid,ms]of Object.entries(await read(join(root,'members/ru',n))))for(const m of ms)if(m.word==='информация')anchors.push({source_family_id:fid,member:m});
 assert.equal(anchors.length,1);assert.equal(anchors[0].member.lemma_id,'lemma:154339eb0e1a7883c8f8');
 const aliasBefore={};for(const a of new Set([...family.aliases,...other.aliases,...aliases]))aliasBefore[a]=(await get(path('aliases',a)))[a]||[];
 const preservedFamilies=[];
 for(const fid of [...new Set(Object.values(aliasBefore).flat())].filter(fid=>fid!==id&&fid!==duplicate).sort()){
  const f=(await get(path('families',fid)))[fid],members={};
  for(const language of languages){const ms=(await read(path('members/'+language,fid)))[fid]||[];members[language]={count:ms.length,ordered_member_sha256:digest(ms)}}
  preservedFamilies.push({family_id:fid,family_sha256:digest(f),members});
 }
 const addedAnchors=[{language:'ru',...anchors[0],...relation('ru','информация')}];
 const germanAnchorFamily='surface:de:informatio';
 const germanAnchorMembers=(await read(path('members/de',germanAnchorFamily)))[germanAnchorFamily];
 assert.deepEqual(germanAnchorMembers.map(m=>m.word),['informationsbildschirm','informationsflut']);
 for(const member of germanAnchorMembers)addedAnchors.push({language:'de',source_family_id:germanAnchorFamily,member,...relation('de',member.word)});
 const ledger={schema_version:1,source_run_id:sourceRun,base_commit:base,repair,canonical_family_id:id,deleted_duplicate_family_id:duplicate,canonical:'informatio',aliases,family_sha256:digest(family),duplicate_family_sha256:digest(other),original_families:[family,other],alias_before:aliasBefore,preserved_families:preservedFamilies,decisions,added:addedAnchors,expected_removed_memberships:7196-decisions.reduce((s,d)=>s+d.retained.length,0),expected_added_memberships:3,review_method:'Complete arrays examined. Explicit retained lists and morphological analyses; excluded suffix peers are a bounded structural decision, not individual dictionary reviews. Original corpus records and every unrelated membership remain. Unverified spellings and named publication are recorded separately, not declared nonexistent words.',size_exception:{language:'de',threshold:20,retained:retainedWords.de.length+2,reason:'Productive transparent Information compounds; no arbitrary truncation to twenty.'},limitations:['German compound analyses establish the Information component, not dictionary certification of every rare formation.','English informations retained for its legal count sense; original token context is unresolved.','No expansion to absent derivatives. Russian headword and two genuine German compounds previously indexed under informatio are the three source-supported additions; their other source families are untouched.','Other azion pairs and informati surface routes are separate review work.'],sources:[
 {url:'https://www.merriam-webster.com/dictionary/information',use:'Headword and legal count sense including informations'},
 {url:'https://en.wiktionary.org/wiki/information',use:'English French/Latin ancestry; der template does not prove inheritance'},
 {url:'https://en.wiktionary.org/wiki/counterinformation',use:'counter- + information'},
 {url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC2859271/',use:'Original NIH informationist research'},
 {url:'https://www.duden.de/rechtschreibung/Information',use:'German lexical head and inflection'},
 {url:'https://www.cnrtl.fr/definition/informationnel',use:'French derivative'},
 {url:'https://www.treccani.it/vocabolario/controinformazione/',use:'contro- + informazione'},
 {url:'https://www.treccani.it/vocabolario/informazionale/',use:'informazione + -ale'},
 {url:'https://www.treccani.it/vocabolario/informatizzazione/',use:'Different computerisation branch'},
 {url:'https://iris.unitn.it/retrieve/3d9ff683-defe-4328-bafc-7fedec6244c8/Bucci%20et%20al..pdf',use:'Primary institutional terminology misinformazione/malinformazione'}
 ].map(s=>({...s,accessed:'2026-09-30'}))};
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode,ledger:ledgerPath,retained:decisions.map(d=>[d.language,d.retained.length]),removed:ledger.expected_removed_memberships,added:3}));
}else{
 const bytes=await readFile(ledgerPath),l=JSON.parse(bytes),sha=createHash('sha256').update(bytes).digest('hex');
 assert.equal(l.source_run_id,sourceRun);assert.equal(l.base_commit,base);assert.equal(l.canonical_family_id,id);assert.equal(l.deleted_duplicate_family_id,duplicate);assert.deepEqual(l.aliases,aliases);
 assert.equal(digest(family),l.family_sha256);assert.equal(digest(other),l.duplicate_family_sha256);
 for(const d of l.preserved_families){
  assert.equal(digest((await get(path('families',d.family_id)))[d.family_id]),d.family_sha256);
  for(const language of languages){const ms=(await read(path('members/'+language,d.family_id)))[d.family_id]||[];assert.equal(digest(ms),d.members[language].ordered_member_sha256)}
 }
 for(const [a,targets]of Object.entries(l.alias_before))assert.deepEqual((await get(path('aliases',a)))[a]||[],targets);
 const changed=new Set();let removed=0,added=0;
 for(const d of l.decisions){
  assert.deepEqual(d.retained.map(m=>m.word).sort(),retainedWords[d.language].slice().sort());
  const mp=path('members/'+d.language,id),dp=path('members/'+d.language,duplicate),ms=(await get(mp))[id]||[],dm=(await get(dp))[duplicate]||[];
  assert.equal(digest(ms),d.ordered_member_sha256);assert.deepEqual(ms,dm);assert.equal(ms.length,d.original_count);
  const ids=new Set(d.retained.map(m=>m.lemma_id)),keep=ms.filter(m=>ids.has(m.lemma_id));assert.equal(keep.length,d.retained.length);
  for(const m of keep){const decision=d.retained.find(x=>x.lemma_id===m.lemma_id);assert.equal(m.word,decision.word);assert.deepEqual(relation(d.language,m.word),{relation:decision.relation,analysis:decision.analysis})}
  for(const a of l.added.filter(a=>a.language===d.language)){
   const source=(await read(path('members/'+d.language,a.source_family_id)))[a.source_family_id].find(m=>m.lemma_id===a.member.lemma_id);assert.deepEqual(source,a.member);assert(!ids.has(source.lemma_id));keep.push(structuredClone(source));added++;
  }
  removed+=ms.length+dm.length-(keep.length-l.added.filter(a=>a.language===d.language).length);
  for(const m of keep){const decision=d.retained.find(x=>x.lemma_id===m.lemma_id)||l.added.find(a=>a.member.lemma_id===m.lemma_id);m.components=[{surface:m.search_form,canonical_candidate:'informatio',confidence:1,evidence:[{type:'manual_override',source:'linguistic_review',path:[d.language,m.word,id],confidence:1,relation_type:decision.relation,analysis:decision.analysis}]}]}
  if(keep.length){(await get(mp))[id]=keep;changed.add(mp)}else if(ms.length){delete(await get(mp))[id];changed.add(mp)}
  if(dm.length){delete(await get(dp))[duplicate];changed.add(dp)}
 }
 assert.equal(removed,l.expected_removed_memberships);assert.equal(added,3);
 const fp=path('families',id),dfp=path('families',duplicate);delete(await get(dfp))[duplicate];changed.add(dfp);
 Object.assign(family,{canonical:'informatio',aliases,etymon_keys:['la:informatio'],runtime_curated:true,verified:false,review_status:'needs_review',review_status_reason:'bounded_lexical_morphology_review_with_documented_size_exception',suspicion_score:0,suspicion_reasons:[],canonical_selection:{method:'manual_lexical_etymon_review'},relation_types:['borrowed_form'],reviewed_relation_note:'Borrowed Latin ancestry, including French mediation in English; original extraction relation_evidence is preserved as source evidence, not inheritance certification.',language_support:Object.fromEntries(l.decisions.map(d=>[d.language,d.retained.length+l.added.filter(a=>a.language===d.language).length]).filter(([,n])=>n)),support:l.decisions.reduce((s,d)=>s+d.retained.length,0)+l.added.length,manual_size_exception:l.size_exception});changed.add(fp);
 assert.equal(family.support,Object.values(family.language_support).reduce((s,n)=>s+n,0));
 let aliasesAdded=0;
 for(const a of Object.keys(l.alias_before)){
  const p=path('aliases',a),s=await get(p),old=s[a]||[],targets=old.filter(x=>x!==id&&x!==duplicate);
  if(aliases.includes(a))targets.push(id);
  if(!old.length&&targets.length)aliasesAdded++;
  const next=[...new Set(targets)].sort();if(!next.length)delete s[a];else s[a]=next;
  if(JSON.stringify(old)!==JSON.stringify(next))changed.add(p);
 }
 manifest.counts.families--;manifest.counts.aliases+=aliasesAdded;
 Object.assign(report.repository_materialization,{information_ledger_sha256:sha,information_memberships_removed:removed,information_memberships_added:added});
 provenance.repository_repairs.push({repair,source_run_id:sourceRun,removed_memberships:removed,added_memberships:added,deleted_families:[duplicate],retained_family:id,added_aliases:aliasesAdded,decision_ledger_sha256:sha,not_individual_lexical_annotation:true});
 for(const p of changed)await write(p,cache.get(p));cache.clear();
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);report.aliases_in_lookup=manifest.counts.aliases;
 await write(join(root,'manifest.json'),manifest);await write(join(root,'report.json'),report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(join(root,'repository-provenance.json'),provenance);
 console.log(JSON.stringify({mode,removed,added,retained:family.support,aliasesAdded,changed_shards:changed.size,counts:report.repository_materialization}));
}

// Read-only diagnostic: independent numeric oracle and actual page adapter probes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {calculateAssociationScore as A,calculateFinalScore as P,calculateLanguageScore as L,calculateFinalAssociation as F,deriveGlobalStatusFromLanguageStatuses} from '../../associativvordes/js/association-analyzer.js';
import {CONTROL_LANGUAGES as langs} from '../../shared/control-language-demographics.mjs';
import {createCandidateTaskRegistry} from '../../associativvordes/js/candidate-task-registry.js';
import {createEmptyAssociativeState} from '../../associativvordes/js/associative-state.js';
import {runAssociativeCalculation} from '../../associativvordes/js/associative-calculation-runner.js';
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-10,`${x} != ${y}`);
// Literal expected values obtained independently using Python Decimal below.
close(A({directness:80,field_relatedness:60,domain_shift:20}),73);
close(P({association_score:73,frequency_score:64}),69.71445715060489);
close(A({directness:10,field_relatedness:100,domain_shift:0}),10);
assert.equal(A({directness:null,field_relatedness:60,domain_shift:20}),null);
const item=(p,a,review=false,word='word')=>({word,selected:true,final_score:p,association_score:a,analysis:{review_required:review}});
const status=Object.fromEntries(langs.map(x=>[x.code,{status:'completed'}]));
const final=rows=>F({languages:langs,languageResults:rows,languageStatuses:status});
assert.equal(L([item(40,90,false,'a'),item(70,60,false,'b')]).associationNormalized,60);
const ps=[74.87,48.66,35.24,56.71,94.08,52.64];
const complete=final(ps.map(x=>L([item(x,85)])));
close(complete.finalAssociation,64.03319270647122); close(complete.averageAssociation,85);
assert.equal(complete.coverage,1); assert.equal(complete.groups,3); assert.equal(complete.accepted,true);
const pending=final(ps.map(x=>L(Array.from({length:5},(_,i)=>item(x-i,85,true,`regul-${i}`)))));
assert.equal(pending.finalAssociation,null);assert.equal(pending.decisionDiagnostics.pendingReview,true);
assert.equal(pending.counts.primaryALanguages,6); assert.equal(pending.counts.includedLanguages,0);
console.log('ORACLE',JSON.stringify({A:73,P:P({association_score:73,frequency_score:64}),regulFA:complete.finalAssociation,N:complete.speakersTotal,pending:pending.counts}));
for(const value of [35,34.999,0]){const r=final([L([item(value,value)]),L([item(value,value)]),L([item(value,value)])]);assert.equal(r.accepted,value===35);console.log('BOUNDARY',value,r.accepted,r.coverage,r.groups);}
const source=await readFile('associativvordes/script.js','utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const rows=[item(null,85)];const page={state:{languages:{en:rows},languageStatuses:{en:{status:'completed'}},maxModels:5},LANGUAGES:[langs[0]],scoringCandidates:()=>rows.filter(x=>Number.isFinite(x.final_score)),wordWeight:x=>x.final_score,calculateLanguageScore:L,calculateFinalAssociation:F};
vm.createContext(page);vm.runInContext(extract('    function calculateFinal()','    function renderTabs()'),page);
const adapter=page.calculateFinal();console.log('V-001 PAGE_MISSING_P',JSON.stringify({direct:L(rows),page:adapter.languageScores[0],diagnostics:adapter.decisionDiagnostics,counts:adapter.counts}));
assert.equal(adapter.counts.primaryALanguages,0);assert.equal(adapter.decisionDiagnostics.missingScores,false);
let resolve,entered;const wait=new Promise(r=>resolve=r),entry=new Promise(r=>entered=r);
const row=item(10,20);row.word='regulation';const state={root:'regul',targetMeaning:'rule',languages:{en:[row]},languageStatuses:{}};
const manual={state,activeRunId:1,manualTasks:createCandidateTaskRegistry(),normalizeText:x=>x,withModelIdentity:()=>({}),isCurrentRun:()=>true,renderAll:()=>{},getRunTargetTranslations:async()=>({}),incrementDiagnostic:()=>{},analyzeAssociativeWord:()=>{entered();return wait;},createReviewBudget:()=>({}),QWEN_RUNTIME_CONFIG:{},isAbortError:()=>false,recordQwenUsedModels:()=>{},finiteOrNull:x=>x,reconcileModelRepresentatives:x=>x,createLanguageStatus:status=>({status}),window:{InteralFormDraft:{save:()=>{}}}};
vm.createContext(manual);vm.runInContext(extract('    async function analyzeItem(','    function deleteItem('),manual);
const work=manual.analyzeItem('en',0);await entry;row.selected=false;resolve({frequency:{frequency_score:70},association:{association_score:80},final_score:75});await work;
console.log('V-002 USER_DESELECT_OVERWRITTEN',row.selected);assert.equal(row.selected,true);
const abort=new AbortController();let started;const start=new Promise(r=>started=r);let unblock;const block=new Promise(r=>unblock=r);let abortedState;
const shared=createEmptyAssociativeState({languages:[langs[0]]});
const job=runAssociativeCalculation({state:shared,signal:abort.signal,input:{root:'regul'},dependencies:{languages:[langs[0]],waitForPaint:async()=>{},candidateIndexLoader:{load:async()=>{started();await block;return[];}}},onStateChange:s=>abortedState=s});
await start;abort.abort();unblock();try{await job;}catch(e){assert.equal(e.name,'AbortError');}
console.log('V-003 ABORT',JSON.stringify({global:shared.globalStatus,language:shared.languageStatuses.en,derived:deriveGlobalStatusFromLanguageStatuses(shared.languageStatuses)}));assert.equal(shared.languageStatuses.en.status,'loading_index'); assert.equal(shared.globalStatus,'aborted');
console.log('Independent diagnostics completed (three defects reproduced; no functional edits).');
let options;const routing={state:{elementType:'preposition'},nowMs:()=>0,candidateIndexLoader:{loadCandidateEntries:async(_l,_r,o)=>{options=o;throw new Error('probe-stop');}}};vm.createContext(routing);vm.runInContext(extract('    async function getLanguageCandidates(','    async function getRunTargetTranslations('),routing);try{await routing.getLanguageCandidates('en','inter');}catch(e){assert.equal(e.message,'probe-stop');}assert.equal(options.elementType,undefined);console.log('V-005 PREPOSITION_LOADER_OPTIONS',Object.keys(options));
for(const [name,p,a,review] of [['missingA',60,null,false],['missingP',null,80,false],['review',60,80,true],['zero',0,0,false]]){const r=L([item(p,a,review)]); console.log('CASE',name,JSON.stringify(r.incompleteReasons),r.normalized,r.associationNormalized);}
const uncertain=final([L([{...item(40,60),analysis:{score_interval:{min:30,max:50},association_interval:{min:60,max:60}}}]),L([item(40,60)]),L([item(40,60)])]);assert.equal(uncertain.accepted,false);assert.equal(uncertain.decisionDiagnostics.thresholdUncertain,true);console.log('UNCERTAINTY',uncertain.scoreInterval,uncertain.accepted);
const mixed={en:[item(60,70)],de:[item(60,70)],fr:[item(60,70)],es:[item(null,85)]};const mix={state:{languages:mixed,languageStatuses:Object.fromEntries(langs.slice(0,4).map(x=>[x.code,{status:'completed'}])),maxModels:5},LANGUAGES:langs.slice(0,4),scoringCandidates:code=>mixed[code].filter(x=>Number.isFinite(x.final_score)),wordWeight:x=>x.final_score,calculateLanguageScore:L,calculateFinalAssociation:F};vm.createContext(mix);vm.runInContext(extract('    function calculateFinal()','    function renderTabs()'),mix);const mp=mix.calculateFinal();const md=F({languages:langs.slice(0,4),languageResults:langs.slice(0,4).map(x=>L(mixed[x.code])),languageStatuses:mix.state.languageStatuses});console.log('V-001 MIXED_ACCEPTANCE',{pageAccepted:mp.accepted,directAccepted:md.accepted,pageMissing:mp.decisionDiagnostics.missingScores,directMissing:md.decisionDiagnostics.missingScores});assert.equal(mp.accepted,true);assert.equal(md.accepted,false);

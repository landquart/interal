import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidateTaskRegistry } from '../associativvordes/js/candidate-task-registry.js';
import { FamilyIndexLoader } from '../associativvordes/js/family-index-loader.js';
import { runAssociativeCalculation } from '../associativvordes/js/associative-calculation-runner.js';
import { createEmptyAssociativeState } from '../associativvordes/js/associative-state.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };

test('AC-006: cancellation, restart and changed candidate reject late manual responses', async () => {
  const registry = createCandidateTaskRegistry(); const item = {}; let context = true;
  const first = registry.begin(item, () => context); const response = deferred(); let writes = 0;
  const work = response.promise.then(() => { if(first.isCurrent()) writes++; });
  const second = registry.begin(item, () => context);
  assert.equal(first.signal.aborted, true); assert.equal(second.isCurrent(), true);
  response.resolve(); await work; assert.equal(writes, 0);
  context=false; assert.equal(second.isCurrent(), false);
  registry.cancelAll(); assert.equal(second.signal.aborted, true);
});

test('AC-007: family requests with distinct signals do not inherit earlier cancellation', async () => {
  const calls=[];
  const loader = new FamilyIndexLoader({ fetchJson: (_url, {signal}) => { const d=deferred(); calls.push({signal,...d}); return d.promise; } });
  const a=new AbortController(), b=new AbortController();
  const old=loader.load('manifest.json',{signal:a.signal}); const fresh=loader.load('manifest.json',{signal:b.signal});
  await Promise.resolve(); assert.equal(calls.length, 2);
  a.abort(); calls[0].resolve({version:'old'}); calls[1].resolve({version:'5'});
  await assert.rejects(old,{name:'AbortError'}); assert.equal((await fresh).version,'5');
  assert.equal((await loader.load('manifest.json')).version,'5');
});

test('AC-007: stale runner catch cannot overwrite fresh shared state or abort its button', async () => {
  let active=1; let aborts=0; const translation=deferred(); const entered=deferred();
  const state=createEmptyAssociativeState({languages:['en']});
  const pending=runAssociativeCalculation({state, runId:1, input:{root:'regul'}, dependencies:{languages:[{code:'en'}],isCurrentRun:id=>id===active,waitForPaint:async()=>{},targetTranslator:{translate:()=>{entered.resolve();return translation.promise;}},buttonStatusController:{abort:()=>aborts++}}});
  await entered.promise; active=2; state.globalStatus='completed'; state.root='new';
  translation.resolve({}); await assert.rejects(pending,{name:'AbortError'});
  assert.equal(state.globalStatus,'completed'); assert.equal(state.root,'new'); assert.equal(aborts,0);
});

test('AC-004: review callbacks bracket active review and return to analyzing', async () => {
  const transitions=[];
  const result=await runAssociativeCalculation({input:{root:'regul'},dependencies:{languages:[{code:'en',group:'Germanic'}], waitForPaint:async()=>{},candidateIndexLoader:{load:async()=>[{word:'regulation',selected:true,frequency_score:50}]},candidateAnalyzer:{analyze:async(_lang,item,context)=>{context.onReviewStart();context.onReviewEnd();return {...item,final_score:50,association_score:60};}}},onStateChange:state=>transitions.push(state.languageStatuses.en.status)});
  assert.ok(transitions.includes('reviewing')); const index=transitions.indexOf('reviewing'); assert.equal(transitions[index+1],'analyzing'); assert.equal(result.state.languageStatuses.en.status,'completed');
});

test('AC-004: index failure, all Qwen failures and no candidates remain distinct', async () => {
  const result=await runAssociativeCalculation({input:{root:'regul'},dependencies:{languages:[{code:'en'},{code:'de'},{code:'fr'}],waitForPaint:async()=>{},candidateIndexLoader:{load:async lang=>{if(lang.code==='en')throw new Error('offline');return lang.code==='de'?[{word:'regulieren',frequency_score:50}]:[];}},candidateAnalyzer:{analyze:async(_l,item)=>({...item,final_score:null,analysisStatus:'error',analysis:{status:'error'}})}}});
  assert.equal(result.state.languageStatuses.en.status,'index_error'); assert.equal(result.state.languageStatuses.de.status,'qwen_error'); assert.equal(result.state.languageStatuses.fr.status,'no_candidates');
});

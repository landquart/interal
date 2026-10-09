import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateLanguageScore, calculateFinalAssociation } from '../associativvordes/js/association-analyzer.js';
import { CONTROL_LANGUAGES } from '../shared/control-language-demographics.mjs';

const scriptPromise = readFile('associativvordes/script.js', 'utf8');
const item = (p, a, word='word') => ({ word, selected: true, final_score: p, association_score: a, analysis: { review_required: false } });

function extract(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'actual runtime functions must be found');
  return source.slice(a,b);
}

test('V-001: actual page final calculation retains selected missing-P diagnostics and blocks acceptance', async () => {
  const source = await scriptPromise;
  const languages = CONTROL_LANGUAGES.slice(0,4);
  const byCode = Object.fromEntries(languages.map(({code}) => [code, [item(60,70)]]));
  byCode.es = [item(null,85,'regulacion')];
  const state = {
    languages: byCode,
    languageStatuses: Object.fromEntries(languages.map(({code}) => [code, {status:'completed'}])),
    maxModels:5
  };
  const context = {
    state, LANGUAGES: languages, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE:5,
    wordWeight: candidate => candidate.final_score,
    compareFinalModelCandidates: (a,b) => Number(b.final_score) - Number(a.final_score),
    calculateLanguageScore, calculateFinalAssociation
  };
  vm.createContext(context);
  vm.runInContext(extract(source,'    function scoringCandidates(langCode)', '    function renderTabs()'),context);
  const result=context.calculateFinal();
  assert.equal(result.accepted,false);
  assert.equal(result.decisionDiagnostics.missingScores,true);
  assert.equal(result.counts.primaryALanguages,4);
  assert.ok(result.languageScores[3].incompleteReasons.some(x=>x.code==='missing_P'));
});

test('V-004: actual page candidate analysis returns terminal states for success and failure', async () => {
  const source = await scriptPromise;
  const body = extract(source,'    async function analyzeCandidateItem(', '    async function mapWithConcurrency(');
  const candidate = { word:'regulation', selected:true, analysisStatus:'pending', frequencyProfile:{} };
  const context = {
    state:{targetMeaning:'rule'}, currentRunSignal:()=>null, isCurrentRun:()=>true,
    throwIfStaleRun:()=>{},textGroup:()=>({en:'English'}),incrementDiagnostic:()=>{},
    recordQwenUsedModels:()=>{},addCandidateWarning:()=>{},candidateWarningId:()=>1,
    warningCode:x=>x, QWEN_ERROR_CODES:{ABORTED:'ABORTED'},
    isAbortError:()=>false,normalizeAbortError:x=>x,
    analyzeAssociativeWord:async()=>({frequency:{frequency_score:70},association:{association_score:85},final_score:75,warnings:[]}),
    failedAnalysis:(_code,item)=>({...item,analysis:{status:'error'},final_score:null})
  };
  vm.createContext(context);vm.runInContext(body,context);
  const ok=await context.analyzeCandidateItem('en', candidate,()=>{},1,'rule');
  assert.equal(ok.analysisStatus,'completed');
  assert.equal(ok.final_score,75);
  context.analyzeAssociativeWord=async()=>{throw Error('upstream');};
  const failed=await context.analyzeCandidateItem('en', candidate,()=>{},1,'rule');
  assert.equal(failed.analysisStatus,'error');
});

test('V-005: actual page preposition path forwards element type to loader', async () => {
  const source = await scriptPromise;
  const body=extract(source,'    async function getLanguageCandidates(', '    async function getRunTargetTranslations(');
  let opts;
  const context={
    state:{elementType:'preposition'},nowMs:()=>0,
    candidateIndexLoader:{loadCandidateEntries:async(_lang,_root,options)=>{opts=options;throw Error('stop');}}
  };
  vm.createContext(context);vm.runInContext(body,context);
  await assert.rejects(context.getLanguageCandidates('en','inter'),/stop/);
  assert.equal(opts.elementType,'preposition');
});

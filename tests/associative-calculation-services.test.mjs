import test from 'node:test';
import assert from 'node:assert/strict';
import { withRequestDeadline } from '../shared/request-deadline.mjs';
import { getQwenAssociationScores, getQwenCandidateSuggestions, QWEN_RUNTIME_CONFIG } from '../associativvordes/js/qwen-client.js';
import handler from '../api/qwen-analyze.js';

test('AC-008: deadline includes an unresponsive response body and cancellation wins late results', async () => {
  const originalDocument=globalThis.document; globalThis.document={documentElement:{lang:'en'}};
  const originalFetch=globalThis.fetch, originalTimeout=QWEN_RUNTIME_CONFIG.requestTimeoutMs, candidateTimeout=QWEN_RUNTIME_CONFIG.candidateRequestTimeoutMs;
  try {
    QWEN_RUNTIME_CONFIG.requestTimeoutMs=5; QWEN_RUNTIME_CONFIG.candidateRequestTimeoutMs=5;
    globalThis.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});
    await assert.rejects(getQwenAssociationScores({language:'en',targetMeaning:'rule',word:'regulation'}),{code:'QWEN_TIMEOUT'});
    await assert.rejects(getQwenCandidateSuggestions({root:'regul',targetMeaning:'rule'}),{code:'QWEN_TIMEOUT'});
    const controller=new AbortController(); let resolve;
    const pending=withRequestDeadline(()=>new Promise(r=>{resolve=r;}),{signal:controller.signal,timeoutMs:1000});
    await Promise.resolve(); controller.abort(); await assert.rejects(pending,{name:'AbortError'}); resolve('late');
  } finally { globalThis.fetch=originalFetch; globalThis.document=originalDocument; QWEN_RUNTIME_CONFIG.requestTimeoutMs=originalTimeout; QWEN_RUNTIME_CONFIG.candidateRequestTimeoutMs=candidateTimeout; }
});

const call = async () => {
  let output; const response={setHeader(){},end(text){output=JSON.parse(text);}};
  await handler({method:'POST',headers:{},body:{task:'associative_word_score',payload:{language:'en',targetMeaning:'rule',word:'regulation'}}},response);
  return {status:response.statusCode,...output};
};
test('AC-009: backend rejects incomplete scores, preserves true zero and upstream 403', async () => {
  const original=globalThis.fetch;
  try {
    for(const scores of [{directness:null,field_relatedness:null,domain_shift:null},{directness:50,field_relatedness:50},{directness:false,field_relatedness:50,domain_shift:50}]) {
      globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(scores)}}]}));
      const result=await call(); assert.equal(result.status,502); assert.equal(result.ok,false); assert.equal(result.errorCode,'QWEN_SEMANTIC_SCORES_INVALID');
    }
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({directness:0,field_relatedness:0,domain_shift:0})}}]}));
    const zero=await call(); assert.equal(zero.status,200); assert.equal(zero.analysis.directness,0);
    globalThis.fetch=async()=>new Response('forbidden',{status:403}); assert.equal((await call()).status,403);
  } finally {globalThis.fetch=original;}
});

test('AC-008: backend timeout also covers upstream body', async () => {
  const original=globalThis.fetch, timeout=process.env.QWEN_REQUEST_TIMEOUT_MS;
  try { process.env.QWEN_REQUEST_TIMEOUT_MS='5'; globalThis.fetch=async()=>({ok:true,text:()=>new Promise(()=>{})}); const result=await call(); assert.equal(result.status,504); assert.equal(result.errorCode,'QWEN_TIMEOUT'); }
  finally { globalThis.fetch=original; if(timeout===undefined)delete process.env.QWEN_REQUEST_TIMEOUT_MS; else process.env.QWEN_REQUEST_TIMEOUT_MS=timeout; }
});

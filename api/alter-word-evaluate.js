import { readFileSync } from 'node:fs';
import { getQwenLanguageInstruction, normalizeInterfaceLanguage } from './lib/interface-language.js';

const DERIVATION_CONTEXT = JSON.parse(
  readFileSync(new URL('./interal-derivation-context.json', import.meta.url), 'utf8')
);

const MAX_BODY_BYTES = 50_000;
const MODEL_NAME = 'qwen3-235b-a22b-fp8/latest';
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const POS_VALUES = new Set(['noun','adjective','verb','adverb','pronoun','numeral','interjection','function_word','other']);
const DECISIONS = new Set(['accepted','rejected','needs_manual_review']);
const CONTROL_CODES = ['en','de','fr','es','it','ru','el'];
const AUX_CODES = ['pl','sv','ca','oc','ro'];
function cors(req,res){const o=req.headers.origin||'*'; res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); res.setHeader('Cache-Control','no-store');}
function send(res,status,payload){res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(payload));}
async function raw(req){let size=0,ch=[]; for await(const c of req){const b=Buffer.isBuffer(c)?c:Buffer.from(String(c)); size+=b.length; if(size>MAX_BODY_BYTES){const e=Error('Payload too large'); e.status=413; throw e;} ch.push(b);} return Buffer.concat(ch).toString('utf8');}
async function body(req){if(req.body&&typeof req.body==='object')return req.body; if(typeof req.body==='string')return JSON.parse(req.body||'{}'); const r=await raw(req); return r?JSON.parse(r):{};}
function extract(text){const t=String(text||'').trim(); try{return JSON.parse(t)}catch{} const f=t.match(/```(?:json)?\s*([\s\S]*?)```/i); if(f)try{return JSON.parse(f[1])}catch{} const i=t.indexOf('{'),j=t.lastIndexOf('}'); if(i>=0&&j>i)return JSON.parse(t.slice(i,j+1)); throw Object.assign(Error('AI returned invalid JSON'),{status:502});}
function validate(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Invalid body'),{status:400}); input.translation=String(input.translation||'').trim(); input.interfaceLanguage=normalizeInterfaceLanguage(input.interfaceLanguage); input.partOfSpeech=String(input.partOfSpeech||'').trim(); input.candidate=String(input.candidate||'').trim(); input.comment=String(input.comment||'').trim(); if(!input.translation)throw Object.assign(Error('translation is required'),{status:400}); if(!POS_VALUES.has(input.partOfSpeech))throw Object.assign(Error('Invalid partOfSpeech'),{status:400}); if(!input.candidate)throw Object.assign(Error('candidate is required'),{status:400}); return input;}
function stringMap(value,codes){const out={}; for(const c of codes) out[c]=String(value?.[c]||''); return out;}
function getAiText(responseJson, fallbackText){const message=responseJson?.choices?.[0]?.message?.content; if(typeof message==='string')return message; if(Array.isArray(message))return message.map(part=>part?.text||part?.content||'').join('\n').trim(); return fallbackText;}
async function callYandex(messages,withResponseFormat=true){const apiKey=process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex; const folderId=process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8; const body={model:`gpt://${folderId}/${MODEL_NAME}`,messages,temperature:0,max_tokens:2200}; if(withResponseFormat)body.response_format={type:'json_object'}; const response=await fetch(YANDEX_CHAT_COMPLETIONS_URL,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)}); const text=await response.text(); if(!response.ok){const error=Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`); error.status=response.status; error.details=text.slice(0,1200); throw error;} let data; try{data=text?JSON.parse(text):{};}catch{data={text};} return {content:getAiText(data,text),model:body.model,raw:data};}
function normalize(r,input,model){const decision=DECISIONS.has(r?.decision)?r.decision:'needs_manual_review'; const eligible=decision==='accepted' && r?.eligible===true; return {
  section:'altervordes', procedure:'alter-vordes-step-6', responseLanguage:normalizeInterfaceLanguage(r?.responseLanguage||input.interfaceLanguage), eligible, decision,
  recommendedForm:String(r?.recommendedForm||input.candidate), partOfSpeech:POS_VALUES.has(r?.partOfSpeech)?r.partOfSpeech:input.partOfSpeech, inputTranslation:String(r?.inputTranslation||input.translation),
  translations:{ controlLanguages:stringMap(r?.translations?.controlLanguages,CONTROL_CODES), auxiliaryLanguages:stringMap(r?.translations?.auxiliaryLanguages,AUX_CODES) },
  analysis:{ brevity:String(r?.analysis?.brevity||''), pronounceability:String(r?.analysis?.pronounceability||''), conflicts:String(r?.analysis?.conflicts||''), neutrality:String(r?.analysis?.neutrality||''), controlAndAuxiliaryEvidence:String(r?.analysis?.controlAndAuxiliaryEvidence||''), partOfSpeechSuitability:String(r?.analysis?.partOfSpeechSuitability||''), derivationalPotential:String(r?.analysis?.derivationalPotential||''), interalRuleCompatibility:String(r?.analysis?.interalRuleCompatibility||'') },
  derivation:{
    canFormVerb:Boolean(r?.derivation?.canFormVerb),
    canFormNoun:Boolean(r?.derivation?.canFormNoun),
    canFormAdjective:Boolean(r?.derivation?.canFormAdjective),
    possibleDerivations:Array.isArray(r?.derivation?.possibleDerivations)?r.derivation.possibleDerivations.map(String).slice(0,24):[],
    appliedRules:Array.isArray(r?.derivation?.appliedRules)?r.derivation.appliedRules.map(String).slice(0,20):[],
    deWahlRuleNotes:String(r?.derivation?.deWahlRuleNotes||''),
    suffixAndEndingNotes:String(r?.derivation?.suffixAndEndingNotes||''),
    ruleSourceVersion:String(r?.derivation?.ruleSourceVersion||DERIVATION_CONTEXT.version||'')
  },
  risks:Array.isArray(r?.risks)?r.risks.map(String).slice(0,12):[], suggestedSaferForms:Array.isArray(r?.suggestedSaferForms)?r.suggestedSaferForms.map(String).slice(0,2):[], shortConclusion:String(r?.shortConclusion||'').slice(0,1600), finalDecisionByHuman:true,
  model:{ name:model, role:'advisory evaluator', finalDecisionByHuman:true }
};}
function systemPrompt(interfaceLanguage){return `You are an expert evaluator for the Interal auxiliary language.

${getQwenLanguageInstruction(interfaceLanguage)}

You analyze only Alter vordes: words that failed the five main lexical selection procedures and therefore require an additional qualitative evaluation.

You must not calculate percentages or numeric scores.

You must use the following Interal derivation context as binding rules. This context is extracted from the Interal grammar and the semantic transparency document. Do not ignore it. Do not invent rules that contradict it.

INTERAL_DERIVATION_CONTEXT:
${JSON.stringify(DERIVATION_CONTEXT, null, 2)}

Core obligations:
1. Translate the user's single input meaning into control languages and auxiliary languages.
2. Evaluate the candidate Interal form qualitatively.
3. Pay special attention to future derivation.
4. Check compatibility with:
   - modified de Wahl rule;
   - Interal endings;
   - suffixes and prefixes;
   - logical vs international derivative meanings;
   - possible need for -u, -i, -al, -ari, -ic;
   - semantic transparency and lexicalization risks.
5. If the candidate form cannot support a stable derivative family, mark it as rejected or needs_manual_review.
6. If the candidate form creates unresolved logical vs international ambiguity, mark it as rejected or needs_manual_review.
7. If the derivational risk is serious, eligible must be false.
8. The final decision is advisory and finalDecisionByHuman must be true.

Return only valid JSON. No markdown. No explanations outside JSON.`;}
function userPrompt(input){return `Evaluate this candidate word for Interal Alter vordes.

Alter vordes are words that do not pass any of the five main lexical selection procedures:
1. grammatical and short function words;
2. internationalisms;
3. professional, cultural, social or subcultural community words;
4. common Indo-European words;
5. associative words.

This is not a mathematical procedure. Do not output percentages or numeric scores.

Input:
${JSON.stringify(input,null,2)}

Tasks:
1. Translate the input meaning into all control languages: English, German, French, Spanish, Italian, Russian, Greek.
2. Translate the input meaning into all auxiliary languages: Polish, Swedish, Catalan, Occitan, Romanian.
3. Analyze whether the candidate Interal form can be accepted as an Alter vordes form.
4. Evaluate the form qualitatively by brevity, pronounceability, semantic and phonetic/graphic conflicts, neutrality, part of speech, future derivational potential, Interal endings, suffixes and prefixes, modified de Wahl rule if relevant, and whether the root allows natural derivations without excessive distortion.
5. Use INTERAL_DERIVATION_CONTEXT from the system prompt as binding context.
6. In derivation.appliedRules, explicitly list which Interal rules were relevant.
7. In derivation.deWahlRuleNotes, explain whether the candidate is compatible with the modified de Wahl rule.
8. In derivation.suffixAndEndingNotes, explain relevant suffix/ending behavior.
9. If the form has serious derivational risk, unresolved ambiguity, or rule conflict, set eligible false.
10. Do not create alternative forms unless the candidate is clearly unsuitable. If unsuitable, suggest at most 2 safer forms.
11. Return whether JSON card creation should be allowed.

Output only valid JSON using this schema shape:
{
  "responseLanguage": "ru | en",
  "decision": "accepted | rejected | needs_manual_review",
  "eligible": false,
  "recommendedForm": "",
  "partOfSpeech": "",
  "inputTranslation": "",
  "translations": {
    "controlLanguages": { "en": "", "de": "", "fr": "", "es": "", "it": "", "ru": "", "el": "" },
    "auxiliaryLanguages": { "pl": "", "sv": "", "ca": "", "oc": "", "ro": "" }
  },
  "analysis": {
    "brevity": "",
    "pronounceability": "",
    "conflicts": "",
    "neutrality": "",
    "controlAndAuxiliaryEvidence": "",
    "partOfSpeechSuitability": "",
    "derivationalPotential": "",
    "interalRuleCompatibility": ""
  },
  "derivation": {
    "canFormVerb": true,
    "canFormNoun": true,
    "canFormAdjective": true,
    "possibleDerivations": [],
    "appliedRules": [],
    "deWahlRuleNotes": "",
    "suffixAndEndingNotes": "",
    "ruleSourceVersion": ""
  },
  "risks": [],
  "suggestedSaferForms": [],
  "shortConclusion": "",
  "finalDecisionByHuman": true
}

Set responseLanguage to the interfaceLanguage from the input. Decision must be accepted, rejected, or needs_manual_review. eligible must be true only for accepted forms. Do not output numeric scores or markdown.`;}
export default async function handler(req,res){cors(req,res); if(req.method==='OPTIONS'){res.statusCode=204;return res.end();} try{if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'}); if(!process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex)return send(res,500,{ok:false,error:'Missing Yandex API key',details:'Set Qwen3_235B_A22B_Instruct_2507_FP8_Yandex in Vercel Environment Variables.'}); if(!process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8)return send(res,500,{ok:false,error:'Missing Yandex folder id',details:'Set yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 in Vercel Environment Variables.'}); const input=validate(await body(req)); const messages=[{role:'system',content:systemPrompt(input.interfaceLanguage)},{role:'user',content:userPrompt(input)}]; let result; try{result=await callYandex(messages,true);}catch(error){if(error.status&&error.status>=400&&error.status<500)result=await callYandex(messages,false); else throw error;} return send(res,200,{ok:true,analysis:normalize(extract(result.content),input,result.model)});}catch(e){const status=e.status&&e.status>=400&&e.status<600?e.status:500; return send(res,status,{ok:false,error:status<500?e.message:'alter_word_evaluate_failed',details:String(e.details||e.message||e).slice(0,1200)});} }

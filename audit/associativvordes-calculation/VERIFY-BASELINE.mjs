import {pathToFileURL} from 'node:url';
const base=process.argv[2] || '/workspace/scratch/27d7adcfbebe/interal-baseline';
const {calculateLanguageScore:L,calculateFinalAssociation:F}=await import(pathToFileURL(base+'/associativvordes/js/association-analyzer.js'));
const {CONTROL_LANGUAGES:languages}=await import(pathToFileURL(base+'/shared/control-language-demographics.mjs'));
const rows=[74.87,48.66,35.24,56.71,94.08,52.64].map(p=>L(Array.from({length:5},(_,i)=>({word:`regul-${i}`,selected:true,final_score:p-i,association_score:85,analysis:{review_required:true}}))));
const r=F({languages,languageResults:rows,languageStatuses:Object.fromEntries(languages.map(l=>[l.code,{status:'completed'}]))});
console.log('BASELINE_REGUL',JSON.stringify({FA:r.finalAssociation,A:r.averageAssociation,coverage:r.coverage,languages:r.representedLangs,groups:r.groups,rows:r.languageScores.map(s=>({language:s.lang.code,P:s.normalized,A:s.associationNormalized,N:new Intl.NumberFormat('ru-RU').format(s.speakers)}))}));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {graphicSimilarityDetails as graphic,internationalismFormPasses} from '../shared/methodology-calculation.mjs';
import {calculateAssociationScore as A,calculateFinalScore as P,calculateLanguageScore} from '../associativvordes/js/association-analyzer.js';
import {calculateAssociativeAffix} from '../shared/associative-affix-calculation.mjs';
import {meanNonZero} from '../associativvordes/js/frequency-loader.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [a,b,g] of [['abc','xabc',.75],['abc','abcx',.75],['abc','aabc',.875],['abc','abcc',.875],['mā̃','ma',.75],['mā̃'.normalize('NFD'),'ma',.75]]) {near(graphic(a,b).score,g);near(graphic(b,a).score,g);}
assert.equal(graphic('','a'),null);
const c={};vm.runInNewContext(fs.readFileSync('indoeuropanvordes/aline.js','utf8'),c);const ph=c.ALINE.normalizedSimilarity;
near(ph('matre','mʌðə'),.6648099662162161);near(ph('p','k'),.840625);near(ph('i','u'),.6756756756756757);near(ph('a','aː'),.972972972972973);near(ph('a','ã'),.8648648648648649);
assert.equal(ph('', 'a'),null);assert.throws(()=>ph('a','☃'));assert.throws(()=>ph('a','a̰'));assert.equal(c.ALINE.tokenize('ts').length,2);assert.equal(c.ALINE.tokenize('t͡s').length,1);assert.equal(c.ALINE.tokenize('eɪ').length,2);
assert.equal(A({directness:0,field_relatedness:100,domain_shift:0}),0);
assert.equal(P({association_score:100,frequency_score:0}),0);near(P({association_score:100,frequency_score:8.7856024301}),42.68939906000369);
const best=calculateLanguageScore([{word:'a',selected:true,final_score:80,association_score:90},{word:'b',selected:true,final_score:20,association_score:99}]);assert.equal(best.normalized,80);assert.equal(best.associationNormalized,90);
const f=words=>calculateAssociativeAffix({en:words}).FAa;
near(f([{word:'a',ipm:3}]),f(Array.from({length:5},(_,i)=>({word:String(i),ipm:.6}))));near(f([{word:'a',ipm:3},{word:'a',ipm:3}]),f([{word:'a',ipm:3}]));
assert.equal(meanNonZero([0,10]),5);assert.equal(meanNonZero([null,10]),null);
assert.equal(internationalismFormPasses('abcd','abxy',2),false);assert.equal(internationalismFormPasses('abcdefgh','abcdexyh',2),true);assert.equal(internationalismFormPasses('abc','abcd',1),false);
// Nine-language matre example in appendix 6; full precision weights and scores.
const rows=[['mother','mʌðə',1493000],['mutter','mʊtɐ',133000],['mère','mɛʁ',334000],['madre','maðɾe',561000],['madre','madre',66000],["mat'",'matʲ',210000],['mitera','mitera',13500],['mā̃','mɑ̃ː',611000],['mâdar','mɒːd̪æɹ',82000]];
near(rows.reduce((s,[w,ipa,n])=>s+n*(graphic('matre',w).score+ph('matre',ipa))/2,0)/3503500*100,60.419444903150264);
console.log('Methodology controls passed');

// Unknown corpus data and truncated lists must not silently become zeros.
const { LANGUAGE_SOURCES } = await import('../associativvordes/js/config-frequency-sources.js');
const { getFrequencyProfile,clearFrequencyCacheForTests,ipmToScore } = await import('../associativvordes/js/frequency-loader.js');
const savedFetch=globalThis.fetch;
try {
  LANGUAGE_SOURCES.zz={subtitles:['full.json',{file:'cut.json',complete:false,cutoffIpm:2}]};
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('full.json')?{word:10}: {}});
  const profile=await getFrequencyProfile('zz','word');
  assert.equal(profile.frequency_score,null);
  near(profile.frequency_interval.min,ipmToScore(5));near(profile.frequency_interval.max,ipmToScore(6));
  assert.deepEqual(profile.category_breakdown.subtitles.ipm_values,[10,null]);
  clearFrequencyCacheForTests();
  LANGUAGE_SOURCES.zz={subtitles:['full.json','zero.json']};
  const exact=await getFrequencyProfile('zz','word');near(exact.frequency_score,ipmToScore(5));
  LANGUAGE_SOURCES.zz={subtitles:[{file:'../invalid.json'}]};
  const invalid=await getFrequencyProfile('zz','word');assert.equal(invalid.frequency_score,null);
} finally {globalThis.fetch=savedFetch;delete LANGUAGE_SOURCES.zz;clearFrequencyCacheForTests();}
const incompleteAffix=calculateAssociativeAffix({en:[{word:'one',ipm:10}],de:[{word:'zwei',ipm:10}],fr:[{word:'trois',ipm:10}],es:[{word:'cuatro',ipm:null}]});
assert.equal(incompleteAffix.accepted,false);assert.equal(incompleteAffix.review_required,true);
const { calculateFinalAssociation } = await import('../associativvordes/js/association-analyzer.js');
const langs=[{code:'en',group:'Germanic'},{code:'de',group:'Germanic'},{code:'fr',group:'Romance'}];
const uncertain=calculateFinalAssociation({languages:langs,languageResults:langs.map(()=>({normalized:40,associationNormalized:50,count:1,scoreInterval:{min:30,max:50}}))});
assert.equal(uncertain.accepted,false);assert.equal(uncertain.reviewRequired,true);assert.ok(uncertain.coverage<1);
const { compactAssociativeState,restoreAssociativeState,createEmptyAssociativeState }=await import('../associativvordes/js/associative-state.js');
// Persist review uncertainty with the analysis; absence of review cannot become acceptance on reload.
const reviewed=calculateLanguageScore([{word:'one',selected:true,final_score:80,association_score:90,analysis:{review_required:true}}]);
assert.equal(reviewed.incomplete,true);
console.log('Missing-data and uncertainty controls passed');

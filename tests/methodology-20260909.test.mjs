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
near(Object.values(c.ALINE.featureWeights.consonant).reduce((sum,value)=>sum+value,0),100);
near(Object.values(c.ALINE.featureWeights.vowel).reduce((sum,value)=>sum+value,0),100);
assert.deepEqual(
  JSON.parse(JSON.stringify(c.ALINE.featureWeights.consonant)),
  {manner:23,place:25,nasal:17,voice:18,lateral:8,aspirated:5,retroflex:4}
);
assert.deepEqual(
  JSON.parse(JSON.stringify(c.ALINE.featureWeights.vowel)),
  {height:32,back:29,nasal:12,round:14,retroflex:7,long:6}
);
near(c.ALINE.featureRanges.place,.9);near(c.ALINE.featureRanges.manner,.4);
near(c.ALINE.consonantSubstitutionScale,100);near(c.ALINE.vowelSubstitutionScale,100);
assert.equal(c.ALINE.relevantFeatures.consonant.join(','),'place,manner,voice,nasal,lateral,retroflex,aspirated');
assert.equal(c.ALINE.relevantFeatures.vowel.join(','),'height,back,round,nasal,retroflex,long');
near(ph('mater','mʌðə'),.6083422222222222);
near(ph('p','k'),.8888888888888888);near(ph('t','s'),.885);near(ph('t','d'),.82);
near(ph('i','u'),.57);near(ph('a','aː'),.94);near(ph('a','ã'),.88);
near(ph('e','ɛ'),.9232);near(ph('o','ɔ'),.9232);
near(ph('dre','tanə'),.594275);near(ph('j','i'),2/3);near(ph('w','u'),2/3);assert.equal(ph('j','u'),0);assert.equal(ph('w','i'),0);assert.equal(ph('r','a'),0);assert.equal(ph('pa','ia'),0);near(ph('pat','a'),1/3);
const paIa=c.ALINE.explain('pa','ia');assert.equal(paIa.alignmentLength,3);assert.equal(paIa.normalizationLength,2);assert.equal(paIa.normalized,0);
assert.equal(c.ALINE.methodologyVersion,'2026-10-06-phonetic-v3');
assert.equal(ph('', 'a'),null);assert.throws(()=>ph('a','☃'));assert.throws(()=>ph('a','a̰'));assert.equal(c.ALINE.tokenize('ts').length,2);assert.equal(c.ALINE.tokenize('t͡s').length,1);assert.equal(c.ALINE.tokenize('eɪ').length,2);
assert.equal(A({directness:0,field_relatedness:100,domain_shift:0}),0);
assert.equal(P({association_score:100,frequency_score:0}),0);near(P({association_score:100,frequency_score:8.7856024301}),42.68939906000369);
const best=calculateLanguageScore([{word:'a',selected:true,final_score:80,association_score:90},{word:'b',selected:true,final_score:20,association_score:99}]);assert.equal(best.normalized,80);assert.equal(best.associationNormalized,90);
const f=words=>calculateAssociativeAffix({en:words}).FAa;
near(f([{word:'a',ipm:3}]),f(Array.from({length:5},(_,i)=>({word:String(i),ipm:.6}))));near(f([{word:'a',ipm:3},{word:'a',ipm:3}]),f([{word:'a',ipm:3}]));
assert.equal(meanNonZero([0,10]),5);assert.equal(meanNonZero([null,10]),null);
assert.equal(internationalismFormPasses('abcd','abxy',2),false);assert.equal(internationalismFormPasses('abcdefgh','abcdexyh',2),true);assert.equal(internationalismFormPasses('abc','abcd',1),false);
// Nine-language mater root-comparison example; full precision weights and scores.
const rows=[['mother','mʌðə',1493000],['mutter','mʊtɐ',133000],['mère','mɛʁ',334000],['madr','maðɾ',561000],['madr','madr',66000],['mater','matʲɪrʲ',210000],['miter','miter',13500],['mā̃','mɑ̃ː',611000],['mâdar','mɒːd̪æɹ',82000]];
near(rows.reduce((s,[w,ipa,n])=>s+n*(graphic('mater',w).score+ph('mater',ipa))/2,0)/3503500*100,59.34011025482454);
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

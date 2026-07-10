import assert from 'node:assert/strict';

function parseCardsApiResponse(data, draftCard = {}, fallbackSection = '') {
  if (!data || typeof data !== 'object' || data.ok !== true) throw new Error('Invalid /api/cards response.');
  const savedCard = data?.card?.payload ?? data?.payload ?? { ...draftCard, id: data.id || draftCard.id, section: data.section || draftCard.section || fallbackSection, discussionId: data.discussionId || (data.id ? `card-${data.id}` : draftCard.discussionId), status: data.status || draftCard.status };
  if (!savedCard || typeof savedCard !== 'object') throw new Error('Saved card payload is missing.');
  return { ...savedCard, id: savedCard.id || data.id, section: savedCard.section || data.section || fallbackSection, discussionId: savedCard.discussionId || data.discussionId || (savedCard.id ? `card-${savedCard.id}` : undefined), status: data.status || savedCard.status || 'pending' };
}
function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,v));}
function assocFinal({Di,Pr,Sh,F,swow=0}){ if([Di,Pr,Sh,F].some(v=>v == null || !Number.isFinite(Number(v)))) return null; const A=0.45*Di+0.35*Pr+0.20*(100-Sh); const A_final=clamp(A+swow,0,100); return clamp(0.65*A_final+0.35*F,0,100); }
function vc(answers){const c=[answers[0]==='yes',answers[1]==='yes',answers[2]==='yes'||answers[2]==='partially']; return {criteria:c,accepted:c.every(Boolean)};}
function gv(arr){const n=arr.filter(Boolean).length; return {passed:n,accepted:n>=3};}
function affix(card){const langs=['en','de','fr','es','it','ru']; const groups={en:'Germanic',de:'Germanic',fr:'Romance',es:'Romance',it:'Romance',ru:'Slavic'}; const words=card.evidence?.frequencyWords||{}; const represented=langs.filter(l=>Array.isArray(words[l])&&words[l].length); const groupCount=new Set(represented.map(l=>groups[l])).size; const ipm=represented.length>=3&&represented.every(l=>words[l].every(x=>Number(x.ipm)>=3)); const wc=represented.length>=3&&represented.every(l=>words[l].length>=1&&words[l].length<=5); if(!card.criteria?.recognition_type) return {status:'needs_manual_review',accepted:false,needs_manual_review:true,frequency_language_count:represented.length}; const accepted=represented.length>=3&&groupCount>=2&&ipm&&wc&&card.criteria.recognition_type==='associative'; return {status:accepted?'accepted':'rejected',accepted,needs_manual_review:false,frequency_language_count:represented.length};}
function intl({word, forms}){const len=word.length; let passed=0; for(const form of forms){const D=form.D; if((len<=3&&D===0)||(len>=4&&D<=2)) passed++;} return {passed,accepted:passed>=5};}

assert.equal(parseCardsApiResponse({ok:true,id:'av_abc',section:'associativvordes',status:'pending',discussionId:'card-av_abc',card:{payload:{id:'av_abc',vord_type:'av'}}},{vord_type:'av'}).id,'av_abc');
assert.equal(parseCardsApiResponse({ok:true,id:'iv_abc',section:'indoeuropanvordes'},{vord_type:'iv'}).discussionId,'card-iv_abc');
assert.throws(()=>parseCardsApiResponse({ok:false,error:'x'},{}));
assert.equal(parseCardsApiResponse({ok:true,id:'gv_abc',section:'grammaticebrevivordes',card:{}},{vord_type:'gv'}).id,'gv_abc');
assert.equal(parseCardsApiResponse({ok:true,id:'vc_new',card:{payload:{id:'vc_new',interal:{word:'a'}}}}, {id:'vc_old'}).id, 'vc_new');

assert.equal(assocFinal({Di:0,Pr:0,Sh:100,F:0}) < 25, true);
assert.equal(assocFinal({Di:25,Pr:25,Sh:75,F:25}),25);
assert.equal(assocFinal({Di:30,Pr:30,Sh:70,F:30}),30);
assert.equal(assocFinal({Di:35,Pr:35,Sh:65,F:35}),35);
assert.equal(assocFinal({Di:80,Pr:80,Sh:20,F:80}) > 35, true);
assert.equal(assocFinal({Di:null,Pr:80,Sh:20,F:80}),null);
assert.equal(assocFinal({Di:80,Pr:80,Sh:20,F:null}),null);

assert.equal(vc(['yes','yes','yes']).accepted,true);
assert.equal(vc(['yes','yes','partially']).accepted,true);
assert.equal(vc(['yes','no','yes']).accepted,false);
assert.equal(vc(['','','']).accepted,false);
assert.equal(vc(['yes','yes','']).accepted,false);

assert.deepEqual(gv([true,true,false,false]),{passed:2,accepted:false});
assert.deepEqual(gv([true,true,true,false]),{passed:3,accepted:true});
assert.deepEqual(gv([true,true,true,true]),{passed:4,accepted:true});

assert.equal(affix({evidence:{frequencyWords:{}},criteria:{recognition_type:'associative'}}).accepted,false);
assert.equal(affix({evidence:{frequencyWords:{en:[{ipm:3}],de:[{ipm:3}]}},criteria:{recognition_type:'associative'}}).accepted,false);
assert.equal(affix({evidence:{frequencyWords:{en:[{ipm:3}],de:[{ipm:3}],fr:[{ipm:3}]}},criteria:{recognition_type:'associative'}}).accepted,true);
assert.equal(affix({evidence:{frequencyWords:{en:[{ipm:2}],de:[{ipm:3}],fr:[{ipm:3}]}},criteria:{recognition_type:'associative'}}).accepted,false);
assert.equal(affix({evidence:{frequencyWords:{en:[{ipm:3}],de:[{ipm:3}],fr:[{ipm:3}]}}}).status,'needs_manual_review');

assert.equal(intl({word:'abc',forms:[{D:0},{D:1},{D:0},{D:0},{D:0},{D:0}]}).passed,5);
assert.equal(intl({word:'abcd',forms:[{D:2},{D:2},{D:2},{D:2},{D:3},{D:0}]}).accepted,true);
assert.equal(intl({word:'abcd',forms:[{D:2},{D:2},{D:2},{D:2},{D:3},{D:3}]}).accepted,false);

console.log('pure functional tests passed');

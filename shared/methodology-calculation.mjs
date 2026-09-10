export const METHODOLOGY_VERSION = '2026-09-09';
export function graphemes(s) { return String(s ?? '').trim().toLowerCase().normalize('NFC').match(/\P{M}\p{M}*|\p{M}+/gu) || []; }
const base = s => s.normalize('NFD').replace(/\p{M}/gu, '');
export function graphicDistance(a,b) {
 const x=graphemes(a),y=graphemes(b);if(!x.length||!y.length)return null;
 const cost=(z,i)=>i>0&&z[i]===z[i-1]?0.5:1;
 const dp=Array.from({length:x.length+1},()=>Array(y.length+1).fill(0));
 for(let i=1;i<=x.length;i++)dp[i][0]=dp[i-1][0]+cost(x,i-1);
 for(let j=1;j<=y.length;j++)dp[0][j]=dp[0][j-1]+cost(y,j-1);
 for(let i=1;i<=x.length;i++)for(let j=1;j<=y.length;j++){
 const sub=x[i-1]===y[j-1]?0:base(x[i-1])===base(y[j-1])?0.5:1;
 dp[i][j]=Math.min(dp[i-1][j]+cost(x,i-1),dp[i][j-1]+cost(y,j-1),dp[i-1][j-1]+sub);
 if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1])dp[i][j]=Math.min(dp[i][j],dp[i-2][j-2]+0.5);
 }
 return dp[x.length][y.length];
}
export function graphicSimilarityDetails(a,b){const distance=graphicDistance(a,b);if(distance==null)return null;const maxLen=Math.max(graphemes(a).length,graphemes(b).length);return {source:a,target:b,distance,maxLen,score:1-distance/maxLen};}
export function internationalismFormPasses(a,b,distance){const x=graphemes(a),y=graphemes(b);if(!x.length||!y.length||!Number.isFinite(distance))return false;return Math.min(x.length,y.length)<4?distance===0:distance<=2&&distance/Math.max(x.length,y.length)<=0.25;}

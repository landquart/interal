// The installed validator is authoritative. No git-show, snapshots or copied rules.
import {readFileSync} from 'node:fs';
import {validateDecision,evaluateMembership,assessRecognition,automaticCorrectionEligibility,rules} from '../normative/validator.mjs';
const request=JSON.parse(readFileSync(0,'utf8'));
try {
 const results=request.actions.map(a=>{
  const context={...a.context,allowTestFixtures:request.namespace==='TEST_ONLY-v5'};
  for(const k of ['verifiedEvidenceIds','authorizedDecisionIds','authorizedSupersessions'])context[k]=new Set(context[k]||[]);
  for(const k of ['verifiedEvidenceDigests','authorizedDecisionDigests'])context[k]=new Map(Object.entries(context[k]||{}));
  if(a.type==='recognition')return assessRecognition(a.kind||'root',a.result||{languages:[],calculator_gates_passed:false});
  validateDecision(a.decision);
  if(a.type==='schema')return {valid:true,policy_version:rules.version};
  if(a.type==='correction')return automaticCorrectionEligibility(a.decision,context);
  return evaluateMembership(a.decision,context);
 });
 console.log(JSON.stringify({status:'PASS',policy_version:rules.version,results}));
} catch(error){console.log(JSON.stringify({status:'BLOCKED',reason:error.message}));process.exitCode=1;}

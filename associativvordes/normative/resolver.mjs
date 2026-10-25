import {readFileSync} from 'node:fs';
import {rules,assessRecognition} from './validator.mjs';
const request=JSON.parse(readFileSync(0,'utf8'));
if(request.type!=='observation')throw Error('Unknown observation operation');
const recognition=assessRecognition('root',{languages:[],calculator_gates_passed:false});
console.log(JSON.stringify({resolver_contract:'interal-normative-resolver/1',policy_version:rules.version,membership:'UNRESOLVED',establishes_membership:false,association_status:'unknown',recognition}));

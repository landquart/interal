import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const rules = JSON.parse(readFileSync(new URL('./rules.json', import.meta.url)));
export const schema = JSON.parse(readFileSync(new URL('./decision.schema.json', import.meta.url)));
const canonical = x => Array.isArray(x) ? `[${x.map(canonical).join(',')}]` :
  x !== null && typeof x === 'object' ? `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}` : JSON.stringify(x);
export const digest = x => createHash('sha256').update(canonical(x)).digest('hex');
export const sameScope = (a,b) => canonical(a) === canonical(b);
const demand = (ok, message) => { if (!ok) throw Error(message); };

// Deliberately limited to keywords used by the bundled closed schema; no remote refs.
export function validateSchema(value, spec = schema, path = '$') {
  if (spec.anyOf) {
    demand(spec.anyOf.some(s => { try { validateSchema(value,s,path); return true; } catch { return false; } }), `${path}: anyOf`);
    return true;
  }
  if (spec.const !== undefined) demand(value === spec.const, `${path}: const`);
  if (spec.enum) demand(spec.enum.includes(value), `${path}: enum`);
  if (spec.type) {
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    demand(type === spec.type, `${path}: type`);
  }
  if (typeof value === 'string') {
    if (spec.minLength) demand([...value].length >= spec.minLength, `${path}: minLength`);
    if (spec.pattern) demand(new RegExp(spec.pattern).test(value), `${path}: pattern`);
  }
  if (Array.isArray(value)) {
    if (spec.minItems) demand(value.length >= spec.minItems, `${path}: minItems`);
    if (spec.uniqueItems) demand(new Set(value.map(canonical)).size === value.length, `${path}: uniqueItems`);
    value.forEach((x,i) => validateSchema(x,spec.items,`${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const k of spec.required || []) demand(Object.hasOwn(value,k),`${path}.${k}: required`);
    for (const [k,x] of Object.entries(value)) {
      demand(spec.properties?.[k] || spec.additionalProperties !== false, `${path}.${k}: unknown field`);
      if (spec.properties?.[k]) validateSchema(x,spec.properties[k],`${path}.${k}`);
    }
  }
  return true;
}

export function validateDecision(d) {
  validateSchema(d);
  demand(d.element.id === d.scope.element_id, 'element ID mismatch');
  demand(!/^(lemma|lexeme|word):/.test(d.element.id), 'national word is not a normative element');
  const refs = new Map(d.evidence.map(e => [e.id,e]));
  demand(refs.size === d.evidence.length, 'duplicate evidence ID');
  for (const e of d.evidence) {
    const intermediate=d.relation_type==='indirect' && d.correspondence?.steps.some(step=>
      step.evidence_ids.includes(e.id) && e.scope.family_id===d.scope.family_id && e.scope.element_id===d.scope.element_id &&
      e.scope.context_id===d.scope.context_id && e.scope.language && e.scope.lemma_id &&
      ((e.scope.lexeme_id===step.from && e.scope.sense_id===step.from_sense) ||
       (e.scope.lexeme_id===step.to && e.scope.sense_id===step.to_sense)));
    demand(sameScope(e.scope,d.scope) || intermediate, 'evidence scope mismatch');
    demand(e.assertion_sha256 === digest({source:e.source,version:e.version,locator:e.locator,finding:e.finding}), 'assertion digest mismatch');
  }
  const checkRefs = values => values.forEach(id => demand(refs.has(id), 'unknown evidence ID: '+id));
  Object.values(d.axis_evidence).forEach(checkRefs);
  if (d.correspondence) {
    demand(sameScope(d.correspondence.scope,d.scope), 'national correspondence scope mismatch');
    checkRefs(d.correspondence.evidence_ids);
    for (const step of d.correspondence.steps) checkRefs(step.evidence_ids);
    if (d.relation_type === 'indirect') {
      demand(d.correspondence.steps.length > 0, 'indirect path missing');
      for (let i=1;i<d.correspondence.steps.length;i++) {
        const a=d.correspondence.steps[i-1],b=d.correspondence.steps[i];
        demand(a.to===b.from && a.to_sense===b.from_sense, 'discontinuous indirect path');
      }
      const end=d.correspondence.steps.at(-1);
      demand(end.to===d.scope.lexeme_id && end.to_sense===d.scope.sense_id, 'indirect endpoint mismatch');
    }
  }
  if (d.decision.startsWith('CONFIRMED_')) {
    demand(Object.values(d.scope).every(x => typeof x==='string' && x.length>0), 'confirmed scope incomplete');
    demand(d.evidence_status==='documented' && d.lexical_identity_status==='resolved' && d.sense_status==='resolved', 'confirmed identity/sense/evidence missing');
    for (const axis of ['evidence_status','lexical_identity_status','sense_status','relation_status'])
      demand(d.axis_evidence[axis].length>0, 'axis proof missing: '+axis);
    if (d.decision==='CONFIRMED_MEMBER') {
      demand(d.relation_status==='supported' && rules.positive_relations.includes(d.relation_type), 'membership relation unsupported');
      demand(d.correspondence?.evidence_ids.length>0, 'national correspondence missing');
    } else demand(d.relation_status==='refuted', 'nonmembership requires a refutation');
  }
  if (d.association_status==='supported') demand(d.axis_evidence.association_status.length>0,'association proof missing');
  return true;
}

function proofTrusted(d,trust) {
  if (!trust.authorizedDecisionIds?.has(d.id) || trust.authorizedDecisionDigests?.get(d.id)!==digest(d) ||
    !(d.provenance.origin==='human_review' || d.provenance.origin==='test_fixture' && trust.allowTestFixtures===true)) return false;
  const byId=new Map(d.evidence.map(e=>[e.id,e]));
  const axes=['evidence_status','lexical_identity_status','sense_status','relation_status'];
  const valid = id => trust.verifiedEvidenceIds?.has(id) && trust.verifiedEvidenceDigests?.get(id)===digest(byId.get(id)) &&
    ['dictionary','grammar','reviewed_document'].includes(byId.get(id)?.origin);
  const polarity=d.decision==='CONFIRMED_NONMEMBER'?'rebuts':'supports';
  return axes.every(axis=>d.axis_evidence[axis].some(id=>valid(id) && (axis!=='relation_status'||byId.get(id).polarity===polarity))) &&
    (d.decision!=='CONFIRMED_MEMBER' || d.correspondence.evidence_ids.some(id=>valid(id) && byId.get(id).polarity==='supports') &&
      d.correspondence.evidence_ids.every(id=>!valid(id) || byId.get(id).polarity==='supports') &&
      d.correspondence.steps.every(step=>step.evidence_ids.some(id=>valid(id) && byId.get(id).polarity==='supports') &&
        step.evidence_ids.every(id=>!valid(id) || byId.get(id).polarity==='supports')));
}

// A null legacy discriminator covers all narrower scopes; never treats unknown as false.
export function scopeCovers(prior,scope) {
  return Object.keys(scope).every(k=>prior[k]===null || prior[k]===scope[k]);
}
export function evaluateMembership(d,{history=[],verifiedEvidenceIds=new Set(),authorizedDecisionIds=new Set(),verifiedEvidenceDigests=new Map(),authorizedDecisionDigests=new Map(),authorizedSupersessions=new Set(),allowTestFixtures=false}={}) {
  validateDecision(d);
  const trust={verifiedEvidenceIds,authorizedDecisionIds,verifiedEvidenceDigests,authorizedDecisionDigests,allowTestFixtures};
  const relevant=history.filter(h=>scopeCovers(h.scope,d.scope));
  const superseded=h=>d.supersedes.includes(h.id) && authorizedSupersessions.has(`${d.id}:${h.id}`) && proofTrusted(d,trust);
  const active=relevant.filter(h=>!superseded(h));
  const negative=active.filter(h=>h.decision==='CONFIRMED_NONMEMBER' || h.guard==='excluded' || h.guard==='quarantine');
  const hold=active.some(h=>h.guard==='uncertain' || h.guard==='pending');
  const relationPolarities=new Set(d.axis_evidence.relation_status.filter(id=>verifiedEvidenceIds.has(id) &&
    verifiedEvidenceDigests.get(id)===digest(d.evidence.find(e=>e.id===id))).map(id=>d.evidence.find(e=>e.id===id).polarity));
  const authorized=authorizedDecisionIds.has(d.id) && authorizedDecisionDigests.get(d.id)===digest(d) &&
    (d.provenance.origin==='human_review' || d.provenance.origin==='test_fixture' && allowTestFixtures);
  const confirmed=d.decision.startsWith('CONFIRMED_') && proofTrusted(d,trust);
  if (relationPolarities.size>1 || authorized && (d.evidence_status==='contradictory' || ['lexical_identity_status','sense_status','relation_status'].some(k=>d[k]==='conflict') || d.decision==='CONFLICT') ||
    active.some(h=>h.decision==='CONFLICT')) return {decision:'CONFLICT',reason:'incompatible_evidence_or_decisions'};
  const opposite=active.some(h=>h.decision?.startsWith('CONFIRMED_') && h.decision!==d.decision);
  if (confirmed && opposite) return {decision:'CONFLICT',reason:'opposite_current_decision'};
  if (negative.length && confirmed && d.decision==='CONFIRMED_NONMEMBER') return {decision:d.decision,reason:'fresh_verified_refutation_preserves_legacy_guard'};
  if (negative.length) return confirmed && d.decision==='CONFIRMED_MEMBER' ?
    {decision:'CONFLICT',reason:'prior_negative_decision',blocked_by:negative.map(h=>h.id)} :
    {decision:negative.some(h=>h.decision==='CONFIRMED_NONMEMBER')?'CONFIRMED_NONMEMBER':'UNRESOLVED',reason:'preserved_prior_negative',blocked_by:negative.map(h=>h.id)};
  if (hold) return {decision:'UNRESOLVED',reason:'prior_hold_requires_review'};
  return confirmed ? {decision:d.decision,reason:'scoped_verified_evidence_and_authorized_review'} :
    {decision:'UNRESOLVED',reason:'insufficient_evidence_or_authority'};
}

// Necessary numeric conditions only. Existing calculator/review gates remain authoritative.
export function assessRecognition(kind, result) {
  demand(Object.hasOwn(rules.thresholds,kind),'unknown element kind');
  const t=rules.thresholds[kind], langs=result.languages;
  if (!Array.isArray(langs) || new Set(langs).size!==langs.length || langs.some(l=>!rules.languages[l]))
    return {eligible:false,reason:'invalid_languages',recognition_authorized:false};
  const groups=new Set(langs.map(l=>rules.languages[l])).size;
  const finite=x=>typeof x==='number' && Number.isFinite(x) && x>=0 && x<=100;
  const score=kind==='suffix'?result.FAa:result.FAv;
  const pass=result.calculator_gates_passed===true && finite(score) && langs.length>=t.languages && groups>=t.groups &&
    score>=(kind==='suffix'?t.FAa:t.FAv) && (kind!=='suffix'||langs.every(l=>typeof result.ipm?.[l]==='number' && Number.isFinite(result.ipm[l]) && result.ipm[l]>=t.ipm_each));
  return {eligible:pass,reason:pass?'necessary_conditions_met':'conditions_missing_or_failed',recognition_authorized:false};
}

export function evaluateAssociation(d,context={}) {
  const membership=evaluateMembership(d,context);
  if (d.association_status==='conflict') return {status:'conflict',reason:'association_disagreement'};
  if (membership.decision!=='CONFIRMED_MEMBER') return {status:'unknown',reason:'membership_not_confirmed'};
  const evidence=d.axis_evidence.association_status;
  const verified=context.verifiedAssociationDecisionIds?.has(d.id) && evidence.length>0 &&
    evidence.every(id=>context.verifiedEvidenceIds?.has(id) && d.evidence.find(e=>e.id===id)?.origin!=='model');
  return verified && ['supported','weak'].includes(d.association_status) ?
    {status:d.association_status,reason:'separately_verified_contemporary_association'} :
    {status:'unknown',reason:'contemporary_association_not_verified'};
}

export function automaticCorrectionEligibility(d,context={}) {
  const evaluation=evaluateMembership(d,context);
  const lockKeys=['snapshot_sha256','source_lock_sha256','algorithm_sha256','policy_version'];
  const locked=lockKeys.every(k=>context.currentLocks?.[k]===d.provenance[k]);
  const expected=context.operation==='EXCLUDE_MEMBER'?'CONFIRMED_NONMEMBER':'CONFIRMED_MEMBER';
  const operations=['ADD_MEMBER','EXCLUDE_MEMBER','CORRECT_RELATION','CORRECT_IDENTITY','CORRECT_FAMILY'];
  const eligible=operations.includes(context.operation) && evaluation.decision===expected && proofTrusted(d,context) &&
    locked && context.exactOperationVerified===true && context.releaseGatesVerified===true;
  return {eligible,decision:evaluation.decision,reason:eligible?'may_prepare_existing_release_control_plan':'blocked',write_authorized:false};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { validateDecision(JSON.parse(readFileSync(process.argv[2],'utf8'))); console.log('VALID_CONTRACT_ONLY'); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}


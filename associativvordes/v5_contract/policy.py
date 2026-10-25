"""Real installed normative checks; trust is supplied separately, never by a question."""
import json,subprocess
from pathlib import Path
from .versions import ROOT,Blocked,validate,require,digest

def evaluate(actions,contract):
 validate(contract)
 require(isinstance(actions,list) and 1<=len(actions)<=10000,'finite normative batch required')
 run=subprocess.run(['node',str(Path(__file__).with_name('normative.mjs'))],input=json.dumps(dict(namespace=contract['namespace'],actions=actions),ensure_ascii=False),text=True,capture_output=True)
 try:result=json.loads(run.stdout)
 except ValueError:raise Blocked('installed normative validator unavailable')
 require(run.returncode==0 and result.get('status')=='PASS','normative validator: '+result.get('reason',run.stderr))
 require(result['policy_version']==contract['normative']['version'],'normative runtime version')
 validate(contract)
 return result['results']

def hypothesis(payload,contract):
 from associativvordes.normative.resolver import observe
 observation=observe('versioned_observation')
 gate=evaluate([dict(type='recognition',result=dict(languages=[],calculator_gates_passed=False))],contract)[0]
 return dict(observation,version_contract_sha256=contract['version'],policy_version=contract['normative']['version'],policy='installed normative validator',recognition=gate,membership='UNRESOLVED',establishes_membership=False,payload_sha256=digest(payload))

def decision(d,contract,trust=None,scope=None,confirmed=False):
 require(isinstance(d,dict),'explicit normative decision object required')
 validate(contract)
 if contract['namespace']=='TEST_ONLY-v5':require(d.get('scope',{}).get('family_id','').startswith('family:TEST_ONLY:'),'test namespace cannot confirm production family')
 locks=dict(snapshot_sha256=contract['baseline']['inventory_sha256'],source_lock_sha256=contract['sources']['sha256'],algorithm_sha256=digest(contract['algorithms']),policy_version=contract['normative']['version'])
 require(all(d.get('provenance',{}).get(k)==v for k,v in locks.items()),'incompatible normative decision provenance')
 if scope:
  require(all(d['scope'].get(k)==v for k,v in scope.items()),'normative decision differs from exact native scope')
 result=evaluate([dict(type='membership',decision=d,context=trust or {})],contract)[0]
 if result['decision'].startswith('CONFIRMED_'):
  h=contract['history']
  blocked=not h['coverage_complete'] or h['conflicts']>0 or any(all(d['scope'].get(k)==r[k] for k in ('family_id','language','lemma_id')) for r in h.get('fixture',{}).get('constraints',[]))
  if blocked:result=dict(decision='UNRESOLVED',reason='HISTORY_SCOPE_OR_COVERAGE_BLOCKED')
 if confirmed or result['decision'].startswith('CONFIRMED_'):
  from associativvordes.identity_mapping.model import require_binding
  try:require_binding(d,contract,trust)
  except ValueError as error:raise Blocked(str(error))
 if confirmed:require(result['decision']==d['decision'] and result['decision'] in {'CONFIRMED_MEMBER','CONFIRMED_NONMEMBER'},'normative evidence/authority not confirmed')
 return result

def review(q,item,contract,trust=None,confirmed=False):
 validate(contract)
 d=item.get('normative_decision')
 require(d is not None,'explicit normative decision required for versioned review; no guessed identity mapping')
 scope=dict(family_id=q.get('source_family_id',q.get('family_id',q.get('family'))),language=q['language'],lemma_id=q.get('source_lemma_id',q.get('lemma_id',item.get('lexeme_id'))))
 for field in ('lexeme_id','sense_id','context_id'):
  if q.get(field) is not None:scope[field]=q[field]
 if item.get('lexeme_id') is not None:scope['lexeme_id']=item['lexeme_id']
 result=decision(d,contract,trust,scope,confirmed)
 if result['decision'].startswith('CONFIRMED_') and q.get('pos'):
  from associativvordes.identity_mapping.model import require_binding
  require(require_binding(d,contract,trust)['target']['pos']==q['pos'],'review POS differs from verified lexical binding')
 return result

def operation_gate(operations,inputs,trust=None,release_verified=False):
 contract=inputs.get('version_contract');validate(contract)
 decisions=inputs.get('normative_decisions',{});receipts=[]
 for op in operations:
  row=op['before'] or op['after'];require(op['id'] in decisions,'missing exact normative operation decision')
  d=decisions[op['id']];result=decision(d,contract,trust,dict(family_id=row['family_id'],language=row['language'],lemma_id=row['lemma_id']),True)
  from associativvordes.identity_mapping.model import require_binding
  binding=require_binding(d,contract,trust)
  if row.get('pos'):require(row['pos']==binding['target']['pos'],'operation POS differs from verified lexical binding')
  require(op.get('source_record_ref')==binding['origin'],'operation source record differs from exact identity binding')
  require(op.get('lexical_binding_sha256')==digest(binding),'operation missing exact lexical/sense binding digest')
  expected='CONFIRMED_NONMEMBER' if op['kind']=='EXCLUDE_MEMBER' else 'CONFIRMED_MEMBER';require(result['decision']==expected,'normative conclusion incompatible with operation')
  context=dict(trust or {},operation=op['kind'],currentLocks=dict(snapshot_sha256=contract['baseline']['inventory_sha256'],source_lock_sha256=contract['sources']['sha256'],algorithm_sha256=digest(contract['algorithms']),policy_version=contract['normative']['version']),exactOperationVerified=True,releaseGatesVerified=release_verified)
  receipt=evaluate([dict(type='correction',decision=d,context=context)],contract)[0]
  if release_verified:require(receipt['eligible'],'normative correction eligibility not established')
  receipts.append(dict(operation=op['id'],result=receipt))
 return receipts

def history_gate(operations,contract):
 validate(contract)
 if not operations:return
 h=contract['history']
 require(h['coverage_complete'] and h['conflicts']==0,'incomplete historical coverage; nonempty operations blocked')
 if contract['namespace']=='TEST_ONLY-v5':
  for op in operations:
   for row in (op['before'],op['after']):
    if row is None:continue
    require(row['family_id'].startswith('family:TEST_ONLY:'),'production family cannot enter test namespace')
    for guard in h.get('fixture',{}).get('constraints',[]):
     if all(row.get(k)==guard[k] for k in ('family_id','language','lemma_id')):raise Blocked('preserved exact test-history restriction')

def admit(d,context,scope=None,expected=None,expected_pos=None):
 """Context is independently configured by the application, never read from d."""
 if not isinstance(context,dict) or not context.get('version_contract'):raise ValueError('normative version contract and external trust required')
 result=decision(d,context['version_contract'],context.get('trust'),scope,confirmed=True)
 if expected and result['decision']!=expected:raise ValueError('normative conclusion incompatible with requested membership')
 if expected_pos:
  from associativvordes.identity_mapping.model import require_binding
  require(require_binding(d,context['version_contract'],context.get('trust'))['target']['pos']==expected_pos,'semantic POS differs from verified lexical binding')
 return dict(result,decision_id=d['id'],scope=d['scope'],establishes_membership=True,production_write_authorized=False)

"""Finite identity proof contract, independent of membership/association scoring."""
import hashlib,json,unicodedata
STATUSES={'EXACT_IDENTITY','SUPPORTED_MAPPING','MULTIPLE_POSSIBLE_IDENTITIES','UNRESOLVED','INCOMPATIBLE'}
STRONG={'EXACT_IDENTITY','SUPPORTED_MAPPING'}
FIELDS=('language','source','source_version','lemma','pos','lexical_identity','sense','context')
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def lookup(x):return unicodedata.normalize('NFC',x).casefold()
def entity(x,complete=False):
 if not isinstance(x,dict) or set(x)!=set(FIELDS):raise ValueError('closed lexical identity entity required')
 for k in FIELDS:
  if x[k] is not None and (not isinstance(x[k],str) or not x[k]):raise ValueError('invalid identity field: '+k)
 if any(x[k] is None for k in ('language','source','source_version','lemma')):raise ValueError('source identity missing')
 if complete and any(x[k] is None for k in FIELDS):raise ValueError('POS, lexical identity, sense and context must be explicit')
 if complete and x['pos'] not in set('ADJ ADP ADV AUX CCONJ DET INTJ NOUN NUM PART PRON PROPN PUNCT SCONJ SYM VERB'.split()):raise ValueError('resolved dictionary POS required')
 return x

def entity_id(value):
 value=dict(entity(value));value['lemma']=unicodedata.normalize('NFC',value['lemma']);return 'lexical-identity:'+digest(value)

def adjudicate(origin,alternatives,proposal=None,verify_receipt=None):
 """Alternatives are source-scoped possibilities, never independent linguistic votes."""
 result=dict(status='MULTIPLE_POSSIBLE_IDENTITIES' if len(alternatives)>1 else 'UNRESOLVED',alternatives=alternatives,operation_authorized=False)
 if proposal is None:return result
 try:
  if proposal['origin']!=origin:raise ValueError('different original record')
  target=entity(proposal['target'],True)
  if proposal['status'] not in STRONG|{'INCOMPATIBLE'}:raise ValueError('not an authoritative mapping proposal')
  if proposal['status'] in STRONG and target['language']!=origin['language']:raise ValueError('language incompatible')
  if not proposal.get('evidence_refs'):raise ValueError('mapping evidence missing')
  if proposal['status']=='EXACT_IDENTITY' and origin.get('declared_native_identity')!=target:raise ValueError('cross-source mapping is not exact native identity')
  payload=digest(proposal);receipt=verify_receipt(payload) if verify_receipt else None
  if not receipt or receipt.get('payload_sha256')!=payload or receipt.get('authority') not in {'CONFIRMED_MANUAL','INDEPENDENT_GOLD'} or receipt.get('status')!='APPROVED':raise ValueError('independent content-bound mapping authority missing')
  return dict(result,status=proposal['status'],target=target,proof_sha256=payload)
 except (KeyError,ValueError,TypeError) as e:return dict(result,reason=str(e))

def require_binding(decision,contract,trust):
 """Application-configured verifier data, never copied from proposed decisions."""
 trust=trust or {};row=trust.get('verifiedLexicalMappings',{}).get(decision['id'])
 if not isinstance(row,dict) or trust.get('verifiedLexicalMappingDigests',{}).get(decision['id'])!=digest(row):raise ValueError('verified lexical/sense mapping required')
 if row.get('schema')!='interal-verified-identity-binding/1' or row.get('status') not in STRONG:raise ValueError('unconfirmed lexical/sense mapping')
 if row.get('scope')!=decision['scope']:raise ValueError('identity mapping scope mismatch')
 target=entity(row['target'],True)
 if any(target[k]!=decision['scope'][v] for k,v in [('language','language'),('lexical_identity','lexeme_id'),('sense','sense_id'),('context','context_id')]):raise ValueError('identity mapping lexical/POS/sense/context mismatch')
 if row.get('input_version')!=contract['version'] or not row.get('evidence_refs'):raise ValueError('stale or unproven identity mapping')
 source_hash=row.get('target_source_sha256','')
 if len(source_hash)!=64 or set(source_hash)-set('0123456789abcdef'):raise ValueError('pinned target source bytes required')
 origin=row.get('origin')
 if not isinstance(origin,dict) or len(origin.get('record_sha256',''))!=64 or set(origin['record_sha256'])-set('0123456789abcdef'):raise ValueError('exact corpus source locator required')
 if any(origin.get(k)!=decision['scope'][k] for k in ('family_id','language','lemma_id')) or not origin.get('path') or type(origin.get('ordinal')) is not int or origin['ordinal']<0:raise ValueError('finite corpus source locator mismatch')
 if contract['namespace']!='TEST_ONLY-v5' and origin.get('source_commit')!=contract['baseline']['source_commit']:raise ValueError('identity origin belongs to another corpus version')
 return row

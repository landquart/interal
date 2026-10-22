"""Explicit opt-in compatible HTTP adapter; durable reservations precede every generation."""
from datetime import datetime,timezone
from decimal import Decimal,ROUND_CEILING
import ipaddress
import json
import os
import re
import secrets
import threading
import time
from urllib.parse import urlsplit,urlunsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler,ProxyHandler
from contract import SYSTEM,canonical,sha,response_schema,validate_response,parse_json

DEFAULT = dict(route='deterministic',providers={},roles={},allow_paid=False,budget_usd='0',
 max_requests=0,concurrency=1,requests_per_minute=60,max_attempts=1,
 max_input_tokens=16000,max_output_tokens=1600,timeout_seconds=45,permission_ref=None)
MODES_NETWORK={'pilot','batch','resume','re-evaluate-changed'}
def now():return datetime.now(timezone.utc).isoformat()
def money(x):
    try:v=Decimal(str(x))
    except Exception:raise ValueError('decimal price/budget') from None
    if not v.is_finite() or v<0:raise ValueError('nonnegative finite money')
    return v
def micro(x):return int((x*1000000).to_integral_value(rounding=ROUND_CEILING))
def configuration(value=None):
    value=value or {}
    if set(value)-set(DEFAULT):raise ValueError('unknown configuration fields; keys belong in env only')
    c=dict(DEFAULT,**value)
    if c['route'] not in {'deterministic','single','multi','mixed'}:raise ValueError('route')
    for k,lo,hi in [('max_requests',0,10000000),('concurrency',1,32),('requests_per_minute',1,60000),
                    ('max_attempts',1,3),('max_input_tokens',128,1000000),
                    ('max_output_tokens',128,64000),('timeout_seconds',1,60)]:
        if type(c[k])!=int or not lo<=c[k]<=hi:raise ValueError('bounded '+k)
    if type(c['allow_paid'])!=bool:raise ValueError('allow_paid boolean')
    money(c['budget_usd'])
    if not isinstance(c['providers'],dict) or not isinstance(c['roles'],dict) or set(c['roles'])-{'B','C'}:
        raise ValueError('provider/role map')
    for name,p in c['providers'].items():
        allowed={'endpoint','model','model_version','key_env','folder_env','auth_scheme','local_only','local_attestation',
                 'runtime','model_digest','input_per_million_usd','output_per_million_usd',
                 'price_ref','price_verified_at','response_format'}
        if not isinstance(p,dict) or set(p)-allowed:raise ValueError('provider fields')
        if not all(isinstance(p.get(k),str) and p[k] for k in ('endpoint','model','model_version')):raise ValueError('pinned provider/model')
        u=urlsplit(p['endpoint'])
        if u.username or u.password or u.query or u.fragment or not u.hostname:raise ValueError('endpoint credentials/query prohibited')
        local=u.hostname in {'127.0.0.1','localhost','::1'}
        if p.get('local_only'):
            if not local or u.scheme!='http' or not p.get('local_attestation'):raise ValueError('attested loopback endpoint required')
            if 'cloud' in p['model'].lower():raise ValueError('local cloud model prohibited')
            if p.get('runtime')=='ollama' and not re.fullmatch(r'sha256:[0-9a-f]{64}',p.get('model_digest','')):
                raise ValueError('Ollama installed digest required')
        elif u.scheme!='https' or local:raise ValueError('paid endpoint requires remote HTTPS')
        for k in ('key_env','folder_env'):
            if p.get(k) and not re.fullmatch(r'[A-Z_][A-Z0-9_]*',p[k]):raise ValueError('environment variable name')
        if p.get('auth_scheme','Bearer') not in {'Bearer','Api-Key'}:raise ValueError('authorization scheme')
        for k in ('input_per_million_usd','output_per_million_usd'):
            if k in p:money(p[k])
        if p.get('response_format','json_object') not in {'json_object','json_schema'}:raise ValueError('response format')
    if any(v not in c['providers'] for v in c['roles'].values()):raise ValueError('unknown role provider')
    return c

class Stop(ValueError):pass
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise Stop('redirect prohibited')

class Client:
    def __init__(self,store,config,mode='offline',transport=None):
        self.store=store;self.config=configuration(config);self.mode=mode
        self.transport=transport or self.http;self.mutex=threading.RLock();self.admission=threading.RLock();self.key_locks={};self.next_slot=0;self.inflight=set()
        self.opener=build_opener(ProxyHandler({}),NoRedirect())
    def http(self,p,request,headers):
        req=Request(p['endpoint'],data=canonical(request).encode(),headers=headers,method='POST')
        with self.opener.open(req,timeout=self.config['timeout_seconds']) as response:
            data=response.read(2*1024*1024+1)
            if len(data)>2*1024*1024:raise Stop('bounded response exceeded')
            return json.loads(data)
    def installed(self,p):
        if p.get('runtime')!='ollama':return
        u=urlsplit(p['endpoint']);url=urlunsplit((u.scheme,u.netloc,'/api/tags','',''))
        with self.opener.open(url,timeout=self.config['timeout_seconds']) as r:
            data=r.read(1024*1024+1)
            if len(data)>1024*1024:raise Stop('local inventory bound')
            models=json.loads(data).get('models',[])
        matches=[m for m in models if m.get('name')==p['model'] or m.get('model')==p['model']]
        if len(matches)!=1:raise Stop('local model not installed')
        m=matches[0];digest=m.get('digest','')
        if not digest.startswith('sha256:'):digest='sha256:'+digest
        if digest!=p['model_digest'] or m.get('remote_host') or m.get('remote_model'):
            raise Stop('local digest/cloud mismatch')
    def request(self,card,role):
        c=self.config;name=c['roles'].get(role)
        if not name:return None,{'status':'MODEL_UNCONFIGURED','role':role}
        p=dict(c['providers'][name]);model=p['model']
        key=os.environ.get(p.get('key_env',''),'')
        folder=os.environ.get(p.get('folder_env',''),'')
        if '{folder}' in model:
            if not folder:raise Stop('model folder environment missing')
            model=model.replace('{folder}',folder)
        fmt={'type':p.get('response_format','json_object')}
        if fmt['type']=='json_schema':
            fmt['json_schema']={'name':'preannotation','strict':True,'schema':response_schema(card)}
        payload=dict(model=model,temperature=0,max_tokens=c['max_output_tokens'],response_format=fmt,
          messages=[{'role':'system','content':SYSTEM},
                    {'role':'user','content':canonical({'schema':response_schema(card),'untrusted_card':card})}])
        identity={k:v for k,v in p.items() if k not in
          {'key_env','folder_env','input_per_million_usd','output_per_million_usd','price_ref','price_verified_at'}}
        reqkey=sha([identity,payload])
        meta=dict(provider=name,model=model,model_version=p['model_version'],request_key=reqkey,role=role)
        # Serialize identical requests as well as store-wide admission. No repeated B/C charge.
        with self.mutex:
            lock=self.key_locks.setdefault(reqkey,threading.RLock())
        with lock:
            cached=self.store.latest('cache:'+reqkey)
            if cached:
                validate_response(cached['response'],card)
                return cached['response'],dict(meta,status='CACHE_HIT',receipt_ref=cached['receipt_ref'])
            if self.mode not in MODES_NETWORK:return None,dict(meta,status='OFFLINE_NO_REQUEST')
            estimate=len(canonical(payload).encode())+512
            if estimate>c['max_input_tokens']:return None,dict(meta,status='INPUT_BUDGET_NO_TRUNCATION')
            paid=not p.get('local_only',False)
            if paid:
                if not (c['allow_paid'] and money(c['budget_usd'])>0 and c['permission_ref']):
                    return None,dict(meta,status='PAID_NOT_AUTHORIZED')
                if not key:raise Stop('provider credential environment missing')
                if not all(p.get(k) is not None for k in
                  ('input_per_million_usd','output_per_million_usd','price_ref','price_verified_at')):
                    raise Stop('verified prices required')
            # Optional local inventory is read only after network mode was explicitly selected.
            self.installed(p)
            errors=[]
            while self.store.attempts(reqkey)<c['max_attempts']:
                with self.admission:
                    accounting=self.store.accounting()
                    if set(accounting['unresolved_paid_reservations'])-self.inflight:
                        return None,dict(meta,status='UNRECONCILED_PAID_OUTCOME')
                    if accounting['requests']>=c['max_requests']:return None,dict(meta,status='REQUEST_LIMIT')
                    reserve=micro((estimate*money(p['input_per_million_usd'])+
                        c['max_output_tokens']*money(p['output_per_million_usd']))/1000000) if paid else 0
                    if paid and accounting['budget_exposure_microusd']+reserve>micro(money(c['budget_usd'])):
                        return None,dict(meta,status='COST_LIMIT')
                    # Never retry an unknown prior semantic/billing outcome, including after a cost receipt.
                    previous=self.store.request_reservations(reqkey)
                    if any(r['id'] not in self.store.settlements or
                           self.store.get(self.store.settlements[r['id']]).get('usage') is None for r in previous):
                        return None,dict(meta,status='UNKNOWN_PRIOR_REQUEST_NO_RETRY')
                    delay=max(0,self.next_slot-time.monotonic())
                    if delay:time.sleep(min(delay,60))
                    self.next_slot=time.monotonic()+60/c['requests_per_minute']
                    rid='request:'+sha([reqkey,len(previous)+1])
                    reservation=dict(id=rid,request_key=reqkey,paid=paid,reserve_microusd=reserve,
                      estimated_input_token_upper_bound=estimate,max_output_tokens=c['max_output_tokens'],
                      provider=identity,price={k:p.get(k) for k in
                       ('input_per_million_usd','output_per_million_usd','price_ref','price_verified_at')},
                      permission_ref=c['permission_ref'] if paid else p.get('local_attestation'),created_at=now())
                    self.store.append('reservation',rid,reservation)
                    self.inflight.add(rid)
                started=time.monotonic();usage=None;rated=None;violation=False;raw=None
                try:
                    headers={'Content-Type':'application/json'}
                    if key:headers['Authorization']=p.get('auth_scheme','Bearer')+' '+key
                    raw=self.transport(p,payload,headers)
                    # Do not persist raw upstream errors or secret echoes.
                    if key and key in canonical(raw):raise Stop('credential echo rejected')
                    u=raw.get('usage')
                    if not isinstance(u,dict) or any(type(u.get(k))!=int or u[k]<0 for k in ('prompt_tokens','completion_tokens')):
                        raise Stop('provider usage unknown')
                    usage={k:u[k] for k in ('prompt_tokens','completion_tokens')}
                    violation=u['prompt_tokens']>estimate or u['completion_tokens']>c['max_output_tokens']
                    if paid:rated=micro((u['prompt_tokens']*money(p['input_per_million_usd'])+
                         u['completion_tokens']*money(p['output_per_million_usd']))/1000000)
                    else:rated=0
                except Exception:
                    # Unknown charge: keep reservation and block further paid calls. No network error text.
                    self.settle(rid,dict(usage=usage,rated_microusd=rated,
                      contract_violation=violation,status='TRANSPORT_OR_USAGE_ERROR',elapsed_seconds=time.monotonic()-started))
                    return None,dict(meta,status='TRANSPORT_OR_USAGE_ERROR',reservation_id=rid)
                self.settle(rid,dict(usage=usage,rated_microusd=rated,
                    contract_violation=violation,status='USAGE_RECORDED',elapsed_seconds=time.monotonic()-started))
                if violation:return None,dict(meta,status='TOKEN_CONTRACT_VIOLATION',reservation_id=rid)
                try:
                    choice=raw['choices'][0]
                    if choice.get('finish_reason') not in (None,'stop'):raise ValueError('truncated/refused')
                    answer=parse_json(choice['message']['content'])
                    validate_response(answer,card)
                    cached=dict(response=answer,receipt_ref=rid,actual_model=raw.get('model'),
                                response_id=raw.get('id'),created_at=now())
                    self.store.append('result','cache:'+reqkey,cached)
                    return answer,dict(meta,status='MEASURED_MODEL_RESPONSE',receipt_ref=rid,
                                      actual_model=raw.get('model'),response_id=raw.get('id'))
                except (ValueError,KeyError,IndexError,TypeError):
                    errors.append(rid)
            return None,dict(meta,status='INVALID_RESPONSE_ATTEMPT_LIMIT',attempt_refs=errors)

    def settle(self,rid,value):
        with self.admission:
            self.store.append('settlement',rid,value)
            self.inflight.discard(rid)

def forecast(config,count):
    c=configuration(config);roles=['B'] if c['route']=='single' else ['B','C'] if c['route'] in {'multi','mixed'} else []
    cost=Decimal(0);known=True
    for role in roles:
        p=c['providers'].get(c['roles'].get(role),{})
        if p.get('local_only'):continue
        if not all(p.get(k) is not None for k in ('input_per_million_usd','output_per_million_usd','price_ref','price_verified_at')):
            known=False;continue
        cost+=(c['max_input_tokens']*money(p['input_per_million_usd'])+
               c['max_output_tokens']*money(p['output_per_million_usd']))/1000000
    return {'schema':'preannotation-forecast/1','max_stage_requests_per_candidate':len(roles),
      'counts':{str(n):{'candidate_count':n,'upper_rated_usd':str(cost*n*c['max_attempts']) if known else None,
                      'status':'CONFIGURED_RATE_BOUND' if known else 'UNKNOWN_PROVIDER_OR_PRICE'} for n in sorted({100,1000,count})},
      'actual_billed_usd':None,'warning':'Configured token bound, not a quote or invoice; C worst case and retry cap included; hardware cost unknown.'}

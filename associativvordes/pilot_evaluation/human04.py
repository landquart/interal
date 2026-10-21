"""Human-only loopback collection with blinded tasks and server-side active timing."""
import argparse,base64,fcntl,hashlib,json,mimetypes,re,secrets,sys,threading,time
from datetime import datetime,timezone
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from pathlib import Path
from gold import canonical,sha,validate_judgment,json_rows,compile_gold
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'review'))
from store import atomic,digest,canonical
HERE=Path(__file__).resolve().parent

class Study:
    def __init__(self,folder):
        self.root=Path(folder);self.plan=json.loads((self.root/'STUDY.json').read_text())
        self.cases={c['id']:c for c in json_rows(self.root/'subset-cases.ndjson')}
        if sha(sorted(self.cases.values(),key=lambda c:c['id']))!=self.plan['subset_sha256']:raise ValueError('study subset lock')
        self.roster=json.loads((self.root/'raters.json').read_text());self.evidence=json.loads((self.root/'EVIDENCE-PRIVATE.json').read_text())
        if self.plan.get('evidence_sha256')!=sha(self.evidence):raise ValueError('study evidence lock')
        self.mutex=threading.RLock();(self.root/'events').mkdir(exist_ok=True);(self.root/'attempts').mkdir(exist_ok=True)
        slots=[r.get('slot') for r in self.roster.values()]
        if len(slots)!=len(set(slots)):raise ValueError('one distinct human per slot')
        if any(r.get('kind')!='human' or not r.get('authorized_by') or not r.get('authorization_ref') for r in self.roster.values()):raise ValueError('verified human roster required')
        self.events=self.read_events()

    def read_events(self):
        events=[];previous=None
        for i,p in enumerate(sorted((self.root/'events').glob('[0-9]*.json')),1):
            e=json.loads(p.read_text());h=e.pop('sha256')
            if p.name!=f'{i:08d}.json' or e['previous']!=previous or digest(e)!=h:raise ValueError('study event integrity')
            e['sha256']=h;events.append(e);previous=h
        head=self.root/'HEAD'
        if head.exists():
            expected=json.loads(head.read_text())
            if len(events)<expected['sequence'] or events[expected['sequence']-1]['sha256']!=expected['sha256']:raise ValueError('committed study tail missing')
        return events

    def pending(self,actor):
        person=self.roster[actor];done={e['task_id'] for e in self.events if e['judgment']['annotator_id']==actor}
        tasks=[t for t in self.plan['tasks'] if t['slot']==person['slot'] and t['task_id'] not in done and t['language'] in person['languages']]
        # Counterbalance order without showing conditions or case origins.
        tasks.sort(key=lambda t:sha([actor,t['task_id']]))
        return tasks[0] if tasks else None

    def open(self,actor):
        with self.mutex:
            task=self.pending(actor)
            if not task:return {'done':True}
            path=self.root/'attempts'/(digest([actor,task['task_id']])+'.json')
            interrupted=path.exists()
            atomic(path,canonical({'actor':actor,'task':task['task_id'],'opened_at':datetime.now(timezone.utc).isoformat()}).encode())
            # Strict allowlist: no origins, graph paths, predictions, old decisions,
            # budgets, confidence, assignment seed, other participants or gold.
            payload={k:task[k] for k in ('task_id','case_id','case_content_sha256','family','language','target')}
            payload['source_observations']=self.evidence.get(task['case_id'],[]) if task['condition']=='combined' else []
            return {'task':payload,'private_task':task,'interrupted':interrupted}

    def save(self,actor,task,j,seconds,request_id,interrupted=False):
        with self.mutex,open(self.root/'STUDY-LOCK','a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX);self.events=self.read_events()
            prior=next((e for e in self.events if e['request_id']==request_id and e['judgment']['annotator_id']==actor),None)
            if prior:
                if sha(prior['judgment'])!=sha(j):raise ValueError('request ID content conflict')
                return prior
            person=self.roster[actor]
            if task['slot']!=person['slot'] or task['language'] not in person['languages']:raise ValueError('unassigned task')
            if any(e['task_id']==task['task_id'] for e in self.events):raise ValueError('task already answered')
            if any(e['judgment']['annotator_id']==actor and (e['judgment']['case_id']==task['case_id'] or e['leakage_group']==task['leakage_group'] and e['condition']!=task['condition']) for e in self.events):raise ValueError('repeated/cross-arm exposure')
            if task['purpose']=='adjudication':
                original=[e['judgment'] for e in self.events if e['purpose']=='gold' and e['judgment']['case_id']==task['case_id']]
                if actor in {x['annotator_id'] for x in original} or sorted(j.get('disputed_judgment_sha256',[]))!=sorted(sha(x) for x in original):raise ValueError('independent adjudication basis')
            validate_judgment(j,self.cases[task['case_id']],self.roster)
            if not re.fullmatch('[a-zA-Z0-9_-]{8,100}',request_id):raise ValueError('request ID')
            e={'sequence':len(self.events)+1,'previous':self.events[-1]['sha256'] if self.events else None,'task_id':task['task_id'],
              'request_id':request_id,'judgment':j,'purpose':task['purpose'],'condition':task['condition'],'leakage_group':task['leakage_group'],
              'active_seconds':None if interrupted else seconds,'server_timing':True,'timing_status':'interrupted_unknown' if interrupted else 'measured',
              'subset_sha256':self.plan['subset_sha256'],'protocol_sha256':self.plan['protocol_sha256']}
            e['sha256']=digest(e);atomic(self.root/'events'/f'{e["sequence"]:08d}.json',canonical(e).encode());self.events.append(e)
            atomic(self.root/'HEAD',canonical({'sequence':e['sequence'],'sha256':e['sha256']}).encode())
            return e

    def export(self):
        self.events=self.read_events();gold=[];trials=[];adjudications=[]
        for e in self.events:
            if e['purpose']=='gold':gold.append(e['judgment'])
            elif e['purpose']=='adjudication':adjudications.append(e['judgment'])
            else:trials.append(dict(e['judgment'],condition=e['condition'],active_seconds=e['active_seconds'],server_timing=True,timing_status=e['timing_status']))
        roster={a:{k:v for k,v in r.items() if k!='token_hash'} for a,r in self.roster.items()}
        payload={'schema':'pilot04-human-release/1','subset_sha256':self.plan['subset_sha256'],'judgments':gold,'adjudications':adjudications,'trials':trials,'raters':roster,'events':self.events}
        raw=canonical(payload).encode();folder=self.root/'human-releases'/digest(raw);folder.mkdir(exist_ok=True,parents=True)
        path=folder/'HUMAN-RELEASE.json';atomic(path,raw)
        for name,values in [('judgments.ndjson',gold),('adjudications.ndjson',adjudications),('trials.ndjson',trials)]:
            atomic(folder/name,(''.join(canonical(j)+'\n' for j in values)).encode())
        atomic(folder/'raters.json',canonical(roster).encode())
        return folder

class Server(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,address,study):
        if not study.roster:raise ValueError('BLOCKED: no verified authorized humans registered')
        super().__init__(address,Handler);self.study=study;self.sessions={}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,code,value,ctype='application/json'):
        body=value if isinstance(value,bytes) else canonical(value).encode();self.send_response(code)
        self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
        self.send_header('Content-Security-Policy',"default-src 'self';script-src 'self';style-src 'self';frame-ancestors 'none';base-uri 'none'")
        self.send_header('X-Content-Type-Options','nosniff')
        if getattr(self,'new_cookie',None):self.send_header('Set-Cookie',self.new_cookie)
        self.end_headers();self.wfile.write(body)
    def guard(self):
        if self.headers.get('Host') not in (f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'):raise ValueError('invalid local host')
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+self.headers['Host']:raise ValueError('cross-origin blocked')
    def session(self):
        cookie=SimpleCookie(self.headers.get('Cookie',''));sid=cookie['study'].value if 'study' in cookie else ''
        s=self.server.sessions.get(sid)
        if not s or s['expires']<time.time():raise ValueError('login required')
        return s
    def do_GET(self):
        try:
            self.guard();path=self.path.split('?')[0]
            static={'/':HERE/'study04.html','/study04.js':HERE/'study04.js','/review.css':HERE.parent/'review/review.css','/shared/ui.css':HERE.parents[1]/'shared/ui.css'}
            if path in static:
                data=static[path].read_bytes()
                if path=='/shared/ui.css':data=re.sub(rb'@import url\([^)]*\)\s*;',b'',data)
                return self.send(200,data,mimetypes.guess_type(static[path])[0] or 'text/plain')
            if path=='/favicon.ico':return self.send(204,b'')
            s=self.session();study=self.server.study
            if path=='/api/task':
                if not s.get('opened'):
                    opened=study.open(s['actor'])
                    if opened.get('done'):return self.send(200,opened)
                    s['opened']=opened;s['timer']={'active':True,'since':time.monotonic(),'total':0}
                return self.send(200,{'task':s['opened']['task'],'csrf':s['csrf'],'interrupted_timing':s['opened']['interrupted']})
            self.send(404,{'error':'unknown route'})
        except Exception as e:self.send(400,{'error':str(e)})
    def do_POST(self):
        try:
            self.guard();size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=50000 or self.headers.get('Content-Type')!='application/json':raise ValueError('bounded JSON request required')
            b=json.loads(self.rfile.read(size));path=self.path;study=self.server.study
            if path=='/api/login':
                h=digest(str(b.get('token','')).encode());actor=next((a for a,r in study.roster.items() if secrets.compare_digest(r['token_hash'],h)),None)
                if not actor:raise ValueError('invalid human credential')
                sid=secrets.token_urlsafe(32);self.server.sessions[sid]={'actor':actor,'csrf':secrets.token_urlsafe(32),'expires':time.time()+43200}
                self.new_cookie='study='+sid+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200';return self.send(200,{'ok':True})
            s=self.session()
            if not secrets.compare_digest(self.headers.get('X-CSRF-Token',''),s['csrf']):raise ValueError('CSRF')
            if not s.get('opened'):raise ValueError('open assigned task first')
            timer=s['timer'];now=time.monotonic()
            if path=='/api/timer':
                active=bool(b['active'])
                if active!=timer['active']:
                    if timer['active']:timer['total']+=now-timer['since']
                    timer['since']=now;timer['active']=active
                return self.send(200,{'active':active})
            if path=='/api/save':
                task=s['opened']['private_task'];j={**b['judgment'],'annotator_id':s['actor'],'case_id':task['case_id'],'case_content_sha256':task['case_content_sha256'],'mode':'human','reviewed_at':datetime.now(timezone.utc).isoformat()}
                if task['purpose']=='adjudication':j['disputed_judgment_sha256']=task['disputed_judgment_sha256']
                seconds=timer['total']+(now-timer['since'] if timer['active'] else 0)
                # Keep a stable timestamp for retry after a lost acknowledgement.
                if s.get('last_request')==b['request_id']:j['reviewed_at']=s['last_timestamp']
                else:s['last_request']=b['request_id'];s['last_timestamp']=j['reviewed_at']
                study.save(s['actor'],task,j,seconds,b['request_id'],s['opened']['interrupted'] or b.get('timing_unknown',False))
                # Retain completed task for idempotent retries; next task is
                # explicitly requested only after acknowledgement.
                s['saved']=True;return self.send(200,{'saved':True})
            if path=='/api/next':
                if not s.get('saved'):raise ValueError('save current task first')
                s.pop('opened',None);s.pop('saved',None);return self.send(200,{'ok':True})
            self.send(404,{'error':'unknown route'})
        except Exception as e:self.send(400,{'error':str(e)})

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data',type=Path,required=True)
    sub=p.add_subparsers(dest='command',required=True)
    reg=sub.add_parser('register')
    for k in ('annotator','slot','authorized-by','authorization-ref','languages'):reg.add_argument('--'+k,required=True)
    serve=sub.add_parser('serve');serve.add_argument('--port',type=int,default=8767)
    sub.add_parser('readiness')
    sub.add_parser('export')
    sub.add_parser('adjudication-tasks')
    a=p.parse_args()
    if a.data.resolve().is_relative_to(HERE.parents[1]):p.error('private data outside checkout')
    if a.command=='register':
        roster=json.loads((a.data/'raters.json').read_text())
        if a.annotator in roster or any(r['slot']==a.slot for r in roster.values()):p.error('already registered; no identity/slot reuse')
        if a.slot not in ('gold-1','gold-2','study-1','study-2','study-3','study-4','arbiter'):p.error('known study slot required')
        langs=a.languages.split(',')
        if set(langs)-{'en','de','es','fr','it','ru'}:p.error('six control languages only')
        token=secrets.token_urlsafe(32)
        roster[a.annotator]={'kind':'human','slot':a.slot,'authorized_by':a.authorized_by,'authorization_ref':a.authorization_ref,'languages':langs,'token_hash':digest(token.encode())}
        atomic(a.data/'raters.json',canonical(roster).encode())
        print('Private one-time human key: '+token);return
    study=Study(a.data)
    if a.command=='readiness':
        byslot={r['slot']:r for r in study.roster.values()}
        missing=[t['task_id'] for t in study.plan['tasks'] if t['slot'] not in byslot or t['language'] not in byslot[t['slot']]['languages']]
        print(canonical({'status':'BLOCKED' if missing else 'READY_FOR_HUMAN_COLLECTION','verified_humans':len(study.roster),'unassigned_tasks':len(missing),'completed_events':len(study.events)}))
    elif a.command=='adjudication-tasks':
        from gold import assignments
        judgments=[e['judgment'] for e in study.events if e['purpose']=='gold']
        gold=compile_gold(list(study.cases.values()),judgments,study.roster)
        already={t['case_id'] for t in study.plan['tasks'] if t['purpose']=='adjudication'}
        for row in gold['rows']:
            if row['state']!='disagreement' or row['case_id'] in already:continue
            c=study.cases[row['case_id']]
            task=assignments([c])[0]
            task={k:task[k] for k in ('case_id','case_content_sha256','family','language','target')}
            task.update(task_id='adjudication:'+sha(row['judgment_refs']),slot='arbiter',condition='control',purpose='adjudication',leakage_group=c['leakage_group'],disputed_judgment_sha256=row['judgment_refs'])
            study.plan['tasks'].append(task)
        versions=a.data/'plan-versions';versions.mkdir(exist_ok=True)
        old=(a.data/'STUDY.json').read_bytes();atomic(versions/(digest(old)+'.json'),old)
        atomic(a.data/'STUDY.json',canonical(study.plan).encode())
        print('Independent adjudication tasks: '+str(sum(t['purpose']=='adjudication' for t in study.plan['tasks'])))
    elif a.command=='export':print(study.export())
    else:
        server=Server(('127.0.0.1',a.port),study);print('http://127.0.0.1:'+str(server.server_port),flush=True);server.serve_forever()

if __name__=='__main__':main()

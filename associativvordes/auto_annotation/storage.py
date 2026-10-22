"""Immutable fsynced object/journal authority, process lease and threaded transactions."""
import contextlib
import fcntl
import json
import os
from pathlib import Path
import secrets
import threading
import zipfile
from contract import canonical,sha

def atomic(path,data):
    path=Path(path);tmp=path.with_name('.pending-'+secrets.token_hex(12))
    try:
        with open(tmp,'xb') as f:
            os.chmod(tmp,0o600);f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
        fd=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(fd)
        finally:os.close(fd)
    finally:tmp.unlink(missing_ok=True)

class Store:
    def __init__(self,root):
        self.root=Path(root).resolve()
        if self.root.is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('store outside checkout')
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        for n in ('objects','journal'): (self.root/n).mkdir(exist_ok=True,mode=0o700)
        self.mutex=threading.RLock();self.active=False
    @contextlib.contextmanager
    def lease(self):
        if self.active:raise RuntimeError('lease already active')
        with open(self.root/'LOCK','a') as f:
            fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);self.active=True
            try:self.reload();yield self
            finally:self.active=False;fcntl.flock(f,fcntl.LOCK_UN)
    def put(self,value):
        data=canonical(value).encode();key=sha(data);p=self.root/'objects'/(key+'.json')
        if p.exists():
            if p.read_bytes()!=data:raise ValueError('immutable object mismatch')
        else:atomic(p,data)
        return key
    def get(self,key):
        if len(key)!=64 or any(c not in '0123456789abcdef' for c in key):raise ValueError('object ID')
        data=(self.root/'objects'/(key+'.json')).read_bytes()
        if sha(data)!=key:raise ValueError('object corruption')
        return json.loads(data)
    def reload(self):
        self.events=[];self.cards={};self.results={};self.runs={};self.reservations={};self.settlements={};self.receipts={}
        self.proposal_index={}
        self.billing={};self.request_index={};self.totals={k:0 for k in ('exposure','rated','actual','unbilled','input','output')};self.unknown=set()
        self.head=None
        files=sorted((self.root/'journal').glob('*.json'))
        committed=json.loads((self.root/'HEAD').read_text()) if (self.root/'HEAD').exists() else None
        if committed and len(files)<committed['sequence']:raise ValueError('committed journal tail lost')
        for n,p in enumerate(files,1):
            e=json.loads(p.read_text())
            if p.name!=f'{n:012d}.json' or e['sequence']!=n or e['previous']!=self.head:
                raise ValueError('journal sequence/chain')
            if e['hash']!=sha({k:v for k,v in e.items() if k!='hash'}):raise ValueError('journal hash')
            if committed and n==committed['sequence'] and committed['hash']!=e['hash']:raise ValueError('HEAD mismatch')
            self.apply(e)
        # A completed transaction file preceding an interrupted HEAD rename is recoverable.
        if files:atomic(self.root/'HEAD',canonical({'sequence':len(files),'hash':self.head}).encode())
    def apply(self,e):
        kind,key,ref=e['kind'],e['key'],e['object']
        value=self.get(ref) # Check every referenced object at recovery, not just latest result.
        if kind in ('reservation','settlement','receipt'):
            old=self.contribution(key)
            self.billing.setdefault(key,{})[kind]=value
            if kind=='reservation':self.request_index.setdefault(value['request_key'],[]).append(value)
            new=self.contribution(key)
            for k in self.totals:self.totals[k]+=new[k]-old[k]
            self.unknown.discard(key)
            if new['unknown']:self.unknown.add(key)
        if kind=='card':self.cards[key]=ref
        elif kind=='result':
            self.results.setdefault(key,[]).append(ref)
            if value.get('candidate_id'):self.proposal_index.setdefault(value['candidate_id'],[]).append(ref)
        elif kind=='run':self.runs[key]=ref
        elif kind=='reservation':self.reservations[key]=ref
        elif kind=='settlement':self.settlements[key]=ref
        elif kind=='receipt':self.receipts[key]=ref
        else:raise ValueError('journal kind')
        self.events.append(e);self.head=e['hash']
    def append(self,kind,key,value):
        with self.mutex:
            if not self.active:raise RuntimeError('exclusive store lease required')
            if kind in ('card','run','reservation','settlement','receipt'):
                table={'card':self.cards,'run':self.runs,'reservation':self.reservations,
                       'settlement':self.settlements,'receipt':self.receipts}[kind]
                if key in table:
                    if self.get(table[key])!=value:raise ValueError('immutable transaction collision')
                    return table[key]
            ref=self.put(value)
            body=dict(sequence=len(self.events)+1,previous=self.head,kind=kind,key=key,object=ref)
            e=dict(body,hash=sha(body));p=self.root/'journal'/f'{e["sequence"]:012d}.json'
            atomic(p,canonical(e).encode())
            atomic(self.root/'HEAD',canonical({'sequence':e['sequence'],'hash':e['hash']}).encode())
            self.apply(e);return ref
    def latest(self,key):
        refs=self.results.get(key,[])
        return self.get(refs[-1]) if refs else None
    def attempts(self,request_key):
        return len(self.request_index.get(request_key,[]))
    def request_reservations(self,key):return self.request_index.get(key,[])
    def contribution(self,key):
        v=self.billing.get(key,{});r=v.get('reservation');s=v.get('settlement');receipt=v.get('receipt')
        out={k:0 for k in ('exposure','rated','actual','unbilled','input','output','unknown')}
        if not r:return out
        if s and s.get('usage'):
            out['input']=s['usage']['prompt_tokens'];out['output']=s['usage']['completion_tokens']
        if r['paid']:
            rated=s.get('rated_microusd') if s else None
            out['rated']=rated or 0
            out['exposure']=receipt['billed_microusd'] if receipt else rated if rated is not None else r['reserve_microusd']
            out['actual']=receipt['billed_microusd'] if receipt else 0
            out['unbilled']=int(not receipt)
            out['unknown']=int((not s or s.get('usage') is None or s.get('contract_violation')) and not receipt)
        return out
    def accounting(self):
        with self.mutex:
            t=self.totals
            return dict(requests=len(self.reservations),budget_exposure_microusd=t['exposure'],
              rated_microusd=t['rated'],actual_billed_microusd=t['actual'] if not t['unbilled'] else None,
              unresolved_paid_reservations=sorted(self.unknown),prompt_tokens=t['input'],completion_tokens=t['output'])
    def receipt(self,r):
        required={'reservation_id','billed_microusd','currency','provider_receipt_ref','author','verified_at'}
        if set(r)!=required or r['currency']!='USD' or type(r['billed_microusd'])!=int or r['billed_microusd']<0:
            raise ValueError('receipt contract')
        if not all(r[k] for k in ('provider_receipt_ref','author','verified_at')):raise ValueError('receipt attribution')
        if r['reservation_id'] not in self.reservations:raise ValueError('unknown reservation')
        return self.append('receipt',r['reservation_id'],r)

def backup(store,destination):
    destination=Path(destination)
    if destination.exists():raise FileExistsError('versioned backup destination')
    files={p.relative_to(store.root).as_posix():p.read_bytes() for n in ('objects','journal')
           for p in (store.root/n).glob('*.json')}
    if (store.root/'HEAD').exists():files['HEAD']=(store.root/'HEAD').read_bytes()
    manifest={'schema':'preannotation-backup/1','files':{k:sha(v) for k,v in sorted(files.items())}}
    with zipfile.ZipFile(destination,'x',zipfile.ZIP_DEFLATED) as z:
        for name,data in sorted(files.items()):z.writestr(name,data)
        z.writestr('MANIFEST.json',canonical(manifest))
    return dict(manifest,backup_sha256=sha(destination.read_bytes()))

def restore(archive,destination):
    root=Path(destination).resolve()
    if root.exists() and any(root.iterdir()):raise ValueError('restore requires empty directory')
    with zipfile.ZipFile(archive) as z:
        names=z.namelist()
        if len(set(names))!=len(names) or sum(i.file_size for i in z.infolist())>10*1024**3:raise ValueError('backup bounds')
        if any(Path(n).is_absolute() or '..' in Path(n).parts for n in names):raise ValueError('backup traversal')
        manifest=json.loads(z.read('MANIFEST.json'))
        if set(names)!=(set(manifest['files'])|{'MANIFEST.json'}):raise ValueError('backup inventory')
        contents={n:z.read(n) for n in manifest['files']}
        if any(sha(b)!=manifest['files'][n] for n,b in contents.items()):raise ValueError('backup corruption')
        if any(n!='HEAD' and not (n.startswith(('objects/','journal/')) and n.endswith('.json')) for n in contents):
            raise ValueError('backup namespace')
    root.mkdir(parents=True,exist_ok=True)
    for n,b in contents.items():
        p=root/n;p.parent.mkdir(parents=True,exist_ok=True);atomic(p,b)
    s=Store(root)
    with s.lease():return {'events':len(s.events),'cards':len(s.cards),'results':len(s.results),'accounting':s.accounting()}

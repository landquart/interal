#!/usr/bin/env python3
"""Acquire exact approved v6 objects and read-only v5 controls; prepare finite probes."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
from graph import canonical,file_hash

COMMIT='9fff76431a86a06df6db69b64d7f2ca4c871f1b7'
BASE='d6780ebc693837cc4560a40672eb7ee39e8fa6f7'
ROOTS=['ocul','ped','alter','regul','creat','nat','inter']
FILES={
 'catalog.json':'d7400d9f327f43f69106725b0b290420fe1a306b',
 'schema.json':'eec5bb31a25c98382ed35da6b83148c90ec694f2',
 'head-lifecycle.json':'9d2ff581658a924bfe1ac76abd759715151b561b',
 'baseline-corrections.json':'f685faf2708c3770d87f4d410f41fae3ac6ec2e2',
 'generated/heads.json.gz':'c886b717337eb4850baa99f9a1e71dbcd5539f71',
 'generated/edges.json.gz':'9db20d73ba7dd939643bd1a78635a00b7fa89b75',
 'generated/lemma-head-links.json.gz':'09782c35660497c98d0cb1ba791be0d630069367',
 'generated/memberships.json.gz':'deb5e562f7cf4c94dcb73a2cc248c8649f7173ab',
 'generated/correction-verdicts.json.gz':'92ae2eec8d019f835ea4fe5e7bc3a2a21fa208b5',
 'generated/reflexes.json':'8a184c4bd4c78e1f51a68e100ee0ce7070dd6bb1',
 'generated/manifest.json':'f5c5092af70f27be40d189f8a8a276aae4ed53f6'}

def bucket(s):
    h=0x811c9dc5
    for c in s:h=((h^ord(c))*0x01000193)&0xffffffff
    return f'{h%256:02x}'
def read(path):
    with (gzip.open(path,'rt',encoding='utf-8') if str(path).endswith('.gz') else open(path,encoding='utf-8')) as f:return json.load(f)
def fetch(root,path,commit,blob,enabled):
    p=root/path
    if not p.exists():
        if not enabled:raise FileNotFoundError(p)
        with urllib.request.urlopen('https://raw.githubusercontent.com/landquart/interal/'+commit+'/'+path,timeout=90) as f:data=f.read()
        if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=blob:raise ValueError('git blob mismatch: '+path)
        p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    data=p.read_bytes()
    if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=blob:raise ValueError('cached git blob mismatch: '+path)
    return {'sha256':file_hash(p),'bytes':len(data),'git_blob':blob,'commit':commit}

def prepare(repo,cache,output,records=None,acquire=False):
    repo=Path(repo).resolve();cache=Path(cache).resolve();out=Path(output).resolve()
    if cache.is_relative_to(repo) or out.is_relative_to(repo):raise ValueError('all acquisition/projection outputs must be outside checkout')
    def get(n):
        path='associativvordes/family-index-v6/'+n
        return path,fetch(cache,path,COMMIT,FILES[n],acquire)
    with ThreadPoolExecutor(max_workers=6) as ex:locked=dict(ex.map(get,FILES))
    v6=cache/'associativvordes/family-index-v6';families={'family:'+s for s in ROOTS}
    c=read(v6/'catalog.json');edges=[e for e in read(v6/'generated/edges.json.gz') if e['family_id'] in families]
    ids={e['head_id'] for e in edges};heads=[h for h in read(v6/'generated/heads.json.gz') if h['id'] in ids]
    links=[l for l in read(v6/'generated/lemma-head-links.json.gz') if l['family_id'] in families]
    members=[m for m in read(v6/'generated/memberships.json.gz') if m['family_id'] in families]
    corrections=[x for x in read(v6/'generated/correction-verdicts.json.gz') if x['family_id'] in families]
    realizations=[x for x in read(v6/'generated/reflexes.json') if x['family_id'] in families]
    controls=[];manual=[];byhead={h['id']:h for h in heads};seeds=[]
    for family in sorted(families):
        for lang in ['de','en','es','fr','it','ru']:
            candidates={}
            for e in edges:
                h=byhead[e['head_id']]
                if e['family_id']==family and h['language']==lang and h['identity_kind']!='legacy_exact_record':candidates[h['normalized_head']]=(0 if e['status']=='accepted' else 2,h['id'],'head')
            for l in links:
                if l['family_id']==family and l['language']==lang:
                    h=byhead[l['head_id']];candidates.setdefault(l['word'],(1 if h['identity_kind']!='legacy_exact_record' else 3,h['id'],l['recognition']))
            for word,info in sorted(candidates.items(),key=lambda x:(x[1][0],len(x[0]),x[0]))[:12]:seeds.append({'family_id':family,'language':lang,'word':word,'head_id':info[1],'origin':info[2],'scope':'lookup_only'})
    def get_v5(relative):
        path='associativvordes/family-index-v5/'+relative
        blob=subprocess.check_output(['git','rev-parse',BASE+':'+path],cwd=repo,text=True).strip()
        locked[path]=fetch(cache,path,BASE,blob,acquire)
        return read(cache/path)
    for fid in sorted(families|{'family:pede'}):
        f=get_v5('families/'+bucket(fid)+'.json.gz').get(fid)
        if not f:continue
        target='family:ped' if fid=='family:pede' else fid
        if not(f.get('runtime_curated') or 'manual_override' in str(f.get('source')) or f.get('review_status') in {'rejected','split_required','blocked_from_runtime'}):continue
        controls.append({'family_id':target,'source_family_id':fid,'family_review_status':f.get('review_status'),'family_record_json':json.dumps(f,sort_keys=True,ensure_ascii=False,separators=(',',':'))})
        for lang in ['en','de','fr','es','it','ru']:
            for m in get_v5('members/'+lang+'/'+bucket(fid)+'.json.gz').get(fid,[]):
                marker=any(e.get('type')=='manual_override' for c in m.get('components',[]) for e in c.get('evidence',[]));bad=m.get('corpus_quality',{}).get('status')=='rejected'
                if marker or bad:manual.append({'family_id':target,'language':lang,'word':m['word'],'lemma_id':m['lemma_id'],'status':'blocked_from_runtime' if bad else 'accepted','reason':'existing corpus quality exclusion' if bad else 'finite prior manual_override; not a new grant','source_record_json':json.dumps(m,sort_keys=True,ensure_ascii=False,separators=(',',':'))})
    snapshot={'schema_version':'v6-readonly-snapshot/1','commit':COMMIT,'files':locked,'catalog':c,'heads':heads,'edges':edges,'links':links,'memberships':members,'corrections':corrections,'realizations':realizations,'manual_decisions':manual,'family_controls':controls}
    snapshot['input_inventory']={k:len(snapshot[k]) for k in ['heads','edges','links','memberships','corrections']}
    if records:
        words={(l['language'],l['lemma'].casefold()) for line in open(records,encoding='utf-8') for l in json.loads(line)['body']['normalized']['lexemes']}
        keep={l['head_id'] for l in links if (l['language'],l['word'].casefold()) in words}|{h['id'] for h in heads if h['identity_kind']!='legacy_exact_record'}
        for field in ['heads','edges','links','memberships']:snapshot[field]=[x for x in snapshot[field] if x['id' if field=='heads' else 'head_id'] in keep]
    out.mkdir(parents=True,exist_ok=True);(out/'seeds.json').write_text(canonical(seeds)+'\n',encoding='utf-8');(out/'v6.json').write_text(canonical(snapshot)+'\n',encoding='utf-8')
    lock={'schema_version':'v6-readonly-input-lock/1','commit':COMMIT,'snapshot_sha256':file_hash(out/'v6.json'),'original_files':locked,'projection_policy_sha256':file_hash(__file__)}
    (out/'v6-lock.json').write_text(canonical(lock)+'\n',encoding='utf-8');return out

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['repo','cache','output']:p.add_argument('--'+name,required=True)
    p.add_argument('--records');p.add_argument('--fetch',action='store_true');a=p.parse_args();print(prepare(a.repo,a.cache,a.output,a.records,a.fetch))

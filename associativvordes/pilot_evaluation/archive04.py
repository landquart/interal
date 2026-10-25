"""Lossless JSON DAG archive for repeated evidence; restores exact captured JSON bytes."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import argparse,base64,gzip,hashlib,json
from pathlib import Path

def raw_hash(b):return hashlib.sha256(b).hexdigest()

def pack(files,output):
    nodes=[];cache={};roots={};hashes={};verbatim={}
    def intern(value):
        if isinstance(value,dict):node=['o',[[intern(k),intern(v)]for k,v in value.items()]]
        elif isinstance(value,list):node=['a',[intern(v)for v in value]]
        else:node=['v',value]
        key=json.dumps(node,ensure_ascii=False,separators=(',',':'),allow_nan=False)
        if key not in cache:cache[key]=len(nodes);nodes.append(node)
        return cache[key]
    for name,path in files.items():
        raw=Path(path).read_bytes()
        if name.endswith('.gz'):raw=gzip.decompress(raw);name=name[:-3]
        hashes[name]=raw_hash(raw)
        value=json.loads(raw)
        canonical=(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False)+'\n').encode()
        if raw==canonical:roots[name]=intern(value)
        else:verbatim[name]=base64.b64encode(gzip.compress(raw,mtime=0)).decode()
    payload={'schema':'pilot04-lossless-json-dag/1','nodes':nodes,'roots':roots,'sha256_uncompressed':hashes,'verbatim_gzip_base64':verbatim}
    Path(output).write_bytes(gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode(),mtime=0))
    return {'files':len(files),'nodes':len(nodes),'bytes':Path(output).stat().st_size,'sha256':raw_hash(Path(output).read_bytes())}

def unpack(path,output):
    output=Path(output)
    if output.exists() and any(output.iterdir()):raise ValueError('restore into empty directory')
    output.mkdir(parents=True,exist_ok=True);payload=json.loads(gzip.decompress(Path(path).read_bytes()))
    if payload['schema']!='pilot04-lossless-json-dag/1':raise ValueError('archive schema')
    nodes=[]
    for tag,body in payload['nodes']:
        if tag=='v':value=body
        elif tag=='a':value=[nodes[i]for i in body]
        elif tag=='o':value={nodes[k]:nodes[v]for k,v in body}
        else:raise ValueError('node kind')
        nodes.append(value)
    restored={}
    for name,i in payload['roots'].items():restored[name]=(json.dumps(nodes[i],ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False)+'\n').encode()
    for name,raw in payload['verbatim_gzip_base64'].items():restored[name]=gzip.decompress(base64.b64decode(raw,validate=True))
    if set(restored)!=set(payload['sha256_uncompressed']):raise ValueError('archive scope')
    for name,raw in restored.items():
        if Path(name).name!=name or raw_hash(raw)!=payload['sha256_uncompressed'][name]:raise ValueError('archive path/checksum')
        (output/name).write_bytes(raw)
    return {'files':len(restored),'all_original_json_bytes_restored':True}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive');p.add_argument('output');a=p.parse_args()
    print(json.dumps(unpack(a.archive,a.output)))

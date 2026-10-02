import json,gzip,re,hashlib
from pathlib import Path
root=Path('associativvordes/family-index-v5');base=Path('audit/associative-family-v5')
d=json.load(gzip.open(base/'action-continuation-20261002/linguistic-decisions.json.gz','rt'))
needed={w[:-5]+'re' for row in d['decisions']['it'] if row['status']=='pending_review' and re.fullmatch('[a-zàèéìòù]+azion[ei]',w:=row['word']) and not re.search(r'^(?:azion|interazion|reazion|coazion|transazion|retroazion|abreazion)',w)}
heads={}; hashes={}
for p in sorted((root/'members/it').glob('*.json.gz')):
 data=p.read_bytes();shard=json.loads(gzip.decompress(data))
 found=False
 for id,ms in shard.items():
  for m in ms:
   if m['word'] in needed and m['word'] not in heads:
    heads[m['word']]={'family_id':id,'member':m,'shard_path':str(p)};found=True
 if found:hashes[str(p)]=hashlib.sha256(data).hexdigest()
print(json.dumps({'needed':len(needed),'found':len(heads),'words':list(heads)}))
out=base/'action-italian-stage-20261002'/'verb-source-records.json.gz'
bytes_out=gzip.compress(json.dumps({'heads':heads,'shard_hashes':hashes},ensure_ascii=False).encode(),mtime=0)
if out.exists():
 assert out.read_bytes()==bytes_out, 'Saved source checkpoint differs; refusing overwrite'
else:
 out.write_bytes(bytes_out)

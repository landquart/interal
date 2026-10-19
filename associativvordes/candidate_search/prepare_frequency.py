"""Extract real project measurements from individually checksum-locked member shards."""
import argparse
import gzip
import json
from pathlib import Path
from search import Graph,lookup,file_hash,sha,canonical

def prepare(original,lock,snapshot,output):
    original=Path(original);lock=json.loads(Path(lock).read_text());g=Graph.open_snapshot(snapshot)
    wanted=set(g.db.execute('SELECT language,search FROM lexemes'));g.close();records={};files={}
    for name,proof in sorted(lock['original_files'].items()):
        if '/family-index-v5/members/' not in name:continue
        path=original/name
        if file_hash(path)!=proof['sha256']:raise ValueError('frequency source checksum: '+name)
        language=path.parent.name;files[name]=proof
        # Existing source is a JSON object: one bounded shard at a time, never all shards.
        rows=json.loads(gzip.decompress(path.read_bytes()))
        for family,values in sorted(rows.items()):
            for row in values:
                if (language,lookup(row['word'])) not in wanted:continue
                raw=json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
                k=sha([language,row['lemma_id'],raw]);record=records.setdefault(k,{'language':language,'record_json':raw,'record_sha256':sha(raw),'locators':[]})
                record['locators'].append({'file':name,'sha256':proof['sha256'],'commit':proof['commit'],'family_key':family,'lemma_id':row['lemma_id']})
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    (output/'frequencies.json').write_text(canonical([records[k] for k in sorted(records)])+'\n')
    (output/'frequency-lock.json').write_text(canonical({'files':files,'snapshot_manifest_sha256':file_hash(Path(snapshot)/'GRAPH-MANIFEST.json'),'records':len(records),'frequencies_sha256':file_hash(output/'frequencies.json')})+'\n')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['original','lock','snapshot','output']:p.add_argument('--'+n,required=True)
    a=p.parse_args();prepare(a.original,a.lock,a.snapshot,a.output)

"""Reproducible offline analysis; inputs require independently verified receipts.

No networking, invented roster entries or implicit publication. Output directory
must be new. Supply only separately authenticated, append-only original answers.
"""
import argparse,json
from pathlib import Path
from .study import analyze
from ..evidence_registry.view import sha

def rows(path):return [json.loads(x) for x in Path(path).read_text().splitlines() if x.strip()]
def run(reserve,output,reviews=None,arbitrations=None,roster=None,assignments=None,trust=None):
    root=Path(reserve);out=Path(output)
    if out.exists():raise ValueError('new immutable analysis directory required')
    m=json.loads((root/'MANIFEST.json').read_bytes())
    for item in m['files']:
        p=(root/item['path']).resolve()
        if not p.is_relative_to(root.resolve()) or sha(p)!=item['sha256'] or p.stat().st_size!=item['bytes']:raise ValueError('frozen reserve file mismatch')
    result=analyze(questions=rows(root/'PREVIEW-A.ndjson'),reviews=rows(reviews or root/'RAW-HUMAN-REVIEWS.ndjson'),arbitrations=rows(arbitrations or root/'RAW-ARBITRATIONS.ndjson'),roster=json.loads(Path(roster or root/'ROSTER.json').read_bytes()),assignments=json.loads(Path(assignments or root/'ASSIGNMENTS.json').read_bytes()),protocol=json.loads((root/'PROTOCOL.json').read_bytes()),study_hash=sha(root/'MANIFEST.json'),trust=json.loads(Path(trust).read_bytes()) if trust else {})
    out.mkdir(parents=True)
    originals=dict(reviews=Path(reviews or root/'RAW-HUMAN-REVIEWS.ndjson'),arbitrations=Path(arbitrations or root/'RAW-ARBITRATIONS.ndjson'),roster=Path(roster or root/'ROSTER.json'),assignments=Path(assignments or root/'ASSIGNMENTS.json'))
    original_dir=out/'original-inputs';original_dir.mkdir()
    locked=[]
    for kind,path in originals.items():
        dest=original_dir/(kind+('.ndjson' if kind in {'reviews','arbitrations'} else '.json'));dest.write_bytes(path.read_bytes());locked.append(dict(kind=kind,path=str(dest.relative_to(out)),sha256=sha(dest)))
    (out/'INPUTS.json').write_text(json.dumps(dict(study_manifest_sha256=sha(root/'MANIFEST.json'),originals=locked,trust_sha256=sha(trust) if trust else None,private_inputs_not_for_public_distribution=True),indent=2)+'\n')
    (out/'ANALYSIS.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    for name,key in [('HUMAN-GOLD.ndjson','human_gold'),('ARBITRATION-LEDGER.ndjson','arbitration_ledger')]:
        (out/name).write_text(''.join(json.dumps(row,ensure_ascii=False,sort_keys=True)+'\n' for row in result[key]))
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--reserve',required=True);p.add_argument('--output',required=True)
    for k in ['reviews','arbitrations','roster','assignments','trust']:p.add_argument('--'+k)
    r=run(**vars(p.parse_args()));print(json.dumps({k:r[k] for k in ('status','accepted_human_reviews','accepted_arbitrations','paired_cases','main_annotation_allowed')}))

"""Optional bounded HanTa smoke probe, NOT Flexor inference or gold evaluation.

Supply the checksum-pinned official wheel. No install, downloads or family writes.
Model files use Python pickle: only the verified official artifact is accepted.
"""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

WHEEL_SHA = 'aad4fdd1eff50522f2b4c2d5c87752beb5bd266c53161bffdda9dc7ca269a476'
CHILD = r'''
import json,sys,time,resource,numpy
from HanTa import HanoverTagger as ht
language, model, plan_path = sys.argv[1:]
cases=[c for c in json.load(open(plan_path))['cases'] if c['language']==language]
t=time.perf_counter(); tagger=ht.HanoverTagger(model); load=time.perf_counter()-t
rows=[]; t=time.perf_counter()
for c in cases:
    try:
        stem,morphemes,pos=tagger.analyze(c['lemma_original'],taglevel=3)
        lemma,lemma_pos=tagger.analyze(c['lemma_original'],pos=pos,taglevel=1)
        rows.append({'case_id':c['case_id'],'lemma_original':c['lemma_original'],
                     'analysis':{'stem':stem,'morphemes':morphemes,'pos_native':pos,
                                 'lemma':lemma,'lemma_pos_native':lemma_pos},'error':None})
    except Exception as e:
        rows.append({'case_id':c['case_id'],'lemma_original':c['lemma_original'],
                     'analysis':None,'error':type(e).__name__+': '+str(e)})
elapsed=time.perf_counter()-t
print(json.dumps({'language':language,'input_mode':'isolated_lemma_no_sentence_context',
 'model_sha256':__import__('hashlib').sha256(open(model,'rb').read()).hexdigest(),
 'model_load_seconds':load,'analysis_seconds':elapsed,'cases':len(cases),'numpy_version':numpy.__version__,
 'peak_process_rss_bytes_linux':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,
 'analyses':rows},ensure_ascii=False))
'''


def run(wheel, plan_path):
    wheel = Path(wheel)
    data = wheel.read_bytes()
    if hashlib.sha256(data).hexdigest() != WHEEL_SHA:
        raise ValueError('Unexpected HanTa wheel SHA-256')
    plan = json.loads(Path(plan_path).read_text())
    if not 0 < len(plan['cases']) <= 40:
        raise ValueError('Bounded probe accepts 1..40 cases')
    if any(c['language'] not in ('en', 'de') for c in plan['cases']):
        raise ValueError('Only EN/DE probe supported')
    results = []
    with tempfile.TemporaryDirectory(prefix='hanta-probe-') as folder:
        root = Path(folder)
        with zipfile.ZipFile(wheel) as z:
            for info in z.infolist():
                parts = Path(info.filename).parts
                if parts and parts[0] == 'HanTa' and '..' not in parts and not info.is_dir():
                    out = root / info.filename
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_bytes(z.read(info))
        frozen_plan = root / 'plan.json'
        frozen_plan.write_text(json.dumps(plan, ensure_ascii=False))
        for lang, name in [('en', 'morphmodel_en.pgz'), ('de', 'morphmodel_ger.pgz')]:
            model = root / 'HanTa' / name
            env = dict(os.environ, PYTHONPATH=str(root))
            completed = subprocess.run([sys.executable, '-c', CHILD, lang, str(model), str(frozen_plan)],
                                       env=env, cwd=root, text=True, capture_output=True,
                                       timeout=60)
            if completed.returncode:
                raise RuntimeError(f'HanTa {lang} subprocess failed: {completed.stderr}')
            results.append(json.loads(completed.stdout))
    return {'schema':'hanta-smoke-probe/1','tool':'HanTa','version':'1.2.0',
            'wheel_sha256':WHEEL_SHA,'plan_sha256':hashlib.sha256(Path(plan_path).read_bytes()).hexdigest(),
            'python':sys.version,'platform':sys.platform,'results':results,
            'quality_metrics':None,'manual_gold_cases':0,
            'warning':'Not Flexor; isolated lemmas, no quality or family-membership claims.'}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--wheel', required=True, type=Path)
    p.add_argument('--plan', required=True, type=Path)
    p.add_argument('--out', required=True, type=Path)
    a = p.parse_args()
    a.out.write_text(json.dumps(run(a.wheel,a.plan),ensure_ascii=False,sort_keys=True,indent=2)+'\n')

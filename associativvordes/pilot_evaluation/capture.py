"""Seal recorded actual searches; do not simulate a current-algorithm baseline."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import json
from pathlib import Path
from associativvordes.pilot_evaluation.gold import sha,canonical,file_hash,json_rows,validate_cases
from associativvordes.evidence_graph.graph import lookup
from associativvordes.pilot_evaluation.run import BASELINE_COMMIT,BASELINE_HASHES

def capture(cases,recordings,operator):
    validate_cases(cases)
    if not operator.strip():raise ValueError('capture operator required')
    observed={};proofs=[]
    for recording in recordings:
        if recording.get('capture_kind')!='actual_runtime' or recording.get('algorithm_commit')!=BASELINE_COMMIT or recording.get('runtime_code_hashes')!=BASELINE_HASHES or recording.get('methodology_modified') is not False:raise ValueError('actual recorded code/dependency lock required')
        if recording.get('case_set_sha256')!=sha(cases) or not recording.get('artifact_sha256') or not recording.get('recorded_at'):raise ValueError('recording scope/artifact receipt')
        for search in recording['searches']:
            k=(search['family'],search['language'])
            if k in observed:raise ValueError('duplicate search capture')
            if type(search.get('complete'))!=bool or type(search.get('truncated'))!=bool:raise ValueError('explicit completion/truncation')
            observed[k]=search
        proofs.append({k:recording[k] for k in ['artifact_sha256','recorded_at']})
    predictions=[]
    for c in cases:
        search=observed.get((c['family'],c['language']));matches=[]
        if search:
            matches=[r for r in search['candidates'] if lookup(r['word'])==lookup(c['target']['lemma'])]
        decision='yes' if matches else ('no' if search and search['complete'] and not search['truncated'] else 'abstain')
        boundaries=None
        if matches and all(m.get('boundary_offsets') is not None for m in matches) and all(m['boundary_offsets']==matches[0]['boundary_offsets'] for m in matches):boundaries=matches[0]['boundary_offsets']
        predictions.append({'case_id':c['id'],'case_content_sha256':c['content_sha256'],'decision':decision,'requires_manual_review':True,
          'sense_identity_established':False,'captured_candidates':matches,'boundaries':boundaries,'merged_families':search.get('merged_families') if search else None,
          'reason':'recorded_word_lookup_only_not_lexeme_identity' if matches else 'recorded_complete_absence' if decision=='no' else 'runtime_not_captured_or_incomplete'})
    return {'schema':'pilot-baseline-capture/1','capture_kind':'actual_runtime','algorithm_commit':BASELINE_COMMIT,'case_set_sha256':sha(cases),
      'runtime_code_hashes':BASELINE_HASHES,'capture_operator':operator,'methodology_modified':False,'artifact_receipts':proofs,
      'predictions':predictions,'trust_boundary':'operator must verify recordings originate from actual frozen runtime; checksum does not prove observation authenticity'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cases',required=True);p.add_argument('--recordings',nargs='+',required=True);p.add_argument('--operator',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('output outside repository')
    files=[Path(x) for x in a.recordings];recordings=[json.loads(x.read_text()) for x in files]
    for recording in recordings:
        if file_hash(recording['artifact_path'])!=recording['artifact_sha256']:raise ValueError('actual export artifact checksum')
    result=capture(list(json_rows(a.cases)),recordings,a.operator);result['recording_files']={x.name:file_hash(x) for x in files}
    Path(a.output).write_text(json.dumps(result,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False)+'\n')

"""Locked historical mechanisms, finite exclusions and explicit retained exceptions."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import collections,hashlib,json,pathlib,sqlite3,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
pass
from associativvordes.history_registry.registry import History
from associativvordes.surface_cleanup.policy import canonical

def collect(repo):
    repo=pathlib.Path(repo);root=repo/'audit/associative-history-registry';c=json.loads((root/'CURRENT.json').read_bytes())
    h=History(repo,root/c['snapshot'],c['sha256'])
    patterns=[];retained=[];files={}
    def walk(x,path,pointer=''):
        if isinstance(x,dict):
            if x.get('family_id') and (x.get('reason') or x.get('reviewed_words')):
                patterns.append(dict(family_id=x['family_id'],language=x.get('language'),reason=x.get('reason'),
                    expected_members=x.get('expected_members'),member_list_sha256=x.get('member_list_sha256'),
                    expected_evidence=x.get('expected_evidence'),source_path=path,pointer=pointer,
                    source_status='HISTORICAL_CLAIM_NOT_INDEPENDENT_GOLD',blanket_transfer_allowed=False))
                for r in x.get('retained',[]):retained.append(dict(family_id=x['family_id'],language=x.get('language'),raw=r,source_path=path,pointer=pointer))
            for k,v in x.items():walk(v,path,pointer+'/'+str(k).replace('~','~0').replace('/','~1'))
        elif isinstance(x,list):
            for i,v in enumerate(x):walk(v,path,pointer+'/'+str(i))
    for p in sorted((repo/'audit/associative-family-v5').glob('*.json')):
        if any(t in p.name for t in ('surface','inflection','ending','short')):
            raw=p.read_bytes();relative=str(p.relative_to(repo));files[relative]=hashlib.sha256(raw).hexdigest();walk(json.loads(raw),relative)
    for p in sorted((repo/'scripts').glob('*.mjs')):
        if any(t in p.name for t in ('surface-suffix','incoherent','russian','ru-short','bounded-associative')):
            files[str(p.relative_to(repo))]=hashlib.sha256(p.read_bytes()).hexdigest()
    return h,dict(schema='v5-historical-surface-catalog/1',source_file_sha256=files,patterns=patterns,
        retained_exceptions=retained,authority_distribution=dict(collections.Counter(d['authority'] for d in h.decisions)),
        scope_rule='Exact family/language/IDs/version only; historical proof digests do not establish a new lexical verdict',
        invalid_inference_schemes=[
          dict(id='SHARED_ENDING_IMPLIES_COMMON_ROOT',invalid_inference='A shared inflection/derivational string is sufficient to prove a shared lexical root',status='LOGICALLY_INVALID_PROOF_RULE',does_not_prove_all_matching_members_false=True),
          dict(id='BOUNDARY_FRAGMENT_IMPLIES_COMPONENT',invalid_inference='Any internal substring crossing boundaries is a lexical component',status='LOGICALLY_INVALID_PROOF_RULE',does_not_prove_all_matching_members_false=True),
          dict(id='LOSSY_NORMALIZATION_IMPLIES_IDENTITY',invalid_inference='Equal lossy search forms prove equal native lexemes or senses',status='LOGICALLY_INVALID_PROOF_RULE',does_not_prove_all_matching_members_false=True),
          dict(id='LEGACY_LABEL_IMPLIES_LINGUISTIC_GOLD',invalid_inference='safe_automatic, compound_morphology or manually_verified is independent lexical gold',status='LOGICALLY_INVALID_PROOF_RULE',does_not_prove_all_matching_members_false=True)],
        history_snapshot_sha256=c['sha256'],coverage_complete=h.snapshot['coverage_complete'])

def build_scope_index(h,path):
    db=sqlite3.connect(path);db.executescript('PRAGMA synchronous=FULL;CREATE TABLE decisions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE ids(family TEXT,language TEXT,lemma TEXT,decision TEXT,PRIMARY KEY(family,language,lemma,decision)) WITHOUT ROWID;')
    with db:
        for d in h.decisions:
            db.execute('INSERT INTO decisions VALUES(?,?)',(d['id'],canonical(d).decode()))
            s=d['scope']
            for lid in h.ids(d):db.execute('INSERT OR IGNORE INTO ids VALUES(?,?,?,?)',(s.get('family_id'),s.get('language'),lid,d['id']))
    n=db.execute('SELECT count(*) FROM ids').fetchone()[0];db.close();return n

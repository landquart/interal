"""Independent reserve audit: no sampler or calibration validator imports."""
import argparse,bz2,collections,gzip,hashlib,json,sqlite3,unicodedata,zipfile
from pathlib import Path

def digest(v):return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def norm(s):return unicodedata.normalize('NFC',s).casefold()
def lines(p):
    with gzip.open(p,'rt') as f:
        return [json.loads(x) for x in f]

def verify(reserve,holdout,baseline,native,raw,lock,output):
    reserve,holdout,baseline,raw=map(Path,(reserve,holdout,baseline,raw));m=json.loads((reserve/'MANIFEST.json').read_bytes());prep=json.loads((reserve/'PREPARATION.json').read_bytes());protocol=json.loads((reserve/'PROTOCOL.json').read_bytes())
    for item in m['files']:
        p=reserve/item['path'];assert p.stat().st_size==item['bytes'] and sha(p)==item['sha256']
    for item in json.loads((holdout/'ARCHIVE-CONTENTS.json').read_bytes())['files']:
        assert sha(holdout/item['path'])==item['sha256']
    held=lines(holdout/'release/PROBABILITY.ndjson.gz')+lines(holdout/'release/CHALLENGE.ndjson.gz')
    with zipfile.ZipFile(holdout/'historical-kit/v5-probability-kit-v2.zip') as z:old=[json.loads(x) for x in z.read('gold-sample.jsonl').splitlines()]
    families={c['family_id'] for c in held+old if c.get('family_id')};words={(c['language'],norm(c['word'])) for c in held+old if c.get('word')};lemmas={(c['language'],c['lemma_id']) for c in held+old if c.get('lemma_id')}
    cases=[json.loads(x) for x in (reserve/'COORDINATOR-CASES.ndjson').read_text().splitlines()];assert len(cases)==240 and len({c['id'] for c in cases})==240
    selected={c['origin']['family_id'] for c in cases};assert len(selected)==240 and not selected&families
    aliases=set();etymons=set();metadata={}
    for p in sorted((baseline/'families').glob('*.gz')):
        d=json.load(gzip.open(p,'rt'))
        for fid in families.intersection(d):aliases.update(norm(x) for x in d[fid].get('aliases',[]));etymons.update(d[fid].get('etymon_keys',[]))
        for fid in selected.intersection(d):metadata[fid]=d[fid]
    assert sha(native)==prep['native_database_sha256'];db=sqlite3.connect(Path(native).resolve().as_uri()+'?mode=ro&immutable=1',uri=True);db.row_factory=sqlite3.Row
    held_raw=set();held_candidates=set()
    for lang,w in sorted(words):
        for cid, in db.execute('SELECT id FROM candidates WHERE language=? AND lookup=?',(lang,w)):
            held_candidates.add(cid);held_raw.update(x[0] for x in db.execute('SELECT raw_sha256 FROM occurrences WHERE candidate=?',(cid,)))
    own_alias=set();own_ety=set();own_raw=set();physical_shards=collections.defaultdict(list);wanted_raw=collections.defaultdict(dict);contexts=0
    for c in cases:
        assert c['content_sha256']==digest({k:v for k,v in c.items() if k!='content_sha256'}) and c['protocol_sha256']==digest(protocol)
        o=c['origin'];assert (o['language'],norm(o['word'])) not in words and (o['language'],o['lemma_id']) not in lemmas
        fm=metadata[o['family_id']];a={norm(x) for x in fm.get('aliases',[])};e=set(fm.get('etymon_keys',[]))
        assert not a&(aliases|own_alias) and not e&(etymons|own_ety);own_alias.update(a);own_ety.update(e)
        assert fm['canonical']==c['family']['proposed_form'] and not o['family_id'].startswith('surface:')
        cs=[dict(x) for x in db.execute('SELECT c.*,a.source_id FROM candidates c JOIN artifacts a ON a.id=c.artifact WHERE language=? AND lookup=? ORDER BY c.id',(o['language'],norm(o['word'])))]
        assert [{k:x[k] for k in ('id','source_id','lemma','pos','native_lexical_id','sense_id','kind')} for x in cs]==c['source_alternatives']
        assert not {x['id'] for x in cs}&held_candidates
        ev=[];raw_hashes=set()
        for candidate in cs:
            for r in db.execute('SELECT * FROM occurrences WHERE candidate=? ORDER BY artifact,line,role',(candidate['id'],)):
                r=dict(r);raw_hashes.add(r['raw_sha256']);ev.append(dict(candidate=candidate['id'],artifact=r['artifact'],line=r['line'],role=r['role'],raw_sha256=r['raw_sha256']));wanted_raw[r['artifact']][r['line']]=r['raw_sha256']
        assert ev==c['source_occurrences'] and sorted(raw_hashes)==c['source_raw_hashes'] and not raw_hashes&(held_raw|own_raw);own_raw.update(raw_hashes)
        for context in c['dictionary_context']:
            a=db.execute('SELECT id,body FROM artifacts WHERE source_id=?',(context['source_id'],)).fetchone();art=json.loads(a['body']);assert context['source_sha256']==art['sha256']
            observed=db.execute('SELECT definition FROM occurrences WHERE artifact=? AND line=? AND role=? AND raw_sha256=?',(a['id'],context['source_row'],context['role'],context['raw_sha256'])).fetchone();assert observed and observed[0]==context['definition'];contexts+=1
        physical_shards[o['path']].append(o)
    for relative,origins in physical_shards.items():
        p=baseline/Path(relative).relative_to('associativvordes/family-index-v5');assert sha(p)==origins[0]['source_file_sha256'];data=json.load(gzip.open(p,'rt'))
        for o in origins:
            r=data[o['family_id']][o['ordinal']];assert digest(r)==o['record_sha256'] and r['word']==o['word'] and r['lemma_id']==o['lemma_id']
    assert sha(lock)==prep['source_lock_sha256']
    lock_data=json.loads(Path(lock).read_bytes());arts={row['id']:json.loads(row['body']) for row in db.execute('SELECT id,body FROM artifacts')};raw_checked=0
    context_by_line=collections.defaultdict(list)
    for c in cases:
        for context in c['dictionary_context']:
            ai=db.execute('SELECT id FROM artifacts WHERE source_id=?',(context['source_id'],)).fetchone()[0]
            context_by_line[(ai,context['source_row'])].append(context)
    for ai,requested in wanted_raw.items():
        a=arts[ai];p=raw/a['path'];assert sha(p)==a['sha256']
        if a.get('member'):
            z=zipfile.ZipFile(p);f=z.open(a['member'])
        else:
            z=None;f=(bz2.open if p.suffix=='.bz2' else gzip.open if p.suffix=='.gz' else open)(p,'rb')
        try:
            for line,b in enumerate(f,1):
                if line in requested:assert hashlib.sha256(b).hexdigest()==requested[line];raw_checked+=1
                if line==1 and a['format'].startswith('glemm_'):header=b.decode().rstrip('\r\n').split('\t')
                if (ai,line) in context_by_line:
                    parsed=dict(zip(header,b.decode().rstrip('\r\n').split('\t')))
                    for context in context_by_line[(ai,line)]:
                        assert context['definition']==parsed['definition2'] and context['lemma']==unicodedata.normalize('NFC',parsed['lemma2'])
                if line>=max(requested):break
        finally:
            f.close()
            if z:z.close()
    assert raw_checked==sum(map(len,wanted_raw.values()))
    allowed={'question_id','language','lexeme','proposed_family_form','normative_root','national_correspondence','pos','sense','dictionary_context','task','protocol_sha256','instructions_sha256','release_status','question_sha256'}
    previews=[]
    for role in ['A','B']:
        rows=[json.loads(x) for x in (reserve/('PREVIEW-'+role+'.ndjson')).read_text().splitlines()];assert len(rows)==240 and {r['question_id'] for r in rows}=={c['id'] for c in cases}
        for r in rows:
            assert set(r)==allowed and r['question_sha256']==digest({k:v for k,v in r.items() if k!='question_sha256'}) and r['release_status']=='PROVISIONAL_NOT_RELEASED'
            c=next(c for c in cases if c['id']==r['question_id'])
            assert r['dictionary_context']==c['dictionary_context'] and r['lexeme']==c['origin']['word'] and r['language']==c['language'] and r['proposed_family_form']==c['family']['proposed_form']
        previews.append(rows)
    assert [r['question_id'] for r in previews[0]]!=[r['question_id'] for r in previews[1]]
    assert {r['question_id']:r for r in previews[0]}=={r['question_id']:r for r in previews[1]}
    assert (reserve/'RAW-HUMAN-REVIEWS.ndjson').stat().st_size==0 and (reserve/'RAW-ARBITRATIONS.ndjson').stat().st_size==0 and (reserve/'HUMAN-GOLD.ndjson').stat().st_size==0 and json.loads((reserve/'ROSTER.json').read_bytes())=={}
    db.close();result=dict(schema='interal-independent-calibration-reserve-audit/1',status='PASS_ENGINEERING_ONLY',reserve_manifest_sha256=sha(reserve/'MANIFEST.json'),cases=240,languages=dict(collections.Counter(c['language'] for c in cases)),heldout_cases_checked=len(held),old_study_cases_checked=len(old),physical_membership_shards=len(physical_shards),original_membership_payloads=240,dictionary_contexts_checked=contexts,raw_source_rows_physically_checked=raw_checked,known_family_alias_lexeme_etymon_native_observation_overlaps=0,blind_previews=480,human_answers=0,human_gold=0,semantic_category_certification=False,independence_certification='BLOCKED_UNKNOWN_LINKAGES',main_annotation_allowed=False,producer_imported=False,production_writes=0)
    Path(output).write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for k in ['reserve','holdout','baseline','native','raw','lock','output']:p.add_argument('--'+k,required=True)
    verify(**vars(p.parse_args()))

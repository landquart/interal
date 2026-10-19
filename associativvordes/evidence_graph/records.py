"""Exact stage-03 extraction bridge; no normalization authority is added."""
import base64
import hashlib
import json
import gzip
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'importers'))
from morphology_import import parse,LANGUAGES,VERSION,SCHEMA,digest,binary_stream,validate_lock,GLEMM

def read_json(path):
    with (gzip.open(path,'rt',encoding='utf-8') if str(path).endswith('.gz') else open(path,encoding='utf-8')) as f:return json.load(f)
def make_record(original,line,data,header=None):
    a=dict(original);a['language']=LANGUAGES[a['language']];h=hashlib.sha256(data).hexdigest()
    fields=data.decode('utf-8').rstrip('\n').removesuffix('\r').split('\t')
    if header is None and a['format'].startswith('glemm_'):header=GLEMM+(['definition2','lemmatized_definition2'] if a['format']=='glemm_defs' else [])
    raw,normalized=parse(a,fields,h,header)
    id='evidence:'+digest([a['id'],a['revision'],a['sha256'],a.get('member_sha256'),line,h,VERSION])
    return {'schema_version':SCHEMA,'id':id,'body':{'source':a['source'],'resource':a['resource'],'revision':a['revision'],
        'artifact':a['id'],'language':a['language'],'raw_locator':{'line':line,'raw_sha256':h,'artifact_sha256':a['sha256'],'member':a.get('member')},
        'raw_fields':raw,'original_line_base64':base64.b64encode(data).decode(),'normalized':normalized,'review_status':'unreviewed','establishes_membership':False}}
def verify_record(record,artifact):
    b=record['body'];loc=b['raw_locator']
    if not isinstance(loc['line'],int) or loc['line']<1 or loc['artifact_sha256']!=artifact['sha256'] or loc.get('member')!=artifact.get('member'):raise ValueError('raw locator mismatch')
    data=base64.b64decode(b['original_line_base64'],validate=True)
    if make_record(artifact,loc['line'],data)!=record:raise ValueError('stage-03 extraction differs from pinned raw record')

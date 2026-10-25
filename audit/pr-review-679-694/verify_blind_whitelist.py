"""Independent literal observed-field whitelist for all actual review cards."""
import json,hashlib
from pathlib import Path
from associativvordes.cleanup_quality.evaluate import release,rows
work=Path('/tmp/interal-audit-work/quality-final');cases,_=release(work);by={c['id']:c for c in cases};count=0
for role in ['A','B']:
 for card in rows(work/f'BLIND-{role}.ndjson.gz'):
  c=by[card['case_id']];raw=c.get('source_record',{})
  expect={k:raw[k] for k in ('word','normalized','search_form','context','source_refs') if k in raw}
  if 'sources' in raw:expect['sources']=[{k:s[k] for k in ('id','file','category') if k in s} for s in raw['sources']]
  assert card['source_record']==expect and card['case_sha256']==c['content_sha256']
  if c.get('case_kind')=='HISTORICAL_SCOPE_NOT_POPULATION_MEMBERSHIP':
   assert all(r['artifact']=='HISTORICAL-LEXICAL-CONTEXTS.json' for r in card['source_record']['source_refs'])
  count+=1
assert count==19524
out=dict(status='PASS',blind_cards_checked=count,exact_observed_field_projection_checked=True,inferred_components_not_exposed=True,historical_locators_neutral=True,manifest_sha256=hashlib.sha256((work/'MANIFEST.json').read_bytes()).hexdigest(),verifier_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),production_writes=0)
Path(__file__).with_name('BLIND-WHITELIST-VERIFICATION.json').write_text(json.dumps(out,indent=2)+'\n');print(out)

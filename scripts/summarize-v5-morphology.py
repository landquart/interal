#!/usr/bin/env python3
"""Streaming per-language/error-type statistics; overlapping flags remain separate."""
import collections,gzip,hashlib,json,pathlib,sys
run=pathlib.Path(sys.argv[1]);manifest=json.loads((run/'MANIFEST.json').read_text());counts=collections.Counter();languages={};flags={};history=collections.Counter()
for part in manifest['buckets']:
 p=run/'buckets'/part['bucket']/'UNRESOLVED.ndjson.gz';h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 if h.hexdigest()!=part['sha256']:raise ValueError('result checksum')
 families=collections.defaultdict(set)
 with gzip.open(p,'rt') as f:
  for line in f:
   fid,lang,lid,ordinal,word,status,mask,n,decisions,risks=json.loads(line)
   c=languages.setdefault(lang,collections.Counter());c['selected_memberships']+=1;c[status]+=1;c['source_rows_missing']+=n==0
   counts['selected_memberships']+=1
   for decision in decisions:history[decision]+=1
   for flag in risks:
    v=flags.setdefault(flag,dict(memberships=0,families=0,languages=collections.Counter()));v['memberships']+=1;v['languages'][lang]+=1;families[flag].add(fid)
 for flag,ids in families.items():flags[flag]['families']+=len(ids)
s=json.loads((run/'SUMMARY.json').read_text())
if counts['selected_memberships']!=s['totals']['selected']:raise ValueError('lost scope')
for lang,c in languages.items():
 for status in ['CONFIRMED_RELATION','CONFIRMED_WRONG_RELATION','WRONG_RELATION_TYPE']:c[status]=0
 for kind in ['direct_derivation','indirect_derivation','inflection','compounding','allomorphy','borrowing','historical_inheritance','prefixation','suffixation','unconfirmed']:
  c['candidate_type:'+kind]=s['totals'].get('language:'+lang+':candidate_type:'+kind,0)
report=dict(schema='v5-morphology-statistics/1',languages=languages,diagnostic_flags=flags,exact_history_decisions=history,flags_overlap=True,type_counts_overlap=True,confirmed_error_types=0,notes='No native/sense binding; missing source rows is not a negative; competing candidate types can coexist')
(run/'STATISTICS.json').write_text(json.dumps(report,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')

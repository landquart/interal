#!/usr/bin/env python3
"""Build deterministic isolated evidence snapshots from pinned observations."""
import argparse
from collections import Counter
import json
from pathlib import Path
import platform
import shutil
import sqlite3
import tempfile
import unicodedata
from graph import Graph,canonical,sha,key,envelope,ref,file_hash,lookup,json_rows
from records import read_json,verify_record

def load_registry(g,snapshot):
    snapshot_hash=sha({'commit':snapshot['commit'],'files':snapshot['files']});g.trusted_snapshots.add(snapshot_hash)
    g.db.execute('CREATE TABLE IF NOT EXISTS native_nodes(artifact TEXT,native TEXT,lexeme TEXT,PRIMARY KEY(artifact,native))')
    for f in snapshot['catalog']['families']:
        g.existing('Family',f['id'],f,snapshot_hash)
        for a in set([f['canonical'],f['id'].removeprefix('family:')]+f.get('aliases',[])):g.db.execute('INSERT OR IGNORE INTO aliases VALUES(?,?)',(lookup(a),f['id']))
    heads={h['id']:h for h in snapshot['heads']}
    for h in heads.values():
        g.existing('LexicalHead',h['id'],h,snapshot_hash)
        for i,e in enumerate(h.get('evidence',[])):
            id=key('existing-history',[h['id'],i,e]);er=g.existing('HistoricalEvidence',id,e,snapshot_hash)
            g.db.execute('INSERT OR IGNORE INTO context_links VALUES(?,?,?,?)',('etymological_context',h['id'],id,canonical(er)))
    for a in snapshot.get('realizations',[]):
        id=key('existing-realization',a);ar=g.existing('Allomorph',id,a,snapshot_hash)
        g.db.execute('INSERT OR IGNORE INTO context_links VALUES(?,?,?,?)',('scoped_allomorph',a['family_id'],id,canonical(ar)))
    for e in snapshot['edges']:
        id=key('existing-edge',[e['head_id'],e['family_id']]);er=g.existing('HeadFamilyEdge',id,e,snapshot_hash)
        g.db.execute('INSERT OR IGNORE INTO context_links VALUES(?,?,?,?)',('existing_head_family',e['head_id'],e['family_id'],canonical(er)))
        if e['status']!='accepted':
            h=heads[e['head_id']];rows=[x for x in e.get('evidence',[]) if isinstance(x,dict) and x.get('word')]
            for x in rows or [{'word':h['normalized_head'],'language':h['language']}]:g.add_decision(e['family_id'],x.get('language',h['language']),x['word'],e['status'],er,lemma=x.get('lemma_id'),head=e['head_id'],reason=x.get('reason','current nonaccepted finite edge'))
    for c in snapshot['corrections']:
        cr=g.existing('CorrectionVerdict',key('existing-correction',c),c,snapshot_hash)
        g.add_decision(c['family_id'],c['language'],c['word'],c['status'],cr,lemma=c['lemma_id'],reason=c.get('reason',''))
    for l in snapshot['links']:
        lr=g.existing('LemmaHeadLink',key('existing-binding',l),l,snapshot_hash)
        g.db.execute('INSERT OR IGNORE INTO context_links VALUES(?,?,?,?)',('finite_lexical_binding',l['head_id'],l['lemma_id'],canonical(lr)))
    for m in snapshot['memberships']:
        mr=g.existing('Membership',key('existing-membership',m),m,snapshot_hash)
        g.db.execute('INSERT OR IGNORE INTO known VALUES(?,?,?,?,?,?)',(m['family_id'],m['language'],lookup(m['word']),m['lemma_id'],m['head_id'],canonical(mr)))
    for m in snapshot.get('manual_decisions',[]):
        mr=g.existing('PriorManualEvidence',key('existing-manual',m),m,snapshot_hash)
        g.add_decision(m['family_id'],m['language'],m['word'],m['status'],mr,lemma=m.get('lemma_id'),reason=m['reason'])
    for c in snapshot.get('family_controls',[]):
        cr=g.existing('ExistingFamilyControl',key('family-control',c),c,snapshot_hash)
        g.db.execute('INSERT OR IGNORE INTO family_controls VALUES(?,?,?)',(c['family_id'],c['family_review_status'],canonical(cr)))
    g.commit();return snapshot_hash

def ingest(g,records,registry):
    artifacts={a['id']:a for a in registry['artifacts']};sources={};counts=Counter()
    for a in artifacts.values():
        body={'source_id':'source:'+a['source'].lower(),'release_label':a['revision'],'canonical_url':a['url'],
          'artifacts':[{'sha256':a['sha256'],'bytes':a['bytes'],'codec':a['path'].split('.')[-1],'decoded_sha256':a.get('member_sha256')}],
          'native_key_policy':'release-resource-native-id' if a['source']=='UDer' else 'release-record-role-unresolved',
          'license_records':[{'expression_or_unknown':a['license'],'source_url':a['url'],'file_sha256':None,'attribution':'See pinned stage-03 license files'}],
          'lineage_declarations':[a['lineage']] if 'lineage' in a else [],'availability_status':'available','registration_status':'pinned',
          'acquisition_receipt_ref':{'artifact_sha256':a['sha256'],'registry_sha256':sha(registry)}}
        sources[a['id']]=g.put(envelope('SourceRevision',key('source-revision',[a['source'],a['resource'],a['revision'],a['sha256']]),body))
    for r in json_rows(records):
        b=r['body'];a=artifacts[b['artifact']];verify_record(r,a)
        for l in b['normalized']['lexemes']:
            body={'source_id':'source:'+b['source'].lower(),'source_revision_ref':sources[a['id']],'native_lexeme_key':l['native_key'],
              'native_key_policy':'stage03-conservative-source-key/1','language':l['language'],'lemma':l['lemma'],'pos':l['pos'],'native_pos':l['native_pos'],
              'identity_resolution':l['identity_resolution'] if l['pos'] else 'unresolved','origin_evidence_refs':[],
              'orthographic_forms':[l['original']],'lookup_keys':[l['lookup']],'extensions':{'native_identity_resolution':l['identity_resolution']}}
            g.put(envelope('Lexeme',l['id'],body));g.db.execute('INSERT OR IGNORE INTO observations VALUES(?,?,?)',(l['id'],r['id'],canonical(b['raw_locator'])))
            if a['source']=='UDer':g.db.execute('INSERT OR IGNORE INTO native_nodes VALUES(?,?,?)',(a['id'],b['raw_fields']['id'],l['id']))
        counts['records']+=1
    g.commit()
    for r in json_rows(records):
        b=r['body'];n=b['normalized'];mappings=[];lexrefs=[ref(g.get(l['id'])) for l in n['lexemes']]
        for ordinal,c in enumerate(n['claims']):
            kind={'direct_derivation':'derivation_direct','conversion':'derivation_direct','compounding':'compounding','orthographic_variant':'orthographic_variant'}.get(c['type'],'ext:core:morphological_relatedness@1')
            unresolved=[]
            if b['source']=='UDer':
                ids=[]
                for native in c['sources']:
                    row=g.db.execute('SELECT lexeme FROM native_nodes WHERE artifact=? AND native=?',(b['artifact'],native)).fetchone()
                    if row:ids.append(row[0])
                    else:unresolved.append(native)
                ids.append(n['lexemes'][0]['id'])
            else:ids=c['participants']
            if unresolved or len(ids)<2:counts['unresolved_claims']+=1;continue
            participants=[{'slot':'p'+str(i),'kind':'lexeme','ref':ref(g.get(id))} for i,id in enumerate(ids)]
            direction={'state':'undirected' if kind=='orthographic_variant' else c['direction'],'from_slots':[],'to_slots':[]}
            if direction['state']=='directed':direction.update(from_slots=[p['slot'] for p in participants[:-1]],to_slots=[participants[-1]['slot']])
            params={'native_type':c.get('native_type'),'source_asserted_direction':c['direction'],'source_parameters':c.get('parameters',{}),'segmentation':n.get('segmentation',c.get('segmentation'))}
            rr=g.relation(kind,participants,direction,params,analysis_key='source-extraction:'+b['artifact']+':'+str(ordinal));mappings.append((rr,c));counts['claims']+=1
        if 'inflection' in n:
            i=n['inflection'];rr=g.relation('inflection',[{'slot':'lexeme','kind':'lexeme','ref':lexrefs[0]},
              {'slot':'form','kind':'form','form':{'owner_lexeme_ref':lexrefs[0],'text':i['form'],'grammatical_features':i['features'],'script':None,'native_form_key':r['id']}}],
              {'state':'directed','from_slots':['lexeme'],'to_slots':['form']},{'features':i['features'],'segmentation':i['segmentation']},analysis_key=r['id'])
            mappings.append((rr,{'type':'inflection'}));counts['inflections']+=1
        if mappings:
            body={'source_revision_ref':sources[b['artifact']],'raw_locator':b['raw_locator'],'raw_record_sha256':b['raw_locator']['raw_sha256'],
              'evidence_kind':'formal_pattern' if b['source']=='GLeMM' else 'source_assertion','related_lexeme_refs':lexrefs,
              'interpretations':[{'relation_ref':rr,'proposed_analysis':{'kind':c['type'],'sense_scope':{'mode':'unresolved','sense_refs':[],'analysis_refs':[],'coverage_reason':'no external sense identity established'},
              'segmentation':n.get('segmentation',c.get('segmentation')),'mapping_policy_ref':{'policy':'stage04-map/1'},'limitations':['unreviewed_source_claim']},'stance':'supports'} for rr,c in mappings],
              'source_lineage':artifacts[b['artifact']].get('lineage',{'status':'no_dependency_declared'}),'extraction':{'stage03_id':r['id'],'policy':'stage04-map/1'},
              'initial_status':'needs_review','rationale':'Pinned source assertion, not a relation/identity/membership verdict.',
              'extensions':{'raw_fields':b['raw_fields'],'original_line_base64':b['original_line_base64'],'definitions':n.get('definitions',{}),'all_native_claims':n['claims']}}
            er=g.put(envelope('Evidence',key('evidence',[sources[b['artifact']],r['id'],'stage04-map/1']),body))
            for rr,c in mappings:g.add_support(rr,er)
            counts['evidence']+=1
        if counts['evidence']%1000==0:g.commit()
    g.commit();return dict(counts)

def align(g,snapshot):
    counts=Counter();heads={h['id']:h for h in snapshot['heads']}
    for l in snapshot['links']:
        h=heads[l['head_id']]
        for id,pos in g.db.execute('SELECT id,pos FROM lexemes WHERE language=? AND search=? ORDER BY id',(l['language'],lookup(l['word']))).fetchall():
            lr=ref(g.get(id));hr=json.loads(g.db.execute('SELECT proof FROM existing WHERE id=?',(h['id'],)).fetchone()[0]);expected=l.get('pos',h.get('pos'))
            status='unknown' if not expected or not pos else 'compatible' if expected==pos else 'conflict'
            body={'source_lexeme_ref':lr,'sense_scope':{'mode':'unresolved','sense_refs':[],'analysis_refs':[],'coverage_reason':'no reviewed external alignment to v6 sense label'},
              'corpus_ref':{'snapshot':sha(snapshot['files']),'language':l['language'],'lemma_id':l['lemma_id'],'record_sha256':sha(l)},'proposed_head_ref':hr,
              'component_slot':l.get('component_slot'),'link_role':l.get('link_role','unresolved'),'segmentation':l.get('segmentation'),'evidence_refs':[],
              'initial_status':'needs_review','extensions':{'family_id':l['family_id'],'pos_check':status,'sense_check':'unresolved','recognition':l['recognition'],
              'identity_kind':h['identity_kind'],'lexical_identity_established':False,'guard':g.guard(l['family_id'],l['language'],l['word'],l['lemma_id'],[h['id']])}}
            ar=g.put(envelope('CorpusAlignment',key('alignment',[lr,l,hr]),body));g.db.execute('INSERT OR IGNORE INTO bindings VALUES(?,?,?)',(h['id'],id,ar['id']))
            counts['alignments']+=1;counts['blocked_alignments']+=body['extensions']['guard']['status'] in {'hold','blocked'}
    g.commit();return dict(counts)

def build(records,registry_path,v6_path,lock_path,output):
    out=Path(output).resolve();repo=Path(__file__).resolve().parents[2]
    if out.is_relative_to(repo):raise ValueError('graph output must be outside checkout')
    lock=read_json(lock_path)
    if file_hash(v6_path)!=lock['snapshot_sha256']:raise ValueError('v6 input checksum mismatch')
    snapshot=read_json(v6_path)
    if snapshot['commit']!=lock['commit']:raise ValueError('v6 commit mismatch')
    identity={'schema_version':'evidence-graph-build/1','records_sha256':file_hash(records),'registry_sha256':file_hash(registry_path),'v6_lock_sha256':file_hash(lock_path),
      'runtime':{'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'unicode':unicodedata.unidata_version},
      'code_sha256':{p.name:file_hash(p) for p in sorted(Path(__file__).parent.glob('*.py')) if not p.name.startswith('test_')}}
    id=sha(identity);final=out/id
    if final.exists():
        m=read_json(final/'GRAPH-MANIFEST.json')
        for name,h in m['outputs'].items():
            if file_hash(final/name)!=h:raise ValueError('corrupted cached graph')
        return final
    with tempfile.TemporaryDirectory(prefix='morphology-graph-') as tmp:
        tmp=Path(tmp);g=Graph(tmp/'working.sqlite');v6_ref=load_registry(g,snapshot)
        counts=ingest(g,records,read_json(registry_path));counts.update(align(g,snapshot))
        from analyze import report
        report(g,snapshot,tmp);g.export(tmp);shutil.copyfile(records,tmp/'source-observations.ndjson')
        counts['entities']=g.db.execute('SELECT COUNT(*) FROM entities').fetchone()[0];counts['relations']=g.db.execute('SELECT COUNT(*) FROM relations').fetchone()[0]
        g.close();(tmp/'working.sqlite').unlink()
        manifest={'build_id':id,'identity':identity,'v6_snapshot_ref':v6_ref,'counts':counts,'mode':'read_only_evidence_graph','establishes_membership':False,
          'outputs':{p.name:file_hash(p) for p in sorted(tmp.iterdir())}}
        (tmp/'GRAPH-MANIFEST.json').write_text(canonical(manifest)+'\n',encoding='utf-8');out.mkdir(parents=True,exist_ok=True)
        stage=Path(tempfile.mkdtemp(prefix='.publish-',dir=out))
        try:shutil.copytree(tmp,stage,dirs_exist_ok=True);stage.rename(final)
        finally:shutil.rmtree(stage,ignore_errors=True)
    return final

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['records','registry','v6','v6-lock','output']:p.add_argument('--'+n,required=True)
    a=p.parse_args();print(build(a.records,a.registry,a.v6,a.v6_lock,a.output))

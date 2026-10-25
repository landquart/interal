"""Deterministic observational diagnostics; no membership or root decisions."""
import hashlib,json,unicodedata
from collections import Counter
from pathlib import Path
POLICY=json.loads(Path(__file__).with_name('policy.json').read_text())
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def normal(x):return unicodedata.normalize('NFC',str(x)).casefold()
def member(row):
 evidence=[e for c in row.get('components',[]) for e in c.get('evidence',[])]
 types=sorted({e.get('type','UNKNOWN') for e in evidence});sources=sorted({e.get('source','UNKNOWN') for e in evidence})
 flags=[]
 if not types:flags.append('RELATION_EVIDENCE_MISSING')
 if types and all(t in {'surface_identity','substring','surface_match','suffix_match'} for t in types):flags.append('SURFACE_ONLY_LINK_CLAIM')
 if any('compound' in t for t in types):flags.append('COMPOUND_CLAIM_UNVERIFIED')
 if any('allomorph' in t for t in types):flags.append('ALLOMORPH_SCOPE_UNVERIFIED')
 inf=any('inflect' in t or t=='form_of' for t in types)
 der=any(t in {'morphological_parse','compound_morphology','derivation','derivational'} for t in types)
 if inf and der:flags.append('MIXED_DERIVATION_INFLECTION_CLAIMS')
 if 'candidate_index' in sources:flags.append('AUTOMATIC_PARSE_CLAIM')
 if 'manually_verified' in sources:flags.append('LEGACY_MANUAL_LABEL_NOT_GOLD')
 return dict(types=types,sources=sources,flags=flags,semantic_status='UNRESOLVED',lexical_identity_status='legacy_exact_record',sense_status='UNRESOLVED',correspondence_status='UNKNOWN_NOT_EVALUATED')
def origin(f,types):
 source=f.get('source','UNKNOWN');rel=set(f.get('relation_types',[]))
 if source=='surface_singleton':return 'SURFACE_FRAGMENT'
 historical=bool(rel&{'direct_descendant','inherited_form','borrowed_form'})
 if historical:return 'BORROWING_FAMILY' if rel=={'borrowed_form'} else 'HISTORICAL_ETYMON'
 inf=any('inflect' in t or t=='form_of' for t in types)
 compound='compound_morphology' in types
 morph=bool(set(types)&{'morphological_parse','surface_identity','derivation','derivational'})
 if sum([inf,compound,morph])>1:return 'MIXED_ORIGIN'
 if inf:return 'INFLECTION_DERIVED'
 if compound:return 'COMPOUND_COMPONENT'
 if morph:return 'EXACT_MORPHOLOGICAL'
 return 'UNCLASSIFIED'
def family(f,counts,types,source_counts,member_flags,ending,history):
 n=sum(counts.values());base=normal(f.get('canonical',''));length=len(base);flags=set(member_flags)
 if n==1:flags.add('SINGLETON')
 if length<=POLICY['short_base_max_codepoints']:flags.add('SHORT_BASE')
 if n>=POLICY['large_family_min']:flags.add('LARGE_FAMILY')
 if n>=POLICY['very_large_family_min']:flags.add('VERY_LARGE_FAMILY')
 category=origin(f,types)
 if category=='SURFACE_FRAGMENT':flags.add('SURFACE_FORMATION')
 if ending:flags.add('ENDING_PREFIX_DIVERSITY_PROXY')
 if f.get('review_status') in {'needs_review','split_required','rejected'}:flags.add('LEGACY_REVIEW_REQUIRED')
 if set(f.get('relation_types',[]))&{'direct_descendant','inherited_form','borrowed_form'}:flags.add('HISTORICAL_DIRECTION_SENSE_UNRESOLVED')
 if len(f.get('etymon_keys',[]))>1:flags.add('MULTI_ETYMON_IDENTITY_BRIDGE_UNRESOLVED')
 if history:flags.add('HISTORY_SCOPED_CONSTRAINTS')
 if member_flags.get('HISTORICAL_EXCLUSION_OVERLAP'):flags.add('HISTORICAL_EXCLUSION_OVERLAP')
 return dict(id=f['id'],canonical=f.get('canonical'),formation_source=f.get('source'),primary_category=category,
  category_status='OBSERVATIONAL_HYPOTHESIS',memberships=n,language_counts=dict(sorted(counts.items())),language_count=len(counts),
  relation_type_counts=dict(sorted(types.items())),evidence_source_counts=dict(sorted(source_counts.items())),
  legacy_family_relation_types=f.get('relation_types',[]),legacy_review_status=f.get('review_status'),
  flags=sorted(flags),member_flag_counts=dict(sorted(member_flags.items())),ending_proxy=ending,
  confirmed_lexical_identities=0,confirmed_memberships=0,unresolved_memberships=n,
  correspondence_status='UNKNOWN_NOT_EVALUATED',confirmed_correspondences=0,semantic_conflict_count=None,
  technical_status='SOURCE_STRUCTURALLY_READABLE',semantic_status='UNRESOLVED',
  history_decision_ids=history,history_coverage='INCOMPLETE_GLOBAL_APPLICATION_HOLD')
def rank(f,extra=()):
 flags=set(f['flags'])|set(extra);n=f['memberships']
 signal=min(40,20*('ENDING_PREFIX_DIVERSITY_PROXY' in flags)+12*('SURFACE_ONLY_LINK_CLAIM' in flags)+10*('SHORT_BASE' in flags and n>=5)+10*('EXACT_DUPLICATE_MEMBER_SET' in flags)+8*('ALIAS_FANOUT' in flags)+12*('MIXED_DERIVATION_INFLECTION_CLAIMS' in flags))
 impact=20 if n>=10000 else 15 if n>=1000 else 10 if n>=100 else 5 if n>=10 else 1
 history=10 if 'HISTORICAL_EXCLUSION_OVERLAP' in flags else 5 if 'HISTORY_SCOPED_CONSTRAINTS' in flags else 0
 ambiguity=10 if 'MULTI_ETYMON_IDENTITY_BRIDGE_UNRESOLVED' in flags else 7 if 'ALLOMORPH_SCOPE_UNVERIFIED' in flags else 4
 complexity=10 if n>=1000 else 7 if f['language_count']>=3 else 3
 cost=10 if f['primary_category'] in {'HISTORICAL_ETYMON','BORROWING_FAMILY'} or f['language_count']>=3 else 6 if n>1 else 2
 parts=dict(systematic_signal=signal,membership_impact=impact,historical_constraint=history,morphological_ambiguity=ambiguity,review_complexity=complexity,false_exclusion_consequence=cost)
 score=sum(parts.values());bands=POLICY['risk']['bands'];band=next((k for k,v in bands.items() if score>=v),'PRIORITY_4')
 return dict(score=score,band=band,components=parts,meaning='experimental investigation priority, not error probability or exclusion permission')

// Review-time policy only; this does not classify tokens or alter production v5.
export function decideLexicalRow(row) {
 if(row.membership_object!=='lexical_row_or_component')throw Error('Explicit lexical row/component semantics required');
 if(!row.analyses?.length||row.analyses.some(a=>!a.history||!a.evidence?.length||!['accepted','excluded','uncertain'].includes(a.verdict)))throw Error('Each established lexical analysis requires history, evidence and verdict');
 const histories=new Set(row.analyses.map(a=>a.history));
 const allAccepted=row.analyses.every(a=>a.verdict==='accepted');
 const common=row.component&&row.analyses.every(a=>a.proved_components?.includes(row.component));
 let decision='accepted',blocker=null;
 if(!allAccepted||histories.size>1&&!common){decision='deferred';blocker='incompatible_or_unproved_lexical_histories_require_provenanced_partition_or_common_component';}
 else if(row.formal_continuity!=='accepted'){decision='deferred';blocker='national_formal_continuity_requires_independent_scoped_evidence';}
 return {decision,blocker,head_scope:common?'lexical_base_component':'whole_lexical_row',frequency_status:'aggregate_only_not_sense_frequency',token_senses_established:false,proper_name_observed:row.proper_name_observed===true};
}

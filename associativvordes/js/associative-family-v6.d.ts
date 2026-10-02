export type EdgeStatus = 'accepted' | 'excluded' | 'uncertain' | 'pending';
export interface CorpusLemma { lemma_id: string; language: string; word: string; normalized: string; search_form: string; frequency_score: number; category_breakdown: object; sources: object[]; corpus_quality: object; }
export interface ComponentCandidate { id: string; language: string; surface: string; associative_family_id: string | null; source_locator: object; evidence: object[]; }
export interface LexicalHead { id: string; language: string; normalized_head: string; identity_kind: 'lexical_head' | 'historically_reviewed_lexical_head' | 'legacy_exact_record'; sense: string; version: number; evidence: object[]; }
export interface AssociativeFamily { id: string; canonical: string; legacy_ids: string[]; canonical_decision: object; aliases: string[]; realizations: Record<string,string[]>; }
export interface NationalReflex { family_id: string; language: string; realization: string; morphology_boundary: string; supporting_heads: string[]; positive_controls: string[]; negative_controls: string[]; status: EdgeStatus; evidence: object[]; }
export interface EvidenceNode { legacy_id: string; etymon_keys: string[]; relation_evidence: object[]; source_locator: object; associative_family_id: null; }
export interface QueryAlias { query: string; family_targets: string[]; evidence_targets: string[]; establishes_membership: false; }
export interface HeadFamilyEdge { head_id: string; family_id: string; status: EdgeStatus; scope: string; version: number; evidence: object[]; morphology_policy: string; lemma_ids: string[]; }
export interface LemmaHeadLink { language: string; lemma_id: string; word: string; head_id: string; family_id: string; evidence: object[]; }

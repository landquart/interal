import { createHash } from 'node:crypto';

export const FAMILY_EDGE = Object.freeze({ EQUIVALENT_BRANCH: 'EQUIVALENT_BRANCH', CONTAINS_COMPONENT: 'CONTAINS_COMPONENT', PROTO_RELATION: 'PROTO_RELATION' });
const MERGE_EVIDENCE = new Set(['allomorph', 'derivational_chain', 'historical_modification', 'inheritance', 'borrowing', 'near_lexical_ancestor', 'manual_override']);
export const stableId = (namespace, ...parts) => `${namespace}:${createHash('sha256').update(parts.map(value => String(value).normalize('NFC')).join('\0')).digest('hex').slice(0, 20)}`;
export const stableLemmaId = (language, normalized) => stableId('lemma', String(language).toLowerCase(), String(normalized).toLocaleLowerCase('und'));
export const surfaceBranchId = (language, surface) => stableId('surface', String(language).toLowerCase(), String(surface).toLocaleLowerCase('und'));

export function assertEvidence(evidence) {
  if (!evidence?.type || !evidence?.source || !Array.isArray(evidence.path)) throw new Error('Evidence requires type, source and path');
  if (!Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1) throw new Error('Evidence confidence must be in [0,1]');
}

export class FamilyGraph {
  constructor() { this.branches = new Map(); this.edges = []; this.parent = new Map(); }
  addBranch(branch) { if (!branch?.id || !branch?.form) throw new Error('Branch requires id and form'); this.branches.set(branch.id, branch); this.parent.set(branch.id, branch.id); return branch.id; }
  find(id) { const parent = this.parent.get(id); if (!parent) throw new Error(`Unknown branch: ${id}`); if (parent !== id) this.parent.set(id, this.find(parent)); return this.parent.get(id); }
  addEdge(from, to, type, evidence) {
    if (!Object.values(FAMILY_EDGE).includes(type)) throw new Error(`Unknown family edge: ${type}`);
    assertEvidence(evidence); this.edges.push({ from, to, type, evidence });
    if (type !== FAMILY_EDGE.EQUIVALENT_BRANCH) return;
    if (!MERGE_EVIDENCE.has(evidence.type)) throw new Error(`Evidence ${evidence.type} cannot merge branches`);
    const a = this.find(from), b = this.find(to); if (a !== b) this.parent.set(a < b ? b : a, a < b ? a : b);
  }
  materializeFamilies() {
    const groups = new Map();
    for (const branch of this.branches.values()) { const root = this.find(branch.id); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(branch); }
    return [...groups.values()].map(branches => ({ family_id: stableId('family', ...branches.map(item => item.id).sort()), canonical: branches.sort((a,b) => a.form.localeCompare(b.form))[0].form, branches }));
  }
}

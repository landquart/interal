import {buildSearchForm} from './search-normalizer.js';
// Root-specific reviewed realizations, never a global letter replacement rule.
export function matchesReviewedAssociativeForm(member,family,language) {
  const forms=family.surface_forms?.[language] || [family.canonical];
  const word=buildSearchForm(member?.word);
  return Array.isArray(forms) && forms.some(form=>{
    const normalized=buildSearchForm(form);
    return normalized.length>0 && word.includes(normalized);
  });
}

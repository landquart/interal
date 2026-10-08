// Exact reviewed memberships; this is not a substring or prefix classifier.
// Component membership never equates the other components of a compound.
export const INTER_COMPONENT_CONTROLS = Object.freeze(['interval', 'internet']);

export function isExplicitComponentControl(familyId, language, word) {
  return familyId === 'family:inter' && language === 'en'
    && INTER_COMPONENT_CONTROLS.includes(word);
}

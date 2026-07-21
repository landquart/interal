from pathlib import Path

path = Path(__file__).resolve().parent / 'apply_associative_morphology_hardening.py'
text = path.read_text(encoding='utf-8')
old = """        lexicalRootSource: root.source,
        lexicalRootFrequency: root.frequency,
        ignored_connectors: segment.connectors,
"""
new = """        lexicalRootSource: root.source,
        lexicalRootFrequency: root.frequency,
        lexicalRootConfidence: root.confidence,
        ignored_connectors: segment.connectors,
"""
if old not in text:
    raise SystemExit('lexical root metadata target not found')
text = text.replace(old, new, 1)
old = """  return output.sort((a, b) => b.confidence_score - a.confidence_score || b.first_lexical_root_after_preposition.length - a.first_lexical_root_after_preposition.length || a.first_lexical_root_after_preposition.localeCompare(b.first_lexical_root_after_preposition)).slice(0, 12);
"""
new = """  return output.sort((a, b) => b.confidence_score - a.confidence_score
    || (b.derivational?.length || 0) - (a.derivational?.length || 0)
    || Number(b.lexicalRootConfidence || 0) - Number(a.lexicalRootConfidence || 0)
    || b.first_lexical_root_after_preposition.length - a.first_lexical_root_after_preposition.length
    || a.first_lexical_root_after_preposition.localeCompare(b.first_lexical_root_after_preposition)).slice(0, 12);
"""
if old not in text:
    raise SystemExit('preposition ranking target not found')
text = text.replace(old, new, 1)
old = """new = r'''  const stem = analysis.analysis_confidence === 'low'
    ? stemRoot
    : `${stemRoot}${analysis.first_meaningful_derivational_element && analysis.first_meaningful_derivational_element !== 'base' ? analysis.first_meaningful_derivational_element : ''}`;
'''
"""
new = """new = r'''  const stem = stemRoot;
'''
"""
if old not in text:
    raise SystemExit('descriptor stem replacement target not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Repaired lexical-root ranking and canonical descriptor stem.')

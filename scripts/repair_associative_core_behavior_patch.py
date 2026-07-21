from pathlib import Path

path = Path(__file__).resolve().parent / 'apply_associative_core_hardening.py'
text = path.read_text(encoding='utf-8')
old = """      const signal = currentRunSignal();
      const languageScore = (language, candidates) => {
"""
new = """      const signal = currentRunSignal();
      clearTargetMeaningTranslationCache();
      const languageScore = (language, candidates) => {
"""
if old not in text:
    raise SystemExit('run translation-cache target not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Restored per-run target translation cache invalidation.')

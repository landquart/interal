from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'tests/associative-qwen-candidate-generation.test.mjs'
text = path.read_text(encoding='utf-8')
old = "assert.deepEqual(refinedAudit.diagnostics, { suggestedCount: 7, duplicateWordCount: 3, duplicateModelCount: 1, locallyMissingCount: 1, verifiedNewModelCount: 1, rejectedInvalidCount: 1, auditRetryCount: 0 }, 'diagnostics counts duplicate, missing, invalid, and verified suggestions');"
new = "assert.deepEqual(refinedAudit.diagnostics, { suggestedCount: 7, duplicateWordCount: 3, duplicateModelCount: 1, locallyMissingCount: 1, verifiedNewModelCount: 1, rejectedInvalidCount: 1, auditRetryCount: 0, status: 'completed', model: null, usedGuaranteedFallback: false, backendErrorCode: null, backendErrorDetails: null }, 'diagnostics counts duplicate, missing, invalid, verified, and backend audit state');"
if old not in text:
    raise SystemExit('first audit diagnostics assertion not found')
text = text.replace(old, new, 1)
old = "assert.deepEqual(emptyAudit.diagnostics, { suggestedCount: 0, duplicateWordCount: 0, duplicateModelCount: 0, locallyMissingCount: 0, verifiedNewModelCount: 0, rejectedInvalidCount: 0, auditRetryCount: 0 }, 'empty Qwen response is a normal no-op');"
new = "assert.deepEqual(emptyAudit.diagnostics, { suggestedCount: 0, duplicateWordCount: 0, duplicateModelCount: 0, locallyMissingCount: 0, verifiedNewModelCount: 0, rejectedInvalidCount: 0, auditRetryCount: 0, status: 'completed', model: null, usedGuaranteedFallback: false, backendErrorCode: null, backendErrorDetails: null }, 'empty Qwen response is a normal completed no-op');"
if old not in text:
    raise SystemExit('empty audit diagnostics assertion not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Updated existing candidate-audit diagnostics tests.')

from pathlib import Path

root = Path(__file__).resolve().parents[1]

path = root / 'tests/associative-qwen-candidate-generation.test.mjs'
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

path = root / 'tests/associative-model-selection-policy.test.mjs'
text = path.read_text(encoding='utf-8')
old = "assert.match(script, /state\\.maxModels = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE/);"
new = "assert.match(script, /maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE/, 'production passes the fixed five-model limit into the unified runner');"
if old not in text:
    raise SystemExit('selection policy runner assertion not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

path = root / 'tests/associative-search-runtime-patch.test.mjs'
text = path.read_text(encoding='utf-8')
old = "  assert.ok(patched.includes('autoAnalyzeCandidatesPerLanguage'));\n  assert.ok(patched.includes(\"analysisStatus: 'pending'\"));\n  assert.ok(patched.includes('nextLangs[lang.code] = reconcileModelRepresentatives'));"
new = "  assert.ok(patched.includes('runAssociativeCalculation'), 'published runtime uses the unified production runner');\n  assert.ok(patched.includes(\"analysisStatus: 'pending'\"));\n  assert.ok(patched.includes('candidateFinalizer'), 'production adapter supplies final model grouping to the unified runner');"
if old not in text:
    raise SystemExit('runtime patch legacy assertions not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

path = root / 'tests/associativvordes-error-handling.test.mjs'
text = path.read_text(encoding='utf-8')
text = text.replace(
    "const analyzer = await readFile('associativvordes/js/association-analyzer.js', 'utf8');",
    "const analyzer = await readFile('associativvordes/js/association-analyzer.js', 'utf8');\nconst runner = await readFile('associativvordes/js/associative-calculation-runner.js', 'utf8');",
    1
)
replacements = [
    ("assert.match(script, /createLanguageStatus\\('no_candidates'\\)[\\s\\S]*continue;/, 'no_candidates path skips ordinary candidate Qwen analysis');", "assert.match(runner, /status\\('no_candidates'\\)[\\s\\S]*continue;/, 'no_candidates path skips candidate analysis in the unified runner');"),
    ("assert.match(script, /createLanguageStatus\\('index_error'[\\s\\S]*continue;/, 'index_error path skips ordinary candidate Qwen analysis');", "assert.match(runner, /addLanguageWarning\\(currentState, language\\.code, 'language_index_unavailable'[\\s\\S]*status\\('index_error'/, 'index errors are terminal for that language in the unified runner');"),
    ("assert.match(script, /state\\.languages = \\{ \\.\\.\\.state\\.languages, \\.\\.\\.nextLangs \\}/, 'one failed language does not clear previous language results');", "assert.match(runner, /currentState\\.languages\\[language\\.code\\] = pool\\.map/, 'each language result is updated independently');"),
    ("assert.match(script, /buttonController\\?\\.success[\\s\\S]*Done[\\s\\S]*Готово/, 'successful calculation shows localized completion status');", "assert.match(script, /buttonTexts:[\\s\\S]*done: currentLang\\(\\) === 'en' \\? 'Done' : 'Готово'/, 'production supplies localized completion text to the unified runner');"),
    ("assert.match(script, /mapWithConcurrency\\([\\s\\S]*QWEN_RUNTIME_CONFIG\\.maxConcurrentQwenRequests/, 'maxConcurrentQwenRequests is honored');", "assert.match(runner, /for \\(const candidate of selected\\)/, 'only the bounded final selected model set is analyzed');")
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'error-handling assertion not found: {old}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

path = root / 'tests/associativvordes-persistence.test.mjs'
text = path.read_text(encoding='utf-8')
old = "assert.equal(exported.version, 1, 'completed state exports through versioned compact page adapter');"
new = "assert.equal(exported.version, 2, 'completed state exports through the current versioned morphology-aware page adapter');"
if old not in text:
    raise SystemExit('persistence state-version assertion not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

print('Updated existing associative tests for unified production behavior.')

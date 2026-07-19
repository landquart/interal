const QWEN_CANDIDATE_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];

function emptyCandidateResponse() {
  return {
    ok: true,
    candidates: Object.fromEntries(QWEN_CANDIDATE_LANGUAGES.map((language) => [language, []])),
    stale: true
  };
}

function candidateRequestSignature() {
  if (typeof document === 'undefined') return '';
  return JSON.stringify([
    String(document.getElementById('rootInput')?.value || '').trim(),
    String(document.getElementById('meaningInput')?.value || '').trim(),
    String(document.getElementById('elementType')?.value || '')
  ]);
}

function installQwenCandidateRequestGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.fetch !== 'function') return;
  if (window.fetch.__interalQwenCandidateRequestGuard) return;

  const originalFetch = window.fetch.bind(window);
  const guardedFetch = async function guardedFetch(input, init) {
    const requestUrl = typeof input === 'string' ? input : String(input?.url || input || '');
    if (!requestUrl.includes('/api/qwen-candidates')) return originalFetch(input, init);

    const signature = candidateRequestSignature();
    const response = await originalFetch(input, init);
    const resultStillVisible = document.getElementById('languagesSection')?.hidden === false;
    if (signature === candidateRequestSignature() && resultStillVisible) return response;

    return new Response(JSON.stringify(emptyCandidateResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  };

  guardedFetch.__interalQwenCandidateRequestGuard = true;
  window.fetch = guardedFetch;
}

function installQwenCheckboxOverflowHook() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let attempts = 0;
  const pending = new Set();

  const install = () => {
    attempts += 1;
    if (typeof window.updateItem !== 'function'
      || typeof window.analyzeItem !== 'function'
      || typeof window.InteralPageStateExport !== 'function') {
      if (attempts < 100) setTimeout(install, 100);
      return;
    }
    if (window.updateItem.__interalQwenOverflowHook) return;

    const originalUpdateItem = window.updateItem;
    const wrappedUpdateItem = function wrappedUpdateItem(language, index, key, value) {
      const result = originalUpdateItem.apply(this, arguments);
      if (key !== 'selected' || value !== true) return result;

      // The compact persisted state intentionally stores at most 80 rows per language.
      // The primary Qwen hook handles rows represented there. This fallback covers
      // visible rows beyond that persistence limit without increasing saved-state size.
      const persistedCandidate = window.InteralPageStateExport?.()?.state?.languages?.[language]?.[index];
      if (persistedCandidate) return result;

      const token = `${language}:${index}`;
      queueMicrotask(async () => {
        if (pending.has(token)) return;
        const checkbox = document.querySelector(`input.word-select[data-lang="${language}"][data-index="${index}"]`);
        const row = checkbox?.closest('tr');
        const analyzeButton = [...(row?.querySelectorAll('button') || [])].find((button) => {
          const action = String(button.getAttribute('onclick') || '');
          return action.includes(`analyzeItem('${language}', ${index})`);
        });
        if (!checkbox?.checked || !analyzeButton || analyzeButton.disabled) return;

        pending.add(token);
        try {
          await window.analyzeItem(language, index);
        } finally {
          pending.delete(token);
        }
      });

      return result;
    };

    wrappedUpdateItem.__interalQwenOverflowHook = true;
    window.updateItem = wrappedUpdateItem;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    setTimeout(install, 0);
  }
}

installQwenCandidateRequestGuard();
installQwenCheckboxOverflowHook();

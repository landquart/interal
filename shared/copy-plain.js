document.addEventListener("copy", function (event) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return;

  const plainText = selection.toString();

  if (!plainText.trim()) return;

  event.preventDefault();
  event.clipboardData.setData("text/plain", plainText);
});

(function initDeterminatorFixes() {
  if (!/\/determinatorofvalentyp\//.test(window.location.pathname)) return;

  const API_PATH = '/api/determine-valen-type';
  const DEFAULT_VERCEL_API = 'https://interal.vercel.app/api/determine-valen-type';

  function configuredApiUrl() {
    const fromWindow = typeof window.DETERMINATOR_API_URL === 'string' ? window.DETERMINATOR_API_URL.trim() : '';
    const fromStorage = localStorage.getItem('determinator.apiUrl') || localStorage.getItem('interal.determinator.apiUrl') || '';
    return fromWindow || fromStorage.trim();
  }

  function shouldRewriteApi(resource) {
    if (typeof resource === 'string') return resource === API_PATH;
    if (resource instanceof Request) {
      try {
        return new URL(resource.url).pathname === API_PATH;
      } catch (_error) {
        return false;
      }
    }
    return false;
  }

  function makeResource(resource, url) {
    if (typeof resource === 'string') return url;
    if (resource instanceof Request) return new Request(url, resource);
    return url;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedDeterminatorFetch(resource, init) {
    if (!shouldRewriteApi(resource)) return originalFetch(resource, init);

    const explicit = configuredApiUrl();
    const urls = [];
    if (explicit) urls.push(explicit);
    if (location.hostname === 'landquart.github.io') urls.push(DEFAULT_VERCEL_API);
    urls.push(API_PATH);

    let lastError = null;
    let lastResponse = null;
    for (const url of [...new Set(urls)]) {
      try {
        const response = await originalFetch(makeResource(resource, url), init);
        lastResponse = response;
        if (response.ok) return response;
        if (![404, 405].includes(response.status)) return response;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastResponse) return lastResponse;
    throw lastError || new Error('Determinator API request failed.');
  };

  function getLang() {
    return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
  }

  function syncAnalyzeButton() {
    const button = document.getElementById('analyzeBtn');
    if (!button || button.disabled) return;
    const text = button.textContent.trim().toLowerCase();
    if (text === 'analyse' || text === 'analyze') {
      button.textContent = getLang() === 'en' ? 'Analyse' : 'Анализировать';
    }
  }

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replaceAll('ё', 'е')
      .replace(/[\s_\-]+/g, '_');
  }

  function chainTypeLabel(value) {
    const isEn = getLang() === 'en';
    const key = normalizeKey(value);
    const labels = {
      direct_composition: ['Прямая композиция', 'Direct composition'],
      slight_focus_shift: ['Сдвиг фокуса', 'Focus shift'],
      semantic_extension: ['Расширение значения', 'Meaning extension'],
      семантическое_расширение: ['Расширение значения', 'Meaning extension'],
      transfer: ['Перенос значения', 'Semantic transfer'],
      перенос: ['Перенос значения', 'Semantic transfer'],
      abstract_transfer: ['Абстрактный перенос', 'Abstract transfer'],
      metaphorical_transfer: ['Метафорический перенос', 'Metaphorical transfer'],
      metonymic_transfer: ['Метонимический перенос', 'Metonymic transfer'],
      metonymic_or_abstract_transfer: ['Метонимический / абстрактный перенос', 'Metonymic / abstract transfer'],
      historical_conventionalization: ['Историческая конвенционализация', 'Historical conventionalization'],
      historical_or_traditional_conventionalization: ['Историческая / традиционная конвенционализация', 'Historical / traditional conventionalization'],
      semantic_conventionalization: ['Конвенционализация значения', 'Meaning conventionalization'],
      семантическая_конвенционализация: ['Конвенционализация значения', 'Meaning conventionalization'],
      lexicalized_no_working_chain: ['Нет рабочей объяснительной цепочки', 'No working explanatory chain'],
      lexicalization: ['Лексикализация', 'Lexicalization'],
      лексикализованность: ['Лексикализация', 'Lexicalization']
    };
    const pair = labels[key];
    if (!pair) return String(value || '—');
    return isEn ? pair[1] : pair[0];
  }

  function cleanResult() {
    syncAnalyzeButton();

    const result = document.getElementById('result');
    if (!result || result.classList.contains('empty')) return;

    result.querySelectorAll('.result-card').forEach((card) => {
      const heading = card.querySelector('h3')?.textContent.trim().toLowerCase() || '';

      if (
        heading === 'использованные аналогии' ||
        heading === 'analogies used' ||
        heading === 'граничные зоны' ||
        heading === 'borderline zones'
      ) {
        card.remove();
        return;
      }

      const pre = card.querySelector('pre');
      if (!pre) return;

      if (heading === 'зона спектра' || heading === 'spectrum zone') {
        const firstLine = pre.textContent.split('\n').map((line) => line.trim()).filter(Boolean)[0];
        if (firstLine) pre.textContent = firstLine;
      }

      if (heading === 'тип цепочки' || heading === 'chain type') {
        const value = pre.textContent.trim();
        pre.textContent = chainTypeLabel(value);
      }
    });
  }

  function injectStyles() {
    if (document.getElementById('determinator-result-fix-styles')) return;
    const style = document.createElement('style');
    style.id = 'determinator-result-fix-styles';
    style.textContent = `
      .determinator-page .result-card { min-width: 0; overflow: hidden; }
      .determinator-page .result-card pre { overflow-wrap: anywhere; }
      .determinator-page .score-grid {
        width: 100%;
        max-width: 100%;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .determinator-page .score-field { min-width: 0; }
      .determinator-page .score-field input {
        min-width: 0;
        width: 100%;
        padding-left: 6px;
        padding-right: 6px;
        text-align: center;
      }
      @media (max-width: 520px) {
        .determinator-page .score-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyles();
    syncAnalyzeButton();

    const result = document.getElementById('result');
    const button = document.getElementById('analyzeBtn');

    if (result) {
      new MutationObserver(cleanResult).observe(result, { childList: true, subtree: true, characterData: true });
      cleanResult();
    }

    if (button) {
      new MutationObserver(syncAnalyzeButton).observe(button, { childList: true, characterData: true, subtree: true });
      syncAnalyzeButton();
    }

    document.addEventListener('interal:languagechange', () => setTimeout(cleanResult, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

(() => {
  const API_PATH = '/api/determine-valen-type';
  const DEFAULT_VERCEL_API = 'https://interal.vercel.app/api/determine-valen-type';
  const STORAGE_KEY = 'determinator-valentyp-state-v1';

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

  function patchApiRoute() {
    if (window.__determinatorApiRoutePatched) return;
    window.__determinatorApiRoutePatched = true;

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
  }

  function cleanupSavedResultHtml() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      delete saved.resultHtml;
      delete saved.resultIsEmpty;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (_error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function pageLooksRussian() {
    const lang = localStorage.getItem('interal.lang');
    if (lang === 'ru') return true;
    if (lang === 'en') return false;
    const sample = Array.from(document.querySelectorAll('.panel .field > span, #resultTitle'))
      .slice(0, 8)
      .map((node) => node.textContent || '')
      .join(' ');
    return /[А-Яа-яЁё]/.test(sample);
  }

  function syncAnalyzeButton() {
    const button = document.getElementById('analyzeBtn');
    if (!button || button.disabled) return;
    const text = button.textContent.trim().toLowerCase();
    if (text === 'analyse' || text === 'analyze' || text === 'анализировать') {
      button.textContent = pageLooksRussian() ? 'Анализировать' : 'Analyse';
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
    const isRu = pageLooksRussian();
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
      лексикализованность: ['Лексикализация', 'Lexicalization'],
      полная_композиционность: ['Прямая композиция', 'Direct composition'],
      частичная_композиционность: ['Сдвиг фокуса', 'Focus shift']
    };
    const pair = labels[key];
    if (!pair) return String(value || '—');
    return isRu ? pair[0] : pair[1];
  }

  function normalizeResultCard(card) {
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
      pre.textContent = chainTypeLabel(pre.textContent);
    }
  }

  function cleanResult() {
    syncAnalyzeButton();
    const result = document.getElementById('result');
    if (!result || result.classList.contains('empty')) return;
    result.querySelectorAll('.result-card').forEach(normalizeResultCard);
  }

  function injectStyles() {
    if (document.getElementById('determinator-page-fixes')) return;
    const style = document.createElement('style');
    style.id = 'determinator-page-fixes';
    style.textContent = `
      html,
      body.determinator-page {
        background: var(--bg) !important;
      }

      .determinator-page .app-shell,
      .determinator-page .panel,
      .determinator-page .result,
      .determinator-page .result-grid,
      .determinator-page .result-card,
      .determinator-page .score-grid,
      .determinator-page .score-field {
        min-width: 0;
      }

      .determinator-page .result-card {
        overflow: hidden;
      }

      .determinator-page .result-card pre {
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .determinator-page .score-grid {
        width: 100%;
        max-width: 100%;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .determinator-page .score-field input {
        width: 100%;
        min-width: 0;
        padding-left: 6px;
        padding-right: 6px;
        text-align: center;
      }

      @media (max-width: 760px) {
        .determinator-page .result-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 520px) {
        .determinator-page .score-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function startObservers() {
    const result = document.getElementById('result');
    const button = document.getElementById('analyzeBtn');

    if (result && !result.__determinatorFixObserver) {
      result.__determinatorFixObserver = new MutationObserver(cleanResult);
      result.__determinatorFixObserver.observe(result, { childList: true, subtree: true, characterData: true });
    }

    if (button && !button.__determinatorButtonObserver) {
      button.__determinatorButtonObserver = new MutationObserver(syncAnalyzeButton);
      button.__determinatorButtonObserver.observe(button, { childList: true, subtree: true, characterData: true });
    }

    document.addEventListener('interal:languagechange', () => setTimeout(() => {
      syncAnalyzeButton();
      cleanResult();
    }, 0));

    syncAnalyzeButton();
    cleanResult();
  }

  patchApiRoute();
  cleanupSavedResultHtml();

  function init() {
    injectStyles();
    startObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

(() => {
  const originalFetch = window.fetch.bind(window);
  const API_PATH = '/api/determine-valen-type';

  function configuredApiUrl() {
    const fromWindow = typeof window.DETERMINATOR_API_URL === 'string' ? window.DETERMINATOR_API_URL.trim() : '';
    const fromStorage = localStorage.getItem('determinator.apiUrl') || localStorage.getItem('interal.determinator.apiUrl') || '';
    return fromWindow || fromStorage.trim();
  }

  function shouldRewrite(resource) {
    if (typeof resource === 'string') return resource === API_PATH;
    if (resource instanceof Request) {
      try {
        const url = new URL(resource.url);
        return url.pathname === API_PATH;
      } catch (_error) {
        return false;
      }
    }
    return false;
  }

  function buildCandidateUrls() {
    const explicit = configuredApiUrl();
    const urls = [];
    if (explicit) urls.push(explicit);

    if (location.hostname === 'landquart.github.io') {
      urls.push('https://interal.vercel.app/api/determine-valen-type');
    }

    urls.push(API_PATH);
    return [...new Set(urls)];
  }

  function makeResource(resource, url) {
    if (typeof resource === 'string') return url;
    if (resource instanceof Request) return new Request(url, resource);
    return url;
  }

  window.fetch = async function patchedFetch(resource, init) {
    if (!shouldRewrite(resource)) return originalFetch(resource, init);

    const urls = buildCandidateUrls();
    let lastError = null;
    let lastResponse = null;

    for (const url of urls) {
      try {
        const response = await originalFetch(makeResource(resource, url), init);
        lastResponse = response;

        if (response.ok) return response;

        const retryable = response.status === 404 || response.status === 405 || response.status === 0;
        if (!retryable) return response;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError || new Error('Determinator API request failed.');
  };
})();

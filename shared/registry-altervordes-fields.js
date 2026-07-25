(() => {
  const ALTER_VORDES_TYPE = 'alter vordes';
  const HIDDEN_LABELS = new Set([
    'pi',
    'языковые группы',
    'groups',
    'sprachgruppen',
    'groupes linguistiques',
    'grupos lingüísticos',
    'gruppi linguistici'
  ]);

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function isAlterVordesCard(card) {
    const typeTag = card.querySelector('.card-tag--type');
    return normalize(typeTag?.textContent) === ALTER_VORDES_TYPE;
  }

  function pruneAlterVordesCard(card) {
    if (!(card instanceof Element) || !card.classList.contains('registry-card')) return;
    if (!isAlterVordesCard(card)) return;

    card.querySelectorAll('.card-tags .card-tag').forEach((tag) => {
      if (/^pi(?:\s|$)/i.test(String(tag.textContent || '').trim())) tag.remove();
    });

    card.querySelectorAll('.card-grid > .card-row').forEach((row) => {
      const label = normalize(row.querySelector('.card-label')?.textContent);
      if (HIDDEN_LABELS.has(label)) row.remove();
    });
  }

  function pruneRegistry(root = document) {
    root.querySelectorAll?.('.registry-card').forEach(pruneAlterVordesCard);
  }

  function initialize() {
    const list = document.getElementById('registry-list');
    if (!list) return;

    pruneRegistry(list);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.classList.contains('registry-card')) pruneAlterVordesCard(node);
          pruneRegistry(node);
        });
      }
    });
    observer.observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();

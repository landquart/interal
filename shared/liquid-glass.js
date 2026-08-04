(function () {
  'use strict';

  const VERSION = 'ayu-glass-material-v1';
  const root = document.documentElement;

  if (!root || root.dataset.interalLiquidGlass === VERSION) {
    return;
  }

  root.dataset.interalLiquidGlass = VERSION;

  const reducedTransparency = window.matchMedia(
    '(prefers-reduced-transparency: reduce)'
  );

  const supportsBackdrop =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    (
      CSS.supports('backdrop-filter', 'blur(1px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
    );

  function readPositiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? number
      : null;
  }

  function selectTier() {
    if (!supportsBackdrop || reducedTransparency.matches) {
      return 'solid';
    }

    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    const memory = readPositiveNumber(navigator.deviceMemory);
    const cores = readPositiveNumber(navigator.hardwareConcurrency);

    if (
      connection?.saveData === true ||
      (memory !== null && memory <= 2) ||
      (cores !== null && cores <= 2)
    ) {
      return 'lite';
    }

    return 'normal';
  }

  function syncTier() {
    root.dataset.liquidGlassTier = selectTier();
  }

  syncTier();

  reducedTransparency.addEventListener?.('change', syncTier);

  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  connection?.addEventListener?.('change', syncTier);
})();

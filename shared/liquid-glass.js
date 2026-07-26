(function () {
  const root = document.documentElement;
  if (!root || root.dataset.interalLiquidGlass === 'ready') return;
  root.dataset.interalLiquidGlass = 'ready';

  const media = (query) => {
    try {
      return window.matchMedia(query).matches;
    } catch (_) {
      return false;
    }
  };

  const userAgent = navigator.userAgent || '';
  const chromiumEngine = /(?:Chrome|Chromium|CriOS|EdgA?|OPR|SamsungBrowser)\//.test(userAgent)
    && !/(?:Firefox|FxiOS)\//.test(userAgent);
  const supportsBackdrop = typeof CSS !== 'undefined'
    && (CSS.supports('backdrop-filter', 'blur(1px)')
      || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  const reducedTransparency = media('(prefers-reduced-transparency: reduce)');
  const increasedContrast = media('(prefers-contrast: more)');
  const saveData = Boolean(navigator.connection?.saveData);
  const veryLowPower = (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2)
    || (Number(navigator.hardwareConcurrency) > 0 && Number(navigator.hardwareConcurrency) <= 2);

  const enhanced = supportsBackdrop
    && chromiumEngine
    && !reducedTransparency
    && !increasedContrast
    && !saveData
    && !veryLowPower;

  root.classList.add(enhanced ? 'liquid-glass-enhanced' : 'liquid-glass-lite');

  if (!enhanced || document.getElementById('interal-liquid-glass-defs')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'interal-liquid-glass-defs';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.position = 'fixed';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.pointerEvents = 'none';
  svg.style.overflow = 'hidden';

  svg.innerHTML = `
    <defs>
      <filter id="interal-liquid-refraction" x="-14%" y="-35%" width="128%" height="170%" color-interpolation-filters="sRGB">
        <feFlood flood-color="#808080" flood-opacity="1" result="neutral" />
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.022" numOctaves="1" seed="13" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="1.15" result="smoothNoise" />
        <feMorphology in="SourceAlpha" operator="erode" radius="13" result="innerAlpha" />
        <feComposite in="SourceAlpha" in2="innerAlpha" operator="out" result="edgeBand" />
        <feGaussianBlur in="edgeBand" stdDeviation="4.8" result="softEdgeBand" />
        <feComposite in="smoothNoise" in2="softEdgeBand" operator="in" result="edgeNoise" />
        <feComposite in="neutral" in2="softEdgeBand" operator="out" result="neutralCore" />
        <feMerge result="displacementMap">
          <feMergeNode in="neutralCore" />
          <feMergeNode in="edgeNoise" />
        </feMerge>
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="24" xChannelSelector="R" yChannelSelector="G" result="refracted" />
        <feGaussianBlur in="refracted" stdDeviation="0.18" />
      </filter>

      <filter id="interal-liquid-refraction-mobile" x="-16%" y="-38%" width="132%" height="176%" color-interpolation-filters="sRGB">
        <feFlood flood-color="#808080" flood-opacity="1" result="neutral" />
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.026" numOctaves="1" seed="17" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="1" result="smoothNoise" />
        <feMorphology in="SourceAlpha" operator="erode" radius="11" result="innerAlpha" />
        <feComposite in="SourceAlpha" in2="innerAlpha" operator="out" result="edgeBand" />
        <feGaussianBlur in="edgeBand" stdDeviation="4.1" result="softEdgeBand" />
        <feComposite in="smoothNoise" in2="softEdgeBand" operator="in" result="edgeNoise" />
        <feComposite in="neutral" in2="softEdgeBand" operator="out" result="neutralCore" />
        <feMerge result="displacementMap">
          <feMergeNode in="neutralCore" />
          <feMergeNode in="edgeNoise" />
        </feMerge>
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="18" xChannelSelector="R" yChannelSelector="G" result="refracted" />
        <feGaussianBlur in="refracted" stdDeviation="0.14" />
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
})();

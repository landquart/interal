(() => {
  const script = document.currentScript;
  if (!script) return;

  const root = document.documentElement;
  root.classList.add("interal-suppress-legacy-loader");

  const style = document.createElement("style");
  style.id = "interal-loader-paint-fix-style";
  style.textContent = `
    .interal-suppress-legacy-loader .interal-page-loader {
      display: none !important;
    }

    .interal-first-paint-loader {
      position: fixed;
      inset: 0;
      z-index: 10080;
      display: grid;
      place-items: center;
      background: transparent !important;
      background-color: transparent !important;
      pointer-events: none;
    }

    .interal-first-paint-loader img {
      display: block;
      width: 48px;
      height: 48px;
      border: 0;
      background: transparent !important;
      background-color: transparent !important;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
    }
  `;
  document.head?.appendChild(style);

  const sharedRoot = new URL("./", script.src);

  if (!document.querySelector('script[data-interal-site-motion]')) {
    const motionScript = document.createElement("script");
    motionScript.src = new URL("site-motion.js?v=page-transitions-only-20260820-6", sharedRoot).href;
    motionScript.async = false;
    motionScript.dataset.interalSiteMotion = "true";
    document.head?.appendChild(motionScript);
  }

  const imageUrl = new URL("../elements/material3_expressive_loader.svg?v=interal-loader-20260819-3", sharedRoot).href;
  let overlay = null;
  let revealTimer = 0;

  const removeOverlay = () => {
    window.clearTimeout(revealTimer);
    overlay?.remove();
    overlay = null;
  };

  const reveal = () => {
    if (document.readyState === "complete" || overlay) return;

    overlay = document.createElement("div");
    overlay.className = "interal-first-paint-loader";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", document.documentElement.lang === "en" ? "Loading" : "Загрузка");

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.draggable = false;

    overlay.appendChild(image);
    document.body?.appendChild(overlay);
  };

  const afterFirstPaint = () => {
    revealTimer = window.setTimeout(reveal, 1000);
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(afterFirstPaint));
  } else {
    afterFirstPaint();
  }

  if (document.readyState === "complete") {
    removeOverlay();
  } else {
    window.addEventListener("load", removeOverlay, { once: true });
  }
})();

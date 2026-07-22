(function () {
  const carousel = document.querySelector('[data-instrumentes-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track]');
  const prevButton = carousel.querySelector('[data-carousel-prev]');
  const nextButton = carousel.querySelector('[data-carousel-next]');
  if (!track || !prevButton || !nextButton) return;

  const cards = Array.from(track.querySelectorAll('.instrument-card'));
  if (!cards.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 560px)');
  const baseAnimationMs = reduceMotion.matches ? 120 : 560;
  const finishEase = 'cubic-bezier(0.22, 1, 0.36, 1)';
  let activeIndex = 0;
  let isAnimating = false;
  let rafId = 0;
  let suppressNextClick = false;
  let drag = null;

  const prevSlot = document.createComment('instrumentes previous arrow');
  const nextSlot = document.createComment('instrumentes next arrow');
  prevButton.replaceWith(prevSlot);
  nextButton.replaceWith(nextSlot);

  prevButton.setAttribute('aria-label', 'Показать предыдущий инструмент');
  nextButton.setAttribute('aria-label', 'Показать следующий инструмент');

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, progress) => from + (to - from) * progress;
  const isMobile = () => mobileQuery.matches;
  const cardWidth = () => cards[activeIndex]?.getBoundingClientRect().width || track.clientWidth * 0.82;
  const sideOffset = () => Math.min(track.clientWidth * 0.58, cardWidth() * 0.92);
  const switchDistance = () => cardWidth() * 0.3;

  const setArrow = (button, slot, visible) => {
    const shouldShow = visible && !isMobile();
    const isMounted = button.parentNode === carousel;
    if (shouldShow && !isMounted) slot.replaceWith(button);
    if (!shouldShow && isMounted) button.replaceWith(slot);
  };

  const clearCardInlineStyles = () => {
    cards.forEach((card) => {
      card.style.transform = '';
      card.style.opacity = '';
      card.style.filter = '';
      card.style.transition = '';
      card.style.zIndex = '';
    });
  };

  const setCardState = (card, state) => {
    card.classList.remove('is-active', 'is-previous', 'is-next', 'is-hidden');
    card.classList.add(state);

    const isActive = state === 'is-active';
    card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    card.tabIndex = isActive ? 0 : -1;
  };

  const render = ({ preserveInlineTransition = false } = {}) => {
    if (!preserveInlineTransition) clearCardInlineStyles();
    cards.forEach((card, index) => {
      if (index === activeIndex) setCardState(card, 'is-active');
      else if (index === activeIndex - 1) setCardState(card, 'is-previous');
      else if (index === activeIndex + 1) setCardState(card, 'is-next');
      else setCardState(card, 'is-hidden');
    });
    if (preserveInlineTransition) {
      cards.forEach((card) => {
        card.style.transform = '';
        card.style.opacity = '';
        card.style.filter = '';
        card.style.zIndex = '';
      });
    }

    setArrow(prevButton, prevSlot, activeIndex > 0);
    setArrow(nextButton, nextSlot, activeIndex < cards.length - 1);
  };

  const goTo = (index) => {
    const nextIndex = clamp(index, 0, cards.length - 1);
    if (nextIndex === activeIndex || isAnimating) return;

    isAnimating = true;
    activeIndex = nextIndex;
    render();

    window.setTimeout(() => {
      isAnimating = false;
    }, baseAnimationMs);
  };

  const applyDragFrame = () => {
    if (!drag) return;
    rafId = 0;
    const deltaX = drag.displayDeltaX;
    const direction = deltaX < 0 ? 1 : -1;
    const targetIndex = activeIndex + direction;
    const progress = clamp(Math.abs(deltaX) / switchDistance(), 0, 1);
    const side = sideOffset();

    cards.forEach((card, index) => {
      card.style.transition = 'none';
      if (index === activeIndex) {
        card.style.zIndex = '3';
        card.style.transform = `translateX(calc(-50% + ${deltaX}px)) scale(${lerp(1, 0.82, progress)})`;
        card.style.opacity = String(lerp(1, 0.65, progress));
        card.style.filter = `blur(${lerp(0, 4, progress)}px)`;
      } else if (index === targetIndex) {
        const start = direction > 0 ? side : -side;
        card.style.zIndex = '2';
        card.style.transform = `translateX(calc(-50% + ${lerp(start, 0, progress)}px)) scale(${lerp(0.82, 1, progress)})`;
        card.style.opacity = String(lerp(0.65, 1, progress));
        card.style.filter = `blur(${lerp(4, 0, progress)}px)`;
      } else if (index === activeIndex - 1) {
        card.style.zIndex = '1';
        card.style.transform = `translateX(calc(-50% - ${side}px)) scale(.82)`;
        card.style.opacity = '.65';
        card.style.filter = 'blur(4px)';
      } else if (index === activeIndex + 1) {
        card.style.zIndex = '1';
        card.style.transform = `translateX(calc(-50% + ${side}px)) scale(.82)`;
        card.style.opacity = '.65';
        card.style.filter = 'blur(4px)';
      }
    });
  };

  const requestDragFrame = () => {
    if (!rafId) rafId = window.requestAnimationFrame(applyDragFrame);
  };

  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const data = drag;
    drag = null;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    try { track.releasePointerCapture(data.pointerId); } catch (_) {}
    if (data.mode !== 'horizontal') { render(); return; }

    const deltaX = data.displayDeltaX;
    const rawDeltaX = data.lastX - data.startX;
    const canMove = !(rawDeltaX > 0 && activeIndex === 0) && !(rawDeltaX < 0 && activeIndex === cards.length - 1);
    const elapsed = Math.max(1, data.lastTime - data.startTime);
    const velocity = rawDeltaX / elapsed;
    const shouldSwitch = canMove && (Math.abs(rawDeltaX) >= switchDistance() || Math.abs(velocity) > 0.55);
    const nextIndex = shouldSwitch ? activeIndex + (rawDeltaX < 0 ? 1 : -1) : activeIndex;
    const remaining = shouldSwitch ? Math.max(0, switchDistance() - Math.abs(deltaX)) : Math.abs(deltaX);
    const duration = reduceMotion.matches ? 120 : clamp(180 + (remaining / switchDistance()) * 140, 180, 320);
    cards.forEach((card) => { card.style.transition = `transform ${duration}ms ${finishEase}, opacity ${duration}ms ${finishEase}, filter ${duration}ms ${finishEase}`; });
    activeIndex = clamp(nextIndex, 0, cards.length - 1);
    window.requestAnimationFrame(() => render({ preserveInlineTransition: true }));
    window.setTimeout(() => { isAnimating = false; render(); }, duration);
  };

  prevButton.addEventListener('click', () => goTo(activeIndex - 1));
  nextButton.addEventListener('click', () => goTo(activeIndex + 1));

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeIndex + 1); }
  });

  track.addEventListener('click', (event) => {
    if (suppressNextClick) { event.preventDefault(); suppressNextClick = false; return; }
    const card = event.target.closest('.instrument-card');
    if (!card || !track.contains(card)) return;
    const index = cards.indexOf(card);
    if (index === activeIndex) return;
    event.preventDefault();
    if (index === activeIndex - 1 || index === activeIndex + 1) goTo(index);
  });

  track.addEventListener('pointerdown', (event) => {
    if (!isMobile() || event.pointerType === 'mouse' && event.button !== 0) return;
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: performance.now(), startTime: performance.now(), displayDeltaX: 0, mode: null };
    track.setPointerCapture(event.pointerId);
  });

  track.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.mode && Math.max(Math.abs(dx), Math.abs(dy)) > 8) drag.mode = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'horizontal' : 'vertical';
    if (drag.mode !== 'horizontal') return;
    event.preventDefault();
    const atStart = dx > 0 && activeIndex === 0;
    const atEnd = dx < 0 && activeIndex === cards.length - 1;
    drag.displayDeltaX = atStart || atEnd ? dx * 0.2 : dx;
    drag.lastX = event.clientX;
    drag.lastTime = performance.now();
    if (Math.abs(dx) > 8) suppressNextClick = true;
    requestDragFrame();
  }, { passive: false });

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  mobileQuery.addEventListener?.('change', render);
  reduceMotion.addEventListener?.('change', render);

  render();
})();

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
  const animationMs = reduceMotion.matches ? 120 : 560;
  let activeIndex = 0;
  let isAnimating = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchTracking = false;

  const prevSlot = document.createComment('instrumentes previous arrow');
  const nextSlot = document.createComment('instrumentes next arrow');
  prevButton.replaceWith(prevSlot);
  nextButton.replaceWith(nextSlot);

  prevButton.setAttribute('aria-label', 'Показать предыдущий инструмент');
  nextButton.setAttribute('aria-label', 'Показать следующий инструмент');

  const setArrow = (button, slot, visible) => {
    const isMounted = button.parentNode === carousel;
    if (visible && !isMounted) slot.replaceWith(button);
    if (!visible && isMounted) button.replaceWith(slot);
  };

  const setCardState = (card, state) => {
    card.classList.remove('is-active', 'is-previous', 'is-next', 'is-hidden');
    card.classList.add(state);

    const isActive = state === 'is-active';
    card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    card.tabIndex = isActive ? 0 : -1;
  };

  const render = () => {
    cards.forEach((card, index) => {
      if (index === activeIndex) setCardState(card, 'is-active');
      else if (index === activeIndex - 1) setCardState(card, 'is-previous');
      else if (index === activeIndex + 1) setCardState(card, 'is-next');
      else setCardState(card, 'is-hidden');
    });

    setArrow(prevButton, prevSlot, activeIndex > 0);
    setArrow(nextButton, nextSlot, activeIndex < cards.length - 1);
  };

  const goTo = (index) => {
    const nextIndex = Math.max(0, Math.min(cards.length - 1, index));
    if (nextIndex === activeIndex || isAnimating) return;

    isAnimating = true;
    activeIndex = nextIndex;
    render();

    window.setTimeout(() => {
      isAnimating = false;
    }, animationMs);
  };

  prevButton.addEventListener('click', () => goTo(activeIndex - 1));
  nextButton.addEventListener('click', () => goTo(activeIndex + 1));

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(activeIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(activeIndex + 1);
    }
  });

  track.addEventListener('click', (event) => {
    const card = event.target.closest('.instrument-card');
    if (!card || !track.contains(card)) return;
    const index = cards.indexOf(card);
    if (index === activeIndex) return;

    event.preventDefault();
    if (index === activeIndex - 1 || index === activeIndex + 1) goTo(index);
  });

  track.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    touchTracking = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  track.addEventListener('touchend', (event) => {
    if (!touchTracking || !event.changedTouches.length) return;
    touchTracking = false;

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
  }, { passive: true });

  render();
})();

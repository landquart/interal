(function () {
  const carousel = document.querySelector('[data-instrumentes-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track]');
  const prev = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  if (!track || !prev || !next) return;

  const getStep = () => {
    const card = track.querySelector('.instrument-card');
    if (!card) return track.clientWidth;
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const updateButtons = () => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth - 1);
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max;
  };

  const move = (direction) => {
    track.scrollBy({ left: direction * getStep(), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons);
  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  });

  updateButtons();
  requestAnimationFrame(updateButtons);
})();

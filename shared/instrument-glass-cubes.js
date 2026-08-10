(() => {
  const CUBE_COUNT = 25;

  const mountGlassCubes = () => {
    document.querySelectorAll('.instrument-art').forEach((art) => {
      if (art.querySelector('.instrument-glass-cubes')) return;

      const grid = document.createElement('span');
      grid.className = 'instrument-glass-cubes';
      grid.setAttribute('aria-hidden', 'true');

      const fragment = document.createDocumentFragment();
      for (let i = 0; i < CUBE_COUNT; i += 1) {
        const cube = document.createElement('span');
        cube.className = 'instrument-glass-cube';
        fragment.appendChild(cube);
      }

      grid.appendChild(fragment);
      art.appendChild(grid);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountGlassCubes, { once: true });
  } else {
    mountGlassCubes();
  }
})();

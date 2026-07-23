(function polishHomepageIntro() {
  if (!document.body.classList.contains('homepage')) return;

  function applyHomepagePolish() {
    const intro = document.querySelector('.home-intro');
    const row = intro?.querySelector('.home-intro-row');
    const description = row?.querySelector('.home-intro-description');
    const firstQuote = row?.querySelector('.home-quote');
    const secondQuote = intro?.querySelector('.home-standalone-quote');

    if (row && description && firstQuote && secondQuote && !row.querySelector('.home-quote-group')) {
      const quoteGroup = document.createElement('div');
      quoteGroup.className = 'home-quote-group';

      secondQuote.classList.remove('home-standalone-quote');
      quoteGroup.append(firstQuote, secondQuote);
      row.insertBefore(quoteGroup, description);
    }

    if (!document.getElementById('homepage-polish-styles')) {
      const style = document.createElement('style');
      style.id = 'homepage-polish-styles';
      style.textContent = `
        .homepage .home-intro {
          gap: 0;
          margin-bottom: clamp(24px, 4vw, 46px);
        }

        .homepage .home-intro-row {
          grid-template-columns: minmax(300px, .82fr) minmax(0, 1.18fr);
          align-items: start;
          gap: clamp(28px, 4vw, 52px);
        }

        .homepage .home-quote-group {
          display: grid;
          align-content: start;
          gap: clamp(9px, 1.1vw, 14px);
          min-width: 0;
        }

        .homepage .home-quote {
          margin: 0;
          width: 100%;
          max-width: 590px;
          color: var(--text);
          font-size: clamp(1.46rem, 2.3vw, 2.3rem);
          font-weight: 800;
          line-height: 1.02;
          letter-spacing: -.035em;
          text-transform: uppercase;
          overflow-wrap: normal;
        }

        .homepage .home-quote span,
        .homepage .home-quote em {
          display: inline;
        }

        .homepage .home-quote em {
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 1.22em;
          font-style: italic;
          font-weight: 500;
          line-height: .82;
          letter-spacing: -.035em;
          text-transform: none;
        }

        html[lang="en"] .homepage .home-quote {
          font-size: clamp(1.32rem, 2.05vw, 2.05rem);
        }

        .homepage .home-about-card {
          border-radius: 22px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, .065);
          border: 1px solid color-mix(in srgb, var(--about-card-text) 10%, transparent);
        }

        @media (max-width: 860px) {
          .homepage .home-intro {
            margin-bottom: 26px;
          }

          .homepage .home-intro-row {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .homepage .home-quote-group {
            gap: 9px;
          }

          .homepage .home-quote,
          html[lang="en"] .homepage .home-quote {
            max-width: none;
            font-size: clamp(1.28rem, 5.8vw, 1.86rem);
          }
        }
      `;
      document.head.appendChild(style);
    }

    const palette = [
      ['#C7A55A', '#1D1A12'],
      ['#B56767', '#130A0B'],
      ['#626799', '#FFFFFF'],
      ['#789174', '#132012']
    ];

    document.querySelectorAll('.home-about-card').forEach((card, index) => {
      const colors = palette[index];
      if (!colors) return;
      card.style.setProperty('--about-card-bg', colors[0]);
      card.style.setProperty('--about-card-text', colors[1]);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyHomepagePolish, { once: true });
  } else {
    applyHomepagePolish();
  }
})();

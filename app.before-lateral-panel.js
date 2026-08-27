(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const body = document.body;
  const menu = $('#mobileNav');
  const menuBtn = $('#menuBtn');
  const close = $('#closeMenu');
  const toast = $('#toast');
  let toastTimer;

  // Sonic Channel-style page entrance: loader + staggered reveal.
  document.documentElement.classList.add('sf-js');
  window.addEventListener('load', () => {
    requestAnimationFrame(() => body.classList.add('page-ready'));
  });

  const showToast = (text) => {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  };

  // Mobile navigation reproduces the original two-stage slide/stagger timing.
  const setMenu = (open) => {
    if (!menu) return;
    menu.classList.toggle('open', open);
    body.classList.toggle('menu-open', open);
    if (open) {
      $$('.mobile-nav a', menu).forEach((a, i) => {
        a.style.setProperty('--nav-delay', `${180 + i * 55}ms`);
      });
    }
  };
  menuBtn?.addEventListener('click', () => setMenu(true));
  close?.addEventListener('click', () => setMenu(false));
  $$('.mobile-nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  // Swiper: the source portal uses centered looping autoplay carousels.
  if (window.Swiper && $('.sf-hero-swiper')) {
    new Swiper('.sf-hero-swiper', {
      loop: true,
      centeredSlides: true,
      slidesPerView: 1,
      speed: 700,
      effect: 'slide',
      watchSlidesProgress: true,
      autoplay: { delay: 3600, disableOnInteraction: false },
      pagination: { el: '.sf-hero-dots', clickable: true },
      breakpoints: { 900: { slidesPerView: 1.12 } }
    });
  }

  // In-view activation, staggered like the original site's section transitions.
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('visible');
      $$('.sf-news-card,.friend-card,.download-card,.quick-action-card,.gallery-grid img,.lineup-cards article', el)
        .forEach((child, i) => child.style.setProperty('--stagger', `${i * 75}ms`));
      revealObserver.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => revealObserver.observe(el));

  // Per-card reveal even when a card's parent was already visible.
  const cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('card-visible');
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  $$('.sf-news-card,.friend-card,.download-card,.quick-action-card,.gallery-grid img,.lineup-cards article').forEach(el => cardObserver.observe(el));

  // Scroll state + parallax layers.
  let ticking = false;
  const updateScroll = () => {
    const y = window.scrollY || 0;
    body.classList.toggle('scrolled', y > 46);
    $('.sf-header')?.style.setProperty('--scroll-progress', Math.min(y / 600, 1).toFixed(3));
    $$('.sf-bg, .hero-orbit, .hero-ring').forEach((el, i) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const factor = [0.035, -0.055, 0.08, -0.045, 0.06][i] ?? 0.04;
      el.style.setProperty('--parallax-y', `${y * factor}px`);
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  updateScroll();

  // Subtle mouse parallax on the hero, inspired by the layered portal artwork.
  const hero = $('.sf-hero');
  if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      hero.style.setProperty('--mx', `${x * 18}px`);
      hero.style.setProperty('--my', `${y * 18}px`);
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--mx', '0px');
      hero.style.setProperty('--my', '0px');
    });
  }

  // Hover depth on content cards.
  $$('.sf-news-card,.friend-card,.download-card,.lineup-cards article').forEach(card => {
    card.addEventListener('pointermove', e => {
      if (window.matchMedia('(hover: none)').matches) return;
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -3;
      const ry = ((e.clientX - r.left) / r.width - .5) * 4;
      card.style.setProperty('--rx', `${rx}deg`);
      card.style.setProperty('--ry', `${ry}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  // Smooth anchors with the same fixed-header offset behavior.
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || id === '#') {
      e.preventDefault();
      showToast('Sección preparada para conectar tus funciones.');
      return;
    }
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 54;
    window.scrollTo({ top, behavior: 'smooth' });
  }));

  $('#playDemo')?.addEventListener('click', () => showToast('Reproductor listo para conectar a tus clips.'));



  // Quick-access controls imported from the original Speedy Friends UI.
  const quickRings = $('#quick-rings');
  const quickAccount = $('#quick-account-label');
  const quickTheme = $('#quick-theme-label');
  const quickCart = $('#quick-cart-count');
  let quickState = JSON.parse(localStorage.getItem('sfQuickState') || '{"rings":0,"account":false,"theme":"light","cart":0}');
  const syncQuickState = () => {
    if (quickRings) quickRings.textContent = String(quickState.rings);
    if (quickAccount) quickAccount.textContent = quickState.account ? 'Cuenta activa' : 'Mi cuenta';
    if (quickTheme) quickTheme.textContent = quickState.theme === 'light' ? 'Modo claro' : 'Modo oscuro';
    if (quickCart) quickCart.textContent = String(quickState.cart);
    localStorage.setItem('sfQuickState', JSON.stringify(quickState));
  };
  syncQuickState();

  const quickButtons = $$('.quick-action-card');
  quickButtons.forEach(card => {
    card.addEventListener('pointermove', e => {
      if (window.matchMedia('(hover: none)').matches) return;
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -3.5;
      const ry = ((e.clientX - r.left) / r.width - .5) * 5;
      card.style.setProperty('--qrx', `${rx}deg`);
      card.style.setProperty('--qry', `${ry}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--qrx', '0deg');
      card.style.setProperty('--qry', '0deg');
    });
  });

  document.addEventListener('click', event => {
    const card = event.target.closest('.quick-action-card');
    if (!card) return;
    const action = card.dataset.action;
    card.classList.add('is-active');
    setTimeout(() => card.classList.remove('is-active'), 420);
    if (action === 'rings') {
      showToast(`Tienes ${quickState.rings} Rings.`);
    } else if (action === 'account') {
      quickState.account = !quickState.account;
      showToast(quickState.account ? 'Cuenta activada en esta demo.' : 'Cuenta desconectada.');
    } else if (action === 'admin') {
      showToast('Panel de administración preparado.');
    } else if (action === 'theme') {
      quickState.theme = quickState.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.sfTheme = quickState.theme;
      showToast(quickState.theme === 'dark' ? 'Modo oscuro activado.' : 'Modo claro activado.');
    } else if (action === 'cart') {
      showToast(`Carrito: ${quickState.cart} ${quickState.cart === 1 ? 'elemento' : 'elementos'}.`);
    }
    syncQuickState();
  });

  // Respect accessibility settings: disable non-essential motion.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    body.classList.add('reduce-motion');
  }

  // Team library buttons: same punchy tab treatment, without replacing the page's existing actions.
  $$('.library-tab').forEach((tab, i) => {
    tab.style.setProperty('--library-stagger', `${i * 70}ms`);
    tab.addEventListener('pointermove', e => {
      if (window.matchMedia('(hover: none)').matches) return;
      const r = tab.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -2.8;
      const ry = ((e.clientX - r.left) / r.width - .5) * 4;
      tab.style.setProperty('--lrx', `${rx}deg`);
      tab.style.setProperty('--lry', `${ry}deg`);
      tab.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-9px) skewX(-1deg)`;
    });
    tab.addEventListener('pointerleave', () => {
      tab.style.removeProperty('transform');
      tab.style.setProperty('--lrx', '0deg');
      tab.style.setProperty('--lry', '0deg');
    });
  });

  document.addEventListener('click', event => {
    const tab = event.target.closest('.library-tab');
    if (!tab) return;
    const label = tab.querySelector('.library-tab-title')?.textContent?.trim() || 'Sección';
    $$('.library-tab').forEach(x => x.classList.remove('is-active'));
    tab.classList.add('is-active');
    setTimeout(() => tab.classList.remove('is-active'), 520);
    showToast(`${label} · acceso preparado para conectar al sistema real.`);
  });



  // Hero utility rail: imported navigation buttons, with a single transform system.
  const heroUtilityCards = $$('.hero-utility-card');
  let heroUtilityIndex = 0;
  let heroUtilityTimer = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const activateHeroUtility = (index, announce = false) => {
    if (!heroUtilityCards.length) return;
    heroUtilityIndex = (index + heroUtilityCards.length) % heroUtilityCards.length;
    heroUtilityCards.forEach((card, i) => card.classList.toggle('is-active', i === heroUtilityIndex));
    if (announce) {
      const label = heroUtilityCards[heroUtilityIndex].querySelector('strong')?.textContent?.trim() || 'Sección';
      showToast(`${label} · navegación lista.`);
    }
  };

  heroUtilityCards.forEach((card, i) => {
    card.addEventListener('pointermove', e => {
      if (reducedMotion.matches || window.matchMedia('(hover: none)').matches) return;
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / Math.max(r.height, 1) - .5) * -2.1;
      const ry = ((e.clientX - r.left) / Math.max(r.width, 1) - .5) * 3.4;
      card.style.setProperty('--u-rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--u-ry', `${ry.toFixed(2)}deg`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--u-rx', '0deg');
      card.style.setProperty('--u-ry', '0deg');
    });
    card.addEventListener('click', () => {
      activateHeroUtility(i, true);
      const targetSelector = card.dataset.scrollTarget;
      if (targetSelector) {
        const target = $(targetSelector);
        if (target) {
          const top = target.getBoundingClientRect().top + window.scrollY - 68;
          window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        }
      }
    });
  });

  if (heroUtilityCards.length > 1 && !reducedMotion.matches) {
    heroUtilityTimer = window.setInterval(() => {
      if (document.hidden || body.classList.contains('menu-open')) return;
      activateHeroUtility(heroUtilityIndex + 1, false);
    }, 5200);
  }
  window.addEventListener('beforeunload', () => {
    if (heroUtilityTimer) window.clearInterval(heroUtilityTimer);
  });

})();
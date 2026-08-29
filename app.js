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

  document.addEventListener('speedy:firebase-ready', event => {
    const state = event.detail || {};
    quickState.account = Boolean(state.uid);
    quickState.rings = Number(state.rings || 0);
    syncQuickState();
  });

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



  // Hero utility rail: native links only.
  // All navigation now uses real <a href="..."> links. This code only
  // restores the visual index metadata and never intercepts clicks.
  const heroUtilityCards = $$('.hero-nav-top .hero-utility-card');
  heroUtilityCards.forEach((card, i) => {
    card.style.setProperty('--utility-i', i);
  });
})();

/* Lateral panel: ONLY the five existing Quick Access buttons. */
(() => {
  const rail = document.querySelector('.hero-utility-rail');
  const quickGrid = document.querySelector('#quick-actions .quick-action-grid');
  if (!rail || !quickGrid || document.querySelector('.sf-utility-toggle')) return;

  const body = document.body;
  const track = rail.querySelector('.hero-utility-track');
  if (!track) return;

  // Move the original Quick Access buttons, preserving their exact markup,
  // IDs, styles and listeners already registered by the main app.
  const quickButtons = [...quickGrid.querySelectorAll('.quick-action-card')];
  quickButtons.forEach(button => track.appendChild(button));
  quickGrid.closest('#quick-actions').classList.add('quick-actions-panel-relocated');

  const backdrop = document.createElement('div');
  backdrop.className = 'sf-utility-backdrop';
  backdrop.setAttribute('aria-hidden','true');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sf-utility-toggle';
  toggle.setAttribute('aria-label','Abrir accesos rápidos');
  toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML = '<span></span>';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'sf-utility-panel-close';
  close.setAttribute('aria-label','Cerrar accesos rápidos');
  close.textContent = '×';

  const title = document.createElement('div');
  title.className = 'sf-utility-panel-title';
  title.innerHTML = '<div><p class="eyebrow">05 / QUICK ACCESS</p><strong>Accesos rápidos</strong></div>';

  rail.querySelector('.hero-utility-side')?.remove();
  rail.querySelector('.hero-utility-ghosts')?.remove();
  rail.querySelector('.hero-utility-progress')?.remove();
  rail.insertBefore(close, rail.firstChild);
  rail.insertBefore(title, close.nextSibling);
  body.appendChild(backdrop);
  body.appendChild(toggle);

  // CRITICAL: detach the fixed panel from the hero/animation stacking context.
  // A transformed ancestor can trap a fixed element underneath the backdrop,
  // making the panel look blurred and swallowing pointer events.
  body.appendChild(rail);

  function setOpen(open){
    rail.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar accesos rápidos' : 'Abrir accesos rápidos');
    body.classList.toggle('utility-panel-open', open);
    if(open) close.focus({preventScroll:true});
  }

  toggle.addEventListener('click', () => setOpen(!rail.classList.contains('is-open')));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && rail.classList.contains('is-open')) setOpen(false);
  });

  // Hide the original Quick Access section because its five cards now live here.
  const quickSection = document.querySelector('#quick-actions');
  if (quickSection) quickSection.setAttribute('hidden','');

  // Keep the exact existing Quick Access click handlers; only close the panel after them.
  quickButtons.forEach(card => {
    card.addEventListener('click', () => {
      window.setTimeout(() => setOpen(false), 260);
    }, { passive: true });
  });

  setOpen(false);
})();

/* Open the Quick Access panel from the desktop Accesos link. */
(() => {

  document.querySelectorAll('[data-open-quick-panel]').forEach(link => {
    link.addEventListener('click', e => {
      const panelToggle = document.querySelector('.sf-utility-toggle');
      const rail = document.querySelector('.hero-utility-rail');
      if (!panelToggle || !rail) return;
      e.preventDefault();
      if (!rail.classList.contains('is-open')) panelToggle.click();
    });
  });
})();


/* Hero CTA interactions — shared motion, no transform conflicts with the page. */
(() => {
  const buttons = [...document.querySelectorAll('.sf-btn-animated')];
  if (!buttons.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  buttons.forEach((button, index) => {
    button.style.setProperty('--cta-delay', `${index * 90}ms`);

    button.addEventListener('pointermove', event => {
      if (reduced.matches || window.matchMedia('(hover: none)').matches) return;
      const rect = button.getBoundingClientRect();
      const px = (event.clientX - rect.left) / Math.max(rect.width, 1) - .5;
      const py = (event.clientY - rect.top) / Math.max(rect.height, 1) - .5;
      button.style.setProperty('--cta-rx', `${(-py * 2.4).toFixed(2)}deg`);
      button.style.setProperty('--cta-ry', `${(px * 3.6).toFixed(2)}deg`);
      button.style.setProperty('--cta-tx', `${(px * 2.2).toFixed(1)}px`);
    }, {passive:true});

    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--cta-rx', '0deg');
      button.style.setProperty('--cta-ry', '0deg');
      button.style.setProperty('--cta-tx', '0px');
    });

    button.addEventListener('click', () => {
      button.classList.remove('is-pulse');
      void button.offsetWidth;
      button.classList.add('is-pulse');

      const targetSelector = button.getAttribute('href');
      const target = targetSelector ? document.querySelector(targetSelector) : null;
      if (target) {
        target.classList.remove('sf-cta-focus');
        window.setTimeout(() => target.classList.add('sf-cta-focus'), 180);
        window.setTimeout(() => target.classList.remove('sf-cta-focus'), 980);
      }
    });
  });
})();



/* USER RINGS SYNC */

/* Dark-mode rail sync */
(() => {
  const applyTheme = () => {
    const raw = document.documentElement.dataset.sfTheme || 'light';
    const dark = raw === 'dark';
    document.querySelector('.hero-utility-rail')?.classList.toggle('theme-dark', dark);
    document.querySelector('.sf-utility-panel')?.classList.toggle('theme-dark', dark);
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, {attributes:true,attributeFilter:['data-sf-theme']});
})();

  // bfcache/back-forward restore: the page can return with the loader still visible.
  window.addEventListener('pageshow', () => {
    const pageLoader = document.querySelector('.sf-page-loader');
    if (!pageLoader) return;
    pageLoader.classList.add('is-hidden');
    pageLoader.setAttribute('aria-hidden', 'true');
    pageLoader.setAttribute('aria-busy', 'false');
    if (window.__sfLoaderHideTimer) {
      clearTimeout(window.__sfLoaderHideTimer);
      window.__sfLoaderHideTimer = null;
    }
  });

/* ===== Global Dark Mode controller v45 ===== */
(() => {
  const root=document.documentElement;
  const KEY='sfTheme';
  const read=()=>{try{return localStorage.getItem(KEY)||'light'}catch{return'light'}};
  const apply=value=>{
    const v=value==='dark'?'dark':'light';
    root.setAttribute('data-sf-theme',v);
    document.body?.classList.toggle('theme-dark',v==='dark');
    document.querySelectorAll('[data-theme-label],#quick-theme-label,#index-theme-label').forEach(el=>el.textContent=v==='dark'?'MODO CLARO':'MODO OSCURO');
    try{localStorage.setItem(KEY,v)}catch{}
  };
  const toggle=()=>apply(root.getAttribute('data-sf-theme')==='dark'?'light':'dark');
  apply(read());
  window.sfDarkMode={apply,toggle,get:()=>root.getAttribute('data-sf-theme')||'light'};
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-theme-toggle],#theme-toggle,.theme-toggle,[data-action="theme"]');
    if(b){e.preventDefault();toggle();}
  });
})();

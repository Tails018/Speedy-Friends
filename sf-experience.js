/* Speedy Friends — capa de experiencia compartida (sin dependencias).
 * Cargar en <head> sin defer: fija html[data-sf-fx] antes del primer pintado para
 * que las transiciones entre páginas y el CSS respeten el modo elegido.
 * Expone window.SFExperience = {get, set} para el interruptor de efectos. */
(() => {
  'use strict';
  const root = document.documentElement;
  const KEY = 'sfFx';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = value => { try { value ? localStorage.setItem(KEY, value) : localStorage.removeItem(KEY); } catch {} };
  // Modo automático: ligero en equipos modestos, ahorro de datos o movimiento reducido.
  const autoLite = () => reduced.matches || navigator.connection?.saveData === true ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  const resolve = () => { const saved = read(); return saved === 'lite' || saved === 'full' ? saved : (autoLite() ? 'lite' : 'full'); };
  // Sesión recordada: la portada se muestra sin la pantalla «Comprobando sesión» (ver index.html).
  try { if (localStorage.getItem('sfAuthHint') === '1') root.classList.add('sf-auth-hint'); } catch {}
  const listeners = new Set();
  const apply = () => { root.dataset.sfFx = resolve(); listeners.forEach(fn => fn(root.dataset.sfFx)); };
  apply();
  reduced.addEventListener?.('change', apply);
  window.SFExperience = {
    get: () => root.dataset.sfFx,
    set: mode => { write(mode === 'lite' || mode === 'full' ? mode : null); apply(); },
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); }
  };

  const init = () => {
    const vh = () => window.innerHeight || document.documentElement.clientHeight;

    // Barra de velocidad: una sola escritura de custom property por frame.
    const hero = document.querySelector('.sf-hero');
    const bar = document.createElement('div');
    bar.className = 'sf-speedbar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let frame = 0;
    const paint = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - vh();
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.setProperty('--sf-progress', p.toFixed(4));
      bar.classList.toggle('is-on', window.scrollY > 24);
      if (hero && window.scrollY < vh() * 1.5 && root.dataset.sfFx !== 'lite' && !reduced.matches) {
        hero.style.setProperty('--sf-hero-y', `${(window.scrollY * 0.12).toFixed(1)}px`);
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    paint();

    // Aparición progresiva para secciones bajo el pliegue que aún no tienen sistema propio.
    if ('IntersectionObserver' in window && !reduced.matches) {
      const limit = vh() * 1.05;
      const candidates = [...document.querySelectorAll('main > section, main > article, body > section, .section, .sf-section')]
        .filter(el => !el.classList.contains('reveal') && !el.closest('.reveal') && !el.hidden && el.getBoundingClientRect().top > limit);
      if (candidates.length) {
        const io = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          });
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
        candidates.forEach(el => { el.classList.add('sf-x-reveal'); io.observe(el); });
        // Navegación por ancla o impresión: nunca dejar contenido oculto.
        const showAll = () => candidates.forEach(el => el.classList.add('is-in'));
        addEventListener('hashchange', showAll, { once: true });
        addEventListener('beforeprint', showAll, { once: true });
      }
    }

    // Anillos y estelas del hero de portada: decorativos, pausados fuera de pantalla.
    if (hero && !hero.querySelector('.sf-rings')) {
      const rings = document.createElement('div');
      rings.className = 'sf-rings';
      rings.setAttribute('aria-hidden', 'true');
      rings.innerHTML = [
        ['8%', '62%', '44px', '.9', '0s'], ['46%', '30%', '34px', '-1.2', '-.4s'],
        ['58%', '78%', '28px', '1.4', '-.8s'], ['88%', '46%', '52px', '-.7', '-1.1s'], ['72%', '18%', '24px', '1.8', '-.2s']
      ].map(([x, y, size, depth, delay]) => `<span class="sf-ring" style="--x:${x};--y:${y};--size:${size};--depth:${depth};--spin-delay:${delay}"></span>`).join('');
      const streaks = document.createElement('div');
      streaks.className = 'sf-streaks';
      streaks.setAttribute('aria-hidden', 'true');
      streaks.innerHTML = [
        ['22%', '2.4s', '0s', 'rgba(31,91,255,.45)'], ['41%', '3.1s', '-1.3s', 'rgba(239,38,63,.4)'],
        ['67%', '2.7s', '-.6s', 'rgba(31,91,255,.35)'], ['84%', '3.4s', '-2s', 'rgba(247,197,72,.5)']
      ].map(([t, d, w, c]) => `<i style="--t:${t};--d:${d};--w:${w};--c:${c}"></i>`).join('');
      hero.prepend(streaks, rings);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => hero.classList.toggle('sf-fx-paused', !entry.isIntersecting)).observe(hero);
      }
      document.addEventListener('visibilitychange', () => hero.classList.toggle('sf-fx-paused', document.hidden));
    }

    // Interruptor de efectos: en el panel «Accesos» (visible en todos los anchos) o,
    // si la página no lo tiene, junto al botón de tema. No altera el botón de tema.
    const themeToggle = document.querySelector('[data-theme-toggle]');
    if ((themeToggle || document.querySelector('.hero-utility-rail')) && !document.querySelector('.sf-fx-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sf-fx-toggle';
      button.innerHTML = '<span class="sf-fx-dot" aria-hidden="true"></span><b></b>';
      const sync = mode => {
        const lite = mode === 'lite';
        button.setAttribute('aria-pressed', String(lite));
        button.setAttribute('aria-label', lite ? 'Efectos ligeros activados. Activar efectos completos' : 'Efectos completos activados. Activar efectos ligeros');
        button.querySelector('b').textContent = lite ? 'Efectos ligeros' : 'Efectos completos';
      };
      button.addEventListener('click', () => window.SFExperience.set(window.SFExperience.get() === 'lite' ? 'full' : 'lite'));
      window.SFExperience.onChange(sync);
      sync(window.SFExperience.get());
      const mount = () => {
        const panelTitle = document.querySelector('.hero-utility-rail .sf-utility-panel-title');
        if (panelTitle) { panelTitle.appendChild(button); return true; }
        if (!button.isConnected && themeToggle) themeToggle.insertAdjacentElement('afterend', button);
        return false;
      };
      // El panel lo construye app.js; si aún no existe, se reintenta al terminar la carga.
      if (!mount()) addEventListener('load', mount, { once: true });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

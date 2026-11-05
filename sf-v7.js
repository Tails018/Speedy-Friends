/* Speedy Friends V7 — movimiento con significado.
 * Ranking: cuando Firebase cambia los Rings, las tarjetas existentes se deslizan desde su posición
 * anterior hasta la nueva (FLIP, solo transform) y el número de Rings late en dorado. No reconstruye
 * nada: Ranking ya conserva y reordena los mismos nodos. Se desactiva con movimiento reducido y en el
 * modo ligero de sf-experience (equipos modestos o ahorro de datos). */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lite = () => reduced.matches || document.documentElement.dataset.sfFx === 'lite';
  const LISTS = '.special-ranking-list, #member-ranking-list';

  function watchList(list) {
    if (list.__sf7) return; list.__sf7 = true;
    const last = new Map(); // profileId → {top, rings, position} (syncCards puede sustituir el nodo)
    const snapshot = () => {
      for (const row of list.querySelectorAll(':scope > [data-profile-id]')) {
        last.set(row.dataset.profileId, { top: row.offsetTop, rings: row.dataset.rings, position: Number(row.dataset.position || 0) });
      }
    };
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const animate = !lite() && !document.hidden;
        for (const row of list.querySelectorAll(':scope > [data-profile-id]')) {
          const before = last.get(row.dataset.profileId);
          if (!before) continue;
          const now = row.offsetTop;
          const dy = before.top - now;
          if (animate && Math.abs(dy) > 2 && row.animate) {
            row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
          }
          if (before.rings !== row.dataset.rings) {
            const strong = row.querySelector('.rank-rings strong');
            if (strong && animate) { strong.classList.remove('sf7-bump'); void strong.offsetWidth; strong.classList.add('sf7-bump'); }
            const pos = Number(row.dataset.position || 0);
            if (animate && pos && before.position && pos < before.position) { row.classList.remove('sf7-up'); void row.offsetWidth; row.classList.add('sf7-up'); }
          }
        }
        snapshot();
      });
    };
    new MutationObserver(onChange).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-rings', 'data-position'] });
    list.addEventListener('animationend', e => e.target.classList.remove('sf7-bump', 'sf7-up'));
    snapshot();
  }

  function init() {
    document.querySelectorAll(LISTS).forEach(watchList);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

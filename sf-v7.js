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

/* V7.1 · Tamaño mínimo de lectura en móvil.
 * Muchas etiquetas heredadas usan 9–10 px. En pantallas estrechas se suben a 12 px y se reduce su
 * interletrado para que no se corten. Solo procesa los nodos nuevos y en tiempo libre. */
(() => {
  const narrow = window.matchMedia('(max-width: 760px)');
  const MIN = 12;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 32));
  const pending = new Set();
  let scheduled = false;
  function fix(el) {
    if (!(el instanceof HTMLElement) || el.dataset.sf7Read || el.closest('svg,[aria-hidden="true"]')) return;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    if (!(size > 0 && size < MIN)) return;
    el.dataset.sf7Read = '1';
    el.style.setProperty('font-size', MIN + 'px', 'important');
    const ls = parseFloat(cs.letterSpacing);
    if (ls > size * 0.06) el.style.setProperty('letter-spacing', '.06em', 'important');
  }
  function flush(deadline) {
    scheduled = false;
    for (const root of pending) {
      pending.delete(root);
      if (!root.isConnected) continue;
      fix(root);
      root.querySelectorAll?.('*').forEach(fix);
      if (deadline?.timeRemaining && deadline.timeRemaining() < 2) break;
    }
    if (pending.size) schedule();
  }
  function schedule() { if (!scheduled) { scheduled = true; idle(flush, { timeout: 300 }); } }
  function queue(node) { if (narrow.matches && node instanceof HTMLElement) { pending.add(node); schedule(); } }
  function start() {
    queue(document.body);
    new MutationObserver(list => { for (const m of list) m.addedNodes.forEach(queue); }).observe(document.body, { childList: true, subtree: true });
    narrow.addEventListener('change', () => queue(document.body));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();

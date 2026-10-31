/* Shared loader lifecycle. Presentation only: authentication stays in its existing gate.
 * La pantalla completa «CARGANDO» ya no se muestra (ni al abrir ni al navegar): las páginas
 * aparecen en cuanto están listas. sfShowLoader/sfHideLoader se conservan para quien los llame,
 * pero solo encienden/apagan una barra fina de progreso (html.sf-navigating). */
(() => {
  const loader = document.getElementById('sf-page-loader');
  if (window.__sfLoaderBound) return;
  window.__sfLoaderBound = true;
  const root = document.documentElement;
  if (loader) {
    loader.classList.add('is-hidden');
    loader.setAttribute('aria-hidden', 'true');
    loader.setAttribute('aria-busy', 'false');
  }
  const bar = () => {
    let el = document.querySelector('.sf-nav-progress');
    if (!el && document.body) {
      el = document.createElement('div');
      el.className = 'sf-nav-progress';
      el.setAttribute('role', 'progressbar');
      el.setAttribute('aria-label', 'Cargando');
      document.body.appendChild(el);
    }
    return el;
  };
  let safety;
  window.sfShowLoader = () => {
    bar();
    root.classList.add('sf-navigating');
    // Si la navegación se cancela (p. ej. descarga o error), la barra no queda encendida.
    clearTimeout(safety);
    safety = setTimeout(() => root.classList.remove('sf-navigating'), 8000);
  };
  window.sfHideLoader = () => { clearTimeout(safety); root.classList.remove('sf-navigating'); };
  // Al volver con el botón Atrás (bfcache) la página no debe quedar en estado de navegación.
  window.addEventListener('pageshow', window.sfHideLoader);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('.html') || (url.pathname === location.pathname && url.search === location.search)) return;
    window.sfShowLoader();
  });
})();

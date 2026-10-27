/* Shared loader lifecycle. Presentation only: authentication stays in its existing gate. */
(() => {
  const loader = document.getElementById('sf-page-loader');
  if (!loader || window.__sfLoaderBound) return;
  window.__sfLoaderBound = true;
  const title = document.getElementById('sf-loader-title');
  const subtitle = document.getElementById('sf-loader-subtitle');
  const names = {'index.html':'INICIO','profile.html':'PERFIL','ost.html':'AUDIO / OST','ranking.html':'RANKING','admin.html':'ADMIN','admin-role.html':'STAFF ADMIN','fanarts.html':'FANARTS'};
  let shownAt = performance.now(), timer;
  const hide = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      loader.classList.add('is-hidden');
      loader.setAttribute('aria-hidden','true');
      loader.setAttribute('aria-busy','false');
    }, Math.max(0, 520 - (performance.now() - shownAt)));
  };
  window.sfShowLoader = (page='PÁGINA', sub='Preparando la página…') => {
    clearTimeout(timer);
    shownAt = performance.now();
    loader.classList.remove('is-hidden');
    loader.setAttribute('aria-hidden','false');
    loader.setAttribute('aria-busy','true');
    if (title) title.textContent = page;
    if (subtitle) subtitle.textContent = sub;
  };
  window.sfHideLoader = hide;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide, {once:true});
  else hide();
  window.addEventListener('pageshow', hide);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('.html') || (url.pathname === location.pathname && url.search === location.search)) return;
    window.sfShowLoader(names[url.pathname.split('/').pop()] || 'PÁGINA');
  });
})();

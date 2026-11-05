/* Aplica la identidad guardada desde Admin › Identidad (siteSettings) a la portada.
 * Lectura única y pequeña; las reglas de referencia exigen sesión para leerla. */
(() => {
  const apply = v => {
    const title = String(v?.title || '').trim().slice(0, 60);
    const subtitle = String(v?.subtitle || '').trim().slice(0, 100);
    const eyebrow = document.querySelector('.sf-hero .eyebrow');
    if (eyebrow && subtitle) eyebrow.textContent = `SPEEDY FRIENDS / ${subtitle.toUpperCase()}`;
    const foot = document.querySelector('.sf-footer > div:nth-child(2)');
    if (foot && title) foot.textContent = `© ${new Date().getFullYear()} ${title}`;
  };
  let done = false;
  const load = () => {
    const sf = window.SpeedyFirebase;
    if (done || !sf?.refs?.siteSettings || !sf.auth?.currentUser) return;
    done = true;
    sf.refs.siteSettings.once('value').then(snap => apply(snap.val()), () => { done = false; });
  };
  document.addEventListener('speedy:firebase-ready', load);
  window.SpeedyFirebase?.auth?.onAuthStateChanged(user => { if (user) load(); });
})();

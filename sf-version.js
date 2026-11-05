/* Generado por scripts/stamp-version.mjs: no editar a mano. */
(() => {
  const build = Object.freeze({ version: "7.1.0", commit: "6b7cf14", date: "2026-11-05" });
  window.SF_BUILD = build;
  document.documentElement.dataset.sfBuild = build.version + '+' + build.commit;
  const mark = () => {
    if (document.getElementById('sf-build-tag')) return;
    const tag = document.createElement('p');
    tag.id = 'sf-build-tag';
    tag.className = 'sf-build-tag';
    tag.textContent = 'Speedy Friends v' + build.version + ' · ' + build.commit;
    document.body.appendChild(tag);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark, { once: true }); else mark();
})();

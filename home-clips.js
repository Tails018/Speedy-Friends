/* Sección «En movimiento» de la portada: muestra los edits de video publicados en Fanarts.
 * No abre otra suscripción: escucha el evento speedy:fanarts-updated que emite fanarts-system.js
 * con la misma lista que ya descarga la galería. Sin videos muestra un estado honesto con enlace
 * a publicar, nunca un reproductor simulado. */
(() => {
  const section = document.getElementById('videos');
  if (!section) return;
  const copy = section.querySelector('.video-copy');
  const preview = section.querySelector('.video-preview');
  const playBtn = document.getElementById('playDemo');
  if (!copy || !preview || !playBtn) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = v => /^(https:\/\/|assets\/|\.\/assets\/)/i.test(String(v || '')) ? String(v) : '';
  const lead = copy.querySelector('p:not(.eyebrow)');
  const originalPreview = preview.innerHTML;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let clips = [], current = 0, status = 'loading';
  const list = document.createElement('div');
  list.className = 'sf-clip-list';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Elegir clip');
  copy.appendChild(list);
  const live = document.createElement('p');
  live.className = 'sf-visually-hidden';
  live.setAttribute('aria-live', 'polite');
  copy.appendChild(live);

  function setPlayLabel(text, icon) {
    playBtn.setAttribute('aria-label', text);
    playBtn.textContent = icon;
  }

  function renderEmpty() {
    preview.classList.remove('has-clip');
    preview.innerHTML = originalPreview;
    list.innerHTML = '';
    section.dataset.clips = status;
    if (status === 'guest') {
      lead.textContent = 'Inicia sesión para ver los edits en video que publica el team.';
      setPlayLabel('Iniciar sesión para ver los clips', '▶');
    } else if (status === 'error' || status === 'denied') {
      lead.textContent = 'No se pudieron cargar los clips. Revisa tu conexión e inténtalo desde Fanarts.';
      setPlayLabel('Abrir Fanarts', '↗');
    } else if (status === 'loading') {
      lead.textContent = 'Cargando los edits del team…';
      setPlayLabel('Cargando clips', '▶');
    } else {
      lead.textContent = 'Aún no hay edits en video. Sube uno en Fanarts › Edits y se mostrará aquí para todo el team.';
      setPlayLabel('Publicar un edit en Fanarts', '＋');
    }
  }

  function renderClip(index, { announce = false } = {}) {
    const clip = clips[index];
    if (!clip) return renderEmpty();
    current = index;
    section.dataset.clips = 'ready';
    preview.classList.add('has-clip');
    const src = safeUrl(clip.image);
    preview.innerHTML = `<video src="${esc(src)}" preload="metadata" playsinline muted loop controls aria-label="${esc(clip.title || 'Clip del team')}"></video><span>${esc(clip.title || 'Clip del team')} · ${esc(clip.authorName || 'Speedy Friends')}</span>`;
    lead.textContent = `${clips.length} ${clips.length === 1 ? 'edit publicado' : 'edits publicados'} por el team. Elige uno o abre la galería completa.`;
    setPlayLabel(`Reproducir «${clip.title || 'clip'}»`, '▶');
    list.innerHTML = clips.slice(0, 4).map((c, i) => `<button type="button" class="sf-clip-chip${i === index ? ' is-active' : ''}" data-clip="${i}" aria-pressed="${i === index}">${esc(c.title || 'Clip')}</button>`).join('');
    if (announce) live.textContent = `Clip seleccionado: ${clip.title || 'clip'}`;
    const video = preview.querySelector('video');
    video?.addEventListener('play', () => setPlayLabel(`Pausar «${clip.title || 'clip'}»`, '❚❚'));
    video?.addEventListener('pause', () => setPlayLabel(`Reproducir «${clip.title || 'clip'}»`, '▶'));
    video?.addEventListener('error', () => { lead.textContent = 'Este clip no se puede reproducir ahora. Prueba otro o ábrelo en Fanarts.'; });
  }

  list.addEventListener('click', e => {
    const chip = e.target.closest('[data-clip]');
    if (chip) renderClip(Number(chip.dataset.clip), { announce: true });
  });

  playBtn.addEventListener('click', e => {
    e.preventDefault();
    const video = preview.querySelector('video');
    if (video) {
      if (video.paused) video.play().catch(() => { lead.textContent = 'El navegador bloqueó la reproducción. Usa los controles del video.'; });
      else video.pause();
      return;
    }
    if (status === 'guest') { document.querySelector('[data-auth-login],#sf-auth-login,.sf-auth-login')?.click(); document.getElementById('top')?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' }); return; }
    location.href = status === 'empty' ? 'fanarts.html#fanartUploadForm' : 'fanarts.html';
  });

  document.addEventListener('speedy:fanarts-updated', e => {
    const detail = e.detail || {};
    status = detail.status === 'ready' ? 'empty' : (detail.status || 'error');
    const next = (detail.list || [])
      .filter(a => a && a.mediaType === 'video' && a.published !== false && safeUrl(a.image))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const keepId = clips[current]?.id;
    clips = next;
    if (!clips.length) return renderEmpty();
    const keep = clips.findIndex(c => c.id === keepId);
    // Si el clip visible sigue existiendo no se reconstruye el reproductor (no corta la reproducción).
    if (keep >= 0 && preview.querySelector('video') && keep === current) {
      list.innerHTML = clips.slice(0, 4).map((c, i) => `<button type="button" class="sf-clip-chip${i === keep ? ' is-active' : ''}" data-clip="${i}" aria-pressed="${i === keep}">${esc(c.title || 'Clip')}</button>`).join('');
      return;
    }
    renderClip(keep >= 0 ? keep : 0);
  });

  renderEmpty();
})();

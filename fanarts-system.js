(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SF = () => window.SpeedyFirebase;
  const teamRoot = () => SF()?.refs?.root;
  const initials = v => String(v || 'SF').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'SF';


  const state = {arts:{}, liked:{}, filter:'Todos', sort:'likes', search:'', ready:false, uid:'', modalId:null, unsub:null};
  const cards = () => $('#fanartGrid');
  const homeCards = () => $('#homeFanartGrid');
  const sourceList = () => Object.values(state.arts);
  const sfIsOwner = a => Boolean(SF()?.current?.uid && a && !String(a.id).startsWith('demo-') && a.ownerUid === SF().current.uid);
  const likeCount = a => Object.prototype.hasOwnProperty.call(a || {}, 'likes') ? Object.keys(a.likes || {}).length : Number(a?.likeCount || 0);
  const filtered = list => {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const q = normalize(state.search.trim());
    return list.filter(a => state.filter === 'Todos' || a.category === state.filter)
      .filter(a => !q || normalize(`${a.title} ${a.description} ${a.authorName} ${a.category}`).includes(q))
      .sort((a,b) => state.sort === 'likes' ? likeCount(b)-likeCount(a) : Number(b.createdAt||0)-Number(a.createdAt||0));
  };
  const mediaMarkup = (a, cls='fanart-image') => a.mediaType === 'video'
    ? `<video class="${cls}" src="${esc(a.image)}" muted loop playsinline preload="none"></video><span class="fanart-video-badge">▶ EDIT</span>`
    : `<img class="${cls}" src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">`;

  let visibleCount=12, previewUrl=null, modalOpener=null;
  // Galería sin tarjetas: cargando, error, vacía o sin coincidencias (nunca contenido inventado).
  function galleryState(hasArts){
    if (state.guest) return '<div class="fanart-empty" role="status"><strong>La galería es del team.</strong><span>Inicia sesión para ver, publicar y dar like a los fanarts.</span><a class="fanart-submit" href="index.html">Iniciar sesión</a></div>';
    if (state.failed) return '<div class="fanart-empty is-error" role="status"><strong>No se pudo cargar la galería.</strong><span>'+esc(state.failed)+'</span><button type="button" class="fanart-submit" data-fanart-retry>Reintentar</button></div>';
    if (!state.loaded) return Array.from({length:6},()=>'<article class="fanart-card fanart-skeleton" aria-hidden="true"><div class="fanart-skeleton-media"></div><div class="fanart-copy"><i></i><i></i><i></i></div></article>').join('');
    if (hasArts) return '<div class="fanart-empty" role="status"><strong>No encontramos fanarts.</strong><span>Prueba otro filtro u otra búsqueda.</span></div>';
    return '<div class="fanart-empty" role="status"><strong>Todavía no hay fanarts publicados.</strong><span>Sube el primero: aparecerá aquí para todo el team.</span><a class="fanart-submit" href="#fanartUploadForm">Publicar un fanart</a></div>';
  }
  function render(list) {
    const el = cards(); if (!el) return;
    const all = filtered(list);
    const items = all.slice(0,visibleCount);
    el.setAttribute('aria-busy', String(!state.loaded && !state.failed));
    if (!items.length) {
      const more=$('#fanartLoadMore');if(more)more.hidden=true;
      el.innerHTML = galleryState(list.length > 0);
      return;
    }
    el.innerHTML = items.map((a,i) => `
      <article class="fanart-card" data-id="${esc(a.id)}" style="animation-delay:${Math.min(i*45,450)}ms">
        <button class="fanart-open" type="button" aria-label="Ver ${esc(a.title)}">
          ${mediaMarkup(a)}
          <span class="fanart-index">${String(i+1).padStart(2,'0')}</span>
          <span class="fanart-ribbon">FEATURED</span>
        </button>
        <div class="fanart-copy">
          <div class="fanart-tag">${esc(a.category || 'Digital')}</div>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.description || 'Sin descripción.')}</p>
          <div class="fanart-author">
            <div class="fanart-avatar">${a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc(initials(a.authorName))}</div>
            <div class="fanart-author-copy"><strong>${esc(a.authorName || 'Integrante')}</strong><span>${a.createdAt ? new Date(a.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : 'Galería'}</span></div>
            <button class="fanart-like ${state.liked[a.id]?'is-liked':''}" data-like="${esc(a.id)}" type="button" aria-label="Dar like"><span>♥</span><b>${likeCount(a)}</b></button></div>
          ${sfIsOwner(a) ? `<div class="fanart-owner-tools"><button type="button" data-edit="${esc(a.id)}">EDITAR</button><button type="button" data-delete="${esc(a.id)}">ELIMINAR</button></div>` : ''}
        </div>
      </article>`).join('');
    let more=$('#fanartLoadMore');
    if(!more){more=document.createElement('button');more.id='fanartLoadMore';more.type='button';more.className='fanart-submit';more.textContent='Cargar más fanarts';el.after(more);more.addEventListener('click',()=>{visibleCount+=12;render(sourceList());});}
    more.hidden=items.length>=all.length;
    bindTilt(el);
    $$('video', el).forEach(v => { v.addEventListener('mouseenter',()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)v.play().catch(()=>{});}, {passive:true}); v.addEventListener('mouseleave',()=>{v.pause(); v.currentTime=0;}, {passive:true}); });
  }

  // La portada pinta #homeFanartGrid con su propio script (index.html, sf-home-fanarts-live).
  function renderHome() {}

  function showModal(a) {
    const m = $('#fanartModal'); if (!m) return;
    modalOpener=document.activeElement;
    $('#modalTitle').textContent = a.title || 'Fanart';
    $('#modalDescription').textContent = a.description || '';
    $('#modalAuthor').textContent = a.authorName || 'Integrante';
    $('#modalCategory').textContent = a.category || 'Digital';
    $('#modalFormat').textContent = a.mediaType === 'video' ? 'VIDEO EDIT' : 'IMAGEN';
    $('#modalLikes').textContent = String(likeCount(a));
    const av = $('#modalAvatar'); av.innerHTML = a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc(initials(a.authorName));
    const media = $('#modalMedia');
    media.innerHTML = a.mediaType === 'video' ? `<video src="${esc(a.image)}" controls autoplay playsinline></video>` : `<img src="${esc(a.image)}" alt="${esc(a.title)}">`;
    m.classList.add('is-open'); m.setAttribute('aria-hidden','false'); state.modalId = a.id; document.body.classList.add('fanart-modal-open');
    m.querySelector('button[data-fanart-close]')?.focus();
  }
  function closeModal(){const m=$('#fanartModal');if(!m)return;m.classList.remove('is-open');m.setAttribute('aria-hidden','true');state.modalId=null;document.body.classList.remove('fanart-modal-open');$('#modalMedia').innerHTML='';if(modalOpener?.isConnected)modalOpener.focus();}

  function loadLikes(uid, arts) {
    if (!uid) return;
    for (const a of arts) state.liked[a.id] = Boolean(a?.likes && a.likes[uid]);
  }
  async function toggleLike(id) {
    const sf = SF(); if (!sf?.current?.uid) { sf?.signInGoogle?.(); return; }
    if (String(id).startsWith('demo-')) { alert('Los fanarts de ejemplo son solo una vista previa. Publica el tuyo para recibir likes.'); return; }
    const ref = teamRoot().child('fanarts').child(id), uid = sf.current.uid, likeRef = ref.child('likes').child(uid);
    const snap = await likeRef.once('value');
    if (snap.exists()) { await likeRef.remove(); state.liked[id]=false; } else { await likeRef.set(true); state.liked[id]=true; }
  }
  const CLOUDINARY = {
    cloudName: 'qgf6z2er',
    uploadPreset: 'speedy_friends_ost',
    folder: 'speedy-friends/fanarts'
  };

  async function uploadToCloudinary(file, uid, id){
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY.uploadPreset);
    form.append('folder', CLOUDINARY.folder);
    form.append('public_id', `${uid}-${id}`);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`, { method:'POST', body:form });
    const payload = await response.json().catch(()=>({}));
    if(!response.ok || !payload.secure_url) {
      throw new Error(payload?.error?.message || 'Cloudinary no pudo subir el archivo. Revisa el upload preset.');
    }
    return payload;
  }

  async function deleteCloudinaryByToken(token){
    if(!token) return false;
    try{
      const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/delete_by_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})});
      return r.ok;
    }catch{return false;}
  }

  async function upload(file,title,description,category){
    const sf=SF();
    if(!sf?.current?.uid) throw new Error('Inicia sesión para publicar un fanart.');
    const isVideo=file.type.startsWith('video/');
    if(isVideo && category!=='Edits') throw new Error('Los videos solo pueden publicarse en la categoría Edits.');
    if(!isVideo && !file.type.startsWith('image/')) throw new Error('Selecciona una imagen o video válido.');
    if(file.size > (isVideo?40:10)*1024*1024) throw new Error(isVideo?'El video debe pesar 40 MB o menos.':'La imagen debe pesar 10 MB o menos.');
    const id=teamRoot().child('fanarts').push().key;
    const uploaded=await uploadToCloudinary(file,sf.current.uid,id);
    const p=sf.current.profile||{};
    const data={id,ownerUid:sf.current.uid,profileId:sf.current.profileId||'',authorName:p.nickname||p.username||p.name||sf.current.email.split('@')[0],avatar:p.avatar||'',title:title.trim(),description:description.trim(),category,mediaType:isVideo?'video':'image',image:uploaded.secure_url,cloudinaryPublicId:uploaded.public_id||'',cloudinaryDeleteToken:uploaded.delete_token||'',createdAt:firebase.database.ServerValue.TIMESTAMP,likes:{}};
    await teamRoot().child('fanarts').child(id).set(data); return data;
  }
  async function editFanart(id){
    const sf=SF(), a=state.arts[id];
    if(!sf?.current?.uid || !a || !sfIsOwner(a)) throw new Error('Solo puedes editar tus propios fanarts.');
    const title=prompt('Título del fanart:', a.title||''); if(title===null) return;
    const description=prompt('Descripción:', a.description||''); if(description===null) return;
    const category=prompt('Categoría (Digital, Dibujos, Renders, Edits o Tradicional):', a.category||'Digital'); if(category===null) return;
    const allowed=['Digital','Dibujos','Renders','Edits','Tradicional'];
    if(!allowed.includes(category)) throw new Error('Categoría no válida.');
    if(!title.trim()) throw new Error('El título no puede estar vacío.');
    await teamRoot().child('fanarts').child(id).update({title:title.trim().slice(0,70),description:description.trim().slice(0,220),category});
  }

  async function deleteFanart(id){
    const sf=SF(), a=state.arts[id];
    if(!sf?.current?.uid || !a || !sfIsOwner(a)) throw new Error('Solo puedes eliminar tus propios fanarts.');
    if(!confirm(`¿Eliminar “${a.title||'este fanart'}”? Esta acción no se puede deshacer.`)) return;
    await teamRoot().child('fanarts').child(id).remove();
    if(a.cloudinaryDeleteToken) await deleteCloudinaryByToken(a.cloudinaryDeleteToken);
  }

  let renderFrame = 0;
  function scheduleRender(){
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      const list = Object.values(state.arts);
      if (state.uid) loadLikes(state.uid, list);
      render(list);
      renderHome(list);
    });
  }

  function subscribe(){
    const sf=SF(); if(!sf?.refs?.root)return; state.unsub?.();
    const ref=teamRoot().child('fanarts');
    const handler=snap=>{ state.arts=snap.val()||{}; state.loaded=true; state.failed=''; scheduleRender(); };
    const fail=error=>{ console.warn('[Fanarts]',error); state.failed=/permission/i.test(String(error?.code||error?.message||''))?'Inicia sesión para ver la galería del team.':'Revisa tu conexión y vuelve a intentarlo.'; render(sourceList()); };
    ref.on('value', handler, fail);
    state.unsub=()=>ref.off('value',handler);
  }

  // CSS handles the hover depth; avoiding per-pointermove JS keeps large galleries smooth.
  function bindTilt(){ return; }
  function previewFile(file){
    const box=$('#fanartFilePreview'), label=$('#fanartFileLabel'); if(!box||!label)return;
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
    if(!file){box.style.display='none';box.innerHTML='';label.textContent='ARRASTRA TU ARTE AQUÍ';return;}
    previewUrl=URL.createObjectURL(file);
    label.textContent=file.name.length>34?file.name.slice(0,31)+'…':file.name; box.style.display='block'; box.innerHTML=file.type.startsWith('video/')?`<video src="${previewUrl}" muted autoplay loop></video>`:`<img src="${previewUrl}" alt="">`;
  }
  function bind(){
    $$('.fanart-filter').forEach(b=>b.addEventListener('click',()=>{$$('.fanart-filter').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');visibleCount=12;state.filter=b.dataset.filter;$$('.fanart-filter').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render(sourceList());}));
    $('#fanartSort')?.addEventListener('change',e=>{visibleCount=12;state.sort=e.target.value;render(sourceList());});
    let searchTimer=null; $('#fanartSearch')?.addEventListener('input',e=>{visibleCount=12;state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>render(sourceList()),120);});
    cards()?.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit){e.stopPropagation();editFanart(edit.dataset.edit).catch(err=>alert(err.message||'No se pudo editar.'));return;}const del=e.target.closest('[data-delete]');if(del){e.stopPropagation();deleteFanart(del.dataset.delete).catch(err=>alert(err.message||'No se pudo eliminar.'));return;}const like=e.target.closest('[data-like]');if(like){e.stopPropagation();toggleLike(like.dataset.like).then(()=>render(sourceList()));return;}const card=e.target.closest('.fanart-card');if(card){const a=state.arts[card.dataset.id]||demo.find(x=>x.id===card.dataset.id);if(a)showModal(a);}});
    $('#fanartFile')?.addEventListener('change',e=>previewFile(e.target.files[0]));
    const drop=$('#fanartDrop'); if(drop){['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragging');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragging');}));drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(!f)return;const input=$('#fanartFile');const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;previewFile(f);});}
    $$('[data-fanart-close]').forEach(button=>button.addEventListener('click',closeModal));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
    $('#fanartCategory')?.addEventListener('change',e=>{const f=$('#fanartFile');if(e.target.value==='Edits')f?.setAttribute('accept','image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime');else f?.setAttribute('accept','image/png,image/jpeg,image/webp');});
    $('#fanartUploadForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,status=$('#fanartUploadStatus'),btn=form.querySelector('.fanart-submit');try{const file=$('#fanartFile').files[0],title=$('#fanartTitle').value,desc=$('#fanartDescription').value,cat=$('#fanartCategory').value;if(!file||!title||!cat)throw new Error('Completa el archivo, el título y el apartado del arte.');btn.disabled=true;status.textContent='PUBLICANDO · SUBIENDO ARCHIVO…';await upload(file,title,desc,cat);form.reset();previewFile(null);status.textContent='PUBLICADO · YA ESTÁ EN LA GALERÍA';setTimeout(()=>status.textContent='',3000);}catch(err){status.textContent=(err.message||'No se pudo publicar').toUpperCase();}finally{btn.disabled=false;}});
    $('#fanartMenu')?.addEventListener('click',()=>{$('#fanartMobile')?.classList.add('is-open');$('#fanartMobile')?.setAttribute('aria-hidden','false');});$('#fanartMobileClose')?.addEventListener('click',()=>{$('#fanartMobile')?.classList.remove('is-open');$('#fanartMobile')?.setAttribute('aria-hidden','true');});
  }
  function init(){
    bind();
    const grid=cards(); if(!grid)return;
    grid.addEventListener('click',e=>{if(e.target.closest('[data-fanart-retry]')){state.failed='';render(sourceList());subscribe();}});
    render(sourceList());
    const sf=SF();
    if(!sf){state.failed='No se pudo conectar con Firebase.';render(sourceList());return;}
    const ready=()=>{state.ready=true;state.uid=sf.current?.uid||'';if(!state.uid){state.guest=true;render(sourceList());return;}state.guest=false;subscribe();};
    if(sf.current?.ready)ready();else document.addEventListener('speedy:firebase-ready',ready,{once:true});
    document.addEventListener('speedy:firebase-error',()=>{if(!state.loaded){state.failed='No se pudo conectar con Firebase.';render(sourceList());}},{once:true});
  }
  window.addEventListener('pagehide',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);state.unsub?.();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.SpeedyFanarts={renderHome};
})();

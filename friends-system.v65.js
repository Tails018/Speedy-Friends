(() => {
  'use strict';

  const SF = () => window.SpeedyFirebase;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const initials = value => {
    const parts = String(value || 'SF').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0,2).map(p => p[0]).join('') || 'SF').toUpperCase();
  };

  const state = {
    ready: false,
    uid: '',
    profileId: '',
    profile: null,
    users: {},
    byUid: {},
    rings: {},
    friends: {},
    incoming: {},
    outgoing: {},
    presence: {},
    presenceUnsubs: [],
    unsubs: [],
    page: location.pathname.split('/').pop().toLowerCase()
  };

  const teamRoot = () => SF().refs.root;
  const friendsRef = uid => teamRoot().child('friends').child(uid);
  const inboxRef = uid => teamRoot().child('friendRequests').child('inbox').child(uid);
  const outboxRef = uid => teamRoot().child('friendRequests').child('outbox').child(uid);

  function notify(text, type = 'normal') {
    const toast = $('#toast') || $('#sf-friends-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.dataset.type = type;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 2100);
  }

  async function waitReady(timeout = 9000) {
    if (SF()?.current?.ready && SF().current.uid) return;
    await new Promise((resolve, reject) => {
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        document.removeEventListener('speedy:firebase-ready', onReady);
        document.removeEventListener('speedy:firebase-error', onError);
        clearTimeout(timer);
        err ? reject(err) : resolve();
      };
      const onReady = () => finish();
      const onError = e => finish(e.detail || new Error('Firebase no está disponible'));
      const timer = setTimeout(() => finish(new Error('No se pudo recuperar la sesión de Speedy Friends')), timeout);
      document.addEventListener('speedy:firebase-ready', onReady);
      document.addEventListener('speedy:firebase-error', onError);
    });
  }

  async function loadDirectory() {
    const [usersSnap, ringsSnap] = await Promise.all([
      SF().refs.users.once('value'),
      SF().refs.rings.once('value')
    ]);

    state.users = usersSnap.val() || {};
    state.rings = ringsSnap.val() || {};
    state.byUid = {};

    for (const [profileId, raw] of Object.entries(state.users)) {
      const profile = { ...raw, id: profileId };
      if (profile.ownerUid) state.byUid[String(profile.ownerUid)] = profile;
      const ringValue = state.rings[profileId];
      if (ringValue !== undefined) profile.__rings = Number(ringValue || 0);
      else profile.__rings = Number(profile.rings || 0);
    }
    return state.users;
  }

  function profileForUid(uid) {
    return state.byUid[String(uid)] || null;
  }

  function nameFor(profile, fallback = 'Integrante') {
    return profile?.nickname || profile?.username || profile?.name || fallback;
  }

  function avatarMarkup(profile, sizeClass = '') {
    const name = nameFor(profile);
    const avatar = profile?.avatar || '';
    return avatar
      ? `<img class="sf-f-avatar ${sizeClass}" src="${esc(avatar)}" alt="${esc(name)}" loading="lazy">`
      : `<div class="sf-f-avatar sf-f-initials ${sizeClass}" aria-hidden="true">${esc(initials(name))}</div>`;
  }

  function profileHref(profile) {
    if (!profile) return 'profile.html';
    const id = encodeURIComponent(profile.id || '');
    return `profile.html?profileId=${id}`;
  }

  async function refreshRelations() {
    const [friendsSnap, inboxSnap, outboxSnap] = await Promise.all([
      friendsRef(state.uid).once('value'),
      inboxRef(state.uid).once('value'),
      outboxRef(state.uid).once('value')
    ]);
    state.friends = friendsSnap.val() || {};
    state.incoming = inboxSnap.val() || {};
    state.outgoing = outboxSnap.val() || {};
  }

  function relationTo(uid) {
    uid = String(uid || '');
    if (state.friends[uid]) return 'friend';
    if (state.incoming[uid]) return 'incoming';
    if (state.outgoing[uid]) return 'outgoing';
    if (uid === String(state.uid)) return 'self';
    return 'none';
  }

  async function sendRequest(targetUid) {
    targetUid = String(targetUid || '');
    if (!targetUid || targetUid === String(state.uid)) throw new Error('No puedes agregarte a ti mismo');
    if (relationTo(targetUid) === 'friend') throw new Error('Ya son amigos');
    if (relationTo(targetUid) === 'outgoing') throw new Error('La solicitud ya fue enviada');

    const target = profileForUid(targetUid);
    if (!target) throw new Error('Usuario no encontrado');

    const me = profileForUid(state.uid) || state.profile || {};
    const now = window.firebase.database.ServerValue.TIMESTAMP;
    const request = {
      requesterUid: state.uid,
      recipientUid: targetUid,
      requesterProfileId: me.id || state.profileId || '',
      recipientProfileId: target.id || '',
      requesterName: nameFor(me),
      requesterAvatar: me.avatar || '',
      recipientName: nameFor(target),
      recipientAvatar: target.avatar || '',
      status: 'pending',
      createdAt: now
    };

    const updates = {};
    updates[`/speedy-friends-teams/${SF().REALTIME_CONFIG.teamId}/friendRequests/inbox/${targetUid}/${state.uid}`] = request;
    updates[`/speedy-friends-teams/${SF().REALTIME_CONFIG.teamId}/friendRequests/outbox/${state.uid}/${targetUid}`] = request;
    await SF().db.ref().update(updates);

    await refreshRelations();
    notify(`Solicitud enviada a ${nameFor(target)}`, 'success');
    renderFriendsPage();
    renderProfileFriends();
  }

  async function acceptRequest(requesterUid) {
    requesterUid = String(requesterUid || '');
    const req = state.incoming[requesterUid];
    if (!req) throw new Error('La solicitud ya no está disponible');

    const requester = profileForUid(requesterUid);
    const me = profileForUid(state.uid) || state.profile || {};
    const acceptedAt = window.firebase.database.ServerValue.TIMESTAMP;
    const friendMe = {
      uid: requesterUid,
      profileId: requester?.id || req.requesterProfileId || '',
      displayName: nameFor(requester, req.requesterName || 'Amigo'),
      avatar: requester?.avatar || req.requesterAvatar || '',
      acceptedAt
    };
    const friendThem = {
      uid: state.uid,
      profileId: me.id || state.profileId || req.recipientProfileId || '',
      displayName: nameFor(me, 'Amigo'),
      avatar: me.avatar || req.recipientAvatar || '',
      acceptedAt
    };

    const base = `/speedy-friends-teams/${SF().REALTIME_CONFIG.teamId}`;
    const updates = {};
    updates[`${base}/friends/${state.uid}/${requesterUid}`] = friendMe;
    updates[`${base}/friends/${requesterUid}/${state.uid}`] = friendThem;
    updates[`${base}/friendRequests/inbox/${state.uid}/${requesterUid}`] = null;
    updates[`${base}/friendRequests/outbox/${requesterUid}/${state.uid}`] = null;

    await SF().db.ref().update(updates);
    await refreshRelations();
    notify(`${nameFor(requester)} ahora es tu amigo`, 'success');
    renderFriendsPage();
    renderProfileFriends();
  }

  async function rejectRequest(requesterUid) {
    requesterUid = String(requesterUid || '');
    if (!state.incoming[requesterUid]) return;
    const base = `/speedy-friends-teams/${SF().REALTIME_CONFIG.teamId}`;
    const updates = {};
    updates[`${base}/friendRequests/inbox/${state.uid}/${requesterUid}`] = null;
    updates[`${base}/friendRequests/outbox/${requesterUid}/${state.uid}`] = null;
    await SF().db.ref().update(updates);
    await refreshRelations();
    notify('Solicitud rechazada');
    renderFriendsPage();
    renderProfileFriends();
  }

  async function cancelRequest(targetUid) {
    targetUid = String(targetUid || '');
    if (!state.outgoing[targetUid]) return;
    const base = `/speedy-friends-teams/${SF().REALTIME_CONFIG.teamId}`;
    const updates = {};
    updates[`${base}/friendRequests/inbox/${targetUid}/${state.uid}`] = null;
    updates[`${base}/friendRequests/outbox/${state.uid}/${targetUid}`] = null;
    await SF().db.ref().update(updates);
    await refreshRelations();
    notify('Solicitud cancelada');
    renderFriendsPage();
    renderProfileFriends();
  }

  async function removeFriend(friendUid) {
    friendUid = String(friendUid || '');
    const base = `/speedy-friends-teams/${SF().REALTIME_CONFIG.teamId}`;
    const updates = {};
    updates[`${base}/friends/${state.uid}/${friendUid}`] = null;
    updates[`${base}/friends/${friendUid}/${state.uid}`] = null;
    await SF().db.ref().update(updates);
    await refreshRelations();
    notify('Amigo eliminado');
    renderFriendsPage();
    renderProfileFriends();
  }

  function friendProfilesFor(uid = state.uid) {
    const source = uid === state.uid ? state.friends : {};
    return Object.keys(source)
      .map(id => profileForUid(id))
      .filter(Boolean)
      .sort((a,b) => {
        const ar = Number(a.__rings || a.rings || 0);
        const br = Number(b.__rings || b.rings || 0);
        return br - ar || nameFor(a).localeCompare(nameFor(b), 'es');
      });
  }

  function userCard(profile, options = {}) {
    const uid = String(profile?.ownerUid || '');
    const rel = relationTo(uid);
    const rings = Number(profile?.__rings || profile?.rings || 0);
    let action = '';
    if (!options.noAction) {
      if (rel === 'none') action = `<button class="sf-f-btn sf-f-btn-primary" data-friend-action="add" data-uid="${esc(uid)}"><i class="ph ph-user-plus"></i> Agregar</button>`;
      if (rel === 'outgoing') action = `<button class="sf-f-btn" data-friend-action="cancel" data-uid="${esc(uid)}"><i class="ph ph-clock"></i> Pendiente</button>`;
      if (rel === 'incoming') action = `<div class="sf-f-actions"><button class="sf-f-btn sf-f-btn-primary" data-friend-action="accept" data-uid="${esc(uid)}"><i class="ph ph-check"></i> Aceptar</button><button class="sf-f-btn sf-f-btn-danger" data-friend-action="reject" data-uid="${esc(uid)}"><i class="ph ph-x"></i></button></div>`;
      if (rel === 'friend') action = `<button class="sf-f-btn" data-friend-action="profile" data-uid="${esc(uid)}"><i class="ph ph-arrow-up-right"></i> Ver perfil</button>`;
    }

    return `
      <article class="sf-f-user-card" data-uid="${esc(uid)}">
        <a class="sf-f-user-main" href="${profileHref(profile)}">
          ${avatarMarkup(profile)}
          <span class="sf-f-user-copy">
            <strong>${esc(nameFor(profile))}</strong>
            <small>${esc(profile?.title || profile?.role || 'Integrante')}</small>
          </span>
        </a>
        <div class="sf-f-user-rings"><strong>${rings.toLocaleString('es-PE')}</strong><span>Rings</span></div>
        ${action}
      </article>`;
  }

  function rankingRows(profiles) {
    if (!profiles.length) return `<div class="sf-f-empty"><i class="ph ph-trophy"></i><strong>Aún no hay amigos</strong><span>Agrega integrantes para crear tu ranking personal.</span></div>`;
    return profiles.map((profile, i) => {
      const rings = Number(profile.__rings || profile.rings || 0);
      return `
        <a class="sf-f-rank-row" href="${profileHref(profile)}">
          <span class="sf-f-rank-no">${i + 1}</span>
          ${avatarMarkup(profile)}
          <span class="sf-f-rank-name"><strong>${esc(nameFor(profile))}</strong><small>${esc(profile?.title || profile?.role || 'Integrante')}</small></span>
          <strong class="sf-f-rank-rings">${rings.toLocaleString('es-PE')} <small>Rings</small></strong>
        </a>`;
    }).join('');
  }

  function renderGuestFriendsPage() {
    const root = $('#sf-friends-app');
    if (!root) return;
    root.innerHTML = `
      <section class="sf-f-guest-hero">
        <div>
          <p class="sf-friends-kicker">VISTA PÚBLICA / SPEEDY FRIENDS</p>
          <h2>Conoce el sistema<br><em>antes de entrar.</em></h2>
          <p>La sección de Amigos funciona en tiempo real. Inicia sesión para ver tus conexiones, solicitudes, estados online/offline y tu ranking personal por Rings.</p>
          <a class="sf-f-btn sf-f-btn-primary" href="index.html#account"><i class="ph ph-sign-in"></i> Iniciar sesión con Google</a>
        </div>
        <div class="sf-f-guest-preview">${GUEST_FRIENDS.map((p,i)=>`<article class="sf-f-card sf-f-guest-card"><div>${avatarMarkup(p)}</div><div><span>#${String(i+1).padStart(2,'0')}</span><h3>${esc(nameFor(p))}</h3><p>${esc(p.title)}</p></div><strong>${Number(p.__rings).toLocaleString('es-PE')} Rings</strong></article>`).join('')}</div>
      </section>`;
  }

  function renderFriendsPage() {
    const root = $('#sf-friends-app');
    if (!root) return;

    const friends = friendProfilesFor();
    const incoming = Object.keys(state.incoming).map(uid => profileForUid(uid) || {
      ownerUid: uid,
      nickname: state.incoming[uid]?.requesterName || 'Integrante',
      avatar: state.incoming[uid]?.requesterAvatar || ''
    });
    const outgoing = Object.keys(state.outgoing).map(uid => profileForUid(uid) || {
      ownerUid: uid,
      nickname: state.outgoing[uid]?.recipientName || 'Integrante',
      avatar: state.outgoing[uid]?.recipientAvatar || ''
    });

    const active = $('.sf-f-tab.is-active', root)?.dataset.tab || 'friends';
    $$('.sf-f-panel', root).forEach(panel => panel.hidden = panel.dataset.panel !== active);

    $('#sf-friends-count')?.replaceChildren(document.createTextNode(String(friends.length)));
    $('#sf-friend-request-count')?.replaceChildren(document.createTextNode(String(incoming.length)));

    const friendsHost = $('#sf-friends-list');
    if (friendsHost) friendsHost.innerHTML = friends.length
      ? friends.map(p => userCard(p)).join('')
      : `<div class="sf-f-empty"><i class="ph ph-users-three"></i><strong>Tu lista está vacía</strong><span>Busca a otros integrantes y envíales una solicitud.</span></div>`;

    const incomingHost = $('#sf-friends-incoming');
    if (incomingHost) incomingHost.innerHTML = incoming.length
      ? incoming.map(p => userCard(p)).join('')
      : `<div class="sf-f-empty"><i class="ph ph-check-circle"></i><strong>No tienes solicitudes nuevas</strong><span>Cuando alguien te agregue, aparecerá aquí.</span></div>`;

    const outgoingHost = $('#sf-friends-outgoing');
    if (outgoingHost) outgoingHost.innerHTML = outgoing.length
      ? outgoing.map(p => userCard(p)).join('')
      : `<div class="sf-f-empty"><i class="ph ph-paper-plane-tilt"></i><strong>No tienes solicitudes enviadas</strong><span>Las solicitudes pendientes aparecerán aquí.</span></div>`;

    const rankHost = $('#sf-friends-ranking');
    if (rankHost) rankHost.innerHTML = rankingRows(friends);

    const searchInput = $('#sf-friends-search');
    const resultsHost = $('#sf-friends-results');
    if (searchInput && resultsHost) {
      const query = searchInput.value.trim().toLowerCase();
      const results = Object.entries(state.users)
        .map(([id, p]) => ({...p, id: p.id || id, __rings: Number(state.rings[id] ?? p.rings ?? 0)}))
        .filter(p => String(p.ownerUid || '') !== String(state.uid))
        .filter(p => {
          if (!query) return false;
          const hay = [p.nickname, p.username, p.name, p.title, p.role].filter(Boolean).join(' ').toLowerCase();
          return hay.includes(query);
        })
        .sort((a,b) => Number(b.__rings||b.rings||0) - Number(a.__rings||a.rings||0))
        .slice(0, 12);

      resultsHost.innerHTML = query
        ? (results.length ? results.map(p => userCard(p)).join('') :
          `<div class="sf-f-empty"><i class="ph ph-magnifying-glass"></i><strong>No encontramos coincidencias</strong><span>Prueba con otro nombre o usuario.</span></div>`)
        : `<div class="sf-f-search-hint"><i class="ph ph-users-four"></i>Escribe un nombre para buscar integrantes.</div>`;
    }
  }

  function renderProfileFriends(targetUid = null) {
    const host = $('#sf-profile-friends');
    if (!host) return;

    const uid = targetUid || host.dataset.uid || profileTargetUid();
    const isMine = String(uid) === String(state.uid);

    if (!isMine) {
      const profileFriendsRef = friendsRef(uid);
      profileFriendsRef.once('value').then(async snap => {
        const list = snap.val() || {};
        const profiles = Object.keys(list).map(id => profileForUid(id)).filter(Boolean)
          .sort((a,b) => Number(b.__rings||b.rings||0) - Number(a.__rings||a.rings||0));
        host.innerHTML = profileFriendsMarkup(profiles, false);
      }).catch(() => {
        host.innerHTML = profileFriendsMarkup([], false);
      });
      return;
    }

    host.innerHTML = profileFriendsMarkup(friendProfilesFor(), true);
  }

  function profileFriendsMarkup(profiles, editable) {
    if (!profiles.length) return `
      <section class="sf-profile-friends-card">
        <div class="sf-profile-friends-head"><div><p>RED SOCIAL</p><h3>Amigos</h3></div><span>0</span></div>
        <div class="sf-f-empty"><i class="ph ph-user-circle-plus"></i><strong>Aún no hay amigos</strong><span>Tu círculo aparecerá aquí cuando aceptes una solicitud.</span></div>
        ${editable ? `<a class="sf-f-btn sf-f-btn-primary sf-profile-manage" href="friends.html"><i class="ph ph-users-three"></i> Buscar amigos</a>` : ''}
      </section>`;

    return `
      <section class="sf-profile-friends-card">
        <div class="sf-profile-friends-head"><div><p>RED SOCIAL</p><h3>Amigos</h3></div><span>${profiles.length}</span></div>
        <div class="sf-profile-friends-grid">
          ${profiles.slice(0, 12).map(p => `
            <a class="sf-profile-friend" href="${profileHref(p)}">
              ${avatarMarkup(p)}
              <span><strong>${esc(nameFor(p))}</strong><small>${Number(p.__rings||p.rings||0).toLocaleString('es-PE')} Rings</small></span>
            </a>`).join('')}
        </div>
        <a class="sf-f-btn sf-profile-manage" href="friends.html"><i class="ph ph-users-three"></i> ${editable ? 'Administrar amigos' : 'Ver más amigos'}</a>
      </section>`;
  }

  function profileTargetUid() {
    const params = new URLSearchParams(location.search);
    const direct = params.get('uid') || params.get('userUid');
    if (direct) return direct;
    const profileId = params.get('profileId') || params.get('id') || params.get('user');
    if (profileId && state.users[profileId]?.ownerUid) return state.users[profileId].ownerUid;
    return state.uid;
  }

  function injectProfileSection() {
    if (!document.body.matches('.profile-page') && !$('#sf-profile-friends')) return;
    if ($('#sf-profile-friends')) {
      $('#sf-profile-friends').dataset.uid = profileTargetUid();
      renderProfileFriends();
      return;
    }

    const shell = $('.profile-shell') || document.main || document.body;
    const section = document.createElement('div');
    section.id = 'sf-profile-friends';
    section.dataset.uid = profileTargetUid();
    section.innerHTML = profileFriendsMarkup(friendProfilesFor(), true);
    shell.appendChild(section);
    renderProfileFriends();
  }

  const GUEST_FRIENDS = [
    { id:'guest-blaze', ownerUid:'guest-blaze', nickname:'Blaze', title:'Racer · Explorer', role:'Racer · Explorer', rings:1840, __rings:1840 },
    { id:'guest-espio', ownerUid:'guest-espio', nickname:'Espio', title:'Stealth · Speed', role:'Stealth · Speed', rings:1620, __rings:1620 },
    { id:'guest-nova', ownerUid:'guest-nova', nickname:'Nova', title:'Creator · Builder', role:'Creator · Builder', rings:1390, __rings:1390 },
    { id:'guest-rin', ownerUid:'guest-rin', nickname:'Rin', title:'Artist · Chaser', role:'Artist · Chaser', rings:1110, __rings:1110 }
  ];

  function guestRankingRows() {
    return GUEST_FRIENDS.map((p, i) => `
      <div class="rank-row sf-guest-rank-row" style="--delay:${i * 70}ms">
        <div class="rank-no">${String(i + 1).padStart(2,'0')}</div>
        <div class="rank-user">${avatarMarkup(p)}<div><strong>${esc(nameFor(p))}</strong><small>${esc(p.title)}</small></div></div>
        <div class="rank-rings"><strong>${Number(p.__rings).toLocaleString('es-PE')}</strong><span>RINGS · VISTA PREVIA</span></div>
        <div class="rank-move up"><span>PREVIEW</span></div>
      </div>`).join('');
  }

  function injectRankingSection() {
    if (!document.body.matches('.ranking-page') && !$('#sf-friends-ranking-embed')) return;
    if ($('#sf-friends-ranking-embed')) {
      const rows = state.uid ? rankingRows(friendProfilesFor()) : guestRankingRows();
      $('#sf-friends-ranking-rows').innerHTML = rows || `<div class="sf-guest-empty">Inicia sesión para cargar tu ranking personal.</div>`;
      return;
    }

    const host = document.createElement('section');
    host.id = 'sf-friends-ranking-embed';
    host.className = 'sf-friends-ranking-embed';
    const isGuest = !state.uid;
    host.innerHTML = `
      <div class="sf-friends-ranking-head">
        <div><p>${isGuest ? 'VISTA PREVIA' : 'RANKING PERSONAL'}</p><h2>Amigos por <em>Rings</em></h2><span>${isGuest ? 'Así se verá tu ranking cuando tengas amigos agregados. Los datos mostrados aquí son de demostración.' : 'Solo muestra a los integrantes que ya tienes agregados.'}</span></div>
        <a class="sf-f-btn sf-f-btn-primary" href="${isGuest ? 'index.html' : 'friends.html'}"><i class="ph ph-${isGuest ? 'sign-in' : 'users-three'}"></i> ${isGuest ? 'Iniciar sesión' : 'Ver Amigos'}</a>
      </div>
      <div id="sf-friends-ranking-rows"></div>`;
    const board = $('.ranking-board') || $('.ranking-shell') || document.body;
    board.parentNode.insertBefore(host, board);
    $('#sf-friends-ranking-rows').innerHTML = isGuest ? guestRankingRows() : (rankingRows(friendProfilesFor()) || `<div class="sf-guest-empty">Todavía no tienes amigos agregados.</div>`);
  }

  function bindFriendsPageEvents() {
    const root = $('#sf-friends-app');
    if (!root) return;

    root.addEventListener('click', async e => {
      const tab = e.target.closest('.sf-f-tab');
      if (tab) {
        $$('.sf-f-tab', root).forEach(x => x.classList.remove('is-active'));
        tab.classList.add('is-active');
        renderFriendsPage();
        return;
      }

      const btn = e.target.closest('[data-friend-action]');
      if (!btn) return;
      const action = btn.dataset.friendAction;
      const uid = btn.dataset.uid;
      btn.disabled = true;
      try {
        if (action === 'add') await sendRequest(uid);
        if (action === 'accept') await acceptRequest(uid);
        if (action === 'reject') await rejectRequest(uid);
        if (action === 'cancel') await cancelRequest(uid);
        if (action === 'profile') {
          const p = profileForUid(uid);
          location.href = profileHref(p);
        }
      } catch (err) {
        console.error(err);
        notify(err.message || 'No se pudo completar la acción', 'error');
        btn.disabled = false;
      }
    });

    $('#sf-friends-search')?.addEventListener('input', () => renderFriendsPage());
  }

  function startRealtime() {
    state.unsubs.forEach(fn => fn && fn());
    state.unsubs = [];

    const watch = (ref, cb) => {
      const handler = snap => cb(snap.val() || {});
      ref.on('value', handler);
      state.unsubs.push(() => ref.off('value', handler));
    };

    watch(friendsRef(state.uid), value => { state.friends = value; presenceWatchFriends(); refreshViews(); });
    watch(inboxRef(state.uid), value => { state.incoming = value; refreshViews(); });
    watch(outboxRef(state.uid), value => { state.outgoing = value; refreshViews(); });
    watch(SF().refs.users, value => {
      state.users = value || {};
      loadDirectory().then(refreshViews);
    });
    watch(SF().refs.rings, value => {
      state.rings = value || {};
      for (const [profileId, profile] of Object.entries(state.users)) {
        profile.__rings = Number(state.rings[profileId] ?? profile.rings ?? 0);
      }
      refreshViews();
    });
  }

  function presenceFor(uid){
    return state.presence[String(uid||"")] || {online:false,lastSeen:null};
  }

  function presenceLabel(uid){
    return presenceFor(uid).online ? 'EN LÍNEA' : 'OFFLINE';
  }

  function presenceClass(uid){
    return presenceFor(uid).online ? 'is-online' : 'is-offline';
  }

  function presenceWatchFriends(){
    state.presenceUnsubs.forEach(fn => fn && fn());
    state.presenceUnsubs = [];
    state.presence = {};
    const friendUids = Object.keys(state.friends || {});
    if(!SF()?.watchUserPresence) return;
    for(const uid of friendUids){
      const stop = SF().watchUserPresence(uid, value=>{
        state.presence[String(uid)] = value || {online:false,lastSeen:null};
        refreshViews();
      });
      state.presenceUnsubs.push(stop);
    }
  }

  function renderHomeFriends() {
    const track = $('.friends-track');
    if (!track) return;

    const profiles = friendProfilesFor().slice(0, 4);
    if (!state.uid || !state.ready) {
      const preview = GUEST_FRIENDS.slice(0, 4);
      track.innerHTML = preview.map((p, i) => {
        const img = `<span class="sf-home-f-avatar-fallback">${esc(initials(nameFor(p)))}</span>`;
        return `<article class="friend-card${i === 0 ? ' active' : ''} sf-home-guest-card">
          <div class="friend-img">${img}<span class="sf-home-presence is-offline" aria-hidden="true"></span></div>
          <div class="friend-info"><span>#${String(i+1).padStart(2,'0')}</span><h3>${esc(nameFor(p))}</h3><p>${esc(p.title)}</p><b class="sf-home-status is-offline">VISTA PREVIA</b></div>
          <div class="sf-home-ring-mini">${Number(p.__rings).toLocaleString('es-PE')} RINGS</div>
        </article>`;
      }).join('');
      return;
    }
    if (!profiles.length) {
      track.innerHTML = `<article class="friend-card active sf-home-friends-empty"><div class="friend-img"><span class="sf-home-f-avatar-fallback">+</span></div><div class="friend-info"><span>01</span><h3>Aún sin amigos</h3><p>Agrega integrantes desde Amigos</p><b>BUSCAR AMIGOS</b></div></article>`;
      return;
    }

    track.innerHTML = profiles.map((p, i) => {
      const rings = Number(p.__rings || p.rings || 0);
      const role = p.title || p.role || 'Integrante';
      const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="${esc(nameFor(p))}" loading="lazy">` : `<span class="sf-home-f-avatar-fallback">${esc(initials(nameFor(p)))}</span>`;
      const online = presenceFor(p.ownerUid).online;
      return `<a class="friend-card${i === 0 ? ' active' : ''}" href="${profileHref(p)}">
        <div class="friend-img">${img}<span class="sf-home-presence ${online ? 'is-online' : 'is-offline'}" aria-label="${online ? 'En línea' : 'Offline'}"></span></div>
        <div class="friend-info"><span>#${String(i+1).padStart(2,'0')}</span><h3>${esc(nameFor(p))}</h3><p>${esc(role)}</p><b class="sf-home-status ${online ? 'is-online' : 'is-offline'}">${presenceLabel(p.ownerUid)}</b></div>
        <div class="sf-home-ring-mini">${rings.toLocaleString('es-PE')} RINGS</div>
      </a>`;
    }).join('');
  }

  function updateFriendCountOnProfile() {
    const stats = $$('.profile-stat');
    for (const stat of stats) {
      const label = stat.querySelector('span');
      if (label && label.textContent.trim().toLowerCase() === 'amigos') {
        const value = stat.querySelector('b');
        if (value) value.textContent = String(Object.keys(state.friends || {}).length);
      }
    }
  }

  function refreshViews() {
    renderFriendsPage();
    renderProfileFriends();
    injectRankingSection();
    injectProfileSection();
    updateFriendCountOnProfile();
    renderHomeFriends();
  }

  async function init() {
    try {
      await waitReady();
      const current = SF().current;
      state.ready = true;
      state.uid = String(current.uid || '');
      state.profileId = current.profileId || '';
      state.profile = current.profile || null;

      if (!state.uid) {
        // Modo visitante: el portal sigue mostrando una vista previa cuidada.
        // Las acciones sociales y los datos privados se activan al iniciar sesión.
        renderHomeFriends();
        if (state.page === 'ranking.html') injectRankingSection();
        if (state.page === 'friends.html') renderGuestFriendsPage();
        return;
      }

      await loadDirectory();
      await refreshRelations();
      bindFriendsPageEvents();
      startRealtime();

      if (state.page === 'friends.html') renderFriendsPage();
      if (state.page === 'profile.html') {
        injectProfileSection();
        renderProfileFriends();
      }
      if (state.page === 'ranking.html') injectRankingSection();
    } catch (error) {
      console.error('[Speedy Friends] Friends module', error);
      const root = $('#sf-friends-app');
      if (root) root.innerHTML = `<div class="sf-f-login"><i class="ph ph-lock-key"></i><strong>${esc(error.message || 'No se pudo cargar Amigos')}</strong><span>Inicia sesión con tu cuenta de Speedy Friends y vuelve a intentarlo.</span><a class="sf-f-btn sf-f-btn-primary" href="index.html">Volver a Inicio</a></div>`;
    }
  }

  window.SpeedyFriends = {
    state,
    init,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
    refresh: async () => { await loadDirectory(); await refreshRelations(); refreshViews(); }
  };

  if (!window.__SPEEDY_FRIENDS_BOOTED__) {
    window.__SPEEDY_FRIENDS_BOOTED__ = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();

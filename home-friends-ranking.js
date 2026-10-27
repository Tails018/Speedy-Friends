(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = v => String(v || 'SF').trim().split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase() || 'SF';
  let boundUid = null;

  function currentSF(){ return window.SpeedyFirebase || null; }
  function teamRoot(){ return currentSF()?.refs?.root || null; }

  function profileName(u, fallback='Integrante') { return u?.nickname || u?.username || u?.name || fallback; }

  function renderMessage(title, text, cta=false){
    const root = $('#homeFriendsRankingList'); if (!root) return;
    root.innerHTML = `<div class="hfr-empty"><strong>${esc(title)}</strong><span>${esc(text)}</span>${cta?'<a class="hfr-cta" href="friends.html">AGREGAR AMIGOS <span>→</span></a>':''}</div>`;
  }

  function render(usersRaw, friendsRaw, ringsRaw, uid){
    const root = $('#homeFriendsRankingList'); if (!root) return;
    if (!uid) { renderMessage('Tu ranking está aquí', 'Inicia sesión para ver únicamente a tus amigos, ordenados por Rings.'); return; }
    const users = usersRaw || {};
    const friends = friendsRaw || {};
    const rings = ringsRaw || {};
    const rows = Object.entries(friends).map(([friendUid, rel]) => {
      const profileId = rel?.profileId;
      const userEntry = Object.entries(users).find(([id, u]) => String(u?.ownerUid || '') === String(friendUid) || String(id) === String(profileId));
      const profile = userEntry ? { id:userEntry[0], ...(userEntry[1]||{}) } : null;
      if (!profile) return null;
      const r = Number(rings[profile.id] ?? profile.rings ?? 0);
      const name = profileName(profile, rel?.displayName || 'Amigo');
      return { uid: friendUid, profileId: profile.id, profile, rings: r, name, relation: rel || {} };
    }).filter(Boolean).sort((a,b)=>b.rings-a.rings || a.name.localeCompare(b.name,'es'));

    if (!rows.length) { renderMessage('Aún no tienes amigos', 'Cuando agregues amigos, su ranking aparecerá aquí automáticamente.', true); return; }
    root.innerHTML = rows.slice(0,6).map((row,i) => {
      const av = row.profile.avatar || row.relation.avatar || '';
      const avatar = av ? `style="background-image:url('${esc(av)}')"` : '';
      return `<article class="hfr-card" tabindex="0" data-profile-id="${esc(row.profileId)}">
        <div class="hfr-pos">${String(i+1).padStart(2,'0')}</div>
        <div class="hfr-main">
          <div class="hfr-avatar" ${avatar}>${av?'':esc(initials(row.name))}</div>
          <div class="hfr-user"><strong>${esc(row.name)}</strong><small>${esc(row.profile.title || row.profile.role || 'Integrante')}</small></div>
          <div class="hfr-rings"><span>${row.rings.toLocaleString('en-US')}</span><img src="assets/ring-animated.png" alt="Rings" width="100" height="100" decoding="async"></div>
        </div>
      </article>`;
    }).join('');
    root.querySelectorAll('.hfr-card').forEach(card => card.addEventListener('click', () => {
      const id = card.dataset.profileId; if (id) location.href = `profile.html?profileId=${encodeURIComponent(id)}`;
    }));
  }

  function bind(uid){
    const sf = currentSF(); const root = teamRoot(); if (!sf || !root || !uid) return false;
    const usersRef = root.child('users');
    const friendsRef = root.child('friends').child(uid);
    const ringsRef = root.child('rings');
    let users = {}, friends = {}, rings = {};
    const update = () => render(users, friends, rings, uid);
    usersRef.on('value', s => { users = s.val() || {}; update(); });
    friendsRef.on('value', s => { friends = s.val() || {}; update(); });
    ringsRef.on('value', s => { rings = s.val() || {}; update(); });
    return true;
  }

  function init(){
    if (!$('#homeFriendsRanking')) return;
    const tryBind = () => {
      const uid = currentSF()?.current?.uid || currentSF()?.state?.uid || '';
      if (uid && uid !== boundUid) { boundUid = uid; bind(uid); }
      else if (!uid && boundUid !== 'guest') { boundUid = 'guest'; render({}, {}, {}, ''); }
      return !!uid;
    };
    tryBind();
    document.addEventListener('speedy:firebase-ready', tryBind, {once:false});
    setTimeout(tryBind, 800); setTimeout(tryBind, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();

/* Firebase compat simulado en memoria SOLO para pruebas (tests/e2e.cjs lo inyecta en lugar de los
 * SDK de gstatic). Implementa la parte de la API que usa el proyecto: auth (Google simulado),
 * Realtime Database con eventos 'value', transaction, orderByChild/equalTo, ServerValue.TIMESTAMP,
 * onDisconnect y .info/connected, y un storage mínimo. Los datos se guardan en localStorage
 * (__sfMockDb / __sfMockAuth) para sobrevivir a la navegación entre páginas de una misma prueba.
 * NO evalúa reglas de seguridad: eso requiere el emulador oficial de Firebase. */
(() => {
  if (window.firebase && window.firebase.__mock) return;
  const DB_KEY = '__sfMockDb', AUTH_KEY = '__sfMockAuth';
  const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const split = p => String(p || '').split('/').filter(Boolean);
  let tree = load(DB_KEY, {});
  const log = window.__sfMockLog = window.__sfMockLog || [];

  const getAt = parts => { let n = tree; for (const k of parts) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
  const prune = v => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) { v[k] = prune(v[k]); if (v[k] === null) delete v[k]; } return Object.keys(v).length ? v : null; } return v === undefined ? null : v; };
  const resolveServer = v => { if (v && typeof v === 'object') { if (v['.sv'] === 'timestamp') return Date.now(); for (const k of Object.keys(v)) v[k] = resolveServer(v[k]); } return v; };
  const setAt = (parts, value) => {
    value = prune(resolveServer(clone(value)));
    if (!parts.length) { tree = value || {}; return; }
    let n = tree; for (const k of parts.slice(0, -1)) { if (n[k] == null || typeof n[k] !== 'object') n[k] = {}; n = n[k]; }
    if (value === null) delete n[parts.at(-1)]; else n[parts.at(-1)] = value;
    tree = prune(tree) || {};
  };

  const listeners = new Set();
  const notify = changed => {
    save(DB_KEY, tree);
    const c = changed.join('/');
    for (const l of [...listeners]) {
      const p = l.ref.path;
      if (!p || !c || c === p || c.startsWith(p + '/') || p.startsWith(c + '/')) setTimeout(() => listeners.has(l) && l.fire(), 0);
    }
  };

  class Snapshot {
    constructor(ref, value) { this.ref = ref; this.key = ref.key; this._v = value === undefined ? null : value; }
    val() { return clone(this._v); }
    exists() { return this._v !== null && this._v !== undefined; }
    child(p) { const parts = split(p); let v = this._v; for (const k of parts) v = v && typeof v === 'object' ? v[k] : null; return new Snapshot(this.ref.child(p), v ?? null); }
    hasChild(p) { return this.child(p).exists(); }
    numChildren() { return this._v && typeof this._v === 'object' ? Object.keys(this._v).length : 0; }
    forEach(fn) { if (!this._v || typeof this._v !== 'object') return false; for (const k of Object.keys(this._v).sort()) if (fn(this.child(k)) === true) return true; return false; }
    toJSON() { return this.val(); }
  }

  const ack = () => { const lat = Number(window.__sfMockLatency || 0); return lat ? new Promise(r => setTimeout(r, lat)) : Promise.resolve(); };
  let pushCounter = 0;
  class Query {
    constructor(ref, filter = null) { this.ref = ref; this._filter = filter; }
    _value() {
      if (this.ref.path === '.info/connected') return true;
      let v = getAt(split(this.ref.path));
      if (this._filter && v && typeof v === 'object') {
        const { by, eq } = this._filter; const out = {};
        for (const [k, c] of Object.entries(v)) if (eq === undefined || (c && c[by]) === eq) out[k] = c;
        v = Object.keys(out).length ? out : null;
      }
      return clone(v);
    }
    orderByChild(by) { return new Query(this.ref, { by }); }
    orderByKey() { return this; } orderByValue() { return this; } limitToLast() { return this; } limitToFirst() { return this; }
    equalTo(eq) { return new Query(this.ref, { ...(this._filter || {}), eq }); }
    // __sfMockLatency (ms) simula el tiempo de ida y vuelta de la red para comparar optimizaciones.
    // El registro añade el instante y el tamaño JSON entregado (no son bytes reales de Firebase).
    once(event, cb) {
      const lat = Number(window.__sfMockLatency || 0);
      if (window.__sfMockDenyRead && window.__sfMockDenyRead(this.ref.path)) return new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' })), lat));
      const deliver = () => { const v = this._value(); log.push(['read', this.ref.path, Math.round(performance.now()), JSON.stringify(v ?? null).length]); const s = new Snapshot(this.ref, v); cb?.(s); return s; };
      return lat ? new Promise(r => setTimeout(() => r(deliver()), lat)) : Promise.resolve(deliver());
    }
    on(event, cb, errCb) {
      if (window.__sfMockDenyRead && window.__sfMockDenyRead(this.ref.path)) { setTimeout(() => errCb?.(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' })), 0); return cb; }
      const l = { ref: this.ref, cb, query: this, fire: () => cb(new Snapshot(this.ref, this._value())) };
      listeners.add(l); log.push(['listen', this.ref.path, Math.round(performance.now()), JSON.stringify(this._value() ?? null).length]); setTimeout(() => listeners.has(l) && l.fire(), Number(window.__sfMockLatency || 0));
      return cb;
    }
    off(event, cb) { for (const l of [...listeners]) if (l.ref.path === this.ref.path && (!cb || l.cb === cb)) listeners.delete(l); }
  }
  class Ref extends Query {
    constructor(path) { super(null); this.path = split(path).join('/'); this.key = split(path).at(-1) || null; this.ref = this; }
    get parent() { const p = split(this.path); return p.length ? new Ref(p.slice(0, -1).join('/')) : null; }
    get root() { return new Ref(''); }
    child(p) { return new Ref([this.path, ...split(p)].join('/')); }
    // Como Firebase: la escritura se aplica en local al instante y la promesa espera la confirmación.
    set(v) { log.push(['set', this.path]); setAt(split(this.path), v); notify(split(this.path)); return ack(); }
    update(obj) { log.push(['update', this.path]); for (const [k, v] of Object.entries(obj || {})) setAt([...split(this.path), ...split(k)], v); notify(split(this.path)); return ack(); }
    remove() { return this.set(null); }
    push(v) {
      const key = '-mock' + Date.now().toString(36) + (pushCounter++).toString(36).padStart(4, '0');
      const r = this.child(key); const p = v === undefined ? Promise.resolve() : r.set(v);
      // Como en Firebase, la promesa resuelve con una referencia normal (no «thenable»).
      const plain = this.child(key);
      r.then = (a, b) => p.then(() => (a ? a(plain) : plain), b); r.catch = b => p.catch(b); return r;
    }
    transaction(fn) {
      log.push(['transaction', this.path]);
      const next = fn(clone(getAt(split(this.path))));
      if (next === undefined) return Promise.resolve({ committed: false, snapshot: new Snapshot(this, getAt(split(this.path))) });
      setAt(split(this.path), next); notify(split(this.path));
      return Promise.resolve({ committed: true, snapshot: new Snapshot(this, getAt(split(this.path))) });
    }
    onDisconnect() { const ok = () => Promise.resolve(); return { set: ok, update: ok, remove: ok, cancel: ok }; }
    toString() { return 'mock://' + this.path; }
  }

  // ----- Auth -----
  const authListeners = new Set();
  const makeUser = u => u && ({ ...u, getIdToken: () => Promise.resolve('mock-token'), providerData: [{ providerId: 'google.com' }] });
  // __sfMockAuthDelay (ms) imita a Firebase real: currentUser vale null mientras se restaura la sesión
  // guardada y onAuthStateChanged no se notifica hasta terminar.
  const authDelay = Number(window.__sfMockAuthDelay || 0);
  const savedUser = makeUser(load(AUTH_KEY, null));
  let authRestored = !authDelay;
  const auth = {
    currentUser: authDelay ? null : savedUser,
    onAuthStateChanged(cb) { authListeners.add(cb); if (authRestored) setTimeout(() => authListeners.has(cb) && cb(auth.currentUser), 0); return () => authListeners.delete(cb); },
    onIdTokenChanged(cb) { return auth.onAuthStateChanged(cb); },
    setPersistence: () => Promise.resolve(),
    async signInWithPopup() {
      const u = window.__SF_MOCK_LOGIN || load('__sfMockNextLogin', null);
      if (!u) throw Object.assign(new Error('popup-closed-by-user'), { code: 'auth/popup-closed-by-user' });
      auth.currentUser = makeUser(u); save(AUTH_KEY, u); authListeners.forEach(cb => setTimeout(() => cb(auth.currentUser), 0));
      return { user: auth.currentUser };
    },
    async signOut() { auth.currentUser = null; try { localStorage.removeItem(AUTH_KEY); } catch {} authListeners.forEach(cb => setTimeout(() => cb(null), 0)); }
  };
  if (authDelay) setTimeout(() => { authRestored = true; auth.currentUser = savedUser; authListeners.forEach(cb => cb(auth.currentUser)); }, authDelay);
  const authFn = () => auth;
  authFn.GoogleAuthProvider = class { setCustomParameters() {} addScope() {} };
  authFn.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };

  const db = { ref: p => new Ref(p), goOnline() {}, goOffline() {} };
  const dbFn = () => db;
  dbFn.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' }, increment: n => n };

  const storageRef = path => ({
    child: p => storageRef([path, p].filter(Boolean).join('/')),
    put: file => { const url = 'data:text/plain,mock-upload-' + encodeURIComponent(path); return Promise.resolve({ ref: { getDownloadURL: () => Promise.resolve(url) } }); },
    getDownloadURL: () => Promise.resolve('data:text/plain,mock-' + encodeURIComponent(path)),
    delete: () => Promise.resolve()
  });
  const storageFn = () => ({ ref: p => storageRef(p || '') });

  window.firebase = { __mock: true, apps: [], initializeApp(cfg) { const app = { name: '[DEFAULT]', options: cfg }; this.apps.push(app); return app; }, app: () => window.firebase.apps[0], auth: authFn, database: dbFn, storage: storageFn };
  window.__sfMock = { getTree: () => clone(tree), getAt: p => clone(getAt(split(p))), log };
})();

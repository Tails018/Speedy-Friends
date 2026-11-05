/* Speedy Friends — Firebase functional core
   Compatible with the existing Speedy Friends design.
   Reuses the existing Firebase project/data tree and Cloudinary OST setup.
*/
(function(){
  const REALTIME_CONFIG = {
    enabled:true,
    teamId:"speedy-friends",
    adminEmail:"t89886464@gmail.com",
    firebaseConfig:{
      apiKey:"AIzaSyByNbNOCihZVwzR7r8w_aIN1breCxUZ1aU",
      authDomain:"speedy-friends.firebaseapp.com",
      databaseURL:"https://speedy-friends-default-rtdb.firebaseio.com",
      projectId:"speedy-friends",
      appId:"1:1045569751260:web:5cea2a6505025db5b28c19",
      storageBucket:"speedy-friends.firebasestorage.app"
    }
  };

  const CLOUDINARY_CONFIG = {
    cloudName:"qgf6z2er",
    uploadPreset:"speedy_friends_ost"
  };

  const creatorEmail=REALTIME_CONFIG.adminEmail.toLowerCase();
  const teamRoot=()=>firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}`);

  const CloudinaryOST = {
    async upload(file,userId){
      if(!file || !file.type.startsWith("audio/")) throw new Error("Selecciona un archivo de audio válido");
      if(file.size>25*1024*1024) throw new Error("El OST debe pesar 25 MB o menos");
      const form=new FormData();
      form.append("file",file);
      form.append("upload_preset",CLOUDINARY_CONFIG.uploadPreset);
      form.append("folder","speedy-friends/ost");
      form.append("public_id",`${userId}-${Date.now()}`);
      const response=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/video/upload`,{method:"POST",body:form});
      const data=await response.json().catch(()=>({}));
      if(!response.ok || !data.secure_url) throw new Error(data?.error?.message || "No se pudo subir el OST a Cloudinary");
      return {url:data.secure_url,name:file.name,bytes:file.size};
    }
  };

  if(typeof firebase==="undefined"){
    console.error("[Speedy Firebase] SDK not loaded");
    // Sin SDK no habrá onAuthStateChanged: avisar para que la interfaz no quede esperando.
    const fail=()=>document.dispatchEvent(new CustomEvent("speedy:firebase-error",{detail:new Error("SDK not loaded")}));
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fail,{once:true});else setTimeout(fail,0);
    return;
  }
  if(!firebase.apps.length) firebase.initializeApp(REALTIME_CONFIG.firebaseConfig);

  const auth=firebase.auth();
  // El primer onAuthStateChanged llega cuando Firebase ya restauró (o no) la sesión guardada.
  let authSettled=false;
  auth.onAuthStateChanged(()=>{authSettled=true;});
  const db=firebase.database();
  const storage=firebase.storage ? firebase.storage() : null;
  const refs={
    root:teamRoot(),
    users:teamRoot().child("users"),
    permissions:teamRoot().child("permissions"),
    rings:teamRoot().child("rings"),
    ratings:teamRoot().child("ratings"),
    ringHistory:teamRoot().child("ringHistory"),
    siteSettings:teamRoot().child("siteSettings"),
    presence:teamRoot().child("presence")
  };

  const state={
    ready:false,uid:"",email:"",role:"guest",isCreator:false,isAdmin:false,
    profileId:null,profile:null,permissions:{},rings:0,ringValues:{}
  };

  // Share identical realtime queries only inside the current authenticated page session.
  // Firebase remains responsible for authorization and every consumer gets cancellation errors.
  const sharedWatches=new Map();
  let sharedUid="";
  auth.onAuthStateChanged(user=>{
    const uid=user?.uid||"";
    if(uid===sharedUid)return;
    for(const entry of sharedWatches.values())entry.ref.off("value",entry.handler);
    sharedWatches.clear();sharedUid=uid;
    // Una copia de otra cuenta (o de antes de cerrar sesión) nunca se muestra.
    const cached=readRankingCache();
    if(cached&&cached.uid!==uid)clearRankingCache();
  });

  // --- Caché pública de Ranking (stale-while-revalidate) ---
  // Solo una proyección que cualquier integrante con sesión ya puede leer: nombre, título, rol,
  // nivel, Rings y avatar si es una URL https corta. Sin correos, descripciones, portadas ni Base64.
  // Vive en sessionStorage (se borra al cerrar la pestaña), caduca a los 10 min, va ligada al UID y
  // se borra al cerrar sesión, al cambiar de cuenta o si Firebase deniega la lectura.
  const RANK_CACHE_KEY="sfPublicRanking:v1",RANK_CACHE_TTL=10*60*1000;
  function readRankingCache(){
    try{const v=JSON.parse(sessionStorage.getItem(RANK_CACHE_KEY)||"null");return v&&v.v===1?v:null;}catch{return null;}
  }
  function clearRankingCache(){try{sessionStorage.removeItem(RANK_CACHE_KEY);}catch{}}
  const shortUrl=v=>{const s=String(v||"");return /^https:\/\//i.test(s)&&s.length<=400?s:"";};
  let rankSaveTimer=0;
  function scheduleRankingCacheSave(){
    clearTimeout(rankSaveTimer);
    rankSaveTimer=setTimeout(()=>{
      const u=sharedWatches.get("users"),r=sharedWatches.get("rings");
      const uid=auth.currentUser?.uid||"";
      if(!uid||uid!==sharedUid||!u?.hasSnapshot||!r?.hasSnapshot)return;
      const users={},rawUsers=u.snapshot.val()||{},rings=r.snapshot.val()||{};
      for(const [id,p] of Object.entries(rawUsers)){
        if(!p||typeof p!=="object")continue;
        const creator=String(p.ownerEmail||p.email||"").toLowerCase()===creatorEmail;
        users[id]={name:String(p.name||"").slice(0,60),username:String(p.username||"").slice(0,60),nickname:String(p.nickname||"").slice(0,60),
          title:String(p.title||"").slice(0,60),role:creator?"creator":String(p.role||"member").slice(0,20),ownerUid:String(p.ownerUid||p.uid||"").slice(0,128),
          level:Number(p.level||1)||1,rings:Number(p.rings||0)||0,avatar:shortUrl(p.avatar),iconPosition:String(p.iconPosition||"50% 50%").slice(0,20),iconZoom:Number(p.iconZoom||100)||100};
      }
      const ringValues={};for(const [id,v] of Object.entries(rings))if(Number.isFinite(Number(v)))ringValues[id]=Number(v);
      try{sessionStorage.setItem(RANK_CACHE_KEY,JSON.stringify({v:1,uid,at:Date.now(),users,rings:ringValues}));}catch{}
    },250);
  }
  function getRankingCache(){
    const uid=auth.currentUser?.uid||"";const c=readRankingCache();
    if(!uid||!c||c.uid!==uid||Date.now()-Number(c.at||0)>RANK_CACHE_TTL)return null;
    return {users:c.users||{},rings:c.rings||{},at:c.at};
  }
  function subscribeShared(key,ref,onValue,onError=()=>{}){
    const uid=auth.currentUser?.uid||"";
    if(!uid||uid!==sharedUid)throw new Error("Sesión de Firebase no disponible");
    let entry=sharedWatches.get(key);
    if(!entry){
      entry={ref,clients:new Set(),snapshot:null,hasSnapshot:false,handler:null};
      sharedWatches.set(key,entry);
      entry.handler=ref.on("value",snap=>{
        if(sharedWatches.get(key)!==entry||auth.currentUser?.uid!==uid)return;
        entry.snapshot=snap;entry.hasSnapshot=true;
        if(key==="users"||key==="rings")scheduleRankingCacheSave();
        for(const client of [...entry.clients])client.onValue(snap);
      },error=>{
        if(sharedWatches.get(key)!==entry)return;
        if(key==="users"||key==="rings")clearRankingCache();
        sharedWatches.delete(key);entry.snapshot=null;entry.hasSnapshot=false;
        for(const client of [...entry.clients])client.onError(error);
      });
    }
    const client={onValue,onError};entry.clients.add(client);
    if(entry.hasSnapshot)queueMicrotask(()=>{
      if(sharedWatches.get(key)===entry&&entry.clients.has(client)&&auth.currentUser?.uid===uid)client.onValue(entry.snapshot);
    });
    return ()=>{
      entry.clients.delete(client);
      if(!entry.clients.size&&sharedWatches.get(key)===entry){entry.ref.off("value",entry.handler);sharedWatches.delete(key);}
    };
  }

  // Lectura deduplicada: entrega el primer dato del listener compartido y lo mantiene un tiempo,
  // así los módulos que se suscriben después reciben el mismo dato sin otra descarga. Si el listener
  // ya existe, responde con su último dato al instante.
  function readShared(key,ref,{holdMs=15000}={}){
    return new Promise((resolve,reject)=>{
      let done=false,off=null;
      try{
        off=subscribeShared(key,ref,snap=>{
          if(done)return;done=true;resolve(snap);
          setTimeout(()=>off?.(),holdMs);
        },error=>{if(done)return;done=true;off?.();reject(error);});
      }catch{
        // Sesión todavía no registrada para compartir: lectura normal.
        ref.once("value").then(resolve,reject);
      }
    });
  }

  function profileMatches(data,uid,email){
    const ownerUid=String(data?.ownerUid||"");
    const ownerEmail=String(data?.ownerEmail||data?.email||"").toLowerCase();
    return ownerUid===String(uid||"") || (!!email && ownerEmail===String(email).toLowerCase());
  }

  async function waitForAuthUser(timeoutMs=8000){
    if(auth.currentUser)return auth.currentUser;
    // Sesión ya comprobada y sin usuario: no hace falta esperar al timeout.
    if(authSettled)return null;
    return await new Promise((resolve,reject)=>{
      let done=false;
      const timer=setTimeout(()=>{
        if(done)return;
        done=true;
        unsub();
        reject(new Error("Firebase tardó demasiado en recuperar la sesión"));
      },timeoutMs);
      const unsub=auth.onAuthStateChanged(user=>{
        if(done)return;
        if(!user){
          // Primera notificación sin usuario = visitante sin sesión guardada.
          done=true;clearTimeout(timer);setTimeout(()=>unsub(),0);resolve(null);return;
        }
        done=true;
        clearTimeout(timer);
        unsub();
        resolve(user);
      });
    });
  }

  // Las páginas llaman a resolve() muchas veces al cargar; cada llamada descargaba todos los
  // usuarios. Se comparte la consulta en curso y se reutiliza el resultado 2 s por usuario.
  let resolving=null,resolvedAt=0,resolvedUid="";
  async function resolve(options={}){
    const uid=auth.currentUser?.uid||"";
    if(!options.force){
      if(resolving&&resolving.uid===uid)return resolving.promise;
      if(uid&&uid===resolvedUid&&state.uid===uid&&Date.now()-resolvedAt<2000)return state;
    }
    const promise=resolveFresh().then(result=>{resolvedAt=Date.now();resolvedUid=result.uid||"";return result;})
      .finally(()=>{if(resolving?.promise===promise)resolving=null;});
    resolving={uid,promise};
    return promise;
  }
  auth.onAuthStateChanged(()=>{resolvedAt=0;resolvedUid="";});

  async function resolveFresh(){
    const user=await waitForAuthUser().catch(error=>{
      console.warn("[Speedy Firebase] auth wait:",error.message);
      return null;
    });

    if(!user){
      Object.assign(state,{ready:false,uid:"",email:"",role:"guest",isCreator:false,isAdmin:false,profileId:null,profile:null,permissions:{},rings:0});
      return state;
    }

    const uid=user.uid,email=String(user.email||"");
    const creator=email.toLowerCase()===creatorEmail;
    // Rings se pide en paralelo con el profileId recordado en esta pestaña (no es un dato privado);
    // si la pista no coincide se vuelve a pedir con el perfil correcto.
    const hintKey="sfProfileHint:"+uid;let hint="";try{hint=sessionStorage.getItem(hintKey)||"";}catch{}
    const hintedRings=hint?refs.rings.child(hint).once("value").catch(()=>null):null;
    const [usersSnap,permSnap]=await Promise.all([
      readShared("users",refs.users),
      refs.permissions.child(uid).once("value")
    ]);
    const users=usersSnap.val()||{};
    let profileId=null,profile=null;

    for(const [id,data] of Object.entries(users)){
      if(profileMatches(data,uid,email)){profileId=id;profile=data||{};break;}
    }

    if(!profileId){
      profileId=`user-${uid}`;
      let suffix=1;
      while(Object.prototype.hasOwnProperty.call(users,profileId))profileId=`user-${uid}-${suffix++}`;
      profile={
        id:profileId,
        name:(email.split("@")[0]||"integrante").slice(0,32),
        username:(email.split("@")[0]||"integrante").slice(0,32),
        nickname:"",title:"Runner",role:"Runner",description:"",bio:"",
        rings:0,level:1,xp:0,ownerUid:uid,ownerEmail:email,
        avatar:"",cover:"",iconPosition:"50% 50%",iconZoom:100,
        coverPosition:"50% 50%",coverZoom:100,ostName:"",hasOst:false,ostUrl:""
      };
      await refs.users.child(profileId).set(profile);
    }else{
      const patch={};
      if(!profile.ownerUid)patch.ownerUid=uid;
      if(!profile.ownerEmail&&email)patch.ownerEmail=email;
      if(Object.keys(patch).length)await refs.users.child(profileId).update(patch);
    }

    const perms=permSnap.val()||{};
    let rings=Number(profile.rings||0);
    let ringSnap=hint===profileId?await hintedRings:null;
    if(!ringSnap)ringSnap=await refs.rings.child(profileId).once("value");
    if(ringSnap.exists())rings=Number(ringSnap.val()||0);
    try{sessionStorage.setItem(hintKey,profileId);}catch{}

    const role=creator?"creator":(String(perms.role||"").toLowerCase()==="admin"?"admin":"member");
    Object.assign(state,{ready:true,uid,email,role,isCreator:creator,isAdmin:creator||role==="admin",profileId,profile,permissions:perms,rings});
    return state;
  }



  async function logActivity(title,detail,meta={}){
    try{
      if(!state.uid)return;
      const data={
        title:String(title||"Actividad del team"),
        detail:String(detail||""),
        avatar:String(meta.avatar||state.profile?.avatar||""),
        actorUid:state.uid,
        actorName:String(meta.actorName||state.profile?.nickname||state.profile?.username||state.email.split("@")[0]||"Integrante"),
        type:String(meta.type||"general"),
        at:firebase.database.ServerValue.TIMESTAMP
      };
      await teamRoot().child("activity").push(data);
    }catch(e){console.warn("[Activity log]",e)}
  }

  // Campos que el dueño puede editar en su perfil. Rings, rol, permisos, nivel e historial nunca se
  // escriben desde aquí, así que un cambio simultáneo de saldo o rol no se pisa.
  const PROFILE_EDITABLE=["name","nickname","title","username","description","bio","avatar","cover","iconPosition","iconZoom","coverPosition","coverZoom","ostName","ostUrl","hasOst"];
  async function saveProfile(data){
    const user=auth.currentUser;
    if(!user)throw new Error("Inicia sesión con Google");
    if(state.uid!==user.uid||!state.profileId)throw new Error("Tu sesión todavía se está comprobando. Vuelve a intentarlo.");
    const id=state.profileId;
    const patch={};
    for(const k of PROFILE_EDITABLE)if(data&&Object.prototype.hasOwnProperty.call(data,k))patch[k]=data[k];
    const existing=state.profile||{};
    if(!existing.ownerUid)patch.ownerUid=user.uid;
    if(!existing.ownerEmail&&user.email)patch.ownerEmail=user.email;
    if(Object.keys(patch).length)await refs.users.child(id).update(patch);
    state.profile={...existing,...patch};
    return state.profile;
  }


  async function uploadProfileAsset(uid,kind,file){
    if(!storage) throw new Error("Firebase Storage no está disponible");
    if(!uid||!file) throw new Error("Archivo inválido");
    const target=storage.ref().child(`profiles/${uid}/${kind}`);
    await target.put(file,{contentType:file.type||"application/octet-stream",cacheControl:"public,max-age=3600"});
    return target.getDownloadURL();
  }

  function watchPublicUsers(callback){
    return refs.users.on("value",snap=>callback(snap.val()||{}));
  }

  function watchUserRings(callback){
    if(!state.profileId){callback(0);return ()=>{};}
    return refs.rings.child(state.profileId).on("value",snap=>{
      state.rings=Number(snap.val()||state.profile?.rings||0);
      callback(state.rings);
    });
  }

  async function signInGoogle(){
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:"select_account"});
    return auth.signInWithPopup(provider);
  }

  async function setCafeWorkerRole(profileId,enabled){
    await resolve();
    if(String(state.email||'').toLowerCase()!==creatorEmail) throw new Error("Solo la Creadora puede administrar trabajadores de Cafetería");
    const snap=await refs.users.child(profileId).once("value");
    if(!snap.exists()) throw new Error("Usuario no encontrado");
    const u=snap.val()||{};
    const uid=String(u.ownerUid||"");
    if(!uid) throw new Error("El integrante debe tener una cuenta vinculada");
    const ref=teamRoot().child("cafeteria").child("workers").child(uid);
    if(enabled){
      await ref.set({
        uid,
        role:"worker",
        active:true,
        displayName:u.nickname||u.username||u.name||"Trabajador",
        createdBy:state.uid,
        createdAt:firebase.database.ServerValue.TIMESTAMP
      });
    }else{
      await ref.update({
        active:false,
        updatedBy:state.uid,
        updatedAt:firebase.database.ServerValue.TIMESTAMP
      });
    }
    return true;
  }

  function adminHref(){
    return state.isCreator ? "admin.html" : state.role==="admin" ? "admin-role.html" : null;
  }

  async function setRingAmount(profileId,delta,reason=""){
    await resolve();
    if(!state.isAdmin && String(state.role||"").toLowerCase()!=="admin" && !state.permissions?.rings) throw new Error("Sin permiso para modificar Rings");
    const userSnap=await refs.users.child(profileId).once("value");
    if(!userSnap.exists()) throw new Error("Usuario no encontrado");
    const target=userSnap.val()||{};
    if(String(target.ownerUid||"")===state.uid || String(target.ownerEmail||"").toLowerCase()===state.email.toLowerCase()){
      if(!state.isCreator) throw new Error("La creadora está protegida");
    }
    const result=await refs.rings.child(profileId).transaction(v=>Math.max(0,Number(v||target.rings||0)+Math.trunc(Number(delta))));
    if(!result.committed) throw new Error("Firebase no confirmó el cambio de Rings");
    const total=Number(result.snapshot.val()||0);
    // El saldo oficial de Rings vive en /rings. La UI administrativa escucha ese nodo en tiempo real.
    // No actualizamos /users aquí: las reglas protegen el perfil para evitar que un Admin altere otros campos.
    if(state.isCreator){ try{ await refs.users.child(profileId).update({rings:total}); }catch(e){ console.warn("[Speedy Firebase] sync users.rings:",e); } }
    await refs.ringHistory.push({userId:profileId,delta:Math.trunc(Number(delta)),reason:String(reason||""),byUid:state.uid,byEmail:state.email,at:firebase.database.ServerValue.TIMESTAMP});
    const action=Math.trunc(Number(delta))>=0?"sumó":"quitó";
    await logActivity("Rings modificados", `${state.profile?.nickname||state.profile?.username||state.email.split("@")[0]} ${action} ${Math.abs(Math.trunc(Number(delta)))} Rings`, {type:"rings"});
    return total;
  }

  async function grantRingsPermission(profileId,enabled){
    await resolve();
    if(!state.isCreator) throw new Error("Solo la creadora puede cambiar permisos");
    const snap=await refs.users.child(profileId).once("value");
    const u=snap.val()||{};
    if(!u.ownerUid) throw new Error("El integrante debe iniciar sesión primero");
    return enabled ? refs.permissions.child(u.ownerUid).update({rings:true}) : refs.permissions.child(u.ownerUid).child("rings").remove();
  }

  async function setAdminRole(profileId,enabled){
    await resolve();
    if(!state.isCreator) throw new Error("Solo la creadora puede cambiar roles");
    const snap=await refs.users.child(profileId).once("value");
    const u=snap.val()||{};
    if(!u.ownerUid) throw new Error("El integrante debe iniciar sesión primero");
    if(String(u.ownerEmail||"").toLowerCase()===creatorEmail) throw new Error("La creadora está protegida");
    if(enabled){
      await refs.permissions.child(u.ownerUid).update({role:"admin",rings:true});
      await refs.users.child(profileId).update({role:"admin"});
    }else{
      await refs.permissions.child(u.ownerUid).remove();
      await refs.users.child(profileId).update({role:"member"});
    }
    return true;
  }

  async function setRating(profileId,score){
    await resolve();
    if(!state.uid) throw new Error("Inicia sesión con Google");
    if(!Number.isInteger(score)||score<1||score>5) throw new Error("La valoración debe ser de 1 a 5");
    const target=await refs.users.child(profileId).once("value");
    const u=target.val()||{};
    if(String(u.ownerUid||"")===state.uid) throw new Error("No puedes valorarte a ti mismo");
    const r=refs.ratings.child(profileId).child(state.uid);
    const existing=await r.once("value");
    if(existing.exists()) throw new Error("Ya has valorado este perfil");
    return r.set(score);
  }

  let presenceUnsub = null;
  let presenceConnectedRef = null;

  async function startPresence(uid){
    uid=String(uid||"");
    if(!uid || !db) return;
    try{
      if(presenceUnsub) presenceUnsub();
      if(presenceConnectedRef) presenceConnectedRef.off();
      const myPresence=refs.presence.child(uid);
      const connectedRef=db.ref(".info/connected");
      const connectedHandler=snap=>{
        if(snap.val()!==true) return;
        myPresence.onDisconnect().set({online:false,lastSeen:firebase.database.ServerValue.TIMESTAMP});
        myPresence.set({online:true,lastSeen:firebase.database.ServerValue.TIMESTAMP});
      };
      presenceConnectedRef=connectedRef;
      connectedRef.on("value",connectedHandler);
      presenceUnsub=()=>{
        connectedRef.off("value",connectedHandler);
        presenceUnsub=null;
      };
      await myPresence.set({online:true,lastSeen:firebase.database.ServerValue.TIMESTAMP});
    }catch(e){ console.warn("[Speedy Firebase] presence:",e); }
  }

  async function stopPresence(uid){
    uid=String(uid||"");
    try{
      if(uid) await refs.presence.child(uid).set({online:false,lastSeen:firebase.database.ServerValue.TIMESTAMP});
    }catch(e){ console.warn("[Speedy Firebase] presence stop:",e); }
  }

  function watchUserPresence(uid,callback){
    uid=String(uid||"");
    if(!uid){ callback?.({online:false,lastSeen:null}); return ()=>{}; }
    const ref=refs.presence.child(uid);
    const handler=snap=>callback?.(snap.val()||{online:false,lastSeen:null});
    ref.on("value",handler);
    return ()=>ref.off("value",handler);
  }

  // Los scripts de cada página se suscriben al final del <body>. Como la sesión ya no espera
  // 8 s, el evento podía llegar antes: se emite cuando el documento terminó de analizarse.
  const domReady=new Promise(done=>{
    if(document.readyState!=="loading")done();
    else document.addEventListener("DOMContentLoaded",()=>setTimeout(done,0),{once:true});
  });
  const emit=(name,detail)=>domReady.then(()=>document.dispatchEvent(new CustomEvent(name,{detail})));
  auth.onAuthStateChanged(async ()=>{
    try{
      await resolve();
      state.ready=Boolean(state.uid);
      state.checked=true;
      // La presencia se escribe en segundo plano: esperar su confirmación retrasaba un viaje de
      // red completo el evento que esperan todos los módulos de la página.
      if(state.uid) startPresence(state.uid);
      await emit("speedy:firebase-ready",{...state});
    }catch(error){
      console.error("[Speedy Firebase]",error);
      await emit("speedy:firebase-error",error);
    }
  });

  window.SpeedyFirebase={
    auth,db,storage,CloudinaryOST,CLOUDINARY_CONFIG,REALTIME_CONFIG,refs,current:state,
    resolve,saveProfile,signInGoogle,signOut:async()=>{ try{ if(state.uid) await stopPresence(state.uid); }catch(e){} return auth.signOut(); },adminHref,
    uploadProfileAsset,uploadOst:(uid,file,trackId)=>CloudinaryOST.upload(file,uid),
    watchPublicUsers,watchUserRings,watchUserPresence,subscribeShared,readShared,getRankingCache,setRingAmount,grantRingsPermission,setAdminRole,setCafeWorkerRole,setRating,
    isCreator:()=>state.isCreator,isAdmin:()=>state.isAdmin
  };
})();

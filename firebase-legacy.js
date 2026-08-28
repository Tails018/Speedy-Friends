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
    return;
  }
  if(!firebase.apps.length) firebase.initializeApp(REALTIME_CONFIG.firebaseConfig);

  const auth=firebase.auth();
  const db=firebase.database();
  const storage=firebase.storage ? firebase.storage() : null;
  const refs={
    root:teamRoot(),
    users:teamRoot().child("users"),
    permissions:teamRoot().child("permissions"),
    rings:teamRoot().child("rings"),
    ratings:teamRoot().child("ratings"),
    ringHistory:teamRoot().child("ringHistory"),
    siteSettings:teamRoot().child("siteSettings")
  };

  const state={
    ready:false,uid:"",email:"",role:"guest",isCreator:false,isAdmin:false,
    profileId:null,profile:null,permissions:{},rings:0,ringValues:{}
  };

  function profileMatches(data,uid,email){
    const ownerUid=String(data?.ownerUid||"");
    const ownerEmail=String(data?.ownerEmail||data?.email||"").toLowerCase();
    return ownerUid===String(uid||"") || (!!email && ownerEmail===String(email).toLowerCase());
  }

  async function waitForAuthUser(timeoutMs=8000){
    if(auth.currentUser)return auth.currentUser;
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
        if(!user)return;
        done=true;
        clearTimeout(timer);
        unsub();
        resolve(user);
      });
    });
  }

  async function resolve(){
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
    const [usersSnap,permSnap]=await Promise.all([
      refs.users.once("value"),
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
    const ringSnap=await refs.rings.child(profileId).once("value");
    if(ringSnap.exists())rings=Number(ringSnap.val()||0);

    const role=creator?"creator":(String(profile.role||perms.role||"").toLowerCase()==="admin"?"admin":"member");
    Object.assign(state,{ready:true,uid,email,role,isCreator:creator,isAdmin:creator||role==="admin",profileId,profile,permissions:perms,rings});
    return state;
  }


  async function saveProfile(data){
    const user=auth.currentUser;
    if(!user)throw new Error("Inicia sesión con Google");

    const id=state.profileId||state.uid||user.uid;
    if(!id)throw new Error("No se encontró tu perfil");

    const existing=state.profile||{};
    const safe={
      ...existing,...(data||{}),
      id,
      ownerUid:existing.ownerUid||state.uid||user.uid,
      ownerEmail:existing.ownerEmail||state.email||user.email||""
    };

    await refs.users.child(id).update(safe);
    state.profile=safe;
    state.profileId=id;
    state.uid=user.uid;
    state.email=String(user.email||state.email||"");
    state.ready=true;
    return safe;
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
    if(!state.isAdmin && !state.permissions?.rings) throw new Error("Sin permiso para modificar Rings");
    const userSnap=await refs.users.child(profileId).once("value");
    if(!userSnap.exists()) throw new Error("Usuario no encontrado");
    const target=userSnap.val()||{};
    if(String(target.ownerUid||"")===state.uid || String(target.ownerEmail||"").toLowerCase()===state.email.toLowerCase()){
      if(!state.isCreator) throw new Error("La creadora está protegida");
    }
    const result=await refs.rings.child(profileId).transaction(v=>Math.max(0,Number(v||target.rings||0)+Math.trunc(Number(delta))));
    if(!result.committed) throw new Error("Firebase no confirmó el cambio de Rings");
    const total=Number(result.snapshot.val()||0);
    await refs.users.child(profileId).update({rings:total});
    await refs.ringHistory.push({userId:profileId,delta:Math.trunc(Number(delta)),reason:String(reason||""),byUid:state.uid,byEmail:state.email,at:firebase.database.ServerValue.TIMESTAMP});
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
    return enabled
      ? refs.permissions.child(u.ownerUid).update({role:"admin",rings:true})
      : refs.permissions.child(u.ownerUid).remove();
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

  auth.onAuthStateChanged(async ()=>{
    try{
      await resolve();
      state.ready=Boolean(state.uid);
      document.dispatchEvent(new CustomEvent("speedy:firebase-ready",{detail:{...state}}));
    }catch(error){
      console.error("[Speedy Firebase]",error);
      document.dispatchEvent(new CustomEvent("speedy:firebase-error",{detail:error}));
    }
  });

  window.SpeedyFirebase={
    auth,db,storage,CloudinaryOST,CLOUDINARY_CONFIG,REALTIME_CONFIG,refs,current:state,
    resolve,saveProfile,signInGoogle,signOut:()=>auth.signOut(),adminHref,
    uploadProfileAsset,uploadOst:(uid,file,trackId)=>CloudinaryOST.upload(file,uid),
    watchPublicUsers,watchUserRings,setRingAmount,grantRingsPermission,setAdminRole,setCafeWorkerRole,setRating,
    isCreator:()=>state.isCreator,isAdmin:()=>state.isAdmin
  };
})();

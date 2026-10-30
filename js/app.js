/* Speedy Friends — lógica principal.
 * Primera etapa de modularización: se conserva el orden original
 * para evitar romper perfiles, ranking, tienda, Firebase, audio y
 * el sistema de encuadre de imágenes.
 */
const BASE_RANKING = [{"name": "Sir Galahad", "rings": 820, "avatar": "assets/legacy-ranking/avatar-1-e2a1e2c8.jpg"}, {"name": "Sir Lancelot", "rings": 760, "avatar": "assets/legacy-ranking/avatar-2-b978ba5d.jpg"}, {"name": "Metal Sonic", "rings": 690, "avatar": "assets/legacy-ranking/avatar-3-1c404e92.jpg"}, {"name": "Blaze", "rings": 610, "avatar": "assets/legacy-ranking/avatar-4-ac195411.jpg"}, {"name": "Surge", "rings": 540, "avatar": "assets/legacy-ranking/avatar-5-1a45e74d.jpg"}];

    const PRODUCTS = [
      {id:"ava-galahad",category:"avatar",name:"Avatar Sir Galahad",rarity:"legendary",price:760,badge:"Nuevo",image:BASE_RANKING[0].avatar,description:"Retrato real de Sir Galahad para tu perfil."},
      {id:"ava-lancelot",category:"avatar",name:"Avatar Sir Lancelot",rarity:"epic",price:620,image:BASE_RANKING[1].avatar,description:"Un avatar elegante, oscuro y competitivo."},
      {id:"ava-metal",category:"avatar",name:"Avatar Metal Sonic",rarity:"rare",price:480,badge:"Oferta -20%",discount:.20,image:BASE_RANKING[2].avatar,description:"Estética metálica para runners de alta velocidad."},
      {id:"ava-blaze",category:"avatar",name:"Avatar Blaze",rarity:"epic",price:590,image:BASE_RANKING[3].avatar,description:"Retrato púrpura con presencia imperial."},
      {id:"ava-surge",category:"avatar",name:"Avatar Surge",rarity:"legendary",price:790,badge:"Nuevo",image:BASE_RANKING[4].avatar,description:"La imagen correcta de Surge, lista para equipar."},

      {id:"frame-neon",category:"frame",name:"Marco Neón Azul",rarity:"rare",price:360,visualClass:"frame-neon",description:"Marco luminoso azul y cian."},
      {id:"frame-gold",category:"frame",name:"Marco Anillo Dorado",rarity:"legendary",price:720,badge:"Nuevo",visualClass:"frame-gold",description:"Un marco premium inspirado en anillos dorados."},
      {id:"frame-glitch",category:"frame",name:"Marco Glitch EXE",rarity:"epic",price:550,visualClass:"frame-glitch",description:"Efecto de interferencia rojo, cian y púrpura."},
      {id:"frame-emerald",category:"frame",name:"Marco Esmeralda",rarity:"rare",price:410,visualClass:"frame-emerald",description:"Resplandor verde para un perfil energético."},

      {id:"bg-synth",category:"background",name:"Fondo Synthwave",rarity:"epic",price:520,badge:"Oferta -20%",discount:.20,visualClass:"bg-synth",description:"Atardecer neón para tu cabecera de perfil."},
      {id:"bg-speed",category:"background",name:"Fondo Líneas de Velocidad",rarity:"rare",price:390,visualClass:"bg-speed",description:"Líneas dinámicas y sensación de movimiento."},
      {id:"bg-void",category:"background",name:"Fondo Vacío Púrpura",rarity:"legendary",price:680,visualClass:"bg-void",description:"Oscuro, profundo y exclusivo."},
      {id:"bg-forest",category:"background",name:"Fondo Esmeralda",rarity:"rare",price:430,visualClass:"bg-forest",description:"Verde vibrante con luz cálida."},

      {id:"emoji-ring",category:"emoji",name:"Badge Ring Collector",rarity:"common",price:140,emoji:"💍",label:"Ring Collector",description:"Badge clásico para coleccionistas."},
      {id:"emoji-star",category:"emoji",name:"Badge Speed Star",rarity:"rare",price:260,emoji:"⭐",label:"Speed Star",description:"Demuestra tu constancia y velocidad."},
      {id:"emoji-chaos",category:"emoji",name:"Badge Chaos Spark",rarity:"epic",price:470,emoji:"💠",label:"Chaos Spark",description:"Badge de energía especial para perfiles destacados."},

      {id:"bundle-speed",category:"bundle",name:"Paquete Speedster",rarity:"legendary",price:1350,badge:"Oferta -20%",discount:.20,includes:["ava-surge","frame-neon","bg-speed","emoji-star"],description:"Avatar Surge, marco neón, fondo de velocidad y badge estrella."},
      {id:"bundle-royal",category:"bundle",name:"Paquete Royal Knight",rarity:"legendary",price:1580,badge:"Nuevo",includes:["ava-galahad","frame-gold","bg-void","emoji-chaos"],description:"Una colección completa de apariencia legendaria."}
    ];


    const CloudinaryOST = {
      async upload(file, userId){
        if(!file || !file.type.startsWith("audio/")) throw new Error("Selecciona un archivo de audio válido");
        const maxBytes = 25 * 1024 * 1024;
        if(file.size > maxBytes) throw new Error("El OST debe pesar 25 MB o menos");
        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
        form.append("folder", "speedy-friends/ost");
        form.append("public_id", `${userId}-${Date.now()}`);
        const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/video/upload`;
        const response = await fetch(endpoint, {method:"POST", body:form});
        const data = await response.json().catch(()=>({}));
        if(!response.ok || !data.secure_url){
          console.error("[Cloudinary OST] upload failed", data);
          throw new Error(data?.error?.message || "No se pudo subir el OST a Cloudinary");
        }
        return { url:data.secure_url, name:file.name, bytes:file.size };
      }
    };

    const RealtimeSync = {
      ready:false,
      ref:null,
      usersRef:null,
      permissionsRef:null,
      ringsRef:null,
      ratingsRef:null,
      ratings:{},
      uid:"",
      email:"",
      admin:false,
      permissions:{},
      ringValues:{},
      timer:null,
      lastSharedHash:"",
      statusNode:null,

      currentUser(){ return typeof firebase !== "undefined" ? firebase.auth().currentUser : null; },
      isAdmin(){ return this.admin === true; },
      isRoleAdmin(){ return Boolean(this.uid && this.permissions?.[this.uid]?.role === "admin"); },
      isSignedIn(){ return Boolean(this.uid); },
      isCreatorProfile(userId){
        const profile=state.users.find(user=>user.id===userId);
        if(!profile) return false;
        const creatorEmail=String(REALTIME_CONFIG.adminEmail||"").trim().toLowerCase();
        return Boolean(creatorEmail && String(profile.ownerEmail||"").trim().toLowerCase()===creatorEmail);
      },
      isTeamAdmin(userId){
        const profile=state.users.find(user=>user.id===userId);
        const ownerUid=profile?.ownerUid;
        if(!ownerUid || this.isCreatorProfile(userId)) return false;
        return this.permissions?.[ownerUid]?.role==="admin";
      },
      canEditRings(userId=state.activeUserId){
        if(this.isCreatorProfile(userId) && !this.isAdmin()) return false;
        if(this.isAdmin()) return true;
        return Boolean(this.uid && (this.permissions?.[this.uid]?.role==="admin" || this.permissions?.[this.uid]?.rings === true));
      },

      async signInGoogle(){
        if(!this.configReady()) { toast("Primero configura Firebase","danger"); return false; }
        try{
          const provider=new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({prompt:"select_account"});
          const result=await firebase.auth().signInWithPopup(provider);
          await this.handleSignedIn(result.user);
          toast(`Sesión iniciada: ${result.user.email}`,"success");
          return true;
        }catch(error){
          console.warn("[Auth] login failed",error);
          const message=error?.code === "auth/popup-blocked"
            ? "El navegador bloqueó la ventana de Google. Permite ventanas emergentes y vuelve a intentarlo."
            : "No se pudo iniciar sesión con Google";
          toast(message,"danger");
          return false;
        }
      },

      async handleSignedIn(user){
        this.uid=user?.uid || "";
        this.email=user?.email || "";
        this.admin=Boolean(this.email && this.email.toLowerCase()===String(REALTIME_CONFIG.adminEmail||"").trim().toLowerCase());
        this.bindPermissionListeners();
        await this.ensureOwnerProfile();
        renderSidebar();
        renderTopbar();
        renderActiveTab();
      },

      async signInAdmin(){
        if(this.isAdmin()){
          switchTab("admin");
          return true;
        }
        return this.signInGoogle();
      },

      async ensureOwnerProfile(){
        if(!this.uid) return;
        let owned=state.users.find(user=>user.ownerUid===this.uid);
        if(!owned && this.email){
          owned=state.users.find(user=>String(user.ownerEmail||"").toLowerCase()===this.email.toLowerCase());
          if(owned){
            owned.ownerUid=this.uid;
            if(this.ready) await this.usersRef.child(owned.id).update({ownerUid:this.uid,ownerEmail:this.email});
          }
        }
        if(!owned && !this.admin){
          const candidate=activeUser();
          if(candidate && !candidate.ownerUid){
            candidate.ownerUid=this.uid;
            candidate.ownerEmail=this.email;
            if(this.ready) await this.usersRef.child(candidate.id).update({ownerUid:this.uid,ownerEmail:this.email});
          }
        }
      },

      async bindPermissionListeners(){
        if(!this.permissionsRef || !this.ringsRef || !this.uid) return;
        this.permissionsRef.off();
        this.ringsRef.off();
        const permissionSource=this.isAdmin() ? this.permissionsRef : this.permissionsRef.child(this.uid);
        permissionSource.on("value",snap=>{
          this.permissions=this.isAdmin() ? (snap.val() || {}) : {[this.uid]:(snap.val() || {})};
          renderSidebar();
          if(state.activeTab==="admin" && this.isAdmin()) renderAdmin();
          if(state.activeTab==="profile") renderProfile();
        });
        this.ringsRef.on("value",snap=>{
          const data=snap.val() || {};
          // Rings are the authoritative ranking value. The profile listener
          // can contain an older cached rings value, so never let it overwrite
          // the live Rings value and make a user jump down/up in the ranking.
          this.ringValues=data;
          state.users.forEach(user=>{
            if(Object.prototype.hasOwnProperty.call(data,user.id)) {
              user.rings=Number(data[user.id]||0);
            }
          });
          renderActiveTab();
          renderSidebar();
          renderTopbar();
        });
      },

      async bindRatingListeners(){
        if(!this.ratingsRef || !this.uid) return;
        this.ratingsRef.off();
        this.ratingsRef.on("value",snap=>{
          this.ratings=snap.val() || {};
          if(state.activeTab==="ranking") renderRanking();
          const overlay=document.getElementById("public-profile-overlay");
          if(overlay?.classList.contains("open")){
            const targetId=overlay.dataset.userId;
            if(targetId) showPublicProfile(targetId);
          }
        });
      },
      ratingSummary(userId){
        const values=Object.values(this.ratings?.[userId] || {}).map(Number).filter(v=>v>=1&&v<=5);
        return {total:values.length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:0};
      },
      myRating(userId){ return Number(this.ratings?.[userId]?.[this.uid] || 0); },
      async setRating(userId,score){
        if(!this.ready || !this.ratingsRef || !this.uid) throw new Error("Inicia sesión con Google para valorar");
        if(!Number.isInteger(score)||score<1||score>5) throw new Error("La valoración debe ser de 1 a 5 estrellas");
        const target=state.users.find(u=>u.id===userId);
        if(!target) throw new Error("Usuario no encontrado");
        if(target.ownerUid===this.uid) throw new Error("No puedes valorarte a ti mismo");

        const ratingRef=this.ratingsRef.child(userId).child(this.uid);
        const existing=await ratingRef.once("value");
        if(existing.exists()) throw new Error("Ya has valorado este perfil. Solo puedes dejar una valoración.");

        await ratingRef.set(score);
      },

      async setRingAmount(userId,delta,reason=""){
        // Wait briefly for Firebase/auth to finish initializing instead of
        // failing intermittently when the admin panel is opened too quickly.
        if(!this.ready || !this.ringsRef){
          await new Promise((resolve,reject)=>{
            const started=Date.now();
            const timer=setInterval(()=>{
              if(this.ready && this.ringsRef){ clearInterval(timer); resolve(); }
              else if(Date.now()-started>7000){ clearInterval(timer); reject(new Error("Realtime no está listo. Espera a que aparezca 'En tiempo real'.")); }
            },100);
          });
        }
        const user=state.users.find(u=>u.id===userId);
        if(!user) throw new Error("Usuario no encontrado");
        if(this.isCreatorProfile(userId) && !this.isAdmin()) throw new Error("La creadora está protegida y no puede ser modificada por otro usuario");
        if(!this.isAdmin() && !(this.permissions?.[this.uid]?.role==="admin" || this.permissions?.[this.uid]?.rings===true)) throw new Error("Sin permiso para modificar Rings");
        const amount=Math.trunc(Number(delta));
        if(!Number.isFinite(amount) || amount===0) throw new Error("Cantidad inválida");
        const ref=this.ringsRef.child(userId);
        const currentLive=Object.prototype.hasOwnProperty.call(this.ringValues,userId)
          ? Number(this.ringValues[userId]||0)
          : Number(user.rings||0);
        const result=await ref.transaction(current=>{
          const base=current === null || current === undefined ? currentLive : Number(current||0);
          return Math.max(0,base+amount);
        });
        if(!result.committed) throw new Error("Firebase no confirmó el cambio de Rings");
        const newTotal=Number(result.snapshot.val()||0);
        this.ringValues[userId]=newTotal;
        user.rings=newTotal;
        // Keep the profile's cached rings field synchronized too. The rings
        // node remains the authoritative value used by the ranking.
        if(this.usersRef) await this.usersRef.child(userId).update({rings:newTotal});
        await this.ringsRef.root.child(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/ringHistory`).push({
          userId,delta:amount,reason:String(reason||""),byUid:this.uid,byEmail:this.email||"",at:firebase.database.ServerValue.TIMESTAMP
        });
        return newTotal;
      },

      async grantRingsPermission(userId,enabled){
        if(!this.isAdmin() || !this.permissionsRef) throw new Error("Solo el administrador puede cambiar permisos");
        const profile=state.users.find(u=>u.id===userId);
        const ownerUid=profile?.ownerUid;
        if(!ownerUid) throw new Error("Ese perfil no tiene una cuenta vinculada. Pide al usuario que inicie sesión con Google primero.");
        const ref=this.permissionsRef.child(ownerUid).child("rings");
        if(enabled) await ref.set(true); else await ref.remove();
      },

      async setBranding(title,subtitle,iconData){
        if(!this.isAdmin()) throw new Error("Solo la creadora puede editar la identidad del sitio");
        const safeTitle=String(title||"").trim().slice(0,60);
        const safeSubtitle=String(subtitle||"").trim().slice(0,100);
        if(!safeTitle) throw new Error("El título no puede estar vacío");
        const current=state.siteSettings || {};
        const next={title:safeTitle,subtitle:safeSubtitle};
        if(iconData === null) next.icon="";
        else next.icon=String(iconData || current.icon || "");
        // Keep the same siteSettings node and update only its fields.
        // This preserves the realtime listener and avoids replacing unrelated
        // branding data if more settings are added later.
        await firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/siteSettings`).update(next);
      },

      async setAdminRole(userId,enabled){
        if(!this.isAdmin() || !this.permissionsRef) throw new Error("Solo la creadora puede cambiar roles");
        const profile=state.users.find(u=>u.id===userId);
        const ownerUid=profile?.ownerUid;
        if(!ownerUid) throw new Error("Ese perfil no tiene una cuenta vinculada. Pide al usuario que inicie sesión con Google primero.");
        if(this.isCreatorProfile(userId)) throw new Error("La creadora ya tiene su espacio especial y no necesita el rol de administración");
        const ref=this.permissionsRef.child(ownerUid);
        if(enabled){
          await ref.update({role:"admin",rings:true});
        } else {
          await ref.child("role").remove();
          await ref.child("rings").remove();
        }
      },

      async deleteUser(userId){
        if(!this.isAdmin() || !this.usersRef || !this.ringsRef || !this.permissionsRef){
          throw new Error("Solo el administrador puede eliminar usuarios");
        }
        const profile=state.users.find(u=>u.id===userId);
        if(!profile) throw new Error("Usuario no encontrado");
        if(profile.ownerUid===this.uid || String(profile.ownerEmail||"").toLowerCase()===this.email.toLowerCase()){
          throw new Error("No puedes eliminar tu propio perfil de administrador");
        }
        const label=profile.username || profile.name || userId;
        if(!confirm(`¿Eliminar a ${label} de Speedy Friends? Esta acción quitará su perfil, Rings y permiso de Rings de Firebase.`)){
          return false;
        }

        await this.usersRef.child(userId).remove();
        await this.ringsRef.child(userId).remove();
        if(profile.ownerUid) await this.permissionsRef.child(profile.ownerUid).remove();

        state.users=state.users.filter(u=>u.id!==userId);
        if(!state.users.length){
          state.users=[defaultProfile()];
        }
        if(state.activeUserId===userId){
          state.activeUserId=state.users[0].id;
        }
        persist();
        renderActiveTab();
        renderSidebar();
        renderTopbar();
        toast(`${label} eliminado de Speedy Friends`,"success");
        return true;
      },

      async logout(){
        try{ await firebase.auth().signOut(); }catch{}
        this.uid=""; this.email=""; this.admin=false; this.permissions={};
        this.statusNode=null;
        if(state.activeTab==="admin") state.activeTab="home";
        this.setStatus("local","Inicia sesión con Google");
        renderSidebar(); renderTopbar(); renderActiveTab();
      },

      configReady(){
        const c=REALTIME_CONFIG.firebaseConfig || {};
        const required=["apiKey","authDomain","databaseURL","projectId","appId"];
        return REALTIME_CONFIG.enabled && typeof firebase !== "undefined" && required.every(key=>typeof c[key]==="string" && c[key].trim());
      },

      setStatus(kind,label){
        const node=this.statusNode || document.getElementById("sync-status");
        if(!node) return;
        node.className=`sync-status ${kind}`;
        node.textContent=label;
        this.statusNode=node;
      },

      sanitizeUser(user){
        const {legacyOst,...clean}=user;
        return {...clean,equipped:{...DEFAULT_EQUIPPED,...(clean.equipped||{})},rings:Number(clean.rings||0)};
      },

      async write(){
        if(!this.ready || !this.usersRef || !this.uid) return;
        try{
          if(this.isAdmin()){
            const updates={};
            state.users.forEach(user=>{ updates[user.id]=this.sanitizeUser(user); });
            // Update children instead of replacing the whole /users node.
            // Firebase rules are defined at /users/$profileId, so a child
            // update lets those per-profile rules be evaluated correctly.
            await this.usersRef.update(updates);
          }else{
            const user=state.users.find(item=>item.ownerUid===this.uid);
            if(!user) return;
            await this.usersRef.child(user.id).set(this.sanitizeUser(user));
          }
          this.setStatus("live","En tiempo real");
        }catch(error){
          console.warn("[RealtimeSync] write failed",error);
          this.setStatus("error","Sin permiso para guardar");
        }
      },

      queueWrite(){
        if(!this.ready || !this.uid) return;
        clearTimeout(this.timer);
        this.timer=setTimeout(()=>this.write(),250);
      },

      async init(){
        this.setStatus("connecting","Conectando…");
        if(!this.configReady()){
          this.setStatus("local","Falta configurar Firebase");
          return;
        }
        try{
          if(!firebase.apps.length) firebase.initializeApp(REALTIME_CONFIG.firebaseConfig);
          this.usersRef=firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/users`);
          this.permissionsRef=firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/permissions`);
          this.siteSettingsRef=firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/siteSettings`);
          this.siteSettingsRef.on("value",snap=>{
            state.siteSettings={title:"Speedy Friends Community Hub",subtitle:"Community Hub",icon:"",...(snap.val()||{})};
            renderBranding();
            if(state.activeTab==="admin" && RealtimeSync.isAdmin()) renderAdmin();
          });
          this.ringsRef=firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/rings`);
          this.ratingsRef=firebase.database().ref(`speedy-friends-teams/${REALTIME_CONFIG.teamId}/ratings`);

          firebase.auth().onAuthStateChanged(async user=>{
            if(!user){
              this.uid=""; this.email=""; this.admin=false; this.permissions={};
              this.ready=false;
              this.setStatus("local","Inicia sesión con Google");
              renderSidebar(); renderTopbar();
              return;
            }
            await this.handleSignedIn(user);
            await this.loadSharedUsers();
          });

          if(firebase.auth().currentUser){
            await this.handleSignedIn(firebase.auth().currentUser);
            await this.loadSharedUsers();
          }else{
            this.setStatus("local","Inicia sesión con Google");
          }
        }catch(error){
          console.error("[RealtimeSync] init failed",error);
          this.setStatus("offline","Sin conexión");
          toast("No se pudo conectar a Firebase","danger");
        }
      },

      async loadSharedUsers(){
        if(!this.usersRef || !this.uid) return;

        const snapshot=await this.usersRef.once("value");
        const remote=snapshot.val() || {};
        const remoteUsers=Object.values(remote);
        const localUsers=Array.isArray(state.users) ? state.users : [];
        const byId=new Map();

        // Keep every profile that already exists locally or remotely.
        // Remote data wins only when the same profile ID already exists.
        localUsers.forEach(user=>{
          if(!user?.id) return;
          byId.set(String(user.id),{
            ...defaultProfile(),
            ...user,
            rings:Number(user.rings||0),
            equipped:{...DEFAULT_EQUIPPED,...(user.equipped||{})}
          });
        });

        remoteUsers.forEach(user=>{
          if(!user?.id) return;
          byId.set(String(user.id),{
            ...defaultProfile(),
            ...user,
            rings:Number(user.rings||0),
            equipped:{...DEFAULT_EQUIPPED,...(user.equipped||{})}
          });
        });

        // IMPORTANT: every Google account gets its own stable profile.
        // Never reuse/reassign another user's profile just because it is
        // the currently selected profile on this browser.
        let own=Array.from(byId.values()).find(u=>u.ownerUid===this.uid);

        if(!own && this.email){
          own=Array.from(byId.values()).find(u=>
            String(u.ownerEmail||"").toLowerCase()===this.email.toLowerCase()
          );
          if(own){
            own.ownerUid=this.uid;
            own.ownerEmail=this.email;
            byId.set(String(own.id),own);
          }
        }

        if(!own){
          const baseName=(this.email || "runner").split("@")[0]
            .replace(/[^a-zA-Z0-9_-]/g,"")
            .slice(0,24) || "runner";

          let profileId=`user-${this.uid}`;
          let suffix=1;
          while(byId.has(profileId)){
            profileId=`user-${this.uid}-${suffix++}`;
          }

          own={
            ...defaultProfile(),
            id:profileId,
            name:baseName,
            username:baseName,
            role:"Runner",
            bio:"",
            rings:0,
            level:1,
            xp:0,
            ownerUid:this.uid,
            ownerEmail:this.email,
            equipped:{...DEFAULT_EQUIPPED}
          };

          byId.set(profileId,own);
        }

        state.users=Array.from(byId.values());
        state.activeUserId=own.id;

        // Admin uploads only profiles that are missing remotely.
        // It never replaces the complete users collection.
        if(this.isAdmin()){
          const updates={};
          state.users.forEach(user=>{
            if(!remote[user.id]) updates[user.id]=this.sanitizeUser(user);
          });
          if(Object.keys(updates).length){
            await this.usersRef.update(updates);
          }
        }else{
          // A newly authenticated account creates/updates only its own
          // profile, leaving every other teammate untouched.
          await this.usersRef.child(own.id).update(this.sanitizeUser(own));
        }

        try{
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              ...state,
              users:state.users.map(({legacyOst,...u})=>u)
            })
          );
        }catch{}

        this.ready=true;

        this.usersRef.off();
        this.usersRef.on("value",snap=>{
          const remoteNow=snap.val() || {};
          const current=activeUser()?.id;

          state.users=Object.values(remoteNow).map(user=>({
            ...defaultProfile(),
            ...user,
            // If the live Rings node already has a value for this user, it
            // wins over the profile's possibly stale rings field.
            rings:Object.prototype.hasOwnProperty.call(this.ringValues,user.id)
              ? Number(this.ringValues[user.id]||0)
              : Number(user.rings||0),
            equipped:{...DEFAULT_EQUIPPED,...(user.equipped||{})}
          }));

          if(!state.users.length) return;

          // Keep this account on its own profile; do not switch it to
          // another teammate when another user signs in elsewhere.
          if(state.users.some(user=>user.id===own.id)){
            state.activeUserId=own.id;
          }else if(current && state.users.some(user=>user.id===current)){
            state.activeUserId=current;
          }else{
            state.activeUserId=state.users[0].id;
          }

          renderActiveTab();
          renderSidebar();
          renderTopbar();
          this.setStatus("live","En tiempo real");
        });

        await this.bindPermissionListeners();
        await this.bindRatingListeners();

        const ringsSnapshot=await this.ringsRef.once("value");
        if(!ringsSnapshot.exists() && this.isAdmin()){
          const ringMap={};
          state.users.forEach(user=>ringMap[user.id]=Number(user.rings||0));
          await this.ringsRef.set(ringMap);
        }

        this.setStatus("live",`En tiempo real · ${this.email}`);
      }
    };

    function renderBranding(){
      const settings=state.siteSettings || {title:"Speedy Friends Community Hub",subtitle:"Community Hub",icon:""};
      const titleEl=document.querySelector("[data-site-title]");
      const subEl=document.querySelector("[data-site-subtitle]");
      const iconEl=document.querySelector("[data-site-icon]");
      if(titleEl) titleEl.textContent=settings.title || "Speedy Friends Community Hub";
      if(subEl) subEl.textContent=settings.subtitle || "Community Hub";
      if(iconEl){
        if(settings.icon){
          iconEl.innerHTML=`<img src="${settings.icon}" alt="Logo de Speedy Friends">`;
          iconEl.classList.add("has-custom-icon");
        }else{
          iconEl.innerHTML='<span class="orbitron">SF</span>';
          iconEl.classList.remove("has-custom-icon");
        }
      }
    }

    function adminUserOptions(){
      const query=String(state.adminSearch||"").trim().toLowerCase();
      const users=state.users.filter(user=>{
        if(!query) return true;
        return [user.username,user.name,user.ownerEmail,user.ownerUid,user.id]
          .some(value=>String(value||"").toLowerCase().includes(query));
      });
      return users.map(user=>`<option value="${escapeHtml(user.id)}">${escapeHtml(user.username || user.name || user.id)} — ${Number(user.rings||0).toLocaleString("es-PE")} Rings</option>`).join("");
    }

    function renderAdmin(){
      const panel=document.getElementById("tab-admin");
      if(!panel) return;
      if(!RealtimeSync.isAdmin() && !RealtimeSync.isRoleAdmin()){ panel.innerHTML=""; return; }

      // Panel reducido para administradores por rol: solo Rings.
      if(!RealtimeSync.isAdmin() && RealtimeSync.isRoleAdmin()){
        const query=String(state.adminSearch||"").trim().toLowerCase();
        const filteredUsers=state.users.filter(user=>{
          if(RealtimeSync.isCreatorProfile(user.id)) return false;
          if(!query) return true;
          return [user.username,user.name,user.ownerEmail,user.ownerUid,user.id]
            .some(value=>String(value||"").toLowerCase().includes(query));
        });
        const rows=filteredUsers.map(user=>`<div class="surface-soft p-4 flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="font-black truncate">${escapeHtml(user.username || user.name || "Sin nombre")}</div>
            <div class="tiny muted truncate">${escapeHtml(user.ownerEmail || "sin cuenta vinculada")}</div>
            <div class="tiny mt-1 text-[var(--gold)]">${Number(user.rings||0).toLocaleString("es-PE")} Rings</div>
          </div>
          <div class="button-row">
            <button class="primary-btn small-btn" data-action="role-admin-ring" data-user-id="${escapeHtml(user.id)}" data-delta="1"><i class="ph-bold ph-plus"></i> Dar Rings</button>
            <button class="danger-btn small-btn" data-action="role-admin-ring" data-user-id="${escapeHtml(user.id)}" data-delta="-1"><i class="ph-bold ph-minus"></i> Quitar Rings</button>
          </div>
        </div>`).join("");
        panel.innerHTML=`<div class="steam-grid">
          <section class="surface p-5">
            <div class="section-kicker">Administrador</div>
            <div class="flex items-center justify-between gap-3 flex-wrap mt-1">
              <h2 class="section-title">Panel de Rings</h2>
              <button class="soft-btn small-btn" data-action="admin-logout"><i class="ph-bold ph-sign-out"></i> Cerrar sesión</button>
            </div>
            <p class="muted text-sm mt-2">Solo puedes agregar o quitar Rings. La creadora está protegida.</p>
            <div class="surface-soft p-3 mt-4">
              <label class="tiny muted">Buscar integrante</label>
              <div class="flex gap-2 mt-2">
                <input id="admin-user-search" class="input flex-1" type="search" value="${escapeHtml(state.adminSearch||"")}" placeholder="Nombre, usuario, correo o UID">
                <button class="soft-btn small-btn" type="button" data-action="clear-admin-search">Limpiar</button>
              </div>
              <div class="tiny muted mt-2">${filteredUsers.length} integrantes encontrados</div>
            </div>
            <div class="steam-grid gap-3 mt-5">${rows || `<div class="muted">No hay coincidencias.</div>`}</div>
          </section>
        </div>`;
        return;
      }

      const query=String(state.adminSearch||"").trim().toLowerCase();
      const filteredUsers=state.users.filter(user=>{
        if(!query) return true;
        return [user.username,user.name,user.ownerEmail,user.ownerUid,user.id]
          .some(value=>String(value||"").toLowerCase().includes(query));
      });

      const rows=filteredUsers.map(user=>{
        const ownerUid=user.ownerUid || "";
        const isCreator=RealtimeSync.isCreatorProfile(user.id);
        const isAdminRole=RealtimeSync.isTeamAdmin(user.id);

        return `<div class="surface-soft p-4 grid gap-3 lg:grid-cols-[1fr_auto] items-center">
          <div class="min-w-0">
            <div class="font-black truncate">${escapeHtml(user.username || user.name || "Sin nombre")}
              ${isCreator ? `<span class="tiny text-[var(--gold)] ml-2">👑 Creadora</span>` : ""}
              ${isAdminRole ? `<span class="tiny text-cyan-300 ml-2">🛡️ Admin</span>` : ""}
            </div>
            <div class="tiny muted truncate">Cuenta: ${escapeHtml(user.ownerEmail || "sin cuenta vinculada")}</div>
            <div class="tiny mt-1 text-[var(--gold)]">${Number(user.rings||0).toLocaleString("es-PE")} Rings</div>
          </div>
          <div class="button-row">
            ${!isCreator ? `<button class="${isAdminRole?"soft-btn":"primary-btn"} small-btn" data-action="toggle-admin-role" data-user-id="${escapeHtml(user.id)}" data-enabled="${isAdminRole?"0":"1"}">${isAdminRole?"Quitar rol de administración":"Dar rol de administración"}</button>` : `<span class="tiny muted px-2">👑 Creadora</span>`}
            ${!isCreator ? `<button class="danger-btn small-btn" data-action="admin-delete-user" data-user-id="${escapeHtml(user.id)}"><i class="ph-bold ph-trash"></i> Eliminar</button>` : ""}
          </div>
        </div>`;
      }).join("");

      panel.innerHTML=`<div class="steam-grid">
        <section class="surface p-5">
          <div class="section-kicker">Solo creadora</div>
          <div class="flex items-center justify-between gap-3 flex-wrap mt-1">
            <h2 class="section-title">Panel de administración</h2>
            <button class="soft-btn small-btn" data-action="admin-logout"><i class="ph-bold ph-sign-out"></i> Cerrar sesión admin</button>
          </div>
          <p class="muted text-sm mt-2">Creadora: ${escapeHtml(RealtimeSync.email || REALTIME_CONFIG.adminEmail)}</p>

          <div class="surface-soft p-3 mt-4">
            <div class="section-kicker">Identidad del sitio</div>
            <h3 class="font-black mt-1">Editar “Speedy Friends Community Hub”</h3>
            <p class="tiny muted mt-1">Solo tú puedes cambiar este título y el texto SF.</p>
            <form id="branding-form" class="grid gap-2 mt-3" autocomplete="off">
              <input id="branding-title" class="input" maxlength="60" value="${escapeHtml(state.siteSettings?.title || "Speedy Friends Community Hub")}" placeholder="Título">
              <input id="branding-subtitle" class="input" maxlength="100" value="${escapeHtml(state.siteSettings?.subtitle || "Community Hub")}" placeholder="Texto debajo del título">
              <div class="flex items-center gap-3 flex-wrap">
                <div class="brand-editor-preview" id="branding-preview"><img src="${escapeHtml(state.siteSettings?.icon || "")}" alt="" style="${state.siteSettings?.icon?"display:block":"display:none"}"><span class="orbitron" style="${state.siteSettings?.icon?"display:none":"display:block"}">SF</span></div>
                <div class="grid gap-2 flex-1 min-w-[220px]">
                  <label class="tiny muted">Icono/logo del recuadro SF</label>
                  <input id="branding-icon" class="input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml">
                  <div class="flex gap-2">
                    <button class="soft-btn small-btn" type="button" data-action="clear-branding-icon"><i class="ph-bold ph-trash"></i> Quitar icono</button>
                    <span class="tiny muted self-center">Solo tú puedes cambiarlo.</span>
                  </div>
                </div>
              </div>
              <button class="primary-btn small-btn" type="submit"><i class="ph-bold ph-floppy-disk"></i> Guardar identidad</button>
            </form>
          </div>

          <div class="surface-soft p-3 mt-4">
            <label class="tiny muted">Buscar integrante</label>
            <div class="flex gap-2 mt-2">
              <input id="admin-user-search" class="input flex-1" type="search" value="${escapeHtml(state.adminSearch||"")}" placeholder="Nombre, usuario, correo o UID">
              <button class="soft-btn small-btn" type="button" data-action="clear-admin-search"><i class="ph-bold ph-x"></i> Limpiar</button>
            </div>
            <div class="tiny muted mt-2">${filteredUsers.length} de ${state.users.length} integrantes mostrados</div>
          </div>

          <div class="steam-grid gap-3 mt-5">${rows || `<div class="muted">No hay coincidencias.</div>`}</div>
        </section>

        <section class="surface p-5">
          <div class="section-kicker">Control de Rings</div>
          <h3 class="section-title mt-1">Agregar o quitar Rings</h3>
          <p class="muted text-sm mt-2">La creadora puede modificar a todos. Las cuentas con permiso Rings pueden modificar a cualquier integrante excepto a la creadora.</p>
          <form id="admin-rings-form" class="grid gap-3 mt-4 md:grid-cols-4" autocomplete="off">
            <select id="admin-rings-user" class="select" required>${adminUserOptions()}</select>
            <input id="admin-rings-amount" class="input" type="number" min="1" step="1" placeholder="Cantidad" required>
            <input id="admin-rings-reason" class="input md:col-span-2" placeholder="Motivo (opcional)">
            <div class="button-row md:col-span-4">
              <button type="submit" class="primary-btn" data-ring-operation="add"><i class="ph-bold ph-plus"></i> Agregar Rings</button>
              <button type="button" class="danger-btn" data-ring-operation="remove"><i class="ph-bold ph-minus"></i> Quitar Rings</button>
            </div>
          </form>
        </section>
      </div>`;
    }

    const TAB_META = {
      home:["Inicio","Tu centro de Speedy Friends"],
      profile:["Perfil","Edita tu identidad, foto y OST"],
      ranking:["Ranking Global","Integrantes registrados"],
      store:["Tienda de Accesorios","Compra y prueba cosméticos para tu perfil"],
      inventory:["Mi Inventario","Equipa los accesorios que ya compraste"],
      audio:["Audio y OST","Control manual sin cambios automáticos al navegar"],
      admin:["Administración","Permisos y control del team"]
    };

    const RARITY_LABEL = {
      common:"Común",
      rare:"Raro",
      epic:"Épico",
      legendary:"Legendario"
    };

    const CATEGORY_LABEL = {
      all:"Todo",
      avatar:"Avatares",
      frame:"Marcos",
      background:"Fondos",
      emoji:"Emojis",
      bundle:"Paquetes"
    };

    const DEFAULT_EQUIPPED = {avatar:null,frame:null,background:null,badge:"emoji-ring"};

    const defaultProfile = () => ({
      id:"speedy-friends",
      name:"Speedy Friends",
      username:"Speedy Friends",
      role:"Runner",
      bio:"Listo para acelerar, romper récords y coleccionar rings.",
      avatar:BASE_RANKING[4].avatar,
      cover:"",
      rings:358,
      level:24,
      xp:72,
      ostName:"",
      hasOst:false,
      equipped:{...DEFAULT_EQUIPPED}
    });

    function migrateOldData(){
      const oldHub = safeParse(localStorage.getItem("sonic-team-hub-state"),null);
      const oldUserLists = [
        safeParse(localStorage.getItem("sf_users_simple_v1"),[]),
        safeParse(localStorage.getItem("sf_local_users_v1"),[]),
        safeParse(localStorage.getItem("sf_users_github_v1"),[])
      ].find(list => Array.isArray(list) && list.length) || [];

      const users = [];
      if(oldHub?.member){
        const member = oldHub.member;
        users.push({
          id:makeId(member.name || "speedy-friends"),
          name:member.name || "Speedy Friends",
          username:member.name || "Speedy Friends",
          role:member.role || "Runner",
          bio:member.status || "Integrante de Speedy Friends.",
          avatar:member.avatar || BASE_RANKING[4].avatar,
          cover:member.cover || "",
          rings:Number(member.rings || 0),
          level:Number(member.level || 1),
          xp:Number(member.xp || 0),
          ostName:"",
          hasOst:false,
          equipped:{...DEFAULT_EQUIPPED}
        });
      }

      oldUserLists.forEach(item => {
        const id = item.id || makeId(item.username || item.name);
        if(users.some(user => user.id === id)) return;
        users.push({
          id,
          name:item.name || item.username || "Integrante",
          username:item.username || item.name || "Integrante",
          role:"Runner",
          bio:"Integrante registrado en Speedy Friends.",
          avatar:item.avatar || BASE_RANKING[4].avatar,
          cover:"",
          rings:Number(item.rings || 0),
          level:1,
          xp:0,
          ostName:item.ostName || "",
          hasOst:Boolean(item.ost),
          legacyOst:item.ost || "",
          equipped:{...DEFAULT_EQUIPPED}
        });
      });

      if(!users.length) users.push(defaultProfile());
      return users;
    }

    const defaultState = () => {
      const users = migrateOldData();
      return {
        theme:"dark",
        motion:true,
        activeTab:"home",
        coins:3000,
        cart:[],
        inventory:["emoji-ring"],
        activeUserId:users[0].id,
        users,
        storeFilter:"all",
        storeSearch:"",
        adminSearch:"",
        siteSettings:{title:"Speedy Friends Community Hub",subtitle:"Community Hub",icon:""},
        previewProductId:null,
        audio:{enabled:true,volume:.58},
        dailyClaim:"",
        version:1
      };
    };

    let state = (() => {
      const saved = safeParse(localStorage.getItem(STORAGE_KEY),null);
      const fresh = defaultState();
      if(!saved) return fresh;
      return {
        ...fresh,
        ...saved,
        users:Array.isArray(saved.users) && saved.users.length ? saved.users.map(user => ({
          ...defaultProfile(),
          ...user,
          equipped:{...DEFAULT_EQUIPPED,...(user.equipped || {})}
        })) : fresh.users,
        audio:{...fresh.audio,...(saved.audio || {})},
        inventory:Array.isArray(saved.inventory) ? saved.inventory : fresh.inventory,
        cart:Array.isArray(saved.cart) ? saved.cart : []
      };
    })();

    const pending = {avatar:null,cover:null,ostBlob:null,ostName:""};
    window.pending = pending;

    const AssetDB = {
      db:null,
      async open(){
        if(this.db) return this.db;
        this.db = await new Promise((resolve,reject) => {
          const request = indexedDB.open("speedy-friends-assets",1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if(!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return this.db;
      },
      async put(key,value){
        const db = await this.open();
        return new Promise((resolve,reject) => {
          const tx = db.transaction("assets","readwrite");
          tx.objectStore("assets").put(value,key);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      },
      async get(key){
        const db = await this.open();
        return new Promise((resolve,reject) => {
          const request = db.transaction("assets","readonly").objectStore("assets").get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      async remove(key){
        const db = await this.open();
        return new Promise((resolve,reject) => {
          const tx = db.transaction("assets","readwrite");
          tx.objectStore("assets").delete(key);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }
    };

    const AudioController = {
      main:null,
      custom:null,
      customUrl:"",
      current:"none",
      init(){
        this.main = document.getElementById("main-ost");
        this.custom = new Audio();
        this.custom.loop = true;
        this.custom.preload = "metadata";
        this.setVolume(state.audio.volume);
      },
      setVolume(value){
        const volume = Math.min(1,Math.max(0,Number(value)));
        state.audio.volume = volume;
        if(this.main) this.main.volume = volume;
        if(this.custom) this.custom.volume = volume;
        persist();
        updateAudioIndicators();
      },
      enable(value){
        state.audio.enabled = Boolean(value);
        if(!state.audio.enabled) this.stop();
        persist();
        renderTopbar();
        updateAudioIndicators();
      },
      toggle(){this.enable(!state.audio.enabled)},
      stop(){
        [this.main,this.custom].forEach(audio => {
          if(!audio) return;
          try{audio.pause();audio.currentTime=0}catch{}
        });
        this.current="none";
        updateAudioIndicators();
      },
      async playMain(){
        if(!state.audio.enabled) this.enable(true);
        this.stop();
        this.main.volume=state.audio.volume;
        try{
          await this.main.play();
          this.current="main";
          toast("Reproduciendo OST principal","success");
        }catch{
          toast("Toca nuevamente para reproducir el OST principal","danger");
        }
        updateAudioIndicators();
      },
      async playCustom(userId=state.activeUserId){
        const user = state.users.find(item => item.id === userId);
        if(!user?.hasOst && !user?.legacyOst){
          toast("Este perfil aún no tiene un OST personalizado","danger");
          return;
        }

        if(!state.audio.enabled) this.enable(true);
        this.stop();

        let source="";
        if(user.ostUrl){
          source=user.ostUrl;
        }else if(user.legacyOst){
          source=user.legacyOst;
        }else{
          let blob=null;
          try{
            blob=await AssetDB.get(`ost:${user.id}`);
          }catch(error){
            console.error("[OST] read failed",error);
            toast("No se pudo acceder al OST personalizado","danger");
            return;
          }
          if(!blob){
            toast("No se encontró el archivo del OST en este dispositivo","danger");
            return;
          }
          if(this.customUrl) URL.revokeObjectURL(this.customUrl);
          this.customUrl=URL.createObjectURL(blob);
          source=this.customUrl;
        }

        this.custom.src=source;
        this.custom.volume=state.audio.volume;
        try{
          await this.custom.play();
          this.current="custom";
          toast(`Reproduciendo el OST de ${user.username}`,"success");
        }catch{
          toast("Toca nuevamente para reproducir Mi OST","danger");
        }
        updateAudioIndicators();
      }
    };

    function persist(){
      const cleanState = {
        ...state,
        users:state.users.map(({legacyOst,...user}) => user)
      };
      try{
        localStorage.setItem(STORAGE_KEY,JSON.stringify(cleanState));
      }catch{
        toast("No se pudo guardar. Reduce el tamaño de las imágenes.","danger");
      }
      RealtimeSync.queueWrite();
    }

    function activeUser(){
      return state.users.find(user => user.id === state.activeUserId) || state.users[0];
    }

    function productById(id){return PRODUCTS.find(product => product.id === id)}
    function finalPrice(product){return Math.round(product.price * (1-(product.discount || 0)))}
    function owned(id){return state.inventory.includes(id)}
    function cartHas(id){return state.cart.includes(id)}

    function toast(message,type="success"){
      const node=document.getElementById("toast");
      node.textContent=message;
      node.className=`toast ${type} show`;
      clearTimeout(window.__speedyToast);
      window.__speedyToast=setTimeout(() => node.classList.remove("show"),2200);
    }

    async function resizeImage(file,maxSize=1150,quality=.84){
      return new Promise((resolve,reject) => {
        const reader=new FileReader();
        reader.onload=() => {
          const image=new Image();
          image.onload=() => {
            const ratio=Math.min(1,maxSize/Math.max(image.width,image.height));
            const canvas=document.createElement("canvas");
            canvas.width=Math.round(image.width*ratio);
            canvas.height=Math.round(image.height*ratio);
            canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
            resolve(canvas.toDataURL("image/jpeg",quality));
          };
          image.onerror=reject;
          image.src=reader.result;
        };
        reader.onerror=reject;
        reader.readAsDataURL(file);
      });
    }

    function slotFor(product){
      if(!product) return null;
      if(product.category==="avatar") return "avatar";
      if(product.category==="frame") return "frame";
      if(product.category==="background") return "background";
      if(product.category==="emoji") return "badge";
      return null;
    }

    function effectiveEquipment(user,previewProduct=null){
      const equipment={...DEFAULT_EQUIPPED,...(user.equipped || {})};
      if(!previewProduct) return equipment;
      if(previewProduct.category==="bundle"){
        (previewProduct.includes || []).forEach(id => {
          const included=productById(id);
          const slot=slotFor(included);
          if(slot) equipment[slot]=included.id;
        });
      }else{
        const slot=slotFor(previewProduct);
        if(slot) equipment[slot]=previewProduct.id;
      }
      return equipment;
    }

    function profilePreviewHtml(user,previewProduct=null,compact=false){
      const equipment=effectiveEquipment(user,previewProduct);
      const avatarProduct=productById(equipment.avatar);
      const frameProduct=productById(equipment.frame);
      const bgProduct=productById(equipment.background);
      const badgeProduct=productById(equipment.badge);
      const avatar=avatarProduct?.image || user.avatar || BASE_RANKING[4].avatar;
      const frameClass=frameProduct?.visualClass || "";
      const bgClass=bgProduct?.visualClass || "bg-default";
      const customCoverStyle=!bgProduct && user.cover
        ? `style="background-image:linear-gradient(to top,rgba(5,11,18,.96),rgba(5,11,18,.08) 65%),url('${user.cover}');background-size:cover;background-position:center"`
        : "";
      const badgeEmoji=badgeProduct?.emoji || "⚡";
      const badgeLabel=badgeProduct?.label || user.role || "Runner";

      return `
        <div class="profile-preview ${bgClass} ${compact ? "min-h-[330px]" : ""}" ${customCoverStyle}>
          <div class="profile-banner-line"></div>
          <div class="profile-avatar-row">
            <div class="avatar-frame ${frameClass}">
              <img src="${avatar}" alt="Avatar de ${escapeHtml(user.username)}" class="profile-avatar" loading="lazy">
            </div>
            <div class="min-w-0">
              <div class="profile-badge">${badgeEmoji} ${escapeHtml(badgeLabel)}</div>
              <div class="orbitron text-2xl sm:text-3xl font-black break-words">${escapeHtml(user.username)}</div>
              <div class="text-sm text-white/70 mt-1">${escapeHtml(user.role || "Runner")} · Nivel ${Number(user.level || 1)}</div>
              <p class="text-sm text-white/70 mt-3 leading-relaxed line-clamp-3">${escapeHtml(user.bio || "")}</p>
            </div>
          </div>
        </div>
      `;
    }

    function productVisualHtml(product,size="card"){
      const previewUser=activeUser();
      const currentAvatar=previewUser.avatar || BASE_RANKING[4].avatar;

      if(product.category==="avatar"){
        return `<div class="product-visual-inner"><img class="product-avatar-img" src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy"></div>`;
      }

      if(product.category==="frame"){
        return `<div class="product-visual-inner"><div class="product-frame-demo ${product.visualClass}"><img src="${currentAvatar}" alt="Vista previa del marco" loading="lazy"></div></div>`;
      }

      if(product.category==="background"){
        return `<div class="product-visual-inner"><div class="product-bg-demo profile-preview ${product.visualClass}"></div></div>`;
      }

      if(product.category==="emoji"){
        return `<div class="product-visual-inner"><div class="product-emoji">${product.emoji}</div></div>`;
      }

      if(product.category==="bundle"){
        const included=(product.includes || []).map(productById).filter(Boolean);
        const visual=included.slice(0,3).map(item => {
          if(item.category==="avatar") return `<img class="product-avatar-img !w-[82px] !h-[82px] !rounded-[22px]" src="${item.image}" alt="" loading="lazy">`;
          if(item.category==="emoji") return `<div class="product-emoji !text-[3rem]">${item.emoji}</div>`;
          return `<div class="w-[76px] h-[76px] rounded-[20px] ${item.visualClass || ""} border border-white/20"></div>`;
        }).join("");
        return `<div class="product-visual-inner product-bundle">${visual}</div>`;
      }

      return "";
    }

    function renderSidebar(){
      const user=activeUser();
      document.querySelectorAll('[data-admin-nav]').forEach(node=>node.remove());
      if(RealtimeSync.isAdmin() || RealtimeSync.isRoleAdmin()){
        document.getElementById("desktop-nav")?.insertAdjacentHTML("beforeend",`<button class="nav-item ${state.activeTab==='admin'?"active":""}" data-tab="admin" data-admin-nav="1" aria-label="Administración"><i class="ph-bold ph-shield-check"></i><span>Administración</span></button>`);
        document.getElementById("mobile-nav")?.insertAdjacentHTML("beforeend",`<button class="nav-item ${state.activeTab==='admin'?"active":""}" data-tab="admin" data-admin-nav="1" aria-label="Administración"><i class="ph-bold ph-shield-check"></i><span>Admin</span></button>`);
      }
      document.getElementById("sidebar-user").innerHTML=`
        <img class="sidebar-avatar" src="${user.avatar || BASE_RANKING[4].avatar}" alt="${escapeHtml(user.username)}">
        <div class="min-w-0">
          <div class="font-black text-sm truncate">${escapeHtml(user.username)}</div>
          <div class="tiny muted truncate">${escapeHtml(user.role || "Runner")}</div>
        </div>
      `;
    }

    function renderTopbar(){
      document.getElementById("top-coins").textContent=state.coins.toLocaleString("es-PE");
      document.getElementById("cart-count").textContent=state.cart.length;
      document.getElementById("cart-count").style.display=state.cart.length ? "grid" : "none";
      document.getElementById("theme-icon").className=state.theme==="dark" ? "ph-bold ph-moon" : "ph-bold ph-sun";
      const accountBtn=document.getElementById("account-login-btn");
      if(accountBtn){
        accountBtn.title=RealtimeSync.isSignedIn() ? `Sesión: ${RealtimeSync.email}` : "Iniciar sesión con Google";
        accountBtn.innerHTML=RealtimeSync.isSignedIn() ? `<i class="ph-fill ph-user-circle"></i>` : `<i class="ph-bold ph-user-circle"></i>`;
      }
      const adminBtn=document.getElementById("admin-login-btn");
      if(adminBtn){
        adminBtn.style.display=RealtimeSync.isAdmin() ? "inline-flex" : "inline-flex";
        adminBtn.title=RealtimeSync.isAdmin() ? `Administración: ${RealtimeSync.email}` : "Acceso administrador";
        adminBtn.innerHTML=RealtimeSync.isAdmin() ? `<i class="ph-fill ph-shield-check"></i>` : `<i class="ph-bold ph-shield-check"></i>`;
      }
    }

    function renderHome(){
      const user=activeUser();
      const top=[...BASE_RANKING,...state.users.map(item => ({name:item.username,rings:item.rings,avatar:item.avatar}))].sort((a,b)=>b.rings-a.rings)[0];
      const ownedCount=state.inventory.length;
      const featured=PRODUCTS.filter(item => item.badge).slice(0,3);

      document.getElementById("tab-home").innerHTML=`
        <div class="steam-grid">
          <section class="surface hero">
            <div class="hero-content">
              <div class="section-kicker">Speedy Friends Team</div>
              <h1 class="hero-title">Tu comunidad, ahora como un <span>hub de juego</span>.</h1>
              <p class="hero-copy">Cada apartado está separado por pestañas. Edita tu perfil, revisa el ranking, compra accesorios, equipa tu inventario y controla tus OST sin que la música cambie sola.</p>
              <div class="button-row mt-6">
                <button class="primary-btn" data-tab="store"><i class="ph-bold ph-storefront"></i> Explorar tienda</button>
                <button class="soft-btn" data-tab="profile"><i class="ph-bold ph-user-circle"></i> Editar perfil</button>
                <button class="soft-btn" data-action="claim-daily"><i class="ph-bold ph-gift"></i> Recompensa diaria</button>
              </div>
            </div>
          </section>

          <section class="steam-grid stats-grid">
            <article class="surface stat-card"><div class="stat-value text-[var(--gold)]">${state.coins.toLocaleString("es-PE")}</div><div class="stat-label">Monedas disponibles</div></article>
            <article class="surface stat-card"><div class="stat-value">${state.users.length}</div><div class="stat-label">Perfiles registrados</div></article>
            <article class="surface stat-card"><div class="stat-value">${ownedCount}</div><div class="stat-label">Accesorios en inventario</div></article>
            <article class="surface stat-card"><div class="stat-value truncate">${escapeHtml(top?.name || "—")}</div><div class="stat-label">Líder actual</div></article>
          </section>

          <section class="steam-grid dashboard-grid">
            <div class="steam-grid">
              <div class="surface p-4 sm:p-5">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div class="section-kicker">Acceso rápido</div>
                    <h2 class="section-title mt-1">Todo separado y ordenado</h2>
                  </div>
                </div>
                <div class="steam-grid quick-grid">
                  <button class="surface-soft quick-card text-left" data-tab="ranking">
                    <div class="quick-icon"><i class="ph-bold ph-trophy"></i></div>
                    <div class="font-black">Ranking Global</div>
                    <div class="tiny muted mt-2">Consulta los puestos sin mezclarlo con otras secciones.</div>
                  </button>
                  <button class="surface-soft quick-card text-left" data-tab="inventory">
                    <div class="quick-icon"><i class="ph-bold ph-backpack"></i></div>
                    <div class="font-black">Mi Inventario</div>
                    <div class="tiny muted mt-2">Equipa avatares, marcos, fondos y badges.</div>
                  </button>
                  <button class="surface-soft quick-card text-left" data-tab="audio">
                    <div class="quick-icon"><i class="ph-bold ph-music-notes"></i></div>
                    <div class="font-black">Audio y OST</div>
                    <div class="tiny muted mt-2">El audio solo cambia cuando presionas un botón.</div>
                  </button>
                </div>
              </div>

              <div class="surface p-4 sm:p-5">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div class="section-kicker">Destacados</div>
                    <h2 class="section-title mt-1">Novedades de la tienda</h2>
                  </div>
                  <button class="soft-btn small-btn" data-tab="store">Ver todo</button>
                </div>
                <div class="steam-grid product-grid">
                  ${featured.map(productCardHtml).join("")}
                </div>
              </div>
            </div>

            <div class="steam-grid">
              <div class="surface overflow-hidden">
                ${profilePreviewHtml(user)}
              </div>
              <div class="surface p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="font-black">${escapeHtml(user.username)}</div>
                    <div class="tiny muted mt-1">${Number(user.rings || 0)} rings · Nivel ${Number(user.level || 1)}</div>
                  </div>
                  <button class="soft-btn small-btn" data-tab="profile">Editar</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      `;
    }

    function profileFormHtml(){
      const user=activeUser();
      return `
        <div class="surface p-4 sm:p-5">
          <div class="flex items-center justify-between gap-3 mb-5">
            <div>
              <div class="section-kicker">Identidad del runner</div>
              <h2 class="section-title mt-1">Editar perfil</h2>
            </div>
            <button class="soft-btn small-btn" data-action="new-profile"><i class="ph-bold ph-user-plus"></i> Nuevo</button>
          </div>

          <div class="field mb-4">
            <label for="profile-selector">Perfil activo</label>
            <select id="profile-selector" class="select" data-action="select-profile">
              ${(() => {
                const signedInProfiles = RealtimeSync.isSignedIn()
                  ? state.users.filter(item => item.ownerUid === RealtimeSync.uid)
                  : [];
                const visibleProfiles = signedInProfiles.length
                  ? signedInProfiles
                  : [user];
                return visibleProfiles.map(item =>
                  `<option value="${item.id}" ${item.id===state.activeUserId ? "selected" : ""}>${escapeHtml(item.username || item.name || "Mi perfil")}</option>`
                ).join("");
              })()}
            </select>
          </div>

          <form id="profile-form" class="steam-grid" autocomplete="off">
            <input type="hidden" id="profile-id" value="${escapeHtml(user.id)}">

            <div class="steam-grid form-grid">
              <div class="field">
                <label for="profile-name">Nombre</label>
                <input id="profile-name" class="input" value="${escapeHtml(user.name)}" required>
              </div>
              <div class="field">
                <label for="profile-username">Usuario / apodo</label>
                <input id="profile-username" class="input" value="${escapeHtml(user.username)}" required>
              </div>
              <div class="field">
                <label for="profile-role">Título</label>
                <input id="profile-role" class="input" value="${escapeHtml(user.role || "Runner")}">
              </div>
              <div class="field">
                <label for="profile-rings">Rings ${RealtimeSync.canEditRings(user.id) ? "" : "<span class='muted tiny'>(solo lectura)</span>"}</label>
                <input id="profile-rings" class="input" type="number" min="0" value="${Number(user.rings || 0)}" ${RealtimeSync.canEditRings(user.id) ? "" : "disabled"}>
              </div>
            </div>

            <div class="field">
              <label for="profile-bio">Descripción</label>
              <textarea id="profile-bio" class="textarea">${escapeHtml(user.bio || "")}</textarea>
            </div>

            <div class="steam-grid form-grid">
              <label class="file-drop">
                <strong class="text-sm">Foto de perfil</strong>
                <span class="tiny muted">Se optimiza antes de guardarse.</span>
                <input id="avatar-file" type="file" accept="image/*" aria-label="Subir foto de perfil">
              </label>

              <label class="file-drop">
                <strong class="text-sm">Fondo personalizado</strong>
                <span class="tiny muted">Opcional; los fondos comprados se equipan desde Inventario.</span>
                <input id="cover-file" type="file" accept="image/*" aria-label="Subir fondo de perfil">
              </label>

              <label class="file-drop">
                <strong class="text-sm">OST personalizado</strong>
                <span class="tiny muted">${user.ostName ? `Actual: ${escapeHtml(user.ostName)}` : "Audio compartido mediante Cloudinary."}</span>
                <input id="ost-file" type="file" accept="audio/*" aria-label="Subir OST personalizado">
              </label>
            </div>

            <div class="button-row">
              <button class="primary-btn" type="submit"><i class="ph-bold ph-floppy-disk"></i> Guardar perfil</button>
              <button class="soft-btn" type="button" data-action="play-custom-ost"><i class="ph-bold ph-play"></i> Probar Mi OST</button>
              ${RealtimeSync.isAdmin() ? `<button class="danger-btn" type="button" data-action="delete-profile"><i class="ph-bold ph-trash"></i> Borrar perfil local</button>` : ""}
            </div>
          </form>
        </div>
      `;
    }

    function renderProfile(){
      const user=activeUser();
      const equipment=effectiveEquipment(user);
      const slots=[
        ["avatar","Avatar",productById(equipment.avatar)?.name || "Foto personal","ph-user-circle"],
        ["frame","Marco",productById(equipment.frame)?.name || "Sin marco","ph-frame-corners"],
        ["background","Fondo",productById(equipment.background)?.name || "Fondo base","ph-image"],
        ["badge","Badge",productById(equipment.badge)?.name || "Badge base","ph-seal"]
      ];

      document.getElementById("tab-profile").innerHTML=`
        <div class="steam-grid profile-layout">
          ${profileFormHtml()}
          <div class="steam-grid">
            <div class="surface overflow-hidden">
              ${profilePreviewHtml(user)}
            </div>
            <div class="surface p-4">
              <div class="section-kicker">Equipamiento actual</div>
              <div class="steam-grid slot-grid mt-3">
                ${slots.map(([slot,label,value,icon]) => `
                  <div class="surface-soft slot-card">
                    <div class="slot-icon"><i class="ph-bold ${icon}"></i></div>
                    <div class="min-w-0">
                      <div class="tiny muted">${label}</div>
                      <div class="font-black text-sm truncate">${escapeHtml(value)}</div>
                    </div>
                  </div>
                `).join("")}
              </div>
              <button class="soft-btn full-btn mt-4" data-tab="inventory"><i class="ph-bold ph-backpack"></i> Abrir inventario</button>
            </div>
          </div>
        </div>
      `;
    }

    function rankingItemHtml(item,index,showPosition=true){
      return `<article class="surface-soft rank-row ${item.type==="user" ? "cursor-pointer" : ""}" ${item.type==="user" ? `data-action="view-public-profile" data-user-id="${item.userId}" tabindex="0" role="button"` : ""}>
        ${showPosition ? `<div class="rank-position">${index+1}</div>` : `<div class="rank-position">👑</div>`}
        <img class="rank-avatar" src="${item.avatar}" alt="${escapeHtml(item.name)}" loading="lazy">
        <div class="min-w-0">
          <div class="rank-name">${escapeHtml(item.name)}</div>
          <div class="rank-realname">${escapeHtml(item.realname || "Integrante")}</div>
        </div>
        <div class="rank-rings">
          <strong>${Number(item.rings).toLocaleString("es-PE")}</strong>
          <div class="tiny muted">rings</div>
          ${RealtimeSync.ratingSummary(item.userId).total ? `<div class="tiny" style="color:var(--gold);margin-top:3px">⭐ ${RealtimeSync.ratingSummary(item.userId).average.toFixed(1)}</div>` : ""}
        </div>
        <div class="flex items-center justify-end gap-2 flex-wrap">
          ${item.hasOst ? `<button class="icon-btn !w-[38px] !h-[38px]" data-action="play-user-ost" data-user-id="${item.userId}" aria-label="Reproducir OST de ${escapeHtml(item.name)}"><i class="ph-bold ph-music-notes"></i></button>` : ""}
        </div>
      </article>`;
    }

    function renderRanking(){
      const registered=state.users.map(user => ({
        name:user.username,
        realname:user.name,
        rings:Number(user.rings || 0),
        avatar:user.avatar || BASE_RANKING[4].avatar,
        type:"user",
        userId:user.id,
        hasOst:user.hasOst || Boolean(user.legacyOst),
        isCreator:RealtimeSync.isCreatorProfile(user.id),
        isAdmin:RealtimeSync.isTeamAdmin(user.id)
      }));

      const creator=registered.find(item=>item.isCreator);
      const admins=registered.filter(item=>item.isAdmin && !item.isCreator).sort((a,b)=>b.rings-a.rings);
      const members=registered.filter(item=>!item.isCreator && !item.isAdmin).sort((a,b)=>b.rings-a.rings);

      document.getElementById("tab-ranking").innerHTML=`
        <div class="steam-grid gap-5">
          <section class="surface p-4 sm:p-5">
            <div class="section-kicker">Espacio especial</div>
            <h2 class="section-title mt-1">👑 Creadora</h2>
            <p class="muted text-sm mt-2">Perfil destacado de la creadora de Speedy Friends.</p>
            <div class="ranking-list mt-4">${creator ? rankingItemHtml(creator,0,false) : `<div class="muted">Aún no se ha vinculado el perfil de la creadora.</div>`}</div>
          </section>

          <section class="surface p-4 sm:p-5">
            <div class="section-kicker">Equipo de administración</div>
            <h2 class="section-title mt-1">🛡️ Administración</h2>
            <p class="muted text-sm mt-2">Administradores designados desde el panel de la creadora.</p>
            <div class="ranking-list mt-4">${admins.length ? admins.map((item,index)=>rankingItemHtml(item,index,true)).join("") : `<div class="muted">Todavía no hay administradores designados.</div>`}</div>
          </section>

          <section class="surface p-4 sm:p-5">
            <div class="section-kicker">Comunidad</div>
            <h2 class="section-title mt-1">🏆 Integrantes</h2>
            <p class="muted text-sm mt-2">Solo aparecen integrantes registrados que no tienen un rol especial.</p>
            <div class="ranking-list mt-4">${members.length ? members.map((item,index)=>rankingItemHtml(item,index,true)).join("") : `<div class="muted">Todavía no hay integrantes para mostrar.</div>`}</div>
          </section>
        </div>
      `;
    }

    function closePublicProfile(){
      const overlay=document.getElementById("public-profile-overlay");
      if(!overlay) return;
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden","true");
    }

    function showPublicProfile(userId){
      const user=state.users.find(item=>item.id===userId);
      if(!user) return toast("Usuario no encontrado","danger");
      const overlay=document.getElementById("public-profile-overlay");
      const body=document.getElementById("public-profile-body");
      const title=document.getElementById("public-profile-title");
      if(!overlay || !body || !title) return;
      title.textContent=user.username || user.name || "Integrante";
      overlay.dataset.userId=user.id;

      const equipment=user.equipped || {};
      const bgProduct=productById(equipment.background);
      const avatarProduct=productById(equipment.avatar);
      const frameProduct=productById(equipment.frame);
      const badgeProduct=productById(equipment.badge);
      const avatar=avatarProduct?.image || user.avatar || BASE_RANKING[4].avatar;
      const frameClass=frameProduct?.visualClass || "";
      const bgClass=bgProduct?.visualClass || "bg-default";
      const customCoverStyle=!bgProduct && user.cover
        ? `background-image:linear-gradient(to top,rgba(5,11,18,.96),rgba(5,11,18,.08) 65%),url('${String(user.cover).replace(/'/g,"%27")}');background-size:cover;background-position:center;`
        : "";
      const badgeEmoji=badgeProduct?.emoji || "⚡";
      const badgeLabel=badgeProduct?.label || user.role || "Runner";
      const hasOst=user.hasOst || Boolean(user.legacyOst || user.ostUrl);

      body.innerHTML=`
        <div class="profile-preview ${bgClass}" style="${customCoverStyle}min-height:250px;margin-bottom:18px">
          <div class="profile-banner-line"></div>
          <div class="profile-avatar-row">
            <div class="avatar-frame ${frameClass}">
              <img src="${avatar}" alt="Avatar de ${escapeHtml(user.username||user.name)}" class="profile-avatar" loading="lazy">
            </div>
            <div class="min-w-0">
              <div class="profile-badge">${badgeEmoji} ${escapeHtml(badgeLabel)}</div>
              <div class="orbitron text-2xl sm:text-3xl font-black break-words">${escapeHtml(user.username || user.name || "Integrante")}</div>
              <div class="text-sm text-white/70 mt-1">${escapeHtml(user.role || "Runner")} · Nivel ${Number(user.level || 1)}</div>
            </div>
          </div>
          <div class="profile-preview-content">
            <p class="muted text-sm mt-3 leading-relaxed">${escapeHtml(user.bio || "Sin descripción todavía.")}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="public-profile-stat"><strong class="text-[var(--gold)]">${Number(user.rings||0).toLocaleString("es-PE")}</strong><div class="tiny muted mt-1">Rings</div></div>
          <div class="public-profile-stat"><strong>${Number(user.level||1)}</strong><div class="tiny muted mt-1">Nivel</div></div>
          <div class="public-profile-stat"><strong>${Number(user.xp||0)}</strong><div class="tiny muted mt-1">XP</div></div>
          <div class="public-profile-stat"><strong>${RealtimeSync.ratingSummary(user.id).total ? `⭐ ${RealtimeSync.ratingSummary(user.id).average.toFixed(1)}` : "⭐ —"}</strong><div class="tiny muted mt-1">${RealtimeSync.ratingSummary(user.id).total ? `${RealtimeSync.ratingSummary(user.id).total} valoraciones` : "Sin valoraciones"}</div></div>
        </div>
        <div class="rating-box">
          <div class="section-kicker">Valoración de la comunidad</div>
          <div class="rating-summary mt-2"><span class="rating-score">${RealtimeSync.ratingSummary(user.id).total ? RealtimeSync.ratingSummary(user.id).average.toFixed(1) : "—"}</span><span class="rating-count">${RealtimeSync.ratingSummary(user.id).total ? `${RealtimeSync.ratingSummary(user.id).total} valoraciones` : "Sé el primero en valorar"}</span></div>
          ${RealtimeSync.uid && user.ownerUid!==RealtimeSync.uid ? (RealtimeSync.myRating(user.id) ? `<div class="tiny muted mt-4">Tu valoración: <strong style="color:var(--gold)">${RealtimeSync.myRating(user.id)} ⭐</strong></div><div class="tiny muted mt-2">Ya has dejado tu valoración para este perfil.</div>` : `<div class="tiny muted mt-4">Tu valoración</div><div class="rating-stars mt-2">${[1,2,3,4,5].map(n=>`<button type="button" class="rating-star" data-action="rate-user" data-user-id="${escapeHtml(user.id)}" data-rating="${n}" aria-label="${n} estrellas">★</button>`).join("")}</div>`) : `<div class="tiny muted mt-3">${RealtimeSync.uid ? "No puedes valorarte a ti mismo." : "Inicia sesión con Google para valorar."}</div>`}
        </div>
        <div class="public-profile-actions">
          ${hasOst ? `<button class="primary-btn small-btn" data-action="play-user-ost" data-user-id="${escapeHtml(user.id)}"><i class="ph-bold ph-music-notes"></i> Escuchar OST</button>` : ""}
        </div>
      `;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden","false");
    }

    function productCardHtml(product){
      const price=finalPrice(product);
      const isOwned=owned(product.id);
      const inCart=cartHas(product.id);
      return `
        <article class="surface-soft product-card" data-preview-product="${product.id}" tabindex="0">
          <div class="product-visual">
            ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
            ${productVisualHtml(product)}
          </div>
          <div class="product-body">
            <div class="product-name">${escapeHtml(product.name)}</div>
            <div class="product-meta">
              <span class="rarity rarity-${product.rarity}">${RARITY_LABEL[product.rarity]}</span>
              <span class="price">
                ${product.discount ? `<span class="old-price">${product.price}</span>` : ""}
                <i class="ph-fill ph-coin"></i>${price}
              </span>
            </div>
            <div class="product-actions">
              <button class="soft-btn small-btn" data-action="preview-product" data-product-id="${product.id}"><i class="ph-bold ph-eye"></i> Vista previa</button>
              <button class="primary-btn small-btn ${isOwned ? "!opacity-50" : ""}" data-action="add-cart" data-product-id="${product.id}" ${isOwned ? "disabled" : ""}>
                <i class="ph-bold ${isOwned ? "ph-check" : inCart ? "ph-shopping-cart-simple" : "ph-plus"}"></i>
                ${isOwned ? "Comprado" : inCart ? "En carrito" : "Comprar"}
              </button>
            </div>
          </div>
        </article>
      `;
    }

    function filteredProducts(){
      const term=state.storeSearch.trim().toLowerCase();
      return PRODUCTS.filter(product => {
        const categoryOk=state.storeFilter==="all" || product.category===state.storeFilter;
        const searchOk=!term || `${product.name} ${product.description} ${RARITY_LABEL[product.rarity]}`.toLowerCase().includes(term);
        return categoryOk && searchOk;
      });
    }

    function renderStore(){
      const products=filteredProducts();
      const preview=productById(state.previewProductId) || products[0] || PRODUCTS[0];
      const user=activeUser();

      document.getElementById("tab-store").innerHTML=`
        <div class="steam-grid store-layout">
          <div class="steam-grid">
            <div class="surface p-4 sm:p-5">
              <div class="store-toolbar">
                <div>
                  <div class="section-kicker">Mercado de la comunidad</div>
                  <h2 class="section-title mt-1">Tienda de Accesorios</h2>
                </div>
                <div class="flex items-center gap-2">
                  <span class="coin-pill"><i class="ph-fill ph-coin"></i>${state.coins.toLocaleString("es-PE")}</span>
                  <button class="soft-btn" data-action="open-cart"><i class="ph-bold ph-shopping-cart"></i> Carrito (${state.cart.length})</button>
                </div>
              </div>

              <div class="store-toolbar mt-5">
                <div class="filter-row" aria-label="Filtros de productos">
                  ${Object.entries(CATEGORY_LABEL).map(([key,label]) => `
                    <button class="filter-btn ${state.storeFilter===key ? "active" : ""}" data-action="store-filter" data-filter="${key}">${label}</button>
                  `).join("")}
                </div>
                <label class="search-wrap">
                  <i class="ph-bold ph-magnifying-glass"></i>
                  <input id="store-search" class="input" value="${escapeHtml(state.storeSearch)}" placeholder="Buscar accesorios..." aria-label="Buscar accesorios">
                </label>
              </div>
            </div>

            <div id="product-grid" class="steam-grid product-grid">
              ${products.length ? products.map(productCardHtml).join("") : `
                <div class="surface empty-state col-span-full">
                  <div class="empty-icon"><i class="ph-bold ph-magnifying-glass"></i></div>
                  <div class="font-black text-lg">No encontramos productos</div>
                  <div class="muted text-sm mt-2">Prueba otro filtro o término de búsqueda.</div>
                </div>
              `}
            </div>
          </div>

          <aside class="surface overflow-hidden preview-panel">
            <div id="store-profile-preview">${profilePreviewHtml(user,preview,true)}</div>
            <div class="preview-caption">
              <div class="section-kicker">Vista previa</div>
              <div id="preview-product-name" class="font-black text-lg mt-1">${escapeHtml(preview.name)}</div>
              <p id="preview-product-description" class="muted text-sm mt-2 leading-relaxed">${escapeHtml(preview.description)}</p>
              <div class="button-row mt-4">
                <button class="primary-btn full-btn" data-action="add-cart" data-product-id="${preview.id}" ${owned(preview.id) ? "disabled" : ""}>
                  <i class="ph-bold ph-shopping-cart-simple"></i> ${owned(preview.id) ? "Ya está en tu inventario" : "Añadir al carrito"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      `;
    }

    function inventoryCardHtml(product){
      const user=activeUser();
      const slot=slotFor(product);
      const isEquipped=slot ? user.equipped?.[slot]===product.id : false;

      return `
        <article class="surface-soft inventory-card">
          <div class="product-visual">${productVisualHtml(product,"inventory")}</div>
          <div class="product-body">
            <div class="flex items-start justify-between gap-2">
              <div class="product-name !min-h-0">${escapeHtml(product.name)}</div>
              ${isEquipped ? `<span class="equipped-tag">Equipado</span>` : ""}
            </div>
            <div class="rarity rarity-${product.rarity} mt-2">${RARITY_LABEL[product.rarity]}</div>
            <div class="button-row mt-3">
              ${product.category==="bundle"
                ? `<button class="primary-btn small-btn full-btn" data-action="equip-bundle" data-product-id="${product.id}"><i class="ph-bold ph-magic-wand"></i> Equipar paquete</button>`
                : `<button class="${isEquipped ? "soft-btn" : "primary-btn"} small-btn full-btn" data-action="${isEquipped ? "unequip-product" : "equip-product"}" data-product-id="${product.id}">
                    <i class="ph-bold ${isEquipped ? "ph-x" : "ph-check-circle"}"></i> ${isEquipped ? "Quitar" : "Equipar"}
                  </button>`
              }
            </div>
          </div>
        </article>
      `;
    }

    function renderInventory(){
      const products=state.inventory.map(productById).filter(Boolean);
      const user=activeUser();
      const slots=[
        ["Avatar",productById(user.equipped?.avatar)?.name || "Foto personal","ph-user-circle"],
        ["Marco",productById(user.equipped?.frame)?.name || "Sin marco","ph-frame-corners"],
        ["Fondo",productById(user.equipped?.background)?.name || "Fondo base","ph-image"],
        ["Badge",productById(user.equipped?.badge)?.name || "Sin badge","ph-seal"]
      ];

      document.getElementById("tab-inventory").innerHTML=`
        <div class="steam-grid">
          <div class="surface p-4 sm:p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="section-kicker">Colección personal</div>
                <h2 class="section-title mt-1">Mi Inventario</h2>
                <p class="muted text-sm mt-2">Los accesorios comprados aparecen aquí. Puedes equiparlos y quitarlos cuando quieras.</p>
              </div>
              <button class="primary-btn" data-tab="store"><i class="ph-bold ph-storefront"></i> Ir a la tienda</button>
            </div>

            <div class="steam-grid slot-grid mt-5">
              ${slots.map(([label,value,icon]) => `
                <div class="surface-soft slot-card">
                  <div class="slot-icon"><i class="ph-bold ${icon}"></i></div>
                  <div class="min-w-0">
                    <div class="tiny muted">${label}</div>
                    <div class="font-black text-sm truncate">${escapeHtml(value)}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          ${products.length ? `
            <div class="steam-grid inventory-grid">
              ${products.map(inventoryCardHtml).join("")}
            </div>
          ` : `
            <div class="surface empty-state">
              <div class="empty-icon"><i class="ph-bold ph-backpack"></i></div>
              <div class="font-black text-xl">Tu inventario está vacío</div>
              <div class="muted text-sm mt-2">Compra accesorios en la tienda para empezar tu colección.</div>
              <button class="primary-btn mt-5" data-tab="store">Explorar tienda</button>
            </div>
          `}
        </div>
      `;
    }

    function renderAudio(){
      const user=activeUser();
      document.getElementById("tab-audio").innerHTML=`
        <div class="steam-grid audio-layout">
          <article class="surface audio-card">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="section-kicker">Música integrada</div>
                <h2 class="section-title mt-1">OST principal</h2>
              </div>
              <i class="ph-bold ph-disc text-3xl text-[var(--blue)]"></i>
            </div>
            <p class="muted text-sm mt-3 leading-relaxed">Comfort Zone se reproduce únicamente cuando presionas el botón. Cambiar de pestaña no lo reinicia ni lo reemplaza.</p>
            <div id="wave-main" class="audio-wave mt-5"></div>
            <div class="button-row mt-5">
              <button class="primary-btn" data-action="play-main-ost"><i class="ph-bold ph-play"></i> Reproducir</button>
              <button class="soft-btn" data-action="stop-audio"><i class="ph-bold ph-stop"></i> Detener</button>
            </div>
          </article>

          <article class="surface audio-card">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="section-kicker">Perfil activo</div>
                <h2 class="section-title mt-1">Mi OST</h2>
              </div>
              <i class="ph-bold ph-headphones text-3xl text-[var(--purple)]"></i>
            </div>
            <p class="muted text-sm mt-3 leading-relaxed">
              ${user.hasOst || user.legacyOst
                ? `Archivo disponible: <strong>${escapeHtml(user.ostName || "OST personalizado")}</strong>.`
                : `Este perfil todavía no tiene un OST. Puedes subirlo desde la pestaña Perfil.`
              }
            </p>
            <div id="wave-custom" class="audio-wave mt-5"></div>
            <div class="button-row mt-5">
              <button class="primary-btn" data-action="play-custom-ost" ${user.hasOst || user.legacyOst ? "" : "disabled"}><i class="ph-bold ph-play"></i> Reproducir Mi OST</button>
              <button class="soft-btn" data-tab="profile"><i class="ph-bold ph-upload"></i> Subir audio</button>
              <button class="danger-btn" data-action="remove-custom-ost" ${user.hasOst || user.legacyOst ? "" : "disabled"}><i class="ph-bold ph-trash"></i> Eliminar</button>
            </div>
          </article>

          <article class="surface audio-card col-span-full">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div class="font-black">Control general</div>
                <div id="audio-status-text" class="tiny muted mt-1"></div>
              </div>
              <div class="flex items-center gap-3 min-w-[250px]">
                <i class="ph-bold ph-speaker-low muted"></i>
                <input id="volume-control" class="w-full accent-sky-400" type="range" min="0" max="1" step="0.01" value="${state.audio.volume}" aria-label="Volumen">
                <i class="ph-bold ph-speaker-high text-[var(--blue)]"></i>
              </div>
              <button class="${state.audio.enabled ? "soft-btn" : "primary-btn"}" data-action="toggle-audio">
                <i class="ph-bold ${state.audio.enabled ? "ph-speaker-high" : "ph-speaker-x"}"></i>
                ${state.audio.enabled ? "Sonido ON" : "Sonido OFF"}
              </button>
            </div>
          </article>
        </div>
      `;
      updateAudioIndicators();
    }

    function renderCart(){
      const items=state.cart.map(productById).filter(Boolean);
      document.getElementById("cart-items").innerHTML=items.length ? items.map(product => `
        <div class="surface-soft cart-item">
          <div class="cart-thumb">
            ${product.category==="avatar"
              ? `<img src="${product.image}" alt="" loading="lazy">`
              : product.category==="emoji"
                ? `<span class="text-2xl">${product.emoji}</span>`
                : `<i class="ph-bold ph-sparkle text-[var(--blue)] text-xl"></i>`
            }
          </div>
          <div class="min-w-0">
            <div class="font-black text-sm truncate">${escapeHtml(product.name)}</div>
            <div class="tiny text-[var(--gold)] mt-1"><i class="ph-fill ph-coin"></i> ${finalPrice(product)}</div>
          </div>
          <button class="icon-btn !w-[36px] !h-[36px]" data-action="remove-cart" data-product-id="${product.id}" aria-label="Quitar ${escapeHtml(product.name)}"><i class="ph-bold ph-trash"></i></button>
        </div>
      `).join("") : `
        <div class="empty-state">
          <div class="empty-icon"><i class="ph-bold ph-shopping-cart"></i></div>
          <div class="font-black">Tu carrito está vacío</div>
          <div class="tiny muted mt-2">Añade accesorios desde la tienda.</div>
        </div>
      `;
      document.getElementById("cart-total").textContent=items.reduce((sum,item)=>sum+finalPrice(item),0).toLocaleString("es-PE");
      renderTopbar();
    }

    function renderActiveTab(){
      renderSidebar();
      renderTopbar();

      if(state.activeTab==="home") renderHome();
      if(state.activeTab==="profile") renderProfile();
      if(state.activeTab==="ranking") renderRanking();
      if(state.activeTab==="store") renderStore();
      if(state.activeTab==="inventory") renderInventory();
      if(state.activeTab==="audio") renderAudio();
      if(state.activeTab==="admin") {
        if(RealtimeSync.isAdmin() || RealtimeSync.isRoleAdmin()) renderAdmin();
        else { state.activeTab="home"; renderHome(); }
      }

      renderCart();
    }

    function switchTab(tab){
      if(!TAB_META[tab]) return;
      if(tab==="admin" && !RealtimeSync.isAdmin() && !RealtimeSync.isRoleAdmin()){
        toast("Solo la creadora o un administrador puede abrir esta sección","danger");
        return;
      }
      state.activeTab=tab;
      persist();

      document.querySelectorAll(".tab-view").forEach(view => view.classList.toggle("active",view.id===`tab-${tab}`));
      document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active",button.dataset.tab===tab));

      const [title,subtitle]=TAB_META[tab];
      document.getElementById("page-title").textContent=title;
      document.getElementById("page-subtitle").textContent=subtitle;

      renderActiveTab();
      window.scrollTo({top:0,behavior:state.motion ? "smooth" : "auto"});
    }

    function setProductPreview(id){
      const product=productById(id);
      if(!product) return;
      state.previewProductId=id;
      persist();
      if(state.activeTab==="store") renderStore();
    }

    function addToCart(id){
      const product=productById(id);
      if(!product || owned(id)) return;
      if(!state.cart.includes(id)) state.cart.push(id);
      persist();
      renderStore();
      renderCart();
      toast(`${product.name} añadido al carrito`,"success");
    }

    function removeFromCart(id){
      state.cart=state.cart.filter(item => item!==id);
      persist();
      renderCart();
      if(state.activeTab==="store") renderStore();
    }

    function checkout(){
      const items=state.cart.map(productById).filter(Boolean);
      const total=items.reduce((sum,item)=>sum+finalPrice(item),0);

      if(!items.length){
        toast("Tu carrito está vacío","danger");
        return;
      }

      if(state.coins<total){
        toast(`Te faltan ${(total-state.coins).toLocaleString("es-PE")} monedas`,"danger");
        return;
      }

      state.coins-=total;
      items.forEach(product => {
        if(!state.inventory.includes(product.id)) state.inventory.push(product.id);
        if(product.category==="bundle"){
          (product.includes || []).forEach(id => {
            if(!state.inventory.includes(id)) state.inventory.push(id);
          });
        }
      });
      state.cart=[];
      persist();
      renderActiveTab();
      closeCart();
      toast("Compra realizada. Los accesorios están en tu inventario.","success");
    }

    function equipProduct(id){
      const product=productById(id);
      if(!product || !owned(id)) return;
      const slot=slotFor(product);
      if(!slot) return;
      const user=activeUser();
      user.equipped={...DEFAULT_EQUIPPED,...(user.equipped || {}),[slot]:id};
      persist();
      renderInventory();
      renderSidebar();
      toast(`${product.name} equipado`,"success");
    }

    function unequipProduct(id){
      const product=productById(id);
      const slot=slotFor(product);
      if(!slot) return;
      const user=activeUser();
      user.equipped={...DEFAULT_EQUIPPED,...(user.equipped || {}),[slot]:null};
      if(slot==="badge") user.equipped.badge=null;
      persist();
      renderInventory();
      renderSidebar();
      toast(`${product.name} retirado`,"success");
    }

    function equipBundle(id){
      const bundle=productById(id);
      if(!bundle || !owned(id)) return;
      const user=activeUser();
      user.equipped={...DEFAULT_EQUIPPED,...(user.equipped || {})};
      (bundle.includes || []).forEach(productId => {
        const product=productById(productId);
        const slot=slotFor(product);
        if(slot && state.inventory.includes(productId)) user.equipped[slot]=productId;
      });
      persist();
      renderInventory();
      toast("Paquete equipado en el perfil","success");
    }

    function openCart(){
      const overlay=document.getElementById("cart-overlay");
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden","false");
      renderCart();
    }

    function closeCart(){
      const overlay=document.getElementById("cart-overlay");
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden","true");
    }

    function claimDaily(){
      const today=new Date().toISOString().slice(0,10);
      if(state.dailyClaim===today){
        toast("Ya reclamaste tu recompensa de hoy","danger");
        return;
      }
      state.dailyClaim=today;
      state.coins+=250;
      persist();
      renderActiveTab();
      toast("+250 monedas añadidas","success");
    }

    function newProfile(){
      const id=`runner-${Date.now()}`;
      const user={
        ...defaultProfile(),
        id,
        name:"",
        username:"",
        role:"Runner",
        bio:"",
        rings:0,
        level:1,
        xp:0,
        equipped:{...DEFAULT_EQUIPPED},
        ownerUid:RealtimeSync.uid || "",
        ownerEmail:RealtimeSync.email || ""
      };
      state.users.push(user);
      state.activeUserId=id;
      persist();
      renderProfile();
      renderSidebar();
      toast("Nuevo perfil listo para editar","success");
    }

    async function saveProfile(event){
      event.preventDefault();
      const user=activeUser();
      if(!user){
        toast("No hay un perfil activo","danger");
        return;
      }

      // A normal account can only save its own profile.
      if(!RealtimeSync.isAdmin() && user.ownerUid !== RealtimeSync.uid){
        toast("Este perfil no pertenece a tu cuenta","danger");
        return;
      }

      const name=document.getElementById("profile-name")?.value.trim();
      const username=document.getElementById("profile-username")?.value.trim();

      if(!name || !username){
        toast("Completa nombre y usuario","danger");
        return;
      }

      user.name=name;
      user.username=username;
      user.role=document.getElementById("profile-role")?.value.trim() || "Runner";
      user.bio=document.getElementById("profile-bio")?.value.trim() || "";

      if(RealtimeSync.isAdmin() || RealtimeSync.canEditRings(user.id)){
        const requested=Math.max(
          0,
          Number(document.getElementById("profile-rings")?.value || user.rings || 0)
        );
        const delta=requested-Number(user.rings||0);
        if(delta!==0){
          try{
            await RealtimeSync.setRingAmount(user.id,delta,"Cambio desde perfil");
          }catch(error){
            toast(error.message||"No se pudo modificar Rings","danger");
            return;
          }
        }
      }

      if(pending.avatar) user.avatar=pending.avatar;
      if(pending.cover) user.cover=pending.cover;

      // OST compartido: súbelo a Cloudinary y guarda únicamente la URL en Firebase.
      if(pending.ostBlob){
        try{
          toast("Subiendo OST…", "success");
          const uploaded=await CloudinaryOST.upload(pending.ostBlob,user.id);
          user.ostUrl=uploaded.url;
          user.hasOst=true;
          user.ostName=uploaded.name;
          user.ostBytes=uploaded.bytes;
          delete user.legacyOst;
          await AssetDB.put(`ost:${user.id}`,pending.ostBlob).catch(()=>{});
        }catch(error){
          console.error("[Cloudinary OST] save failed",error);
          toast(error.message||"No se pudo subir el OST personalizado","danger");
          return;
        }
      }

      // Keep the Google ownership fields intact so Firebase rules accept
      // the write and the profile cannot jump to another account.
      user.ownerUid=RealtimeSync.uid || user.ownerUid || "";
      user.ownerEmail=RealtimeSync.email || user.ownerEmail || "";

      const cleanUser=RealtimeSync.sanitizeUser(user);

      try{
        if(RealtimeSync.ready && RealtimeSync.usersRef){
          if(RealtimeSync.isAdmin()){
            await RealtimeSync.usersRef.child(user.id).update(cleanUser);
          }else{
            await RealtimeSync.usersRef.child(user.id).update(cleanUser);
          }
        }
      }catch(error){
        console.error("[Profile] Firebase save failed",error);
        toast("No se pudo guardar el perfil en Firebase","danger");
        return;
      }

      pending.avatar=null;
      pending.cover=null;
      pending.ostBlob=null;
      pending.ostName="";

      try{
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...state,
            users:state.users.map(({legacyOst,...u})=>u)
          })
        );
      }catch{}

      renderProfile();
      renderSidebar();
      renderTopbar();
      toast("Perfil guardado correctamente","success");
    }

    async function deleteProfile(){
      if(state.users.length<=1){
        toast("Debe quedar al menos un perfil","danger");
        return;
      }

      const user=activeUser();
      await AssetDB.remove(`ost:${user.id}`).catch(()=>{});
      state.users=state.users.filter(item => item.id!==user.id);
      state.activeUserId=state.users[0].id;
      persist();
      AudioController.stop();
      renderProfile();
      renderSidebar();
      toast("Perfil eliminado","success");
    }

    async function removeCustomOst(){
      const user=activeUser();
      if(!user) return;
      await AssetDB.remove(`ost:${user.id}`).catch(()=>{});
      user.hasOst=false;
      user.ostName="";
      user.ostBytes=0;
      delete user.ostUrl;
      delete user.legacyOst;
      AudioController.stop();
      try{
        if(RealtimeSync.ready && RealtimeSync.usersRef){
          await RealtimeSync.usersRef.child(user.id).update({hasOst:false,ostName:"",ostBytes:0,ostUrl:null});
        }
      }catch(error){
        console.error("[OST] remove failed",error);
        toast("No se pudo quitar el OST de Firebase","danger");
        return;
      }
      persist();
      renderProfile();
      toast("OST personalizado eliminado","success");
    }

    function updateAudioIndicators(){
      const mainWave=document.getElementById("wave-main");
      const customWave=document.getElementById("wave-custom");
      mainWave?.classList.toggle("playing",AudioController.current==="main");
      customWave?.classList.toggle("playing",AudioController.current==="custom");

      const status=document.getElementById("audio-status-text");
      if(status){
        status.textContent=!state.audio.enabled
          ? "Sonido desactivado"
          : AudioController.current==="main"
            ? "Reproduciendo OST principal"
            : AudioController.current==="custom"
              ? "Reproduciendo Mi OST"
              : "Sonido activado, sin reproducción";
      }
    }

    function applyTheme(){
      document.documentElement.dataset.theme=state.theme;
      document.body.classList.toggle("motion-off",!state.motion);
      renderTopbar();
    }

    async function migrateLegacyAudio(){
      for(const user of state.users){
        if(!user.legacyOst) continue;
        try{
          const response=await fetch(user.legacyOst);
          const blob=await response.blob();
          await AssetDB.put(`ost:${user.id}`,blob);
          user.hasOst=true;
          delete user.legacyOst;
        }catch{}
      }
      persist();
    }

    document.addEventListener("keydown",event => {
      if(event.key!=="Enter" && event.key!==" ") return;
      const row=event.target.closest('[data-action="view-public-profile"]');
      if(!row || event.target.closest('button')) return;
      event.preventDefault();
      showPublicProfile(row.dataset.userId);
    });

    document.addEventListener("click",async event => {
      const tabButton=event.target.closest("[data-tab]");
      if(tabButton){
        switchTab(tabButton.dataset.tab);
        return;
      }

      const actionButton=event.target.closest("[data-action]");
      if(!actionButton) return;
      if(actionButton.dataset.action==="rate-user") {
        const targetId=actionButton.dataset.userId;
        if(RealtimeSync.myRating(targetId)){
          toast("Ya has valorado este perfil.","danger");
          return;
        }
        actionButton.disabled=true;
        try {
          await RealtimeSync.setRating(targetId,Number(actionButton.dataset.rating));
          showPublicProfile(targetId);
          toast(`Valoración guardada: ${actionButton.dataset.rating} ⭐`,"success");
        } catch(error) {
          actionButton.disabled=false;
          toast(error.message||"No se pudo guardar la valoración","danger");
        }
        return;
      }
      const action=actionButton.dataset.action;
      const productId=actionButton.dataset.productId;

      if(action==="admin-login") RealtimeSync.signInAdmin();
      if(action==="google-login") RealtimeSync.isSignedIn() ? RealtimeSync.logout() : RealtimeSync.signInGoogle();
      if(action==="admin-logout") RealtimeSync.logout();
      if(action==="toggle-ring-permission") RealtimeSync.grantRingsPermission(actionButton.dataset.userId,actionButton.dataset.enabled==="1").then(()=>renderAdmin()).catch(error=>toast(error.message||"No se pudo cambiar el permiso","danger"));
      if(action==="toggle-admin-role") RealtimeSync.setAdminRole(actionButton.dataset.userId,actionButton.dataset.enabled==="1").then(()=>{ renderAdmin(); if(state.activeTab==="ranking") renderRanking(); }).catch(error=>toast(error.message||"No se pudo cambiar el rol","danger"));
      if(action==="role-admin-ring") RealtimeSync.setRingAmount(actionButton.dataset.userId,Number(actionButton.dataset.delta||0),"Panel de administrador").then(()=>renderAdmin()).catch(error=>toast(error.message||"No se pudo modificar Rings","danger"));
      if(action==="clear-branding-icon"){
        const preview=document.getElementById("branding-preview");
        if(preview) preview.innerHTML='<span class="orbitron">SF</span>';
        const input=document.getElementById("branding-icon");
        if(input) input.value="";
        state._brandingIconData=null;
      }
      if(action==="clear-admin-search"){ state.adminSearch=""; renderAdmin(); }
      if(action==="admin-delete-user") RealtimeSync.deleteUser(actionButton.dataset.userId).then(()=>renderAdmin()).catch(error=>toast(error.message||"No se pudo eliminar el usuario","danger"));
      if(action==="go-store") switchTab("store");
      if(action==="toggle-theme"){
        state.theme=state.theme==="dark" ? "light" : "dark";
        persist();applyTheme();renderActiveTab();
      }
      if(action==="open-cart") openCart();
      if(action==="close-cart") closeCart();
      if(action==="add-cart") addToCart(productId);
      if(action==="remove-cart") removeFromCart(productId);
      if(action==="checkout") checkout();
      if(action==="preview-product") setProductPreview(productId);
      if(action==="store-filter"){
        state.storeFilter=actionButton.dataset.filter;
        persist();renderStore();
      }
      if(action==="equip-product") equipProduct(productId);
      if(action==="unequip-product") unequipProduct(productId);
      if(action==="equip-bundle") equipBundle(productId);
      if(action==="claim-daily") claimDaily();
      if(action==="new-profile") newProfile();
      if(action==="delete-profile") deleteProfile();
      if(action==="play-main-ost") AudioController.playMain();
      if(action==="play-custom-ost") AudioController.playCustom();
      if(action==="play-user-ost") AudioController.playCustom(actionButton.dataset.userId);
      if(action==="view-public-profile") showPublicProfile(actionButton.dataset.userId);
      if(action==="close-public-profile") closePublicProfile();
      if(action==="stop-audio") AudioController.stop();
      if(action==="toggle-audio"){
        AudioController.toggle();
        renderAudio();
      }
      if(action==="remove-custom-ost") removeCustomOst();
    });

    document.addEventListener("click",async event => {
      const removeButton=event.target.closest('[data-ring-operation="remove"]');
      if(!removeButton) return;

      const form=document.getElementById("admin-rings-form");
      if(!form) return;

      const userId=document.getElementById("admin-rings-user")?.value;
      const rawAmount=Number(document.getElementById("admin-rings-amount")?.value);
      const reason=document.getElementById("admin-rings-reason")?.value || "";

      if(!userId || !Number.isFinite(rawAmount) || rawAmount<=0){
        toast("Indica una cantidad mayor que 0","danger");
        return;
      }

      try{
        const total=await RealtimeSync.setRingAmount(userId,-Math.trunc(rawAmount),reason);
        toast(`Rings quitados: ${total.toLocaleString("es-PE")}`,"success");
        form.reset();
        renderAdmin();
        renderActiveTab();
      }catch(error){
        toast(error.message||"No se pudo quitar Rings","danger");
      }
    });

    document.addEventListener("mouseover",event => {
      const card=event.target.closest("[data-preview-product]");
      if(card && state.activeTab==="store" && state.previewProductId!==card.dataset.previewProduct){
        state.previewProductId=card.dataset.previewProduct;
        const product=productById(state.previewProductId);
        const preview=document.getElementById("store-profile-preview");
        const name=document.getElementById("preview-product-name");
        const description=document.getElementById("preview-product-description");
        if(preview) preview.innerHTML=profilePreviewHtml(activeUser(),product,true);
        if(name) name.textContent=product.name;
        if(description) description.textContent=product.description;
      }
    });

    document.addEventListener("input",event => {
      if(event.target.id==="admin-user-search"){
        state.adminSearch=event.target.value;
        renderAdmin();
        const input=document.getElementById("admin-user-search");
        if(input){
          input.focus();
          input.setSelectionRange(state.adminSearch.length,state.adminSearch.length);
        }
      }

      if(event.target.id==="store-search"){
        state.storeSearch=event.target.value;
        persist();
        const grid=document.getElementById("product-grid");
        const products=filteredProducts();
        if(grid){
          grid.innerHTML=products.length ? products.map(productCardHtml).join("") : `
            <div class="surface empty-state col-span-full">
              <div class="empty-icon"><i class="ph-bold ph-magnifying-glass"></i></div>
              <div class="font-black text-lg">No encontramos productos</div>
            </div>
          `;
        }
      }

      if(event.target.id==="volume-control"){
        AudioController.setVolume(event.target.value);
      }
    });

    document.addEventListener("change",async event => {
      if(event.target.id==="profile-selector"){
        const selectedId=event.target.value;
        const selected=state.users.find(u=>u.id===selectedId);

        if(!RealtimeSync.isAdmin() && selected && selected.ownerUid!==RealtimeSync.uid){
          toast("Solo puedes seleccionar tu propio perfil","danger");
          renderProfile();
          return;
        }

        state.activeUserId=selectedId;
        pending.avatar=null;pending.cover=null;pending.ostBlob=null;pending.ostName="";
        AudioController.stop();
        persist();
        renderProfile();
        renderSidebar();
      }

      if(event.target.id==="avatar-file" && event.target.files[0]){
        const file=event.target.files[0];
        if(window.sfHandleImageFile) window.sfHandleImageFile(file,"avatar");
        event.target.value="";
      }

      if(event.target.id==="cover-file" && event.target.files[0]){
        const file=event.target.files[0];
        if(window.sfHandleImageFile) window.sfHandleImageFile(file,"cover");
        event.target.value="";
      }

      if(event.target.id==="ost-file" && event.target.files[0]){
        const file=event.target.files[0];
        if(!file.type.startsWith("audio/")){
          toast("Selecciona un archivo de audio válido","danger");
          return;
        }
        pending.ostBlob=file;
        pending.ostName=file.name;
        toast("OST preparado. Guarda el perfil para subirlo y compartirlo.","success");
      }
    });

    document.addEventListener("change", event => {
      if(event.target.id!=="branding-icon") return;
      const file=event.target.files?.[0];
      if(!file) return;
      if(file.size>1500000){ toast("El icono debe pesar menos de 1.5 MB","danger"); event.target.value=""; return; }
      if(!file.type.startsWith("image/")){ toast("Selecciona una imagen válida","danger"); event.target.value=""; return; }
      const reader=new FileReader();
      reader.onload=()=>{
        state._brandingIconData=String(reader.result||"");
        const preview=document.getElementById("branding-preview");
        if(preview) preview.innerHTML=`<img src="${state._brandingIconData}" alt="Vista previa">`;
      };
      reader.readAsDataURL(file);
    });

    document.addEventListener("submit",async event => {
      if(event.target.id==="branding-form"){
        event.preventDefault();
        try{
          await RealtimeSync.setBranding(
            document.getElementById("branding-title")?.value,
            document.getElementById("branding-subtitle")?.value,
            state._brandingIconData
          );
          state._brandingIconData=undefined;
          toast("Identidad e icono actualizados","success");
        }catch(error){ toast(error.message||"No se pudo guardar la identidad","danger"); }
        return;
      }
      if(event.target.id==="profile-form") saveProfile(event);
      if(event.target.id==="admin-rings-form") {
        event.preventDefault();
        const submitter=event.submitter;
        const userId=document.getElementById("admin-rings-user")?.value;
        const rawAmount=Number(document.getElementById("admin-rings-amount")?.value);
        const reason=document.getElementById("admin-rings-reason")?.value || "";
        const operation=submitter?.dataset?.ringOperation || "add";

        if(!userId || !Number.isFinite(rawAmount) || rawAmount<=0){
          toast("Indica una cantidad mayor que 0","danger");
          return;
        }

        const delta=operation==="remove" ? -Math.trunc(rawAmount) : Math.trunc(rawAmount);

        try{
          const total=await RealtimeSync.setRingAmount(userId,delta,reason);
          toast(`${operation==="remove"?"Rings quitados":"Rings agregados"}: ${total.toLocaleString("es-PE")}`,"success");
          event.target.reset();
          renderAdmin();
          renderActiveTab();
        }catch(error){
          toast(error.message||"No se pudo modificar Rings","danger");
        }
      }
    });

    document.getElementById("public-profile-overlay")?.addEventListener("click",event => {
      if(event.target.id==="public-profile-overlay") closePublicProfile();
    });

    document.getElementById("cart-overlay").addEventListener("click",event => {
      if(event.target.id==="cart-overlay") closeCart();
    });

    document.addEventListener("keydown",event => {
      if(event.key==="Escape"){ closeCart(); closePublicProfile(); }
    });

    async function init(){
      applyTheme();
      AudioController.init();
      await RealtimeSync.init();
      await migrateLegacyAudio();

      const tab=TAB_META[state.activeTab] ? state.activeTab : "home";
      document.querySelectorAll(".tab-view").forEach(view => view.classList.toggle("active",view.id===`tab-${tab}`));
      document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active",button.dataset.tab===tab));
      const [title,subtitle]=TAB_META[tab];
      document.getElementById("page-title").textContent=title;
      document.getElementById("page-subtitle").textContent=subtitle;
      renderActiveTab();
      renderTopbar();
      renderSidebar();
    }

    init();
  

/* ===== Original inline script block 2 id="sf-auto-frame-script" ===== */
(() => {
  const AF = {file:null, mode:"cover", ratio:16/9, img:null, zoom:1, x:0, y:0, baseScale:1, dragging:false, sx:0, sy:0, ox:0, oy:0};

  const $af = id => document.getElementById(id);
  const afClamp = (v,a,b) => Math.max(a,Math.min(b,v));

  function afOpen(file, mode){
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        AF.file=file; AF.mode=mode; AF.ratio=mode==="avatar"?1:16/9; AF.img=img;
        AF.zoom=1; AF.x=0; AF.y=0;
        const stage=$af("sf-af-stage");
        stage.classList.toggle("avatar",mode==="avatar");
        $af("sf-af-title").textContent=mode==="avatar"?"Ajustar icono":"Ajustar portada";
        $af("sf-af-subtitle").textContent=mode==="avatar"?"Vista previa · cuadrícula 3×3 · 320×320":"Vista previa · cuadrícula 3×3 · 16:9";
        $af("sf-af-img").src=reader.result;
        $af("sf-af-zoom").value="1";
        $af("sf-auto-frame").classList.add("open");
        $af("sf-auto-frame").setAttribute("aria-hidden","false");
        requestAnimationFrame(afLayout);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  }

  function afLayout(){
    const stage=$af("sf-af-stage"), img=$af("sf-af-img");
    if(!stage || !AF.img) return;
    const sw=stage.clientWidth, sh=stage.clientHeight;
    const scale=Math.max(sw/AF.img.naturalWidth, sh/AF.img.naturalHeight);
    AF.baseScale=scale;
    afRender();
  }

  function afRender(){
    const img=$af("sf-af-img");
    if(!img || !AF.img) return;
    const scale=AF.baseScale*AF.zoom;
    img.style.width=AF.img.naturalWidth*scale+"px";
    img.style.height=AF.img.naturalHeight*scale+"px";
    img.style.transform=`translate(calc(-50% + ${AF.x}px),calc(-50% + ${AF.y}px))`;
  }

  function afClose(){
    $af("sf-auto-frame").classList.remove("open");
    $af("sf-auto-frame").setAttribute("aria-hidden","true");
    AF.file=null; AF.img=null;
  }

  function afCanvas(){
    const img=AF.img, stage=$af("sf-af-stage");
    const outW=AF.mode==="avatar"?320:1280, outH=AF.mode==="avatar"?320:720;
    const sw=stage.clientWidth, sh=stage.clientHeight;
    const scale=AF.baseScale*AF.zoom;
    const displayedW=img.naturalWidth*scale, displayedH=img.naturalHeight*scale;
    const left=(sw-displayedW)/2+AF.x, top=(sh-displayedH)/2+AF.y;
    const srcX=afClamp((0-left)/scale,0,img.naturalWidth);
    const srcY=afClamp((0-top)/scale,0,img.naturalHeight);
    const srcW=afClamp(sw/scale,1,img.naturalWidth-srcX);
    const srcH=afClamp(sh/scale,1,img.naturalHeight-srcY);
    const c=document.createElement("canvas"); c.width=outW;c.height=outH;
    const ctx=c.getContext("2d"); ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,srcX,srcY,srcW,srcH,0,0,outW,outH);
    return c.toDataURL("image/jpeg",.88);
  }

  async function afSave(){
    try{
      const data=afCanvas();
      if(AF.mode==="avatar") window.__speedyPendingAvatar=data;
      else window.__speedyPendingCover=data;
      const ev=new CustomEvent("sf:auto-frame-ready",{detail:{mode:AF.mode,data}});
      document.dispatchEvent(ev);
      afClose();
    }catch(e){ console.error(e); if(window.toast) toast("No se pudo preparar la imagen","danger"); }
  }

  $af("sf-af-zoom")?.addEventListener("input",e=>{AF.zoom=Number(e.target.value);afRender()});
  $af("sf-af-save")?.addEventListener("click",afSave);
  $af("sf-af-cancel")?.addEventListener("click",afClose);
  $af("sf-af-x")?.addEventListener("click",afClose);
  window.addEventListener("resize",()=>{if(AF.img && $af("sf-auto-frame").classList.contains("open")) afLayout()});

  const stage=$af("sf-af-stage");
  stage?.addEventListener("pointerdown",e=>{
    e.preventDefault(); AF.dragging=true; AF.sx=e.clientX;AF.sy=e.clientY;AF.ox=AF.x;AF.oy=AF.y;stage.setPointerCapture?.(e.pointerId);
  });
  stage?.addEventListener("pointermove",e=>{
    if(!AF.dragging)return;
    AF.x=AF.ox+(e.clientX-AF.sx); AF.y=AF.oy+(e.clientY-AF.sy); afRender();
  });
  stage?.addEventListener("pointerup",()=>AF.dragging=false);
  stage?.addEventListener("pointercancel",()=>AF.dragging=false);
  stage?.addEventListener("wheel",e=>{
    e.preventDefault(); AF.zoom=afClamp(AF.zoom+(e.deltaY<0?.08:-.08),1,3.5);$af("sf-af-zoom").value=String(AF.zoom);afRender();
  },{passive:false});

  // Repeatedly selecting the same file works.
  document.addEventListener("sf:auto-frame-ready",e=>{
    const {mode,data}=e.detail;
    if(mode==="avatar") window.__speedyPendingAvatar=data;
    if(mode==="cover") window.__speedyPendingCover=data;
  });

  window.sfOpenAutoFrame=afOpen;
})();


/* ===== Original inline script block 3 id="sf-auto-frame-connector" ===== */
document.addEventListener("sf:auto-frame-ready",e=>{
  if(!window.pending) return;
  if(e.detail.mode==="avatar") window.pending.avatar=e.detail.data;
  if(e.detail.mode==="cover") window.pending.cover=e.detail.data;
  if(window.toast) toast(e.detail.mode==="avatar"?"Icono preparado. Guarda el perfil para aplicarlo.":"Portada preparada. Guarda el perfil para aplicarla.","success");
});


/* ===== Original inline script block 4 id="sf-auto-frame-direct" ===== */
(() => {
  function directFrame(file, mode){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          const ratio=mode==="avatar"?1:16/9;
          const targetW=mode==="avatar"?320:1280;
          const targetH=mode==="avatar"?320:720;
          let sw=img.naturalWidth, sh=Math.round(sw/ratio);
          if(sh>img.naturalHeight){sh=img.naturalHeight;sw=Math.round(sh*ratio)}
          const sx=Math.max(0,Math.round((img.naturalWidth-sw)/2));
          const sy=Math.max(0,Math.round((img.naturalHeight-sh)/2));
          const c=document.createElement("canvas");c.width=targetW;c.height=targetH;
          const ctx=c.getContext("2d");ctx.imageSmoothingQuality="high";
          ctx.drawImage(img,sx,sy,sw,sh,0,0,targetW,targetH);
          resolve(c.toDataURL("image/jpeg",.88));
        };
        img.onerror=reject; img.src=reader.result;
      };
      reader.onerror=reject;reader.readAsDataURL(file);
    });
  }

  window.sfHandleImageFile = async (file,mode) => {
    try{
      const info=await new Promise((resolve,reject)=>{
        const r=new FileReader();
        r.onload=()=>{
          const im=new Image();
          im.onload=()=>resolve({w:im.naturalWidth,h:im.naturalHeight});
          im.onerror=reject;im.src=r.result;
        };
        r.onerror=reject;r.readAsDataURL(file);
      });

      // Siempre mostrar una vista previa con cuadrícula 3x3.
      // El encuadre inicial ya respeta 1:1 para icono o 16:9 para portada,
      // y el usuario puede mover/ajustar la imagen antes de guardar.
      if(window.sfOpenAutoFrame){
        window.sfOpenAutoFrame(file,mode);
        return;
      }

      const data=await directFrame(file,mode);
      window.pending = window.pending || {};
      if(mode==="avatar") window.pending.avatar=data;
      else window.pending.cover=data;
      if(window.toast) toast(mode==="avatar"?"Icono encuadrado automáticamente. Guarda el perfil para aplicarlo.":"Portada encuadrada automáticamente. Guarda el perfil para aplicarla.","success");
    }catch(error){
      console.error(error);
      if(window.toast) toast("No se pudo preparar la imagen","danger");
    }
  };
})();

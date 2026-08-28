/* Speedy Friends — Cafetería v8 core */
(function(){
  const sf = window.SpeedyFirebase;
  if(!sf?.db){ console.warn("[Cafetería] Firebase no disponible"); return; }

  const root = sf.db.ref("speedy-friends-teams/speedy-friends/cafeteria");
  const menuRef = root.child("menu");
  const ordersRef = root.child("orders");
  const workersRef = root.child("workers");
  const activityRef = root.child("activity");
  const musicRef = root.child("music");
  const historyRef = root.child("ticketHistory");
  const specialRef = root.child("special");
  const workerHistoryRef = root.child("workerHistory");

  const api = {
    root, menuRef, ordersRef, workersRef, activityRef, musicRef, historyRef, specialRef, workerHistoryRef,
    uid: () => sf.current?.uid || "",
    profile: () => sf.current?.profile || {},
    isCreator: () => !!sf.current?.isCreator,

    async role(){
      if(sf.current?.isCreator) return "creator";
      if(String(sf.current?.role || "") === "admin") return "admin";
      try{
        const snap = await workersRef.child(api.uid()).once("value");
        const worker = snap.val() || {};
        return worker.active === true && worker.role === "worker" ? "worker" : "member";
      }catch(e){ return "member"; }
    },

    watchMenu(cb){ return menuRef.on("value", s => cb(s.val() || {})); },
    watchOrders(cb){ return ordersRef.on("value", s => cb(s.val() || {})); },
    watchMyOrders(cb){ return ordersRef.orderByChild("ownerUid").equalTo(api.uid()).on("value", s => cb(s.val() || {})); },
    watchHistory(cb){ return historyRef.on("value", s => cb(s.val() || {})); },
    watchWorkers(cb){ return workersRef.on("value", s => cb(s.val() || {})); },
    watchMusic(cb){ return musicRef.on("value", s => cb(s.val() || {})); },
    watchSpecial(cb){ return specialRef.on("value", s => cb(s.val() || {})); },

    async saveSpecial(data){
      const role = await api.role();
      if(!["creator","worker"].includes(role)) throw new Error("No tienes permiso para editar la especialidad");
      const safe = {
        title: String(data.title || "ESPECIALIDAD DE LA CASA").slice(0,100),
        tag: String(data.tag || "HOUSE SPECIAL / 01").slice(0,60),
        subtitle: String(data.subtitle || "").slice(0,280),
        image: String(data.image || "").slice(0,2500000),
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        updatedByUid: api.uid()
      };
      await specialRef.update(safe);
      await activityRef.push({ type:"special_saved", byUid:api.uid(), at:firebase.database.ServerValue.TIMESTAMP });
      return safe;
    },

    async saveMenu(item){
      const role = await api.role();
      if(!["creator","worker"].includes(role)) throw new Error("No tienes permiso para editar la carta");
      const id = item.id || menuRef.push().key;
      const safe = {
        ...item, id, active: item.active !== false,
        price: Math.max(0, Math.trunc(Number(item.price) || 0)),
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        updatedByUid: api.uid()
      };
      await menuRef.child(id).update(safe);
      return safe;
    },

    async deleteMenu(id){
      const role = await api.role();
      if(!["creator","worker"].includes(role)) throw new Error("No tienes permiso");
      await menuRef.child(id).update({
        active:false,
        updatedAt:firebase.database.ServerValue.TIMESTAMP,
        updatedByUid:api.uid()
      });
    },

    async saveMusic(track){
      const role = await api.role();
      if(role!=="creator") throw new Error("Solo la Creadora puede administrar la disquera");
      const id = track.id || musicRef.push().key;
      const safe = {
        ...track, id, active: track.active !== false,
        updatedAt:firebase.database.ServerValue.TIMESTAMP,
        updatedByUid:api.uid()
      };
      await musicRef.child(id).update(safe);
      return safe;
    },

    async deleteMusic(id){
      const role = await api.role();
      if(role!=="creator") throw new Error("Solo la Creadora puede administrar la disquera");
      await musicRef.child(id).update({
        active:false,
        updatedAt:firebase.database.ServerValue.TIMESTAMP,
        updatedByUid:api.uid()
      });
    },

    async uploadCafeAudio(file){
      const role = await api.role();
      if(role!=="creator") throw new Error("Solo la Creadora puede subir música");
      if(!file?.type?.startsWith("audio/")) throw new Error("Selecciona un audio válido");
      if(file.size > 25*1024*1024) throw new Error("El audio debe pesar 25 MB o menos");
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", "speedy_friends_ost");
      form.append("folder", "speedy-friends/cafeteria/audio");
      form.append("public_id", `cafe-${api.uid()}-${Date.now()}`);
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/qgf6z2er/video/upload",
        { method:"POST", body:form }
      );
      const data = await response.json().catch(() => ({}));
      if(!response.ok || !data.secure_url){
        throw new Error(data?.error?.message || "Cloudinary no pudo subir el audio");
      }
      return { url:data.secure_url, name:file.name, bytes:file.size, duration:Number(data.duration||0) };
    },

    async placeOrder(order){
      const uid = api.uid();
      if(!uid) throw new Error("Inicia sesión para pedir");
      const activeSnap = await ordersRef.orderByChild("ownerUid").equalTo(uid).once("value");
      const active = Object.values(activeSnap.val() || {}).some(o =>
        o && ["pendiente","preparando","listo"].includes(String(o.status || "pendiente"))
      );
      if(active) throw new Error("YA TIENES UN TICKET EN PROCESO. Espera a que termine antes de pedir otro.");

      const p = api.profile();
      const profileId = sf.current?.profileId || p.id || "";
      if(!profileId) throw new Error("No se encontró tu perfil");
      const qty = Math.max(1, Math.min(10, Math.trunc(Number(order.qty) || 1)));
      const price = Math.max(0, Math.trunc(Number(order.price) || 0));
      const ref = ordersRef.push();
      const data = {
        id:ref.key, ownerUid:uid, ownerProfileId:profileId,
        username:p.username || p.name || "Usuario", nickname:p.nickname || "",
        title:p.title || "Integrante", avatar:p.avatar || "",
        itemId:order.itemId || "", itemName:order.itemName || "Bebida",
        unitPrice:price, qty, totalRings:price*qty,
        note:String(order.note || "").slice(0,240),
        status:"pendiente", statusChanges:0,
        createdAt:firebase.database.ServerValue.TIMESTAMP,
        servedByUid:"", servedByName:"", paidAt:0
      };
      await ref.set(data);
      await activityRef.push({type:"order_created",orderId:ref.key,ownerUid:uid,ownerProfileId:profileId,username:data.username,nickname:data.nickname,itemName:data.itemName,qty,at:firebase.database.ServerValue.TIMESTAMP});
      return data;
    },

    async setOrderStatus(id,status){
      const role = await api.role();
      if(!["creator","worker"].includes(role)) throw new Error("No tienes permiso para procesar tickets");
      const allowed = ["pendiente","preparando","listo","agotado","cancelado","servido"];
      if(!allowed.includes(status)) throw new Error("Estado inválido");

      const snap = await ordersRef.child(id).once("value");
      if(!snap.exists()) throw new Error("El ticket ya no existe");
      const order = snap.val() || {};
      const changes = Math.max(0, Math.trunc(Number(order.statusChanges) || 0));
      if(changes >= 3) throw new Error("Este ticket ya alcanzó el límite de 3 cambios de estado");
      if(String(order.status || "pendiente") === status) throw new Error("Ese ticket ya está en ese estado");

      const p = api.profile();
      const workerName = p.nickname || p.username || p.name || "Trabajador";

      if(["listo","agotado","cancelado"].includes(status)){
        const historyId = historyRef.push().key;
        const doneAt = Date.now();
        const archived = {
          ...order, status, statusChanges:changes+1, completedAt:doneAt,
          archivedAt:firebase.database.ServerValue.TIMESTAMP,
          servedByUid:api.uid(), servedByName:workerName,
          servedByUsername:p.username || p.name || workerName,
          servedByNickname:p.nickname || "", servedByAvatar:p.avatar || "",
          chargeRings:0, paidAt:0
        };
        const updates = {};
        updates[`ticketHistory/${historyId}`] = archived;
        updates[`workerHistory/${api.uid()}/${historyId}`] = archived;
        updates[`orders/${id}`] = null;
        updates[`activity/archive-${historyId}`] = {
          type:"order_archived", orderId:id, historyId, status,
          byUid:api.uid(), byName:workerName, at:firebase.database.ServerValue.TIMESTAMP
        };
        await root.update(updates);
        return archived;
      }

      if(status === "servido") return api.completeOrder(id);

      const patch = {
        status, statusChanges:changes+1,
        updatedAt:firebase.database.ServerValue.TIMESTAMP,
        updatedByUid:api.uid(), updatedByName:workerName
      };
      await ordersRef.child(id).update(patch);
      await activityRef.push({type:"order_status",orderId:id,status,statusChanges:changes+1,byUid:api.uid(),byName:workerName,at:firebase.database.ServerValue.TIMESTAMP});
      return {...order,...patch};
    },

    async completeOrder(id){
      const role = await api.role();
      if(!["creator","worker"].includes(role)) throw new Error("No tienes permiso para finalizar tickets");
      const snap = await ordersRef.child(id).once("value");
      if(!snap.exists()) throw new Error("Este ticket ya fue procesado");
      const order = snap.val() || {};
      const changes = Math.max(0, Math.trunc(Number(order.statusChanges) || 0));
      if(changes >= 3) throw new Error("Este ticket ya alcanzó el límite de 3 cambios de estado");

      const ownerUid = String(order.ownerUid || "");
      let profileId = String(order.ownerProfileId || "");
      if(!profileId){
        const us = await sf.refs.users.orderByChild("ownerUid").equalTo(ownerUid).once("value");
        profileId = Object.keys(us.val() || {})[0] || "";
      }
      if(!profileId) throw new Error("No se encontró el perfil del cliente");

      const total = Math.max(0, Math.trunc(Number(order.totalRings) || 0));
      const ringRef = sf.refs.rings.child(profileId);
      const userRef = sf.refs.users.child(profileId);
      const [rs,us] = await Promise.all([ringRef.once("value"),userRef.once("value")]);
      const before = Math.max(0, Math.trunc(Number(rs.val()) || Number(us.val()?.rings) || 0));
      if(before < total) throw new Error(`Rings insuficientes: necesita ${total} y tiene ${before}`);

      const tx = await ringRef.transaction(v => {
        const n = Math.max(0, Math.trunc(Number(v) || 0));
        return n >= total ? n-total : n;
      });
      const after = Math.max(0, Math.trunc(Number(tx.snapshot.val()) || 0));
      if(!tx.committed || after !== before-total) throw new Error("No se pudo confirmar el cobro");
      await userRef.update({rings:after}).catch(() => {});

      const p = api.profile();
      const workerName = p.nickname || p.username || p.name || "Trabajador";
      const doneAt = Date.now();
      const historyId = historyRef.push().key;
      const archived = {
        ...order, status:"servido", statusChanges:changes+1,
        updatedAt:doneAt, completedAt:doneAt,
        archivedAt:firebase.database.ServerValue.TIMESTAMP,
        servedByUid:api.uid(), servedByName:workerName,
        servedByUsername:p.username || p.name || workerName,
        servedByNickname:p.nickname || "", servedByAvatar:p.avatar || "",
        paidAt:doneAt, chargeRings:total
      };
      const updates = {};
      updates[`ticketHistory/${historyId}`] = archived;
      updates[`workerHistory/${api.uid()}/${historyId}`] = archived;
      updates[`orders/${id}`] = null;
      updates[`activity/charge-${historyId}`] = {
        type:"order_paid", orderId:id, historyId, ownerUid,
        ownerProfileId:profileId, workerUid:api.uid(), workerName,
        totalRings:total, at:firebase.database.ServerValue.TIMESTAMP
      };
      await root.update(updates);
      return archived;
    },

    async addWorker(uid,displayName){
      if(!sf.current?.isCreator) throw new Error("Solo la Creadora");
      await workersRef.child(uid).set({uid,role:"worker",active:true,displayName:displayName||uid,createdBy:api.uid(),createdAt:firebase.database.ServerValue.TIMESTAMP});
    },
    async removeWorker(uid){
      if(!sf.current?.isCreator) throw new Error("Solo la Creadora");
      await workersRef.child(uid).update({active:false,updatedBy:api.uid(),updatedAt:firebase.database.ServerValue.TIMESTAMP});
    }
  };

  window.SpeedyCafe = api;
  document.dispatchEvent(new CustomEvent("speedy:cafe-ready"));
})();
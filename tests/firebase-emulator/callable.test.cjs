'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const serverRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../../server/index.cjs'));
const {initializeApp,deleteApp}=serverRequire('firebase-admin/app');
const {getDatabase}=serverRequire('firebase-admin/database');
const base='speedy-friends-teams/speedy-friends';
const project='demo-speedy-integration';
const api='http://127.0.0.1:15001/'+project+'/us-central1/serveCafeOrder';
let app,team,worker,attacker;
async function account(){
 const r=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
 const data=await r.json(); if(!r.ok)throw Error('Auth emulator signup failed');return data;
}
async function call(user,data){
 const headers={'content-type':'application/json'}; if(user)headers.authorization='Bearer '+user.idToken;
 const r=await fetch(api,{method:'POST',headers,body:JSON.stringify({data})});return {status:r.status,body:await r.json()};
}
test.before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19000' || process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099' || process.env.GCLOUD_PROJECT!==project)throw Error('Solo emuladores demo aislados');
 app=initializeApp({projectId:project,databaseURL:'https://demo-speedy-integration-default-rtdb.firebaseio.com'});
 team=getDatabase(app).ref(base);worker=await account();attacker=await account();
});
test.beforeEach(async()=>{
 await team.set({users:{alice:{ownerUid:'alice'}},rings:{alice:100},cafeteria:{workers:{[worker.localId]:{role:'worker',active:true}},menu:{coffee:{active:true,price:20}},orders:{o1:{ownerUid:'alice',ownerProfileId:'alice',itemId:'coffee',qty:2,totalRings:1,status:'listo'}}}});
});
test.after(async()=>{if(app)await deleteApp(app)});
test('rechaza solicitudes anónimas y actores suplantados',async()=>{
 assert.equal((await call(null,{orderId:'o1'})).status,401);
 assert.equal((await call(attacker,{orderId:'o1',actorUid:worker.localId})).status,400);
 assert.equal((await call(worker,{orderId:'o1',price:1})).status,400);
 assert.equal((await call(attacker,{orderId:'o1'})).status,403);
 assert.equal((await team.child('rings/alice').get()).val(),100);
});
test('el trabajador no puede cambiar saldo ni servir por ruta directa',async()=>{
 const menuUrl='http://127.0.0.1:19000/'+base+'/cafeteria/menu.json?ns='+project+'-default-rtdb&auth='+encodeURIComponent(worker.idToken);
 assert.equal((await fetch(menuUrl)).status,200,'el mismo token debe poder leer la carta');
 for(const [path,data] of [['rings/alice',999],['cafeteria/orders/o1/status','servido']]){
  const url='http://127.0.0.1:19000/'+base+'/'+path+'.json?ns='+project+'-default-rtdb&auth='+encodeURIComponent(worker.idToken);
  const response=await fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,401);
 }
});
test('la función autenticada cobra una sola vez bajo concurrencia con precio servidor',async()=>{
 const results=await Promise.all([call(worker,{orderId:'o1'}),call(worker,{orderId:'o1'}),call(worker,{orderId:'o1'})]);
 assert.deepEqual(results.map(r=>r.status),[200,200,200]);
 const statuses=results.map(r=>r.body.result.status);
 assert.equal(statuses.filter(x=>x==='settled').length,1);assert.equal(statuses.filter(x=>x==='already-settled').length,2);
 const state=(await team.get()).val();assert.equal(state.rings.alice,60);assert.equal(state.cafeteria.orders.o1.status,'servido');assert.equal(state.economyLedger.o1.totalRings,40);
});

test('no cobra ni cambia el pedido si el saldo es insuficiente',async()=>{
 await team.child('rings/alice').set(10);
 const response=await call(worker,{orderId:'o1'});
 assert.equal(response.status,400);
 const state=(await team.get()).val();assert.equal(state.rings.alice,10);assert.equal(state.cafeteria.orders.o1.status,'listo');assert.equal(state.economyLedger,undefined);
});
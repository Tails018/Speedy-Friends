import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction } from 'firebase/database';
const require=createRequire(import.meta.url);
const {settleOrder}=require(process.env.SF_SETTLE_MODULE || '../../server/settle-order.cjs');
const path='speedy-friends-teams/speedy-friends';
let env,db;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19000')throw Error('Emulador aislado requerido');
 // Explicitly open test rules only for exercising the trusted server transaction.
 env=await initializeTestEnvironment({projectId:'demo-speedy-friends',database:{rules:JSON.stringify({rules:{'.read':true,'.write':true}})}});
 db=env.unauthenticatedContext().database();
});
beforeEach(async()=>{
 await env.clearDatabase();
 await set(ref(db,path),{users:{alice:{ownerUid:'alice'}},rings:{alice:100},cafeteria:{workers:{worker:{role:'worker',active:true}},menu:{coffee:{active:true,price:20}},orders:{o1:{ownerUid:'alice',ownerProfileId:'alice',itemId:'coffee',qty:2,totalRings:1,status:'listo'}}}});
});
after(async()=>{if(env)await env.cleanup()});
const execute=(id='o1',actor='worker')=>settleOrder({actorUid:actor,creatorUid:'creator',orderId:id,now:12345,runTransaction:async update=>{
 const r=ref(db,path);await get(r);return runTransaction(r,update,{applyLocally:false});
}});
test('cobro concurrente y reintentos registran exactamente un cargo al precio del menú',async()=>{
 const results=await Promise.all([execute(),execute(),execute()]);
 assert.equal(results.filter(x=>x.status==='settled').length,1);
 assert.equal(results.filter(x=>x.status==='already-settled').length,2);
 const team=(await get(ref(db,path))).val();
 assert.equal(team.rings.alice,60);assert.equal(team.cafeteria.orders.o1.status,'servido');
 assert.equal(team.economyLedger.o1.totalRings,40);assert.equal(Object.keys(team.economyLedger).length,1);
});
test('un usuario no autorizado no puede cobrar',async()=>{
 await assert.rejects(execute('o1','alice'),e=>e.code==='permission-denied');
 assert.equal((await get(ref(db,`${path}/rings/alice`))).val(),100);
});
test('saldo insuficiente no modifica saldo ni pedido ni historial',async()=>{
 await set(ref(db,`${path}/rings/alice`),10);
 await assert.rejects(execute(),e=>e.code==='insufficient-rings');
 const team=(await get(ref(db,path))).val();assert.equal(team.rings.alice,10);assert.equal(team.cafeteria.orders.o1.status,'listo');assert.equal(team.economyLedger,undefined);
});
test('no se puede cobrar antes de listo',async()=>{
 await set(ref(db,`${path}/cafeteria/orders/o1/status`),'pendiente');
 await assert.rejects(execute(),e=>e.code==='invalid-order-state');
});

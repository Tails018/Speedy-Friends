import {readFileSync} from 'node:fs';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {ref,runTransaction,set,get} from 'firebase/database';
import {pairKey,reducePair} from './pair-transaction.mjs';
let env;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19011')throw Error('Requiere emulador local aislado');
 env=await initializeTestEnvironment({projectId:'demo-speedy-social',database:{rules:readFileSync(new URL('./deny.rules.json',import.meta.url),'utf8')}});
});
after(async()=>{if(env)await env.cleanup();});
test('cliente autenticado no escribe directamente en la fuente de amistad',async()=>{
 const db=env.authenticatedContext('mallory').database();
 await assertFails(set(ref(db,'socialV2/pairs/'+pairKey('bob','mallory')),{status:'friends'}));
});
test('solicitudes concurrentes se serializan y solo el destinatario puede aceptar',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.database(),r=ref(db,'socialV2/pairs/'+pairKey('alice','bob'));
  const op=(actorUid,peerUid,action,operationId)=>runTransaction(r,s=>{const next=reducePair(s,{actorUid,peerUid,action,operationId});return s===null && next===undefined?null:next;},{applyLocally:false});
  const [a,b]=await Promise.all([op('alice','bob','send','request01'),op('bob','alice','send','request02')]);
  assert.equal([a,b].filter(v=>v.committed).length,1);
  const p=(await get(r)).val();
  assert.equal(p.status,'pending');
  assert.equal((await op(p.requester,p.recipient,'accept','attempt01')).committed,false);
  assert.equal((await op(p.recipient,p.requester,'accept','accept001')).committed,true);
  assert.equal((await get(r)).val().status,'friends');
  const repeated=await op(p.recipient,p.requester,'accept','accept001');
  assert.equal(repeated.committed,true);
  assert.equal((await get(r)).val().status,'friends');
 });
});

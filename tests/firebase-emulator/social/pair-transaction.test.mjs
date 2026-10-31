import test from 'node:test';
import assert from 'node:assert/strict';
import {pairKey,reducePair} from './pair-transaction.mjs';
const apply=(s,actorUid,peerUid,action,operationId)=>reducePair(s,{actorUid,peerUid,action,operationId});
test('pareja canónica y sin colisiones',()=>{
 assert.equal(pairKey('alice','bob'),pairKey('bob','alice'));
 assert.notEqual(pairKey('ab','c'),pairKey('a','bc'));
 assert.throws(()=>pairKey('a','a'));
});
test('solo destinatario acepta o rechaza y remitente cancela',()=>{
 const p=apply(null,'alice','bob','send','request01');
 assert.equal(apply(p,'alice','bob','accept','attack001'),undefined);
 assert.equal(apply(p,'alice','bob','reject','attack002'),undefined);
 assert.equal(apply(p,'bob','alice','cancel','attack003'),undefined);
 assert.equal(apply(p,'bob','alice','accept','accept001').status,'friends');
 assert.equal(apply(p,'bob','alice','reject','reject001').status,'none');
 assert.equal(apply(p,'alice','bob','cancel','cancel001').status,'none');
});
test('aceptación sin solicitud y actor ajeno se rechazan',()=>{
 assert.equal(apply(null,'alice','bob','accept','attempt01'),undefined);
 const p=apply(null,'alice','bob','send','request01');
 assert.equal(apply(p,'mallory','alice','accept','attempt02'),undefined);
 assert.equal(apply(null,'alice','alice','send','attempt03'),undefined);
});
test('reintentos idénticos son idempotentes',()=>{
 const p=apply(null,'alice','bob','send','request01');
 assert.deepEqual(apply(p,'alice','bob','send','request01'),p);
 assert.equal(apply(p,'alice','bob','cancel','request01'),undefined);
 const f=apply(p,'bob','alice','accept','accept001');
 assert.deepEqual(apply(f,'bob','alice','accept','accept001'),f);
 assert.equal(apply(f,'alice','bob','remove','remove001').status,'none');
});

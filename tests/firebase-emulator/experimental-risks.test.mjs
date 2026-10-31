// These tests deliberately confirm unresolved vulnerabilities in the experimental candidate.
import {readFileSync} from 'node:fs';
import {before,beforeEach,after,test} from 'node:test';
import {initializeTestEnvironment,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,set,get} from 'firebase/database';
const base='speedy-friends-teams/speedy-friends';let env;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19000')throw Error('Solo emulador local');
 env=await initializeTestEnvironment({projectId:'demo-speedy-experimental',database:{rules:readFileSync('database.experimental.rules.json','utf8')}});
});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database(),base),{
 users:{alice:{ownerUid:'alice',ownerEmail:'alice@example.test'}},
 cafeteria:{workers:{suspended:{role:'worker',active:false}}},
 news:{draft:{id:'draft',title:'Borrador',category:'INFO',date:'2026-01-01',summary:'',body:'privado',published:false}}
}));});
after(async()=>{await env?.cleanup()});
const db=uid=>env.authenticatedContext(uid,{email:`${uid}@example.test`,email_verified:true}).database();
test('RIESGO CONFIRMADO: un miembro puede crear un ticket servido con precio elegido por el cliente',async()=>{
 await assertSucceeds(set(ref(db('alice'),`${base}/cafeteria/orders/fake`),{ownerUid:'alice',status:'servido',unitPrice:1,totalRings:1}));
});
test('RIESGO CONFIRMADO: se puede crear una amistad sin consentimiento',async()=>{
 await assertSucceeds(set(ref(db('alice'),`${base}/friends/alice/bob`),{uid:'bob',profileId:'bob-profile',displayName:'Bob'}));
});
test('RIESGO CONFIRMADO: un trabajador inactivo puede modificar la carta',async()=>{
 await assertSucceeds(set(ref(db('suspended'),`${base}/cafeteria/menu/item`),{price:1,active:true}));
});
test('RIESGO CONFIRMADO: una cuenta autenticada puede leer borradores',async()=>{
 await assertSucceeds(get(ref(db('alice'),`${base}/news`)));
});

// Perfil V7.1 contra el Emulator Suite oficial (Realtime Database), con dos clientes reales.
// Compara la escritura antigua (objeto completo con «...existing») con la nueva (solo campos
// editables) bajo las reglas de referencia y bajo el candidato experimental. No toca producción.
import {readFileSync} from 'node:fs';
import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,set,update,get} from 'firebase/database';

const USERS='speedy-friends-teams/speedy-friends/users';
const CREATOR={email:'t89886464@gmail.com',email_verified:true};
const EDITABLE=['name','nickname','title','username','description','bio','avatar','cover','iconPosition','iconZoom','coverPosition','coverZoom'];
const envs={};
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19000')throw Error('Solo emulador local');
 envs.reference=await initializeTestEnvironment({projectId:'demo-profile-reference',database:{rules:readFileSync('../../rules/realtime-owner-reference.json','utf8')}});
 envs.experimental=await initializeTestEnvironment({projectId:'demo-profile-experimental',database:{rules:readFileSync('database.experimental.rules.json','utf8')}});
});
after(async()=>{for(const e of Object.values(envs))await e.cleanup();});
const seed={ownerUid:'alice',ownerEmail:'alice@example.test',role:'Runner',rings:120,level:3,name:'Alice',title:'Runner',description:''};
beforeEach(async()=>{
 for(const e of Object.values(envs)){
  await e.clearDatabase();
  await e.withSecurityRulesDisabled(c=>set(ref(c.database(),USERS),{alice:seed,bob:{ownerUid:'bob',ownerEmail:'bob@example.test',role:'Runner',rings:80,name:'Bob'}}));
 }
});
const as=(env,uid,claims={email:`${uid}@example.test`,email_verified:true})=>env.authenticatedContext(uid,claims).database();
const read=async(env,path)=>{let v;await env.withSecurityRulesDisabled(async c=>{v=(await get(ref(c.database(),path))).val();});return v;};
// Lo que hace profile.html V7.1: solo los campos editables que cambiaron.
const minimalPatch=(existing,edits)=>Object.fromEntries(Object.entries(edits).filter(([k,v])=>EDITABLE.includes(k)&&existing[k]!==v));

for(const name of ['reference','experimental']){
 test(`[${name}] guardar el perfil no pisa un saldo cambiado a la vez por la creadora`,async()=>{
  const env=envs[name];
  const alice=as(env,'alice'),creator=as(env,'creator',CREATOR);
  const existing=await read(env,`${USERS}/alice`);              // Alice abre el editor (saldo 120)
  await assertSucceeds(set(ref(creator,`${USERS}/alice/rings`),999)); // la creadora cambia el saldo
  await assertSucceeds(update(ref(alice,`${USERS}/alice`),minimalPatch(existing,{title:'Capitana',cover:'data:image/png;base64,AAAA'})));
  const after=await read(env,`${USERS}/alice`);
  assert.equal(after.rings,999);assert.equal(after.title,'Capitana');assert.equal(after.role,'Runner');
 });

 test(`[${name}] dos sesiones de la misma cuenta editan campos distintos sin perder ninguno`,async()=>{
  const env=envs[name];
  const phone=as(env,'alice'),laptop=as(env,'alice');
  const existing=await read(env,`${USERS}/alice`);
  await Promise.all([
   assertSucceeds(update(ref(phone,`${USERS}/alice`),minimalPatch(existing,{nickname:'Speedy A'}))),
   assertSucceeds(update(ref(laptop,`${USERS}/alice`),minimalPatch(existing,{description:'Desde el portátil'})))
  ]);
  const after=await read(env,`${USERS}/alice`);
  assert.equal(after.nickname,'Speedy A');assert.equal(after.description,'Desde el portátil');assert.equal(after.rings,120);
 });

 test(`[${name}] nadie puede guardar su perfil sobre el de otra cuenta`,async()=>{
  await assertFails(update(ref(as(envs[name],'alice'),`${USERS}/bob`),{name:'Hackeado'}));
  assert.equal((await read(envs[name],`${USERS}/bob`)).name,'Bob');
 });
}

test('[reference] la escritura antigua con el objeto completo SÍ pisaba el saldo concurrente (riesgo corregido en el cliente)',async()=>{
 const env=envs.reference;
 const alice=as(env,'alice'),creator=as(env,'creator',CREATOR);
 const existing=await read(env,`${USERS}/alice`);
 await set(ref(creator,`${USERS}/alice/rings`),999);
 await assertSucceeds(update(ref(alice,`${USERS}/alice`),{...existing,title:'Capitana'}));
 assert.equal((await read(env,`${USERS}/alice`)).rings,120,'las reglas de referencia permiten devolver el saldo antiguo');
});

test('[experimental] el candidato rechaza la escritura antigua que reescribe Rings, y acepta la mínima',async()=>{
 const env=envs.experimental;
 const alice=as(env,'alice'),creator=as(env,'creator',CREATOR);
 const existing=await read(env,`${USERS}/alice`);
 await set(ref(creator,`${USERS}/alice/rings`),999);
 await assertFails(update(ref(alice,`${USERS}/alice`),{...existing,title:'Capitana'}));
 await assertSucceeds(update(ref(alice,`${USERS}/alice`),minimalPatch(existing,{title:'Capitana'})));
 assert.equal((await read(env,`${USERS}/alice`)).rings,999);
});

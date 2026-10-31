import { readFileSync } from 'node:fs';
import { before, beforeEach, after, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set } from 'firebase/database';
const base = 'speedy-friends-teams/speedy-friends';
let env;
before(async () => {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:19000') throw new Error('Emulador aislado requerido');
  const source = process.env.SF_OWNER_RULES || new URL('../../rules/realtime-owner-reference.json', import.meta.url);
  env = await initializeTestEnvironment({ projectId: 'demo-speedy-friends', database: { rules: readFileSync(source, 'utf8') } });
});
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(ctx => set(ref(ctx.database(), `${base}/users/alice`), {ownerUid:'alice', ownerEmail:'alice@example.test', role:'Runner'}));
});
after(async () => { if(env) await env.cleanup(); });
test('la copia original permite apropiarse de un perfil ajeno', async () => {
  const db=env.authenticatedContext('mallory', { email:'mallory@example.test' }).database();
  await assertSucceeds(set(ref(db, `${base}/users/alice`), {ownerUid:'mallory', ownerEmail:'mallory@example.test', role:'admin'}));
});
test('la copia original permite crear perfil propio admin y publicar noticias', async () => {
  const db=env.authenticatedContext('mallory', { email:'mallory@example.test' }).database();
  await assertSucceeds(set(ref(db, `${base}/users/mallory`), {ownerUid:'mallory', ownerEmail:'mallory@example.test', role:'admin'}));
  await assertSucceeds(set(ref(db, `${base}/news/n1`), {id:'n1', title:'Noticia', category:'INFO', date:'2026-01-01', summary:'Resumen', body:'Texto', published:true}));
});
test('la copia original permite crear un pedido servido con precio arbitrario', async () => {
  const db=env.authenticatedContext('mallory', { email:'mallory@example.test' }).database();
  await assertSucceeds(set(ref(db, `${base}/cafeteria/orders/forged`), {ownerUid:'mallory', status:'servido', totalRings:0}));
});
test('la copia original permite crear una amistad sin solicitud', async () => {
  const db=env.authenticatedContext('mallory', { email:'mallory@example.test' }).database();
  await assertSucceeds(set(ref(db, `${base}/friends/bob/mallory`), {uid:'mallory', profileId:'mallory', displayName:'Mallory'}));
});

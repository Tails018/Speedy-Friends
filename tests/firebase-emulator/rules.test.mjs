import { readFileSync } from 'node:fs';
import { before, beforeEach, after, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';

const projectId = 'demo-speedy-friends';
const base = 'speedy-friends-teams/speedy-friends';
let env;

before(async () => {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:19000') {
    throw new Error('Estas pruebas requieren el emulador local en 127.0.0.1:19000; no se permite conectar a producción.');
  }
  env = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync('database.candidate.rules.json', 'utf8') }
  });
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), base), {
      users: { aliceProfile: { ownerUid: 'alice', ownerEmail: 'alice@example.test', nickname: 'Alice' } },
      rings: { aliceProfile: 50 },
      permissions: { admin: { role: 'admin' } },
      ringHistory: { one: { amount: 50 } }
    });
  });
});

after(async () => { if (env) await env.cleanup(); });
const db = uid => env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: true }).database();
const path = suffix => `${base}/${suffix}`;

test('sin sesión no se leen perfiles', async () => {
  await assertFails(get(ref(env.unauthenticatedContext().database(), path('users'))));
});
test('propietario legítimo puede editar su perfil', async () => {
  await assertSucceeds(set(ref(db('alice'), path('users/aliceProfile')), { ownerUid: 'alice', ownerEmail: 'alice@example.test', nickname: 'A' }));
});
test('otro usuario no puede apropiarse de un perfil existente', async () => {
  await assertFails(set(ref(db('mallory'), path('users/aliceProfile')), { ownerUid: 'mallory', ownerEmail: 'mallory@example.test', nickname: 'M' }));
});
test('usuario normal no puede asignarse permisos de admin', async () => {
  await assertFails(set(ref(db('mallory'), path('permissions/mallory')), { role: 'admin' }));
});
test('usuario normal no puede modificar saldo ajeno', async () => {
  await assertFails(set(ref(db('mallory'), path('rings/aliceProfile')), 999));
});
test('usuario normal no lee historial administrativo', async () => {
  await assertFails(get(ref(db('mallory'), path('ringHistory'))));
});

test('propietario no puede cambiar ownerEmail, rol o Rings de su perfil', async () => {
  const alice = db('alice');
  for (const [key, value] of [['ownerEmail', 'mallory@example.test'], ['role', 'admin'], ['rings', 999]]) {
    await assertFails(set(ref(alice, path(`users/aliceProfile/${key}`)), value));
  }
});
test('usuario nuevo no puede crear un perfil con rol administrativo', async () => {
  await assertFails(set(ref(db('mallory'), path('users/malloryProfile')), { ownerUid: 'mallory', ownerEmail: 'mallory@example.test', role: 'admin', rings: 0 }));
});
test('usuario nuevo puede crear un perfil normal', async () => {
  await assertSucceeds(set(ref(db('mallory'), path('users/malloryProfile')), { ownerUid: 'mallory', ownerEmail: 'mallory@example.test', role: 'Runner', rings: 0 }));
});

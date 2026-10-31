import {readFileSync} from 'node:fs';
import {before,beforeEach,after,test} from 'node:test';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,set,update} from 'firebase/database';
const base='speedy-friends-teams/speedy-friends/users';let env;
before(async()=>{if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19000')throw Error('Solo emulador local');env=await initializeTestEnvironment({projectId:'demo-speedy-experimental',database:{rules:readFileSync('database.experimental.rules.json','utf8')}})});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database(),`${base}/alice`),{ownerUid:'alice',ownerEmail:'alice@example.test',role:'Runner',rings:0,name:'Alice'}));});
after(async()=>{await env?.cleanup()});
const db=uid=>env.authenticatedContext(uid,{email:`${uid}@example.test`,email_verified:true}).database();
test('edición legítima mantiene identidad y privilegios',async()=>{await assertSucceeds(update(ref(db('alice'),`${base}/alice`),{name:'Alice dos'}));});
test('propietario no puede añadir banderas ni claims de privilegio',async()=>{
 for(const [field,value] of [['isAdmin',true],['isCreator',true],['admin',true],['permissions',{role:'admin'}],['customClaims',{admin:true}]])await assertFails(set(ref(db('alice'),`${base}/alice/${field}`),value));
});
test('usuario nuevo no puede crear perfil con privilegios adicionales',async()=>{
 await assertFails(set(ref(db('bob'),`${base}/bob`),{ownerUid:'bob',ownerEmail:'bob@example.test',role:'Runner',rings:0,isAdmin:true}));
 await assertSucceeds(set(ref(db('bob'),`${base}/bob`),{ownerUid:'bob',ownerEmail:'bob@example.test',role:'Runner',rings:0}));
});

import {readFileSync} from 'node:fs';
import {before,beforeEach,after,test} from 'node:test';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,set,update,remove,get} from 'firebase/database';

const base='speedy-friends-teams/speedy-friends/fanarts';
const art=(id,uid,extra={})=>({id,ownerUid:uid,title:'Arte',description:'',category:'Digital',mediaType:'image',image:'https://example.test/image.png',createdAt:1,...extra});
let env;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:19000')throw Error('Solo emulador local');
 env=await initializeTestEnvironment({projectId:'demo-speedy-experimental',database:{rules:readFileSync('database.experimental.rules.json','utf8')}});
});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database(),base),{old:art('old','alice',{cloudinaryDeleteToken:'legacy-test-value'}),owned:art('owned','alice')}));});
after(async()=>{await env?.cleanup()});
const db=uid=>env.authenticatedContext(uid,{email:`${uid}@example.test`,email_verified:true}).database();
const path=id=>`${base}/${id}`;
test('sesión y dueño válidos pueden publicar imagen sin tokens ni likes',async()=>{await assertSucceeds(set(ref(db('alice'),path('new')),art('new','alice')))});
test('no se puede publicar una obra de otro usuario ni sin sesión',async()=>{
 await assertFails(set(ref(db('mallory'),path('new')),art('new','alice')));
 await assertFails(set(ref(env.unauthenticatedContext().database(),path('new')),art('new','alice')));
});
test('una creación no puede incluir token de borrado ni likes falsos',async()=>{
 await assertFails(set(ref(db('alice'),path('new')),art('new','alice',{cloudinaryDeleteToken:'test-token'})));
 await assertFails(set(ref(db('alice'),path('new')),art('new','alice',{likes:{mallory:true}})));
});
test('el dueño edita metadatos y no cambia identidad, imagen o token',async()=>{
 await assertSucceeds(update(ref(db('alice'),path('owned')),{title:'Nuevo',description:'Texto',category:'Renders'}));
 await assertFails(set(ref(db('mallory'),`${path('owned')}/title`),'Intruso'));
 await assertFails(set(ref(db('alice'),`${path('owned')}/ownerUid`),'mallory'));
 await assertFails(set(ref(db('alice'),`${path('owned')}/cloudinaryDeleteToken`),'test-token'));
 await assertFails(remove(ref(db('mallory'),path('owned'))));
});
test('se conservan publicaciones históricas con token al editar o dar like',async()=>{
 await assertSucceeds(set(ref(db('alice'),`${path('old')}/title`),'Edición'));
 await assertSucceeds(set(ref(db('mallory'),`${path('old')}/likes/mallory`),true));
 await assertFails(set(ref(db('mallory'),`${path('old')}/likes/alice`),true));
});
test('valida longitud y categoría de imágenes y vídeos',async()=>{
 await assertFails(set(ref(db('alice'),path('new')),art('new','alice',{title:'x'.repeat(71)})));
 await assertFails(set(ref(db('alice'),path('new')),art('new','alice',{mediaType:'video',category:'Digital'})));
 await assertSucceeds(set(ref(db('alice'),path('new')),art('new','alice',{mediaType:'video',category:'Edits'})));
 await assertFails(set(ref(db('alice'),`${path('new')}/category`),'Digital'));
});
test('una persona autenticada puede leer; un visitante no',async()=>{
 await assertSucceeds(get(ref(db('alice'),base)));
 await assertFails(get(ref(env.unauthenticatedContext().database(),base)));
});

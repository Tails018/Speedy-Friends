/* Perfil V7.1: carreras de sesión, borradores por cuenta y escrituras mínimas.
 * Usa tests/firebase-mock.js (Firebase SIMULADO, sin reglas). __sfMockAuthDelay imita la restauración
 * asíncrona de Firebase Auth y __sfMockLatency la red. Las reglas reales se prueban aparte con el
 * Emulator Suite (tests/firebase-emulator/profile-writes.test.mjs).
 * Uso: npm run dev (otra terminal) → node tests/profile-session.cjs */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const MOCK=fs.readFileSync(__dirname+'/firebase-mock.js','utf8');
const T='speedy-friends-teams/speedy-friends';
const ALICE={uid:'uid-alice',email:'alice@test.local',displayName:'Alice'};
const BOB={uid:'uid-bob',email:'bob@test.local',displayName:'Bob'};
const user=(id,u,extra={})=>({id,name:u.displayName,username:u.displayName.toLowerCase(),nickname:'',title:'Runner',description:'',ownerUid:u.uid,ownerEmail:u.email,rings:0,role:'member',level:3,...extra});
const SEED={'speedy-friends-teams':{'speedy-friends':{
 users:{'user-alice':user('user-alice',ALICE,{rings:120}),'user-bob':user('user-bob',BOB,{rings:80,avatar:'data:image/png;base64,Qk9C'})},
 rings:{'user-alice':120,'user-bob':80}
}}};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const ALLOWED=['name','nickname','title','username','description','bio','avatar','cover','iconPosition','iconZoom','coverPosition','coverZoom','ownerUid','ownerEmail'];

async function context(browser,{session=ALICE,authDelay=0,latency=0,mobile=false,seed=SEED}={}){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},reducedMotion:'reduce',...(mobile?{hasTouch:true,isMobile:true}:{})});
 await ctx.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===base)return route.continue();
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-app-compat'))return route.fulfill({contentType:'text/javascript',body:MOCK});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase'))return route.fulfill({contentType:'text/javascript',body:'/* mock */'});
  return route.abort();
 });
 await ctx.addInitScript(({seed,session,authDelay,latency})=>{
  window.__sfMockAuthDelay=Number(sessionStorage.getItem('__authDelay')??authDelay);window.__sfMockLatency=latency;
  if(!localStorage.getItem('__sfMockSeeded')){localStorage.setItem('__sfMockDb',JSON.stringify(seed));localStorage.setItem('__sfMockSeeded','1');if(session)localStorage.setItem('__sfMockAuth',JSON.stringify(session));}
  // Registra cada update para comprobar qué campos se escriben.
  window.__updates=[];
  const hook=()=>{const db=window.firebase?.database?.();if(!db)return setTimeout(hook,5);const proto=Object.getPrototypeOf(db.ref('x'));if(proto.__wrapped)return;const orig=proto.update;proto.update=function(obj){window.__updates.push({path:this.path,keys:Object.keys(obj||{})});if(window.__failNextUpdate){window.__failNextUpdate=false;return Promise.reject(Object.assign(new Error('Client is offline.'),{code:'NETWORK_ERROR'}));}if(window.__beforeUpdate){const f=window.__beforeUpdate;window.__beforeUpdate=null;f();}return orig.call(this,obj);};proto.__wrapped=true;};
  hook();
 },{seed,session,authDelay,latency});
 return ctx;
}
const get=(page,path)=>page.evaluate(p=>window.__sfMock.getAt(p),path);
const status=page=>page.locator('#save-profile-status').innerText();
const waitStatus=async(page,re,timeout=8000)=>{try{await page.waitForFunction(r=>new RegExp(r,'i').test(document.getElementById('save-profile-status')?.textContent||''),re.source,{timeout});}catch{throw new Error(`Estado esperado ${re} y se vio: «${await page.locator('#save-profile-status').innerText().catch(()=>'?')}»`);}};
const pickCover=(page)=>page.locator('#profile-cover-file').setInputFiles({name:'portada.png',mimeType:'image/png',buffer:PNG});

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 let failed=0;const results=[];
 const test=async(title,fn)=>{try{await fn();results.push({title,status:'passed'});console.log('PASS',title);}catch(e){failed++;results.push({title,status:'failed',error:e.message});console.log('FAIL',title,'\n  '+e.message.split('\n').slice(0,3).join('\n  '));}};

 await test('1-3. Edita y elige portada antes de que Auth termine (inicio lento): guarda en la cuenta correcta',async()=>{
  const ctx=await context(browser,{authDelay:1500,latency:150});const p=await ctx.newPage();
  await p.goto(base+'/profile.html',{waitUntil:'domcontentloaded'});
  await p.locator('#profile-edit-name').fill('Alice rápida');
  await pickCover(p);
  assert.equal(await p.evaluate(()=>window.firebase.auth().currentUser),null,'Auth todavía restaurando');
  await p.locator('#save-profile').click();
  await waitStatus(p,/GUARDADO/);
  assert.equal(await get(p,T+'/users/user-alice/name'),'Alice rápida');
  assert.match(String(await get(p,T+'/users/user-alice/cover')),/^data:image\/png/);
  assert.equal(await get(p,T+'/users/user-bob/name'),'Bob','otra cuenta intacta');
  await ctx.close();
 });

 await test('4. Cambio real de cuenta con cambios sin guardar: no se guarda en la cuenta nueva',async()=>{
  const ctx=await context(browser);const p=await ctx.newPage();
  await p.goto(base+'/profile.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await p.locator('#profile-edit-name').fill('Borrador de Alice');await pickCover(p);
  await p.evaluate(async b=>{await window.firebase.auth().signOut();window.__SF_MOCK_LOGIN=b;await window.firebase.auth().signInWithPopup();},BOB);
  await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-bob');
  await p.locator('#save-profile').click().catch(()=>{});
  await waitStatus(p,/otra cuenta/);
  assert.equal(await get(p,T+'/users/user-bob/name'),'Bob','el borrador de Alice no llega a Bob');
  assert.equal(await get(p,T+'/users/user-bob/cover'),null,'la portada de Alice no llega a Bob');
  assert.equal(await get(p,T+'/users/user-alice/name'),'Alice','tampoco se guarda en Alice sin su sesión');
  await ctx.close();
 });

 await test('5. Cierre de sesión durante la edición: conserva el borrador y guarda al volver con la misma cuenta',async()=>{
  const ctx=await context(browser);const p=await ctx.newPage();
  await p.goto(base+'/profile.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await p.locator('#profile-edit-nickname').fill('Speedy A');
  await p.evaluate(()=>window.firebase.auth().signOut());
  await waitStatus(p,/sesión se cerró/);
  assert.ok(await p.locator('#save-profile').isDisabled(),'no se puede guardar sin sesión');
  assert.equal(await p.locator('#profile-edit-nickname').inputValue(),'Speedy A','borrador intacto');
  await p.evaluate(async a=>{window.__SF_MOCK_LOGIN=a;await window.firebase.auth().signInWithPopup();},ALICE);
  await p.waitForFunction(()=>!document.getElementById('save-profile').disabled);
  await p.locator('#save-profile').click();await waitStatus(p,/GUARDADO/);
  assert.equal(await get(p,T+'/users/user-alice/nickname'),'Speedy A');
  await ctx.close();
 });

 await test('6 y 9. Error de conexión al guardar: conserva cambios y el reintento guarda sin reeditar',async()=>{
  const ctx=await context(browser);const p=await ctx.newPage();
  await p.goto(base+'/profile.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await p.locator('#profile-edit-title').fill('Capitana');await pickCover(p);
  await p.evaluate(()=>{window.__failNextUpdate=true;});
  await p.locator('#save-profile').click();
  await waitStatus(p,/conexión|reintenta/);
  assert.match(await p.locator('#save-profile').innerText(),/REINTENTAR/i);
  assert.equal(await p.locator('#profile-edit-title').inputValue(),'Capitana');
  assert.equal(await get(p,T+'/users/user-alice/title'),'Runner','nada a medias');
  await p.locator('#save-profile').click();await waitStatus(p,/GUARDADO/);
  assert.equal(await get(p,T+'/users/user-alice/title'),'Capitana');
  assert.match(String(await get(p,T+'/users/user-alice/cover')),/^data:image\/png/);
  await ctx.close();
 });

 await test('7. Dos cuentas en el mismo dispositivo: imágenes y borradores no se mezclan',async()=>{
  const ctx=await context(browser);const p=await ctx.newPage();
  await p.goto(base+'/profile.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await pickCover(p);await p.locator('#save-profile').click();await waitStatus(p,/GUARDADO/);
  await p.locator('#profile-edit-name').fill('Pendiente de Alice');
  await p.evaluate(()=>window.firebase.auth().signOut());
  await p.evaluate(()=>localStorage.setItem('__sfMockAuth',JSON.stringify({uid:'uid-bob',email:'bob@test.local',displayName:'Bob'})));
  await p.reload();await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-bob');
  await p.waitForTimeout(400);
  assert.equal(await p.locator('#profile-edit-name').inputValue(),'Bob','Bob no ve el borrador de Alice');
  const coverStyle=await p.evaluate(()=>getComputedStyle(document.getElementById('cover-crop-image')||document.body).backgroundImage);
  assert.doesNotMatch(coverStyle,/iVBOR/,'Bob no ve la portada de Alice');
  await p.locator('#profile-edit-nickname').fill('B');await p.locator('#save-profile').click();await waitStatus(p,/GUARDADO/);
  assert.equal(await get(p,T+'/users/user-bob/cover'),null,'la portada de Alice no se guarda en Bob');
  assert.equal(await get(p,T+'/users/user-bob/avatar'),'data:image/png;base64,Qk9C','el avatar de Bob no se toca');
  await ctx.close();
 });

 await test('8. Cambio de Rings y rol mientras se edita: el guardado solo escribe campos editables',async()=>{
  const ctx=await context(browser);const p=await ctx.newPage();
  await p.goto(base+'/profile.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await p.locator('#profile-edit-description').fill('Nueva bio');await pickCover(p);
  // Otra sesión (admin) cambia el saldo y el rol justo antes de que llegue el guardado.
  await p.evaluate(()=>{window.__beforeUpdate=()=>{const r=window.firebase.database().ref('speedy-friends-teams/speedy-friends/users/user-alice');r.child('rings').set(999);r.child('role').set('admin');r.child('level').set(9);};});
  await p.locator('#save-profile').click();await waitStatus(p,/GUARDADO/);
  const saved=await get(p,T+'/users/user-alice');
  assert.equal(saved.rings,999,'Rings concurrentes conservados');assert.equal(saved.role,'admin','rol concurrente conservado');assert.equal(saved.level,9);
  assert.equal(saved.description,'Nueva bio');
  const writes=(await p.evaluate(()=>window.__updates)).filter(u=>/users\/user-alice$/.test(u.path));
  assert.ok(writes.length>=1,'hubo escritura del perfil');
  for(const w of writes)for(const k of w.keys)assert.ok(ALLOWED.includes(k),`campo no editable escrito: ${k}`);
  assert.ok(!writes.some(w=>w.keys.includes('avatar')),'no reescribe el avatar si no cambió');
  await ctx.close();
 });

 await test('10. Android: el borrador sobrevive a recargar la página (misma cuenta)',async()=>{
  const ctx=await context(browser,{mobile:true});const p=await ctx.newPage();
  await p.goto(base+'/profile.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await p.locator('#profile-edit-name').fill('Alice móvil');await pickCover(p);
  await p.waitForTimeout(700);
  await p.reload();await p.waitForFunction(()=>window.SpeedyFirebase?.current?.uid==='uid-alice');
  await p.waitForFunction(()=>document.getElementById('profile-edit-name').value==='Alice móvil',null,{timeout:5000});
  await waitStatus(p,/recuper/);
  await p.locator('#save-profile').click();await waitStatus(p,/GUARDADO/);
  assert.equal(await get(p,T+'/users/user-alice/name'),'Alice móvil');
  assert.match(String(await get(p,T+'/users/user-alice/cover')),/^data:image\/png/,'la portada del borrador también se recupera');
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,'sin scroll horizontal en móvil');
  await ctx.close();
 });

 await browser.close();
 fs.mkdirSync('test-results',{recursive:true});
 fs.writeFileSync('test-results/profile-session.json',JSON.stringify({date:new Date().toISOString(),note:'Firebase simulado',results},null,1));
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

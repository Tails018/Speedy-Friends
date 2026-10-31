/* Pruebas de extremo a extremo con datos ficticios: los SDK de Firebase se sustituyen por
 * tests/firebase-mock.js y todo servicio externo queda bloqueado. Ejecuta el código real de las
 * páginas (firebase-legacy, cafetería, amigos, fanarts, ranking, admin) contra una base en memoria.
 * No toca Firebase real. No evalúa reglas de seguridad (requiere el emulador oficial).
 * Uso: npm run dev (otra terminal) → npm run test:e2e */
const {chromium,firefox,webkit}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const MOCK=fs.readFileSync(__dirname+'/firebase-mock.js','utf8');
const T='speedy-friends-teams/speedy-friends';
const CREATOR={uid:'uid-creator',email:'t89886464@gmail.com',displayName:'Creadora'};
const ALICE={uid:'uid-alice',email:'alice@test.local',displayName:'Alice'};
const BOB={uid:'uid-bob',email:'bob@test.local',displayName:'Bob'};
const user=(id,u,extra={})=>({id,name:u.displayName,username:u.displayName.toLowerCase(),nickname:'',title:'Runner',ownerUid:u.uid,ownerEmail:u.email,rings:0,...extra});
const SEED={'speedy-friends-teams':{'speedy-friends':{
 users:{'user-creator':user('user-creator',CREATOR,{rings:500}),'user-alice':user('user-alice',ALICE,{rings:120}),'user-bob':user('user-bob',BOB,{rings:80})},
 rings:{'user-creator':500,'user-alice':120,'user-bob':80},
 cafeteria:{menu:{m1:{id:'m1',name:'Chili Latte',description:'Café de prueba',price:20,active:true}},workers:{'uid-bob':{active:true,role:'worker',uid:'uid-bob'}}},
 fanarts:{f1:{id:'f1',title:'Arte de prueba',description:'Fixture',ownerUid:'uid-bob',authorName:'Bob',category:'Digital',image:'assets/fanart-demo/neon-rush.svg',mediaType:'image',createdAt:1}},
 news:{n1:{id:'n1',title:'Noticia de prueba',summary:'Resumen de prueba',date:'2026-10-30',category:'INFO',published:true}}
}}};

const MOBILE=process.env.SF_E2E_VIEWPORT==='mobile';
async function newContext(browser,{viewport=MOBILE?{width:390,height:844}:{width:1280,height:850},session=null}={}){
 const context=await browser.newContext({viewport,reducedMotion:'reduce',...(MOBILE?{hasTouch:true}:{})});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===base)return route.continue();
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-app-compat'))return route.fulfill({contentType:'text/javascript',body:MOCK});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase'))return route.fulfill({contentType:'text/javascript',body:'/* mock */'});
  return route.abort();
 });
 await context.addInitScript(({seed,session})=>{
  if(!localStorage.getItem('__sfMockSeeded')){
   localStorage.setItem('__sfMockDb',JSON.stringify(seed));localStorage.setItem('__sfMockSeeded','1');
   if(session)localStorage.setItem('__sfMockAuth',JSON.stringify(session));
  }
 },{seed:SEED,session});
 return context;
}
const db=(page,path)=>page.evaluate(p=>window.__sfMock?.getAt(p),path);
const waitReady=page=>page.waitForFunction(()=>window.SpeedyFirebase?.current?.checked===true,null,{timeout:8000});

(async()=>{
 const which=(process.env.SF_E2E_BROWSERS||'chromium').split(',');
 const report=[];let failed=0;
 for(const name of which){
  const type={chromium,firefox,webkit}[name];
  const opts=name==='chromium'?(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'}):{};
  let browser;
  try{browser=await type.launch({headless:true,...opts});}catch(e){report.push({browser:name,test:'launch',status:'skipped',reason:e.message.split('\n')[0]});console.log(`SKIP [${name}] ${e.message.split('\n')[0]}`);continue;}
  const test=async(title,fn)=>{try{await fn();report.push({browser:name,test:title,status:'passed'});console.log(`PASS [${name}] ${title}`);}catch(e){failed++;report.push({browser:name,test:title,status:'failed',error:e.message});console.log(`FAIL [${name}] ${title}\n  ${e.message.split('\n').slice(0,4).join('\n  ')}`);}};

  await test('Login with Google, remembered session and logout',async()=>{
   const ctx=await newContext(browser);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/index.html');await waitReady(page);
   await page.waitForFunction(()=>/Debes iniciar/.test(document.getElementById('sf-auth-gate-note')?.textContent||''));
   await page.evaluate(u=>localStorage.setItem('__sfMockNextLogin',JSON.stringify(u)),ALICE);
   await page.locator('#sf-auth-login').click();
   await page.waitForFunction(()=>document.getElementById('sf-auth-gate').classList.contains('is-hidden'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('sfAuthHint')),'1');
   await page.reload();
   assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('sf-auth-hint')),'remembered session shows portal at once');
   await waitReady(page);assert.ok(await page.locator('#sf-auth-gate').isHidden());
   await page.goto(base+'/profile.html');await waitReady(page);
   const logout=page.locator('.profile-top .sf-logout');await logout.waitFor({state:'visible'});await logout.click();
   await page.waitForURL(/index\.html/);await waitReady(page);
   await page.waitForFunction(()=>!document.getElementById('sf-auth-gate').classList.contains('is-hidden'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('sfAuthHint')),null);
   assert.equal(await page.evaluate(()=>localStorage.getItem('__sfMockAuth')),null);
   assert.deepEqual(errors,[]);await ctx.close();
  });

  await test('Profile: edits are saved to the database and removing the icon persists',async()=>{
   const ctx=await newContext(browser,{session:ALICE});const page=await ctx.newPage();
   await page.addInitScript(()=>{const k='__sfMockDb';const d=JSON.parse(localStorage.getItem(k));const u=d['speedy-friends-teams']['speedy-friends'].users['user-alice'];if(!u.avatar){u.avatar='data:image/gif;base64,R0lGODlhAQABAAAAACw=';localStorage.setItem(k,JSON.stringify(d));}});
   await page.goto(base+'/profile.html');await waitReady(page);
   await page.locator('#profile-edit-name').fill('Alice Prueba');
   await page.locator('#profile-edit-nickname').fill('Ali');
   await page.locator('#avatar-remove').click();
   await page.locator('#save-profile').click();
   // El estado ya dice «CAMBIOS GUARDADOS» al cargar: se espera al dato real en la base.
   await page.waitForFunction(()=>window.__sfMock.getAt('speedy-friends-teams/speedy-friends/users/user-alice/name')==='Alice Prueba',null,{timeout:8000});
   const u=await db(page,T+'/users/user-alice');
   assert.equal(u.name,'Alice Prueba');assert.equal(u.nickname,'Ali');
   assert.equal(u.avatar||'','','icon removal persisted');assert.equal(u.ownerUid,ALICE.uid);
   assert.equal(Object.keys(await db(page,T+'/users')).length,3,'no duplicate profile created');
   await ctx.close();
  });

  await test('Cafeteria: order, one active ticket, worker serves it and Rings are charged once',async()=>{
   const ctx=await newContext(browser,{session:ALICE});const page=await ctx.newPage();const dialogs=[];
   page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
   await page.goto(base+'/cafeteria.html');await waitReady(page);
   const qty=page.locator('[data-qty="m1"]');await qty.waitFor();await qty.fill('2');
   await page.locator('[data-order="m1"]').click();
   await page.waitForFunction(()=>Object.keys(window.__sfMock.getAt('speedy-friends-teams/speedy-friends/cafeteria/orders')||{}).length===1);
   const order=Object.values(await db(page,T+'/cafeteria/orders'))[0];
   assert.equal(order.ownerUid,ALICE.uid);assert.equal(order.totalRings,40);assert.equal(order.status,'pendiente');assert.equal(typeof order.createdAt,'number');
   await page.waitForFunction(()=>/PENDIENTE/.test(document.getElementById('active-ticket')?.textContent||''));
   await page.locator('[data-order="m1"]').click();
   await page.waitForFunction(()=>/TICKET EN PROCESO/i.test(document.getElementById('toast')?.textContent||''));
   assert.equal(Object.keys(await db(page,T+'/cafeteria/orders')).length,1,'second active ticket rejected');
   // Trabajador (Bob) en otro contexto: prepara y sirve.
   const wctx=await newContext(browser,{session:BOB});const w=await wctx.newPage();w.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
   await w.addInitScript(db=>{localStorage.setItem('__sfMockDb',db);},JSON.stringify(await page.evaluate(()=>window.__sfMock.getTree())));
   await w.goto(base+'/cafe-worker.html');await waitReady(w);
   await w.locator(`[data-id="${order.id}"][data-s="preparando"]`).click();
   await w.waitForFunction(id=>window.__sfMock.getAt('speedy-friends-teams/speedy-friends/cafeteria/orders/'+id+'/status')==='preparando',order.id);
   await w.locator(`[data-id="${order.id}"][data-s="servido"]`).click();
   await w.waitForFunction(id=>!window.__sfMock.getAt('speedy-friends-teams/speedy-friends/cafeteria/orders/'+id),order.id);
   assert.equal(await db(w,T+'/rings/user-alice'),80,'charged 40 of 120');
   const hist=Object.values(await db(w,T+'/cafeteria/ticketHistory')||{});
   assert.equal(hist.length,1);assert.equal(hist[0].status,'servido');assert.equal(hist[0].chargeRings,40);
   assert.deepEqual(dialogs,[],'no error dialogs: '+dialogs.join(' | '));
   await wctx.close();await ctx.close();
  });

  await test('Cafeteria: order rejected up-front when Rings are insufficient',async()=>{
   const ctx=await newContext(browser,{session:ALICE});const page=await ctx.newPage();
   await page.addInitScript(()=>{const d=JSON.parse(localStorage.getItem('__sfMockDb'));d['speedy-friends-teams']['speedy-friends'].rings['user-alice']=10;localStorage.setItem('__sfMockDb',JSON.stringify(d));});
   await page.goto(base+'/cafeteria.html');await waitReady(page);
   await page.locator('[data-order="m1"]').click();
   await page.waitForFunction(()=>/Rings insuficientes/i.test(document.getElementById('toast')?.textContent||''));
   assert.equal(await db(page,T+'/cafeteria/orders'),null);
   await ctx.close();
  });

  await test('Friends: request, accept on the other account, both sides see the friendship',async()=>{
   const ctx=await newContext(browser,{session:ALICE});const page=await ctx.newPage();
   await page.goto(base+'/friends.html');await waitReady(page);
   await page.locator('.sf-f-tab[data-tab="explore"]').click();
   const add=page.locator('[data-panel="explore"] [data-friend-action="add"][data-uid="uid-bob"]').first();
   await add.waitFor({timeout:8000});await add.click();
   await page.waitForFunction(()=>!!window.__sfMock.getAt('speedy-friends-teams/speedy-friends/friendRequests/inbox/uid-bob/uid-alice'));
   const tree=JSON.stringify(await page.evaluate(()=>window.__sfMock.getTree()));
   const bctx=await newContext(browser,{session:BOB});const b=await bctx.newPage();
   await b.addInitScript(t=>localStorage.setItem('__sfMockDb',t),tree);
   await b.goto(base+'/friends.html');await waitReady(b);
   await b.locator('.sf-f-tab[data-tab="requests"]').click();
   const accept=b.locator('[data-panel="requests"] [data-friend-action="accept"][data-uid="uid-alice"]').first();await accept.waitFor({timeout:8000});await accept.click();
   await b.waitForFunction(()=>!!window.__sfMock.getAt('speedy-friends-teams/speedy-friends/friends/uid-bob/uid-alice'));
   assert.ok(await db(b,T+'/friends/uid-alice/uid-bob'),'friendship on both sides');
   assert.equal(await db(b,T+'/friendRequests/inbox/uid-bob/uid-alice'),null,'request consumed');
   await bctx.close();await ctx.close();
  });

  await test('Fanarts: real work listed, like toggles in the database, guest-free',async()=>{
   const ctx=await newContext(browser,{session:ALICE});const page=await ctx.newPage();
   await page.goto(base+'/fanarts.html');await waitReady(page);
   await page.waitForSelector('.fanart-card:not(.fanart-skeleton)');
   assert.match(await page.locator('#fanartGrid').textContent(),/Arte de prueba/);
   await page.locator('[data-like="f1"]').click();
   await page.waitForFunction(()=>!!window.__sfMock.getAt('speedy-friends-teams/speedy-friends/fanarts/f1/likes/uid-alice'));
   await page.waitForFunction(()=>document.querySelector('[data-like="f1"] b')?.textContent.trim()==='1');
   await ctx.close();
  });

  await test('Ranking: members ordered by real Rings',async()=>{
   const ctx=await newContext(browser,{session:ALICE});const page=await ctx.newPage();
   await page.goto(base+'/ranking.html');await waitReady(page);
   await page.waitForFunction(()=>document.querySelectorAll('#member-ranking-list .rank-row, #member-ranking-list [data-profile-id], #member-ranking-list article').length>0,null,{timeout:8000});
   const text=(await page.locator('#member-ranking-list').textContent()).toUpperCase();
   assert.ok(text.indexOf('ALICE')>-1&&text.indexOf('BOB')>-1,'members listed: '+text.slice(0,200));
   assert.ok(text.indexOf('ALICE')<text.indexOf('BOB'),'120 Rings before 80');
   await ctx.close();
  });

  await test('Admin: creator adds Rings with history; a member without role is sent back to Inicio',async()=>{
   const ctx=await newContext(browser,{session:CREATOR});const page=await ctx.newPage();
   await page.goto(base+'/admin.html');await waitReady(page);
   await page.locator('.admin-side-btn[data-panel="rings"]').click();
   await page.waitForFunction(()=>[...document.querySelectorAll('#ring-user option')].some(o=>o.value==='user-bob'),null,{timeout:8000});
   await page.locator('#ring-user').selectOption('user-bob');
   await page.locator('#ring-amount').fill('25');
   await page.locator('#ring-reason').fill('Prueba e2e');
   await page.locator('#rings-form button[type="submit"]').click();
   await page.waitForFunction(()=>window.__sfMock.getAt('speedy-friends-teams/speedy-friends/rings/user-bob')===105,null,{timeout:8000});
   const hist=Object.values(await db(page,T+'/ringHistory')||{});
   assert.ok(hist.some(h=>/Prueba e2e/.test(JSON.stringify(h))),'ring history records the reason');
   await page.waitForFunction(()=>/^\d/.test(document.querySelector('#overview .admin-stat strong')?.textContent||''),null,{timeout:8000});
   assert.equal(await page.locator('#overview .admin-stat strong').first().textContent(),'3','real member count');
   await ctx.close();
   const mctx=await newContext(browser,{session:ALICE});const m=await mctx.newPage();
   await m.goto(base+'/admin.html');await m.waitForURL(/index\.html/,{timeout:8000});
   await mctx.close();
  });

  await browser.close();
 }
 fs.mkdirSync('test-results',{recursive:true});
 fs.writeFileSync(MOBILE?'docs/e2e-verification-mobile.json':'docs/e2e-verification.json',JSON.stringify({date:new Date().toISOString(),viewport:MOBILE?'390x844 táctil (emulado)':'1280x850',note:'Firebase simulado en memoria (tests/firebase-mock.js). No evalúa reglas de seguridad.',report},null,2));
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

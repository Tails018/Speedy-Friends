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

async function newContext(browser,{viewport={width:1280,height:850},session=null}={}){
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});
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

  await browser.close();
 }
 fs.mkdirSync('test-results',{recursive:true});
 fs.writeFileSync('docs/e2e-verification.json',JSON.stringify({date:new Date().toISOString(),note:'Firebase simulado en memoria (tests/firebase-mock.js). No evalúa reglas de seguridad.',report},null,2));
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

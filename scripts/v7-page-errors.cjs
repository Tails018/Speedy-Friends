/* Recorre las páginas con Firebase simulado y una sesión ficticia, y lista errores de JavaScript con
 * su pila, promesas rechazadas sin capturar y errores de consola propios (no los recursos externos
 * bloqueados por la prueba). Uso: SF_BASE_URL=http://127.0.0.1:4174 node scripts/v7-page-errors.cjs */
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const MOCK=fs.readFileSync(path.join(__dirname,'..','tests','firebase-mock.js'),'utf8');
const {SEED,CREATOR}=require('../tests/fixtures/v7-seed.cjs');
const PAGES=(process.env.SF_PAGES||'index.html,profile.html,friends.html,ranking.html,fanarts.html,novedades.html,novedad.html?id=n1,novedades-admin.html,cafeteria.html,cafe-worker.html,cafe-creator.html,ost.html,admin.html,admin-role.html').split(',');
const SESSIONS={creator:CREATOR,worker:{uid:'uid-bob',email:'bob@test.local',displayName:'Bob'},member:{uid:'uid-gus',email:'gus@test.local',displayName:'Gus'}};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 let total=0;const report=[];
 for(const [who,session] of Object.entries(SESSIONS)){
  for(const page of PAGES){
   const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-app-compat'))return route.fulfill({contentType:'text/javascript',body:MOCK});if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase'))return route.fulfill({contentType:'text/javascript',body:''});return route.abort();});
   await ctx.addInitScript(({seed,session})=>{
    window.__sfMockLatency=60;
    if(!localStorage.getItem('__sfMockSeeded')){localStorage.setItem('__sfMockDb',JSON.stringify(seed));localStorage.setItem('__sfMockSeeded','1');localStorage.setItem('__sfMockAuth',JSON.stringify(session));}
    window.addEventListener('unhandledrejection',e=>console.error('unhandledrejection: '+(e.reason?.stack||e.reason)));
   },{seed:SEED,session});
   const p=await ctx.newPage();const errors=[];
   p.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message).split('\n').slice(0,3).join(' | ')));
   p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))errors.push('console: '+m.text().slice(0,260));});
   await p.goto(base+'/'+page,{waitUntil:'domcontentloaded'});
   await p.waitForTimeout(2200);
   const uniq=[...new Set(errors)];total+=uniq.length;
   report.push({who,page,errors:uniq});
   if(uniq.length)console.log(`[${who}] ${page}\n  `+uniq.join('\n  '));
   await ctx.close();
  }
 }
 console.log(`Total de errores propios: ${total}`);
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/page-errors.json',JSON.stringify(report,null,1));
 await browser.close();process.exitCode=total?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

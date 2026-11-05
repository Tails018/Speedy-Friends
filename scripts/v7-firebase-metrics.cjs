/* Métricas de carga de datos V7 con Firebase SIMULADO (tests/firebase-mock.js) y una latencia
 * artificial por consulta (__sfMockLatency, 80 ms por defecto). Sirve para comparar el código antes y
 * después de una optimización en condiciones reproducibles. NO mide Firebase real ni la red real:
 * los tiempos y tamaños son del simulador.
 * Uso: npm run dev (otra terminal) → SF_METRICS_LABEL=antes node scripts/v7-firebase-metrics.cjs */
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const label=process.env.SF_METRICS_LABEL||'actual';
const latency=Number(process.env.SF_MOCK_LATENCY||80);
const runs=Number(process.env.SF_METRICS_RUNS||3);
const MOCK=fs.readFileSync(path.join(__dirname,'..','tests','firebase-mock.js'),'utf8');
const {SEED,CREATOR}=require('../tests/fixtures/v7-seed.cjs');
const ALICE={uid:'uid-alice',email:'alice@test.local',displayName:'Alice'};

async function context(browser,session){
 const ctx=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
 await ctx.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===base)return route.continue();
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-app-compat'))return route.fulfill({contentType:'text/javascript',body:MOCK});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase'))return route.fulfill({contentType:'text/javascript',body:'/* mock */'});
  return route.abort();
 });
 await ctx.addInitScript(({seed,session,latency})=>{
  window.__sfMockLatency=latency;
  if(!localStorage.getItem('__sfMockSeeded')){localStorage.setItem('__sfMockDb',JSON.stringify(seed));localStorage.setItem('__sfMockSeeded','1');localStorage.setItem('__sfMockAuth',JSON.stringify(session));}
  // Marca el primer integrante visible y la lista completa de Ranking, y si la lista llega a vaciarse.
  const marks=window.__sfMarks={readyEvent:null,firstMember:null,fullList:null,emptiedAfterFull:0};
  document.addEventListener('speedy:firebase-ready',()=>{if(marks.readyEvent===null)marks.readyEvent=Math.round(performance.now());});
  const check=()=>{
   const n=document.querySelectorAll('[data-profile-id]').length;
   if(n>0&&marks.firstMember===null)marks.firstMember=Math.round(performance.now());
   if(n>=8&&marks.fullList===null)marks.fullList=Math.round(performance.now());
   if(marks.fullList!==null&&n===0)marks.emptiedAfterFull++;
  };
  new MutationObserver(check).observe(document,{subtree:true,childList:true});
 },{seed:SEED,session,latency});
 return ctx;
}
const summary=log=>{
 const listens=log.filter(x=>x[0]==='listen'),reads=log.filter(x=>x[0]==='read');
 const count=list=>Object.entries(list.reduce((a,x)=>(a[x[1]]=(a[x[1]]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
 return {listeners:listens.length,onceReads:reads.length,jsonChars:[...listens,...reads].reduce((a,x)=>a+(x[3]||0),0),
  duplicatedPaths:count([...listens,...reads]).filter(([,n])=>n>1).map(([p,n])=>`${p}×${n}`)};
};
async function measurePage(browser,page,session=CREATOR){
 const ctx=await context(browser,session);const p=await ctx.newPage();
 await p.goto(base+'/'+page,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.SpeedyFirebase?.current?.checked===true,null,{timeout:10000});
 const authMs=await p.evaluate(()=>Math.round(performance.now()));
 await p.waitForTimeout(latency*6+600);
 const r={page,authMs,...await p.evaluate(()=>window.__sfMarks),...summary(await p.evaluate(()=>window.__sfMockLog.map(x=>[...x])))};
 await ctx.close();return r;
}
async function measureNavigation(browser){
 const ctx=await context(browser,CREATOR);const p=await ctx.newPage();
 await p.goto(base+'/index.html');await p.waitForFunction(()=>window.SpeedyFirebase?.current?.checked===true,null,{timeout:10000});
 await p.waitForTimeout(latency*6+400);
 await p.goto(base+'/ranking.html',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__sfMarks.fullList!==null,null,{timeout:10000});
 const r={scenario:'index → ranking',...await p.evaluate(()=>window.__sfMarks)};
 // Latencia de actualización: un cambio de Rings reordena la lista sin vaciarla.
 const t=await p.evaluate(async()=>{
  const start=performance.now();
  firebase.database().ref('speedy-friends-teams/speedy-friends/rings/user-gus').set(999);
  return await new Promise(res=>{const tick=()=>{const rows=[...document.querySelectorAll('[data-profile-id]')].map(x=>x.dataset.profileId).filter(id=>id!=='user-creator');if(rows[0]==='user-gus')res(Math.round(performance.now()-start));else requestAnimationFrame(tick);};tick();setTimeout(()=>res(null),5000);});
 });
 r.updateToReorderMs=t;r.emptiedAfterFull=await p.evaluate(()=>window.__sfMarks.emptiedAfterFull);
 r.afterNavigation=summary(await p.evaluate(()=>window.__sfMockLog.map(x=>[...x])));
 await ctx.close();return r;
}
const median=a=>{const v=a.filter(x=>typeof x==='number').sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:null;};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 const pages=['ranking.html','index.html','friends.html','profile.html','admin.html','cafeteria.html','fanarts.html'];
 const result={label,date:new Date().toISOString(),note:'Firebase simulado con latencia artificial; no son mediciones de producción.',mockLatencyMs:latency,runs,pages:{},navigation:null};
 for(const page of pages){
  const all=[];for(let i=0;i<runs;i++)all.push(await measurePage(browser,page));
  result.pages[page]={authMs:median(all.map(x=>x.authMs)),readyEventMs:median(all.map(x=>x.readyEvent)),firstMemberMs:median(all.map(x=>x.firstMember)),fullListMs:median(all.map(x=>x.fullList)),listeners:all[0].listeners,onceReads:all[0].onceReads,jsonChars:all[0].jsonChars,duplicatedPaths:all[0].duplicatedPaths};
  console.log(page.padEnd(16),JSON.stringify(result.pages[page]));
 }
 const nav=[];for(let i=0;i<runs;i++)nav.push(await measureNavigation(browser));
 result.navigation={firstMemberMs:median(nav.map(x=>x.firstMember)),fullListMs:median(nav.map(x=>x.fullList)),updateToReorderMs:median(nav.map(x=>x.updateToReorderMs)),emptiedAfterFull:Math.max(...nav.map(x=>x.emptiedAfterFull)),afterNavigation:nav[0].afterNavigation};
 console.log('index → ranking ',JSON.stringify(result.navigation));
 fs.mkdirSync(path.join(__dirname,'..','docs','metrics'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'..','docs','metrics',`firebase-v7-${label}.json`),JSON.stringify(result,null,1));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

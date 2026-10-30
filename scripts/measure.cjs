// Mide peso transferido, peticiones y métricas de carga por página (offline: bloquea orígenes externos).
// Uso: npm run dev  (otra terminal)  →  node scripts/measure.cjs [salida.json]
const {chromium}=require('playwright-core');
const {writeFileSync}=require('node:fs');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const pages=['index.html','cafeteria.html','friends.html','fanarts.html','ranking.html','profile.html','ost.html','novedades.html','admin.html'];
const viewports={mobile:{width:390,height:844},desktop:{width:1440,height:900}};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 const out={browser:browser.version(),date:new Date().toISOString(),results:{}};
 for(const [vpName,viewport] of Object.entries(viewports)){
  for(const path of pages){
   const context=await browser.newContext({viewport});
   await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   const page=await context.newPage();
   const sizes={};let requests=0;const seen=new Map();
   page.on('response',async res=>{requests++;const u=res.url();seen.set(u,(seen.get(u)||0)+1);try{const b=await res.body();const ext=(new URL(u).pathname.split('.').pop()||'other').toLowerCase();sizes[ext]=(sizes[ext]||0)+b.length;}catch{}});
   await page.addInitScript(()=>{window.__sf={lcp:0,cls:0,long:0};
    new PerformanceObserver(l=>{for(const e of l.getEntries())window.__sf.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__sf.cls+=e.value}).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries())window.__sf.long+=Math.max(0,e.duration-50)}).observe({type:'longtask',buffered:true});});
   await page.goto(base+'/'+path,{waitUntil:'load'});
   await page.waitForTimeout(2500);
   const m=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return{dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),lcp:Math.round(window.__sf.lcp),cls:+window.__sf.cls.toFixed(3),tbt:Math.round(window.__sf.long),domNodes:document.getElementsByTagName('*').length}});
   const total=Object.values(sizes).reduce((a,b)=>a+b,0);
   out.results[vpName+':'+path]={...m,requests,kb:Math.round(total/1024),byType:Object.fromEntries(Object.entries(sizes).map(([k,v])=>[k,Math.round(v/1024)])),duplicates:[...seen].filter(([,c])=>c>1).map(([u])=>u.replace(base,''))};
   await context.close();
  }
 }
 await browser.close();
 const file=process.argv[2];
 if(file)writeFileSync(file,JSON.stringify(out,null,2));
 console.table(Object.fromEntries(Object.entries(out.results).map(([k,v])=>[k,{kb:v.kb,req:v.requests,dcl:v.dcl,lcp:v.lcp,cls:v.cls,tbt:v.tbt,nodes:v.domNodes,dup:v.duplicates.length}])));
})();

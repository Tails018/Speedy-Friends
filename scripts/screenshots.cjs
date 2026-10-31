// Capturas de todas las páginas activas (sin conexión: servicios externos bloqueados).
// Uso: node scripts/screenshots.cjs <carpeta> ; requiere npm run dev.
const {chromium}=require('playwright-core');const fs=require('node:fs');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';const out=process.argv[2]||'test-results/shots';
const pages=(process.env.SF_PAGES||'index.html,profile.html,ranking.html,friends.html,fanarts.html,cafeteria.html,cafe-worker.html,cafe-creator.html,ost.html,novedades.html,novedad.html,admin.html,admin-role.html,novedades-admin.html').split(',');
(async()=>{fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 for(const [name,viewport] of [['desktop',{width:1366,height:850}],['mobile',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,reducedMotion:'reduce'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  for(const p of pages){const pg=await ctx.newPage();await pg.goto(base+'/'+p);await pg.waitForTimeout(900);
   await pg.addStyleTag({content:'#sf-auth-gate{display:none!important}body{overflow:auto!important}'});await pg.waitForTimeout(150);
   await pg.screenshot({path:`${out}/${name}-${p.replace('.html','')}.png`,fullPage:false});await pg.close();}
  await ctx.close();}
 await browser.close();console.log('ok '+out);})();

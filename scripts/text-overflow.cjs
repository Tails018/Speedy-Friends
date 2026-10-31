// Cuenta textos recortados (contenido más ancho que su caja con overflow oculto) y scroll horizontal por página.
const {chromium}=require('playwright-core');const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const pages='index.html,profile.html,ranking.html,friends.html,fanarts.html,cafeteria.html,cafe-worker.html,cafe-creator.html,ost.html,novedades.html,novedad.html,admin.html,admin-role.html,novedades-admin.html'.split(',');
(async()=>{const b=await chromium.launch({channel:process.env.SF_BROWSER_EXECUTABLE?undefined:'msedge',executablePath:process.env.SF_BROWSER_EXECUTABLE});const out={};
for(const [vp,size] of [['m',{width:390,height:844}],['d',{width:1366,height:850}]]){const c=await b.newContext({viewport:size,reducedMotion:'reduce'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 for(const p of pages){const pg=await c.newPage();await pg.goto(base+'/'+p);await pg.waitForTimeout(700);
  out[vp+':'+p]=await pg.evaluate(()=>{const bad=[];for(const el of document.querySelectorAll('body *')){const cs=getComputedStyle(el);if(cs.display==='none'||!el.textContent.trim()||el.children.length>3)continue;
   if((cs.overflowX==='hidden'||cs.overflowX==='clip'||cs.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+2&&el.clientWidth>0)bad.push((el.className||el.tagName).toString().slice(0,30));}
   return {clipped:bad.length,hscroll:document.documentElement.scrollWidth-innerWidth,sample:bad.slice(0,4)}});await pg.close();}
 await c.close();}
await b.close();console.log(JSON.stringify(out));})();

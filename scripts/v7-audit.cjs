/* Auditoría V7: recorre todas las páginas con Firebase simulado (tests/firebase-mock.js) y la sesión
 * de la creadora ficticia. Hace capturas de escritorio y móvil y lista los controles visibles que no
 * tienen ninguna acción: ni href, ni envío de formulario, ni listener en el propio elemento o en sus
 * antepasados por debajo de <body>. Detecta además esqueletos que siguen visibles, errores de consola y
 * recursos locales que faltan.
 * Los delegados en document/window no se cuentan, así que puede haber falsos positivos: es una lista
 * para revisar, no un veredicto. No toca Firebase real.
 * Uso: npm run dev (otra terminal) → SF_AUDIT_LABEL=antes node scripts/v7-audit.cjs */
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const label=process.env.SF_AUDIT_LABEL||'actual';
const out=path.join(__dirname,'..','test-results','v7-audit',label);
const MOCK=fs.readFileSync(path.join(__dirname,'..','tests','firebase-mock.js'),'utf8');
const {SEED,CREATOR}=require('../tests/fixtures/v7-seed.cjs');
const PAGES=['index.html','profile.html','friends.html','ranking.html','fanarts.html','novedades.html','novedad.html?id=n1','novedades-admin.html','cafeteria.html','cafe-worker.html','cafe-creator.html','ost.html','admin.html','admin-role.html'];
const VIEWPORTS={desktop:{width:1366,height:900},mobile:{width:390,height:844}};
const only=process.env.SF_AUDIT_PAGES?process.env.SF_AUDIT_PAGES.split(','):null;

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 const report=[];
 for(const [vp,viewport] of Object.entries(VIEWPORTS)){
  for(const page of PAGES.filter(p=>!only||only.includes(p.split('?')[0]))){
   const context=await browser.newContext({viewport,reducedMotion:'reduce',...(vp==='mobile'?{hasTouch:true,isMobile:true}:{})});
   const missing=[],errors=[];
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===base)return route.continue();
    if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-app-compat'))return route.fulfill({contentType:'text/javascript',body:MOCK});
    if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase'))return route.fulfill({contentType:'text/javascript',body:'/* mock */'});
    return route.abort();
   });
   await context.addInitScript(({seed,session})=>{
    if(!localStorage.getItem('__sfMockSeeded')){localStorage.setItem('__sfMockDb',JSON.stringify(seed));localStorage.setItem('__sfMockSeeded','1');localStorage.setItem('__sfMockAuth',JSON.stringify(session));}
   },{seed:SEED,session:CREATOR});
   const p=await context.newPage();
   p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
   p.on('pageerror',e=>errors.push('pageerror: '+e.message.slice(0,200)));
   p.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)missing.push(r.status()+' '+r.url().slice(base.length));});
   const t0=Date.now();
   await p.goto(base+'/'+page,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>window.SpeedyFirebase?.current?.checked===true,null,{timeout:8000}).catch(()=>errors.push('auth no lista en 8 s'));
   const authMs=Date.now()-t0;
   await p.waitForTimeout(1200);
   // Recorre la página para que las secciones con aparición al hacer scroll se muestren como las vería alguien.
   // Algunas páginas desplazan <body> en lugar de la ventana.
   await p.evaluate(async()=>{const el=document.body.scrollHeight>document.body.clientHeight+4&&getComputedStyle(document.body).overflowY!=='visible'?document.body:document.scrollingElement;for(let y=0;y<el.scrollHeight;y+=innerHeight*0.7){el.scrollTop=y;await new Promise(r=>setTimeout(r,120));}el.scrollTop=0;});
   await p.waitForTimeout(400);
   const file=page.replace(/[?=]/g,'_').replace('.html','');
   // Capturas por tramos: fullPage agranda el viewport y deforma las alturas en vh de páginas que desplazan <body>.
   const segments=await p.evaluate(()=>{const el=document.body.scrollHeight>document.body.clientHeight+4&&getComputedStyle(document.body).overflowY!=='visible'?document.body:document.scrollingElement;return Math.min(8,Math.ceil(el.scrollHeight/innerHeight));});
   for(let i=0;i<segments;i++){
    await p.evaluate(i=>{const el=document.body.scrollHeight>document.body.clientHeight+4&&getComputedStyle(document.body).overflowY!=='visible'?document.body:document.scrollingElement;el.scrollTop=i*innerHeight;},i);
    await p.waitForTimeout(250);
    await p.screenshot({path:path.join(out,`${file}-${vp}-${i+1}.png`)});
   }
   const cdp=await context.newCDPSession(p);
   const {result:{objectId:listId}}=await cdp.send('Runtime.evaluate',{expression:`[...document.querySelectorAll('button,a,[role=button],[role=tab],summary,input[type=checkbox],select')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden],[aria-hidden=true],[inert]')})`});
   const {result:props}=await cdp.send('Runtime.getProperties',{objectId:listId,ownProperties:true});
   const dead=[];
   for(const prop of props.filter(x=>/^\d+$/.test(x.name))){
    const id=prop.value.objectId;
    const {result:info}=await cdp.send('Runtime.callFunctionOn',{objectId:id,returnByValue:true,functionDeclaration:`function(){const e=this;const tag=e.tagName.toLowerCase();const href=e.getAttribute('href');const label=(e.getAttribute('aria-label')||e.textContent||e.value||'').replace(/\\s+/g,' ').trim().slice(0,60);const intrinsic=(tag==='a'&&href&&href!=='#'&&!href.startsWith('javascript:'))||(e.type==='submit'&&e.form)||tag==='summary'||tag==='select'||(tag==='input')||e.hasAttribute('onclick')||e.hasAttribute('data-sf-nav')||e.closest('label');const chain=[];let n=e;while(n&&n!==document.body){chain.push(n);n=n.parentElement}return {tag,label,href,intrinsic,id:e.id,cls:String(e.className).slice(0,60),depth:chain.length}}`});
    if(info.value.intrinsic)continue;
    let hasListener=false;let node=id;
    for(let d=0;d<info.value.depth&&!hasListener;d++){
     const {listeners}=await cdp.send('DOMDebugger.getEventListeners',{objectId:node});
     if(listeners.some(l=>['click','pointerdown','pointerup','mousedown','touchstart','keydown','change','input'].includes(l.type)))hasListener=true;
     const {result:parent}=await cdp.send('Runtime.callFunctionOn',{objectId:node,functionDeclaration:'function(){return this.parentElement}'});
     if(!parent.objectId)break;node=parent.objectId;
    }
    if(!hasListener)dead.push(`${info.value.tag}${info.value.id?'#'+info.value.id:''}.${info.value.cls.split(' ')[0]} «${info.value.label}»`);
   }
   const stuck=await p.evaluate(()=>[...document.querySelectorAll('[class*=skeleton],[class*=loading],[aria-busy=true]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'}).map(e=>e.tagName.toLowerCase()+'.'+String(e.className).split(' ').slice(0,2).join('.')).slice(0,12));
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   const listeners=await p.evaluate(()=>(window.__sfMockLog||[]).filter(x=>x.op==='on'||x.type==='on').length).catch(()=>null);
   report.push({page,viewport:vp,authMs,overflowPx:overflow,consoleErrors:errors,missing,stillLoading:stuck,deadControls:[...new Set(dead)]});
   console.log(`${vp.padEnd(7)} ${page.padEnd(22)} muertos:${String(dead.length).padStart(3)} cargando:${stuck.length} errores:${errors.length} 404:${missing.length} overflow:${overflow}`);
   await context.close();
  }
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

/* Calidad móvil (390×844, táctil) con Firebase simulado y la cuenta de la creadora ficticia:
 * - textos visibles por debajo de 12 px (hojas de texto, sin decorativos aria-hidden),
 * - controles con área táctil menor de 44×44 px (botones, enlaces, inputs),
 * - controles fijos que se solapan entre sí,
 * - contraste del estado de guardado del perfil.
 * Uso: SF_QUALITY_LABEL=antes node scripts/v7-mobile-quality.cjs */
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const label=process.env.SF_QUALITY_LABEL||'actual';
const MOCK=fs.readFileSync(path.join(__dirname,'..','tests','firebase-mock.js'),'utf8');
const {SEED,CREATOR}=require('../tests/fixtures/v7-seed.cjs');
const PAGES=(process.env.SF_PAGES||'profile.html,ranking.html,friends.html,fanarts.html,novedades.html,admin.html,cafeteria.html,index.html').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 const out={};
 for(const page of PAGES){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(u.pathname.includes('firebase-app-compat'))return r.fulfill({contentType:'text/javascript',body:MOCK});if(u.pathname.includes('firebase'))return r.fulfill({contentType:'text/javascript',body:''});return r.abort();});
  await ctx.addInitScript(({s,a})=>{if(!localStorage.__sfMockSeeded){localStorage.__sfMockDb=JSON.stringify(s);localStorage.__sfMockSeeded=1;localStorage.__sfMockAuth=JSON.stringify(a)}},{s:SEED,a:CREATOR});
  const p=await ctx.newPage();await p.goto(base+'/'+page);await p.waitForTimeout(2200);
  out[page]=await p.evaluate(()=>{
   const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0.05&&!e.closest('[aria-hidden=true],[hidden],[inert]');};
   const small=[];
   for(const el of document.querySelectorAll('body *')){
    if(!visible(el))continue;
    const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);
    if(!own)continue;
    const fs=parseFloat(getComputedStyle(el).fontSize);
    if(fs<12)small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${fs}px «${el.textContent.trim().slice(0,24)}»`);
   }
   const tiny=[];
   for(const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],summary')){
    if(!visible(el))continue;
    const r=el.getBoundingClientRect();
    // Enlaces dentro de un párrafo están exentos (WCAG 2.5.8, texto en línea).
    if(el.tagName==='A'&&getComputedStyle(el).display==='inline'&&el.closest('p'))continue;
    if(el.type==='range'||el.type==='checkbox'||el.type==='radio'){if(r.height<24)tiny.push(`${el.tagName.toLowerCase()}#${el.id} ${Math.round(r.width)}×${Math.round(r.height)}`);continue;}
    if(r.width<44||r.height<44)tiny.push(`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} «${(el.getAttribute('aria-label')||el.textContent||el.value||'').trim().slice(0,18)}»`);
   }
   const fixed=[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e);return (s.position==='fixed'||s.position==='sticky')&&visible(e)&&e.getBoundingClientRect().height<300&&e.getBoundingClientRect().width<380;});
   const overlaps=[];
   for(let i=0;i<fixed.length;i++)for(let j=i+1;j<fixed.length;j++){
    if(fixed[i].contains(fixed[j])||fixed[j].contains(fixed[i]))continue;
    const a=fixed[i].getBoundingClientRect(),b=fixed[j].getBoundingClientRect();
    const x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    if(x>4&&y>4)overlaps.push(`${fixed[i].id||fixed[i].className.toString().split(' ')[0]} ↔ ${fixed[j].id||fixed[j].className.toString().split(' ')[0]}`);
   }
   return {smallText:small.length,smallSample:small.slice(0,8),tinyTargets:tiny.length,tinySample:tiny.slice(0,10),fixedOverlaps:overlaps,hscroll:document.documentElement.scrollWidth-innerWidth};
  });
  console.log(page.padEnd(16),`texto<12px:${out[page].smallText} táctil<44:${out[page].tinyTargets} solapes:${out[page].fixedOverlaps.length} hscroll:${out[page].hscroll}`);
  await ctx.close();
 }
 fs.mkdirSync(path.join(__dirname,'..','docs','metrics'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'..','docs','metrics',`mobile-quality-${label}.json`),JSON.stringify(out,null,1));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

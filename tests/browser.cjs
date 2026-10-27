const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {writeFileSync,mkdirSync}=require('node:fs');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const baseline=process.argv.includes('--baseline');
let activeBrowser;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 activeBrowser=browser;
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push({url:page.url(),message:e.message,stack:e.stack?.split('\n').slice(0,3)}));
 await page.goto(base+'/index.html');
 await page.waitForTimeout(800);
 const home=await page.evaluate(()=>({loaderHidden:document.getElementById('sf-page-loader')?.classList.contains('is-hidden'),quickCards:document.querySelectorAll('.quick-action-card').length,nestedButtons:document.querySelectorAll('button button').length,gateVisible:!document.getElementById('sf-auth-gate')?.classList.contains('is-hidden'),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,headInBody:document.body.contains(document.querySelector('head'))}));
 mkdirSync('test-results',{recursive:true});
 if(baseline){writeFileSync('docs/browser-baseline.json',JSON.stringify({browser:browser.version(),home,errors},null,2));console.log({home,errors});await browser.close();return;}
 const report=[];const test=async(name,fn)=>{await fn();report.push({name,status:'passed'});console.log('PASS '+name);};
 const dismissGate=()=>page.evaluate(()=>{document.getElementById('sf-auth-gate')?.classList.add('is-hidden');document.body.classList.remove('sf-auth-gate-open');});
 await test('Loader, repaired document and required authentication',async()=>{
  assert.equal(home.nestedButtons,0);assert.ok(home.loaderHidden);assert.ok(home.gateVisible);
  await page.locator('#sf-auth-login').click();assert.match(await page.locator('#sf-auth-gate-note').innerText(),/cargando|espera|conexi|Firebase|cargar|recarga/i);
  assert.ok(await page.locator('#sf-auth-gate').isVisible());
 });
 await test('Corrupt local storage cannot interrupt startup',async()=>{
  await page.evaluate(()=>localStorage.setItem('sfQuickState','{invalid-json'));await page.reload();
  await page.waitForFunction(()=>document.body.classList.contains('page-ready'));assert.ok(await page.locator('#sf-auth-gate').isVisible());
 });
 await dismissGate();
 await test('Mobile menu, focus return and keyboard carousel',async()=>{
  await page.locator('#menuBtn').click();assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'closeMenu');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'menuBtn');
  assert.ok(await page.locator('#mobileNav').evaluate(el=>el.inert));
  const before=await page.locator('.sf-hero-swiper').evaluate(el=>el.swiper.realIndex);
  await page.getByRole('button',{name:'Portada siguiente',exact:true}).click();
  assert.notEqual(await page.locator('.sf-hero-swiper').evaluate(el=>el.swiper.realIndex),before);
 });
 await test('Quick controls: cart saves/removes without modifying Rings or unrelated data',async()=>{
  await page.evaluate(()=>localStorage.setItem('speedy-friends-steam-ui-v1',JSON.stringify({cart:[],coins:125,users:[{id:'preserved'}],inventory:['keep']})));
  await page.locator('.sf-utility-toggle').click();await page.locator('[data-action="cart"]').click();
  await page.getByRole('button',{name:'Explorar catálogo',exact:true}).click();
  await page.locator('[data-cart-add]').first().click();assert.equal(await page.locator('.sf-cart-item').count(),1);
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('speedy-friends-steam-ui-v1')));
  assert.equal(saved.cart.length,1);assert.equal(saved.coins,125);assert.equal(saved.users[0].id,'preserved');assert.deepEqual(saved.inventory,['keep']);
  await page.locator('[data-cart-remove]').click();assert.equal(await page.locator('.sf-cart-item').count(),0);
  assert.equal(await page.locator('#quick-cart-count').innerText(),'0');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.sf-tools-dialog').open);
 });
 await test('Rings display reads a subscribed fixture and never writes a balance',async()=>{
  await page.evaluate(()=>{window.__ringOff=0;window.SpeedyFirebase={current:{uid:'fixture',profileId:'fixture-profile',rings:99},refs:{rings:{child:()=>({on:(event,fn)=>fn({exists:()=>true,val:()=>137}),off:()=>window.__ringOff++})}}};});
  if(!(await page.locator('.hero-utility-rail').evaluate(el=>el.classList.contains('is-open'))))await page.locator('.sf-utility-toggle').click();
  try{await page.locator('[data-action="rings"]').click({timeout:4000});}catch(e){console.log(await page.locator('[data-action="rings"]').evaluate(el=>[el,el.parentElement,el.closest('.hero-utility-rail')].map(x=>({class:x.className,rect:x.getBoundingClientRect().toJSON(),scrollTop:x.scrollTop,scrollHeight:x.scrollHeight,transform:getComputedStyle(x).transform,overflow:getComputedStyle(x).overflow,display:getComputedStyle(x).display}))));await page.screenshot({path:'test-results/drawer-failure.png'});throw e;}
  assert.ok((await page.locator('.sf-ring-total').innerText()).includes('137'));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__ringOff>0);
  await page.keyboard.press('Escape');
 });
 await test('Theme persists and restores after reload',async()=>{
  await page.locator('.sf-utility-toggle').click();await page.locator('[data-action="theme"]').click();
  const theme=await page.locator('html').getAttribute('data-sf-theme');await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-sf-theme'),theme);await dismissGate();
 });
 await test('Fanart filters, search, empty state and modal close button',async()=>{
  await page.goto(base+'/fanarts.html');await page.waitForSelector('.fanart-card');
  await page.locator('.fanart-open').first().click();assert.equal(await page.locator('#fanartModal').getAttribute('aria-hidden'),'false');
  await page.getByRole('button',{name:'Cerrar fanart'}).click();assert.equal(await page.locator('#fanartModal').getAttribute('aria-hidden'),'true');
  assert.ok(await page.locator('.fanart-open').first().evaluate(el=>el===document.activeElement));
  await page.locator('#fanartSearch').fill('zzzz-no-results');await page.waitForSelector('.fanart-empty');
  await page.locator('#fanartSearch').fill('');await page.waitForSelector('.fanart-card');
  await page.locator('.fanart-filter').nth(1).click();assert.equal(await page.locator('.fanart-filter').nth(1).getAttribute('aria-pressed'),'true');
 });
 await test('Large fanart fixture paginates and filters reset the visible limit',async()=>{
  const fixture=await context.newPage();
  await fixture.route('**/friends-system.js',route=>route.fulfill({contentType:'text/javascript',body:'/* Gallery-only fixture: friends are tested on their normal route. */'}));
  await fixture.addInitScript(()=>{
   const arts=Object.fromEntries(Array.from({length:25},(_,i)=>['fixture-'+i,{id:'fixture-'+i,title:'Arte '+i,description:'Fixture local',category:i%2?'Digital':'Dibujos',image:'assets/fanart-demo/neon-rush.svg',authorName:'Prueba',mediaType:'image'}]));
   window.SpeedyFirebase={current:{ready:true,uid:'fixture'},refs:{root:{child:()=>({on:(event,fn)=>fn({val:()=>arts}),off(){}})}}};
  });
  await fixture.goto(base+'/fanarts.html',{waitUntil:'domcontentloaded'});await fixture.waitForFunction(()=>document.querySelectorAll('.fanart-card').length===12);
  await fixture.locator('#fanartLoadMore').click();assert.equal(await fixture.locator('.fanart-card').count(),24);
  await fixture.locator('#fanartLoadMore').click();assert.equal(await fixture.locator('.fanart-card').count(),25);assert.ok(await fixture.locator('#fanartLoadMore').isHidden());
  await fixture.locator('[data-filter="Dibujos"]').click();assert.equal(await fixture.locator('.fanart-card').count(),12);
  await fixture.close();
 });
 await test('All existing routes, loader recovery and responsive layouts',async()=>{
  const layoutIssues=[];
  const routes=['index.html','profile.html','ost.html','ranking.html','fanarts.html','friends.html','cafeteria.html','cafe-worker.html','cafe-creator.html','admin.html','admin-role.html','novedades.html','novedad.html','novedades-admin.html'];
  for(const route of routes){
   const response=await page.goto(base+'/'+route);assert.equal(response.status(),200,route);
   await page.waitForTimeout(600);
   const loader=page.locator('#sf-page-loader');if(await loader.count())assert.ok(await loader.evaluate(el=>el.classList.contains('is-hidden')),route+' loader');
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const issue=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth?[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width})):null);if(issue)layoutIssues.push({route,width,issue});}
  }
  assert.deepEqual(layoutIssues,[]);
 });
 await test('Decoded local images, screenshot and reduced-motion carousel',async()=>{
  await page.goto(base+'/index.html');await dismissGate();await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));});
  assert.deepEqual(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.getAttribute('src')&&i.naturalWidth===0).map(i=>i.src)),[]);
  assert.equal(await page.locator('.sf-hero-swiper').evaluate(el=>el.swiper.autoplay.running),false);
  assert.ok(await page.locator('.reveal').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).opacity==='1')));
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  await page.screenshot({path:'test-results/home-mobile-viewport.png'});
 });
 await test('Carousel responds to motion preference and user pause controls',async()=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('.sf-hero-swiper').swiper.autoplay.running);
  await page.locator('.sf-slide-pause').click();assert.equal(await page.locator('.sf-slide-pause').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.sf-hero-swiper').evaluate(el=>el.swiper.autoplay.running),false);
  await page.emulateMedia({reducedMotion:'reduce'});
 });
 await test('No uncaught JavaScript errors across the audited routes',async()=>assert.deepEqual(errors,[]));
 writeFileSync('docs/browser-verification.json',JSON.stringify({browser:browser.version(),report,errors,limitations:['External services blocked. Firebase login, live writes, uploads and real administrative permissions not exercised.','Rings use a read-only fixture. Home screenshots dismiss only the local presentation gate.','Chromium responsive emulation; not physical Android/iOS or cross-browser certification.']},null,2));
 await browser.close();
})().catch(async e=>{console.error(e);await activeBrowser?.close();process.exitCode=1;});

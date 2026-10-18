/* Run with npm install && npx playwright install chromium, or an installed Edge. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdirSync,writeFileSync}=require('node:fs');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4173';
const output=process.env.SF_TEST_OUTPUT||'test-results';
mkdirSync(output,{recursive:true});
const report=[];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_CHANNEL?{channel:process.env.SF_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 // UI tests stay offline: never authenticate, upload, write to Firebase, or send group messages.
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const test=async(name,fn)=>{await fn();report.push({name,status:'passed'});console.log('PASS '+name);};
 await test('Rules page: search, accent normalization, category filters and empty state',async()=>{
  await page.goto(base+'/comunidad.html');
  assert.equal(await page.locator('.community-card:visible').count(),15);
  await page.getByRole('button',{name:'Creatividad',exact:true}).click();
  assert.equal(await page.locator('.community-card:visible').count(),2);
  await page.getByRole('button',{name:'Todos',exact:true}).click();
  await page.getByRole('searchbox').fill('musica');
  assert.equal(await page.locator('.community-card:visible').count(),1);
  assert.equal(await page.locator('.community-card:visible h3').innerText(),'Música y audios');
  await page.getByRole('searchbox').fill('zzzzzz');assert.equal(await page.locator('.community-card:visible').count(),0);
  assert.ok(await page.locator('#group-empty').isVisible());await page.getByRole('searchbox').fill('');
  await page.locator('#lobby summary').click();assert.ok(await page.locator('#lobby details').getAttribute('open')!==null);
  assert.ok((await page.locator('#lobby li').allTextContents()).some(x=>x.includes('registro oficial')));
 });
 await test('Rules page: no missing images or horizontal overflow at 360/390/768/1440 px',async()=>{
  for(const width of [360,390,768,1440]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
   assert.deepEqual(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)),[]);
  }
  await page.screenshot({path:output+'/community-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/community-mobile.png',fullPage:true});
 });
 await test('Home: malformed local storage does not break startup; auth stays required',async()=>{
  await context.addInitScript(()=>localStorage.setItem('sfQuickState','{invalid-json'));
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>document.querySelector('.sf-page-loader')?.classList.contains('is-hidden'));
  assert.ok(await page.locator('#sf-auth-gate').isVisible());
  assert.ok(await page.getByRole('link',{name:'Conocer la comunidad y sus reglas'}).isVisible());
  await page.getByRole('link',{name:'Conocer la comunidad y sus reglas'}).click();
  await page.waitForURL('**/comunidad.html');
 });
 await test('Home presentation: mobile menu focus, Escape, carousel and internal/external CTAs',async()=>{
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>document.body.classList.contains('page-ready'));
  // Presentation fixture only: dismiss the local login overlay to inspect the protected layout.
  // This does not authenticate or test database permissions.
  await page.evaluate(()=>{document.getElementById('sf-auth-gate').classList.add('is-hidden');document.body.classList.remove('sf-auth-gate-open');});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
  assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'closeMenu');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'menuBtn');
  assert.ok(await page.locator('#mobileNav').evaluate(el=>el.inert));
  assert.equal(await page.locator('.sf-slide-pause').innerText(),'Reproducir');
  const before=await page.locator('.sf-hero-swiper').evaluate(el=>el.swiper.realIndex);
  await page.getByRole('button',{name:'Portada siguiente',exact:true}).click();
  const after=await page.locator('.sf-hero-swiper').evaluate(el=>el.swiper.realIndex);assert.notEqual(before,after);
  await page.locator('.sf-hero .sf-btn.primary').click();await page.waitForURL('**/novedades.html');
 });
 await test('Home layout: no overflow and all original sections exist at all target widths',async()=>{
  await page.goto(base+'/index.html');
  await page.evaluate(()=>{document.getElementById('sf-auth-gate').classList.add('is-hidden');document.body.classList.remove('sf-auth-gate-open');});
  for(const width of [360,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Home overflow at ${width}`);
   for(const id of ['topics','friends','special','downloads','fanarts','ultimos-momentos'])assert.equal(await page.locator('#'+id).count(),1);
  }
  await page.screenshot({path:output+'/home-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/home-mobile.png',fullPage:true});
  await page.locator('.sf-utility-toggle').click();assert.ok(await page.locator('.hero-utility-rail').evaluate(el=>el.classList.contains('is-open')));
  await page.keyboard.press('Escape');assert.ok(!(await page.locator('.hero-utility-rail').evaluate(el=>el.classList.contains('is-open'))));
 });
 await test('Existing member pages: routes and mobile layout smoke check',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const route of ['friends.html','ranking.html','ost.html','cafeteria.html','fanarts.html','novedades.html','profile.html']){
   const response=await page.goto(base+'/'+route,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,route);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflows on mobile');
  }
 });
 await test('No uncaught browser JavaScript errors',async()=>assert.deepEqual(errors,[]));
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const fallback=await noJs.newPage();await test('Rules work without JavaScript',async()=>{
  await fallback.goto(base+'/comunidad.html');assert.equal(await fallback.locator('.community-card').count(),15);
  await fallback.locator('#cafeteria summary').click();assert.ok(await fallback.locator('#cafeteria details').getAttribute('open')!==null);
  assert.ok(!(await fallback.locator('.community-tools').isVisible()));
 });
 await browser.close();writeFileSync(output+'/browser-report.json',JSON.stringify({report,errors,limitations:['Authentication and live Firebase writes were not exercised. Home screenshots use a presentation fixture that hides the login overlay.','Responsive Chromium emulation is not a physical Android device test.']},null,2));
})().catch(error=>{console.error(error);process.exit(1);});

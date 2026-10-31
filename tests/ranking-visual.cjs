// Chromium with Firebase simulated in memory; no production services or rules.
const {chromium}=require('playwright-core');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const mock=readFileSync(__dirname+'/firebase-mock.js','utf8');
const values=[0,9,67,153,230,999,1000,1000000];
const users=Object.fromEntries(values.map((n,i)=>['u'+i,{id:'u'+i,ownerUid:'uid'+i,username:'Runner '+i,role:i===1?'admin':'member',rings:n,...(i===2?{ostUrl:'https://example.test/audio.mp3',ostName:'Test'}:{})}]));
const seed={'speedy-friends-teams':{'speedy-friends':{users,rings:Object.fromEntries(values.map((n,i)=>['u'+i,n]))}}};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});mkdirSync('test-results/ranking-v62',{recursive:true});const metrics=[];
 for(const [width,height] of [[1920,1080],[1366,768],[390,844],[360,800]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-app-compat'))return r.fulfill({contentType:'text/javascript',body:mock});if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase'))return r.fulfill({contentType:'text/javascript',body:'/* mock */'});return r.abort()});
  await context.addInitScript(seed=>{localStorage.setItem('__sfMockDb',JSON.stringify(seed));localStorage.setItem('__sfMockSeeded','1');localStorage.setItem('__sfMockAuth',JSON.stringify({uid:'uid0',email:'test@example.test',displayName:'Test'}))},seed);
  const page=await context.newPage();await page.goto(base+'/ranking.html');await page.waitForSelector('.rank-row');
  await page.waitForFunction(()=>document.querySelectorAll('.rank-row').length===8);
  metrics.push(await page.evaluate(()=>({width:innerWidth,observedAllRowsMs:Math.round(performance.now()),listeners:window.__sfMockLog.filter(x=>x[0]==='listen').map(x=>x[1]),reads:window.__sfMockLog.filter(x=>x[0]==='read').map(x=>x[1])})));
  const result=await page.locator('.rank-row').evaluateAll(rows=>rows.map(row=>{const number=row.querySelector('.rank-rings strong'),label=row.querySelector('.rank-rings span'),icon=row.querySelector('.ring-icon'),button=row.querySelector('.rank-ost-btn');const rect=e=>e?.getBoundingClientRect().toJSON();return {value:number.textContent,number:rect(number),label:rect(label),icon:rect(icon),button:rect(button),scroll:number.scrollWidth,client:number.clientWidth,whiteSpace:getComputedStyle(number).whiteSpace}}));
  assert.deepEqual(result.map(x=>x.value).sort(),values.map(n=>n.toLocaleString('en-US')).sort());
  for(const x of result){assert.equal(x.whiteSpace,'nowrap');assert.ok(x.scroll<=x.client+1,`${width}: clipped ${x.value}`);assert.ok(x.label.width>0&&x.label.height>0,`${width}: label missing`);if(x.button)assert.ok(x.button.bottom<=x.number.top||x.button.left>=x.number.right||x.button.right<=x.number.left||x.button.top>=x.number.bottom,`${width}: music overlaps`)}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`test-results/ranking-v62/ranking-${width}.png`,fullPage:true});
  if(width===390){
   await page.evaluate(()=>{window.__unchanged=document.querySelector('[data-profile-id="u1"]');return window.SpeedyFirebase.refs.rings.child('u0').set(2000000)});
   await page.waitForFunction(()=>document.querySelector('[data-profile-id="u0"] .rank-rings strong')?.textContent==='2,000,000');
   assert.equal(await page.evaluate(()=>window.__unchanged===document.querySelector('[data-profile-id="u1"]')),true,'unchanged card survives update');
   assert.equal(await page.locator('#member-ranking-list .rank-row').first().getAttribute('data-profile-id'),'u0');
   await page.evaluate(()=>window.SpeedyFirebase.auth.signOut());
   await page.waitForFunction(()=>document.querySelectorAll('.rank-row,.creator-rank-card').length===0);
  }
  console.log(`PASS ${width}x${height}: ${result.length} real fixture rows`);await context.close();
 }
 writeFileSync('test-results/ranking-v62/mock-metrics.json',JSON.stringify({note:'Local Chromium with Firebase simulated in memory; not production latency.',metrics},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

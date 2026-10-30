/* Derivados WebP para fondos y fotos de cafetería. No sobrescribe originales.
 * Requiere el servidor local (npm run dev). Escribe docs/media-optimization-extra.json. */
const {chromium}=require('playwright-core');
const fs=require('node:fs');const crypto=require('node:crypto');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
const candidates={
 'assets/banner_250627_01_SonicRacingCrossWorld.jpg':[960,1440],
 'assets/banner_260624_01_SonicFrontiersDX.webp':[640,1280],
 'assets/cafeteria-counter-inspiration.jpg':[480,736],
 'assets/cafe-sonic-barista-cover.jpg':[480,736],
 'assets/cafe-speed-cafe-storefront.jpg':[480,736],
 'assets/cafe-toast-sonic.jpg':[480,736],
 'assets/cafe-matcha-sonic.jpg':[480,736]
};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 const page=await browser.newPage();await page.goto(base+'/__media-audit__');
 const mapping={};fs.mkdirSync('assets/optimized',{recursive:true});
 for(const [source,widths] of Object.entries(candidates)){
  const result=await page.evaluate(async ({source,widths})=>{
   const image=new Image();image.src=source;await image.decode();
   const w=image.naturalWidth,h=image.naturalHeight;
   return {w,h,outputs:widths.filter(n=>n<=w).map(width=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(h*width/w);const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);return {width,height:canvas.height,data:canvas.toDataURL('image/webp',.82)};})};
  },{source,widths});
  const hash=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0,12);
  const variants=[];
  for(const out of result.outputs){if(!out.data.startsWith('data:image/webp;'))throw new Error('WebP encoding unavailable');const file=`assets/optimized/${hash}-${out.width}.webp`;const bytes=Buffer.from(out.data.split(',')[1],'base64');fs.writeFileSync(file,bytes);variants.push({path:file,width:out.width,height:out.height,bytes:bytes.length});}
  mapping[source]={originalBytes:fs.statSync(source).size,width:result.w,height:result.h,variants};
 }
 fs.writeFileSync('docs/media-optimization-extra.json',JSON.stringify(mapping,null,2));
 console.log(Object.entries(mapping).map(([k,v])=>`${k}: ${Math.round(v.originalBytes/1024)}KB -> ${v.variants.map(x=>x.width+'w '+Math.round(x.bytes/1024)+'KB').join(', ')}`).join('\n'));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

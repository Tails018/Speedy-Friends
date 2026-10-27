/* Existing local assets only. Emits derivatives, never overwrites originals. */
const {chromium}=require('playwright-core');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const base=process.env.SF_BASE_URL||'http://127.0.0.1:4174';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SF_BROWSER_EXECUTABLE?{executablePath:process.env.SF_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 const page=await browser.newPage();await page.goto(base+'/__media-audit__');
 const inventory=JSON.parse(fs.readFileSync('docs/media-inventory.json','utf8'));
 const candidates=['assets/section-replacement.png',...['01','02','03'].map(n=>`assets/user-carousel/carousel-${n}.jpg`),...['sonic-wars','metal-virus','execution'].map(n=>`assets/ultimos-momentos/${n}.jpeg`)];
 const inspectOnly=process.argv.includes('--inspect-only');
 const mapping={};fs.mkdirSync('assets/optimized',{recursive:true});
 for(const source of inspectOnly?[]:candidates){
  const result=await page.evaluate(async source=>{
   const image=new Image();image.src=source;await image.decode();
   const w=image.naturalWidth,h=image.naturalHeight;
   const widths=[...new Set([320,640,960,1440].filter(n=>n<w).concat(Math.min(w,1440)))];
   const outputs=widths.map(width=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(h*width/w);const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);return {width,height:canvas.height,data:canvas.toDataURL('image/webp',.84)};});
   return {w,h,outputs};
  },source);
  const hash=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0,12);
  const variants=[];
  for(const out of result.outputs){if(!out.data.startsWith('data:image/webp;'))throw new Error('WebP encoding unavailable');const file=`assets/optimized/${hash}-${out.width}.webp`;const bytes=Buffer.from(out.data.split(',')[1],'base64');fs.writeFileSync(file,bytes);variants.push({path:file,width:out.width,height:out.height,bytes:bytes.length});}
  const preferred=variants.find(v=>v.width>=640)||variants.at(-1);
  mapping[source]={originalBytes:fs.statSync(source).size,width:result.w,height:result.h,src:preferred.path,variants};
 }
 // All local raster dimensions and signature checks, without changing files.
 for(const entry of inventory){
  if(!/\.(png|jpe?g|webp|gif|svg)$/i.test(entry.path))continue;
  entry.dimensions=await page.evaluate(async src=>{try{const i=new Image();i.src=src;await i.decode();return {width:i.naturalWidth,height:i.naturalHeight};}catch{return {error:'decode failed'};}},entry.path);
  const b=fs.readFileSync(entry.path);
  entry.detectedFormat=b.subarray(0,4).toString('hex')==='89504e47'?'png':b.subarray(0,3).toString('hex')==='ffd8ff'?'jpeg':b.toString('ascii',0,3)==='GIF'?'gif':b.toString('ascii',8,12)==='WEBP'?'webp':entry.format;
 }
 fs.writeFileSync('docs/media-inventory.json',JSON.stringify(inventory,null,2));
 fs.writeFileSync('docs/media-dimensions.json',JSON.stringify(Object.fromEntries(inventory.map(m=>[m.path,{dimensions:m.dimensions,detectedFormat:m.detectedFormat}])),null,2));
 if(inspectOnly){await browser.close();console.log('Inspected '+inventory.length+' local assets');return;}
 fs.writeFileSync('docs/media-optimization.json',JSON.stringify(mapping,null,2));
 // Apply to local authored pages/scripts, preserving every original asset and backup.
 for(const file of fs.readdirSync('.').filter(f=>/\.(html|js)$/.test(f)&&!f.includes('.before-')&&!f.includes('.v65.'))){
  let text=fs.readFileSync(file,'utf8');
  text=text.replace(/<img\b[^>]*>/g,tag=>{
   const src=tag.match(/\bsrc="([^"]+)"/)?.[1];const media=inventory.find(m=>m.path===src),opt=mapping[src];
   const width=opt?.width||media?.dimensions?.width,height=opt?.height||media?.dimensions?.height;
   if(width&&height){if(!/\bwidth=/.test(tag))tag=tag.replace(/>$/,` width="${width}" height="${height}">`);if(!/\bdecoding=/.test(tag))tag=tag.replace(/>$/,' decoding="async">');}
   if(opt){tag=tag.replace(`src="${src}"`,`src="${opt.src}" srcset="${opt.variants.map(v=>`${v.path} ${v.width}w`).join(', ')}" sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 640px"`);if(!tag.includes('carousel-01')&&!/loading=/.test(tag))tag=tag.replace(/>$/,' loading="lazy">');}
   return tag;
  });
  // Fallbacks and JS templates use a shared optimized asset instead of a 2.5 MB copy.
  for(const [source,opt] of Object.entries(mapping))text=text.split(`'${source}'`).join(`'${opt.src}'`);
  fs.writeFileSync(file,text);
 }
 // First hero image is critical; later slides and below-fold cards are deferred.
 const home='index.html';let text=fs.readFileSync(home,'utf8');
 const first=mapping[candidates[1]].src;
 text=text.replace(new RegExp(`<img[^>]+src="${first}"[^>]*>`),tag=>tag.replace(/ loading="lazy"/,'').replace(/>$/,' fetchpriority="high">'));
 fs.writeFileSync(home,text);
 console.log(JSON.stringify({sources:candidates.length,originalBytes:Object.values(mapping).reduce((s,m)=>s+m.originalBytes,0),preferredBytes:Object.values(mapping).reduce((s,m)=>s+fs.statSync(m.src).size,0),brokenImages:inventory.filter(m=>m.dimensions?.error).map(m=>m.path)}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

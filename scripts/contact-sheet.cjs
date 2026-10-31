// Une capturas en una hoja de contacto. Uso: node scripts/contact-sheet.cjs <carpeta> <prefijo> <salida.png>
const {chromium}=require('playwright-core');const fs=require('node:fs');const path=require('node:path');
const [dir,prefix,outFile]=process.argv.slice(2);
(async()=>{const files=fs.readdirSync(dir).filter(f=>f.startsWith(prefix)&&f.endsWith('.png')).sort();
 const cols=prefix==='mobile'?7:4,w=prefix==='mobile'?230:400;
 const html=`<body style="margin:0;background:#222;font:12px Arial;color:#fff;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px">${files.map(f=>`<figure style="margin:0"><img style="width:${w}px;display:block" src="data:image/png;base64,${fs.readFileSync(path.join(dir,f)).toString('base64')}"><figcaption>${f}</figcaption></figure>`).join('')}</body>`;
 const b=await chromium.launch({channel:'msedge'});const p=await b.newPage({viewport:{width:cols*(w+6)+6,height:600}});await p.setContent(html);await p.waitForTimeout(300);
 await p.screenshot({path:outFile,fullPage:true});await b.close();console.log(outFile);})();

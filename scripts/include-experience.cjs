// Inserta la capa compartida (sf-experience.css/.js) al final del <head> de cada página activa.
// Idempotente; no toca copias históricas (.v65 / .before-).
const fs=require('node:fs');
const pages=fs.readdirSync('.').filter(f=>f.endsWith('.html')&&!f.includes('.v65.')&&!f.includes('.before-'));
for(const page of pages){
 let html=fs.readFileSync(page,'utf8');
 if(html.includes('sf-experience.css')){console.log('skip',page);continue;}
 const at=html.indexOf('</head>');
 if(at<0){console.log('no </head>',page);continue;}
 html=html.slice(0,at)+'<link rel="stylesheet" href="sf-experience.css">\n<script src="sf-experience.js"></script>\n'+html.slice(at);
 fs.writeFileSync(page,html);console.log('ok',page);
}

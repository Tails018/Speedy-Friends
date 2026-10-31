// Sube los tamaños de letra ilegibles (4–8px) en las páginas y CSS propios. No toca vendor/ ni copias históricas.
const fs=require('node:fs');
const files=fs.readdirSync('.').filter(f=>/\.(html|css)$/.test(f)&&!/\.v65\.|\.before-|^sf-experience\.css$/.test(f));
const map=px=>px<=6?9:px<=6.5?9.5:px<=7.5?10:9;
let total=0;
for(const f of files){
 const raw=fs.readFileSync(f,'utf8');let n=0;
 const out=raw.replace(/font-size:(\s*)([4-8](?:\.\d+)?)px/g,(m,sp,v)=>{const px=parseFloat(v);if(px>8)return m;n++;return `font-size:${sp}${map(px)}px`;});
 if(n){fs.writeFileSync(f,out);total+=n;console.log(String(n).padStart(3),f);}
}
console.log('total',total);

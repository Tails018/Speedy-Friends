import {readFileSync,readdirSync,statSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const baseline=process.argv.includes('--baseline');
const files=execFileSync('git',['ls-tree','-r','--name-only','main'],{encoding:'utf8'}).trim().split('\n');
const read=p=>baseline?execFileSync('git',['show','main:'+p],{maxBuffer:20*1024*1024}).toString('utf8'):readFileSync(p,'utf8');
const active=files.filter(p=>!p.includes('.before-')&&!p.includes('.v65.'));
const report={baseline,base:'e4255ff83ea278534f8312ea873bd990f6ca111d',files:files.length,syntax:[],missingReferences:[],cssMissing:[],pages:[],embeddedMedia:[]};
const exactExists=p=>{let cur='.';for(const part of p.replaceAll('\\','/').split('/')){if(part==='.'||!part)continue;if(!existsSync(cur)||!readdirSync(cur).includes(part))return false;cur=join(cur,part);}return existsSync(cur);};
for(const file of active){
 if(/\.(?:html|js)$/.test(file)){
  const text=read(file);
  const scripts=file.endsWith('.js')?[[0,text]]:[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/type=["'](?:module|application\/)/.test(m[1])).map(m=>[text.slice(0,m.index).split('\n').length,m[2]]);
  for(const [line,code] of scripts)try{new vm.Script(code,{filename:file+':'+line});}catch(e){report.syntax.push({file,line,error:e.message});}
  for(const m of text.matchAll(/data:(image|audio|video|font)\/[\w+.-]+;base64,[A-Za-z0-9+/=]+/g))report.embeddedMedia.push({file,line:text.slice(0,m.index).split('\n').length,bytes:m[0].length,type:m[1]});
  if(file.endsWith('.html')){
   const html=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   report.pages.push({file,title:text.match(/<title>(.*?)<\/title>/s)?.[1],startsWithHtml:/^\s*<!doctype html>\s*<html/i.test(text),hasLoader:text.includes('id="sf-page-loader"'),scripts:[...text.matchAll(/<script\b[^>]*src=["']([^"']+)/g)].map(m=>m[1])});
   for(const m of html.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/g)){
    const raw=m[1];if(/^(?:[a-z]+:|\/\/|#)/i.test(raw)||raw.includes('${')||raw.startsWith('`'))continue;
    const local=decodeURIComponent(raw.split(/[?#]/)[0]);if(local&&!exactExists(join(dirname(file),local)))report.missingReferences.push({file,path:local});
   }
  }
 }
 if(file.endsWith('.css'))for(const m of read(file).matchAll(/url\(["']?([^\)"']+)["']?\)/g)){
  if(/^(?:[a-z]+:|\/\/|#)/i.test(m[1]))continue;
  if(!existsSync(resolve(dirname(file),m[1].split('?')[0])))report.cssMissing.push({file,path:m[1]});
 }
}
const media=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name).replaceAll('\\','/');if(entry.isDirectory())walk(p);else if(/\.(?:png|jpe?g|webp|avif|gif|svg|ico|mp4|webm|mov|mp3|wav|ogg|m4a|woff2?|ttf|otf|eot)$/i.test(p)){const b=readFileSync(p);media.push({path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),format:p.split('.').at(-1).toLowerCase()});}}}
walk('assets');walk('vendor');
const groups=new Map();for(const m of media){const list=groups.get(m.sha256)||[];list.push(m.path);groups.set(m.sha256,list);}
report.media={files:media.length,bytes:media.reduce((n,m)=>n+m.bytes,0),duplicateGroups:[...groups.values()].filter(g=>g.length>1),largest:[...media].sort((a,b)=>b.bytes-a.bytes).slice(0,12)};
mkdirSync('docs',{recursive:true});writeFileSync('docs/'+(baseline?'audit-baseline':'audit-current')+'.json',JSON.stringify(report,null,2));
if(!baseline){const dims=existsSync('docs/media-dimensions.json')?JSON.parse(readFileSync('docs/media-dimensions.json','utf8')):{};writeFileSync('docs/media-inventory.json',JSON.stringify(media.map(m=>({...m,...(dims[m.path]||{})})),null,2));}
console.log(JSON.stringify({baseline,files:files.length,pages:report.pages.length,syntax:report.syntax,missingReferences:report.missingReferences,cssMissing:report.cssMissing.length,media:report.media.files,mediaBytes:report.media.bytes,embeddedMedia:report.embeddedMedia.length},null,2));

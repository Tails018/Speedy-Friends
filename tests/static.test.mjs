import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const pages=readdirSync('.').filter(f=>f.endsWith('.html')&&!f.includes('.v65.'));
const scripts=[...readdirSync('.').filter(f=>f.endsWith('.js')),...readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f),...readdirSync('vendor').filter(f=>f.endsWith('.js')).map(f=>'vendor/'+f),...readdirSync('scripts').filter(f=>f.endsWith('.cjs')).map(f=>'scripts/'+f)];
test('Every original and new classic JS source and inline script parses',()=>{
 for(const file of scripts)new vm.Script(read(file),{filename:file});
 for(const file of pages)for(const m of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/type=["'](?:module|application\/)/.test(m[1]))continue;
  new vm.Script(m[2],{filename:file});
 }
});
test('Local images, stylesheets, scripts, routes and srcsets exist with exact filename case',()=>{
 const exact=p=>{let current='.';for(const part of p.replaceAll('\\','/').split('/')){if(!part||part==='.')continue;if(!existsSync(current)||!readdirSync(current).includes(part))return false;current+='/'+part;}return existsSync(current);};
 const missing=[];
 for(const file of pages){const text=read(file);const refs=[...text.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/g)].map(m=>m[1]);
  for(const m of text.matchAll(/\bsrcset="([^"]+)"/g))refs.push(...m[1].split(',').map(x=>x.trim().split(/\s+/)[0]));
  for(const ref of refs){if(/^(?:[a-z]+:|\/\/|#)/i.test(ref)||ref.includes('${')||ref.startsWith('`'))continue;const local=decodeURIComponent(ref.split(/[?#]/)[0]);if(local&&!exact(local))missing.push(file+': '+local);}
 }
 assert.deepEqual(missing,[]);
});
test('All CSS image references resolve, including preserved vendor declarations',()=>{
 const files=[...readdirSync('.').filter(f=>f.endsWith('.css')&&!f.includes('.before-')),...readdirSync('vendor').filter(f=>f.endsWith('.css')).map(f=>'vendor/'+f)];const missing=[];
 for(const file of files)for(const m of read(file).matchAll(/url\(["']?([^\)"']+)["']?\)/g)){
  if(/^(?:[a-z]+:|\/\/|#)/i.test(m[1]))continue;
  if(!existsSync(resolve(dirname(file),m[1].split('?')[0])))missing.push(file+': '+m[1]);
 }
 assert.deepEqual(missing,[]);
});
test('Loader document ordering and original integration IDs remain intact',()=>{
 for(const page of pages){const source=read(page);assert.match(source,/^<!doctype html>\s*<html\b/i,page);
  if(source.includes('id="sf-page-loader"')){assert.ok(source.indexOf('<body')<source.indexOf('id="sf-page-loader"'),page);if(page!=='cafeteria.html')assert.equal((source.match(/src="page-loader.js"/g)||[]).length,1,page);}
 }
 const source=read('index.html');for(const id of ['sf-auth-gate','topics','friends','special','downloads','quick-actions','videos','fanarts','ultimos-momentos','mobileNav'])assert.ok(source.includes(`id="${id}"`),id);
 assert.equal((source.match(/<h1\b/g)||[]).length,1);assert.ok(source.includes('sf-auth-required-gate'));
});
test('Every original asset and historical backup is preserved (Git line endings normalized for text)',()=>{
 const originals=execFileSync('git',['ls-tree','-r','--name-only','main'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.startsWith('assets/')||f.includes('.before-')||f.includes('.v65.'));
 for(const file of originals){assert.ok(existsSync(file),file);const original=execFileSync('git',['show','main:'+file],{maxBuffer:20*1024*1024});const actual=readFileSync(file);assert.ok(original.equals(actual)||((!file.startsWith('assets/')||file.endsWith('.svg'))&&original.toString('utf8').replaceAll('\r\n','\n')===actual.toString('utf8').replaceAll('\r\n','\n')),file+' was changed');}
});
test('WebP variants are real images and the chosen sources reduce transfer bytes',()=>{
 const mapping=JSON.parse(read('docs/media-optimization.json'));let before=0,after=0;
 for(const [source,m] of Object.entries(mapping)){assert.ok(existsSync(source));before+=m.originalBytes;after+=readFileSync(m.src).length;for(const variant of m.variants){const b=readFileSync(variant.path);assert.equal(b.toString('ascii',8,12),'WEBP');assert.ok(variant.width<=m.width);}}
 assert.ok(after<before*.3,{before,after});
});
test('Reused catalog IDs and prices match the original catalog without executing legacy app',()=>{
 const original=read('js/app.js').match(/const PRODUCTS\s*=\s*(\[.*?\n\s*\]);/s)[1];const a={BASE_RANKING:Array.from({length:5},()=>({avatar:''}))};vm.createContext(a);vm.runInContext('result='+original,a);
 const b={window:{}};vm.createContext(b);vm.runInContext(read('store-catalog.js'),b);
 assert.deepEqual(JSON.parse(JSON.stringify(b.window.SFStoreCatalog.map(p=>[p.id,p.price]))),JSON.parse(JSON.stringify(a.result.map(p=>[p.id,p.price]))));
});

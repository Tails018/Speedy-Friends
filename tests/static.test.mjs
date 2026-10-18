import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const htmlFiles=readdirSync('.').filter(f=>f.endsWith('.html'));
test('Every classic JavaScript file and inline script parses',()=>{
 for(const file of readdirSync('.').filter(f=>f.endsWith('.js')))new vm.Script(read(file),{filename:file});
 for(const file of htmlFiles){let i=0;for(const m of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/type=["'](?:module|application\/)/.test(m[1]))continue;
  new vm.Script(m[2],{filename:`${file}:inline-${++i}`});
 }}
});
test('Local resources and HTML routes resolve on case-sensitive hosts',()=>{
 const missing=[];
 const exactExists=path=>{
  const parts=path.split('/');let current='.';
  for(const part of parts){if(part==='.'||part==='')continue;if(!existsSync(current)||!readdirSync(current).includes(part))return false;current+='/'+part;}return existsSync(current);
 };
 for(const file of htmlFiles){const source=read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  for(const m of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)){
   const raw=m[1];if(/^(?:https?:|data:|blob:|mailto:|tel:|#|javascript:)/i.test(raw)||raw.includes('${')||raw.startsWith('`'))continue;
   const local=decodeURIComponent(raw.split(/[?#]/)[0]);if(local&&!exactExists(local))missing.push(`${file}: ${local}`);
  }
 }
 assert.deepEqual(missing,[]);
});
test('Home document starts with html and preserves main integration targets',()=>{
 const src=read('index.html');assert.match(src,/^<!doctype html>\s*<html lang="es">/i);
 for(const id of ['sf-auth-gate','topics','friends','special','downloads','quick-actions','videos','fanarts','ultimos-momentos','mobileNav'])assert.ok(src.includes(`id="${id}"`),id);
 assert.ok(src.includes('sf-auth-required-gate'));
 assert.ok(src.includes('firebase-legacy.js'));
 assert.equal((src.match(/<h1\b/g)||[]).length,1);
});
test('Stylesheet image URLs resolve locally, including original vendor GIF/WebP resources',()=>{
 const files=[...readdirSync('.').filter(f=>f.endsWith('.css')&&!f.includes('.before-')),...readdirSync('vendor').filter(f=>f.endsWith('.css')).map(f=>'vendor/'+f)];
 const missing=[];
 for(const file of files)for(const m of read(file).matchAll(/url\(["']?([^\)"']+)["']?\)/g)){
  if(/^(?:data:|https?:|\/\/|#)/.test(m[1]))continue;
  if(!existsSync(resolve(dirname(file),m[1].split('?')[0])))missing.push(file+': '+m[1]);
 }
 assert.deepEqual(missing,[]);
});
test('Community selection is complete and does not publish excluded or unverified groups',()=>{
 const data=JSON.parse(read('community-groups.json'));const page=read('comunidad.html');
 assert.equal(data.groups.length+data.pending.length+data.excluded.length,23);
 assert.equal(new Set(data.groups.map(g=>g.id)).size,data.groups.length);
 for(const group of data.groups){assert.ok(group.rules.length>0);assert.ok(page.includes(`id="${group.id}"`));}
 for(const group of [...data.pending,...data.excluded])assert.ok(!page.includes(`<h3>${group.name}</h3>`));
 assert.ok(page.includes(data.registration));
 assert.doesNotMatch(page,/\+5\d[\s-]*\d{3}/);
});
test('All optimized images exist and reduce the total transferred bytes',()=>{
 const images=JSON.parse(read('docs/media-optimization.json'));
 for(const image of images){assert.ok(existsSync(image.source));assert.ok(existsSync(image.optimized));assert.ok(statSync(image.optimized).size<statSync(image.source).size,image.source);}
});
test('Public rules remain available without JS and external services',()=>{
 const page=read('comunidad.html');assert.equal((page.match(/<details>/g)||[]).length,15);
 assert.equal((page.match(/<script /g)||[]).length,1);assert.ok(!page.includes('firebase'));
 assert.ok(page.includes('id="group-search"'));assert.ok(read('community.js').includes("normalize('NFD')"));
});

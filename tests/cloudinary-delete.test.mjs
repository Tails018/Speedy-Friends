import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createDeleteFanartHandler}=require('../server/cloudinary/delete-fanart.cjs');
const goodBinding={assetId:'fanart-1',ownerUid:'alice',publicId:'protected/alice/verified-id',resourceType:'image',lockId:'abcdefghijklmnop'};
function setup({claim=async({actorUid})=>actorUid==='alice'?{status:'claimed',authorization:'owner',binding:goodBinding}:{status:'denied'},destroy=async()=>({result:'ok'}),complete=async()=>{}}={}){
 const calls={claims:[],destroys:[],completions:[]};
 const handler=createDeleteFanartHandler({claimDeletion:async x=>(calls.claims.push(x),claim(x)),destroyCloudinary:async (...x)=>(calls.destroys.push(x),destroy(...x)),completeDeletion:async x=>(calls.completions.push(x),complete(x))});
 return {handler,calls};
}
const req=(uid='alice',data={assetId:'fanart-1'})=>({auth:uid?{uid}:null,data});
const isCode=code=>e=>e.code===code;
test('unauthenticated requests and client-supplied public IDs are rejected before claiming',async()=>{
 const {handler,calls}=setup();
 await assert.rejects(handler(req(null)),isCode('unauthenticated'));
 await assert.rejects(handler(req('alice',{assetId:'fanart-1',publicId:'another/asset'})),isCode('invalid-argument'));
 await assert.rejects(handler(req('alice',{assetId:'../secrets'})),isCode('invalid-argument'));
 assert.equal(calls.claims.length,0);assert.equal(calls.destroys.length,0);
});
test('only a server-authorized claim can reach Cloudinary',async()=>{
 const {handler,calls}=setup();
 await assert.rejects(handler(req('bob')),isCode('permission-denied'));
 assert.equal(calls.destroys.length,0);assert.equal(calls.completions.length,0);
});
test('uses trusted binding and invalidates CDN before completing deletion',async()=>{
 const {handler,calls}=setup();
 assert.deepEqual(await handler(req()),{status:'deleted'});
 assert.deepEqual(calls.claims,[{assetId:'fanart-1',actorUid:'alice'}]);
 assert.deepEqual(calls.destroys,[['protected/alice/verified-id',{resource_type:'image',invalidate:true}]]);
 assert.deepEqual(calls.completions,[{assetId:'fanart-1',lockId:'abcdefghijklmnop'}]);
});
test('video type is forwarded and authenticated admins depend on the trusted claim adapter',async()=>{
 const {handler,calls}=setup({claim:async({actorUid})=>actorUid==='admin'?{status:'claimed',authorization:'admin',binding:{...goodBinding,resourceType:'video'}}:{status:'denied'}});
 assert.deepEqual(await handler(req('admin')),{status:'deleted'});
 assert.equal(calls.destroys[0][1].resource_type,'video');
});
test('rejects missing, mismatched, or malformed trusted bindings without making a Cloudinary call',async()=>{
 for(const binding of [{...goodBinding,assetId:'other'},{...goodBinding,resourceType:'raw'},{...goodBinding,lockId:'x'},{...goodBinding,publicId:''}]){
  const {handler,calls}=setup({claim:async()=>({status:'claimed',authorization:'owner',binding})});
  await assert.rejects(handler(req()),isCode('invalid-binding'));assert.equal(calls.destroys.length,0);
 }
});
test('destroy and persistence failures are generic and do not falsely report completion',async()=>{
 const bad=setup({destroy:async()=>{throw Error('secret-private-test');}});
 await assert.rejects(bad.handler(req()),e=>e.code==='unavailable'&&!e.message.includes('secret-private-test'));
 assert.equal(bad.calls.completions.length,0);
 const response=setup({destroy:async()=>({result:'error',detail:'secret-private-test'})});
 await assert.rejects(response.handler(req()),isCode('unavailable'));assert.equal(response.calls.completions.length,0);
 const finalize=setup({complete:async()=>{throw Error('secret-private-test');}});
 await assert.rejects(finalize.handler(req()),isCode('unavailable'));
});
test('already deleted result is idempotent; not found can finish a reserved retry',async()=>{
 const already=setup({claim:async()=>({status:'already-deleted'})});
 assert.deepEqual(await already.handler(req()),{status:'already-deleted'});assert.equal(already.calls.destroys.length,0);
 const retry=setup({destroy:async()=>({result:'not found'})});
 assert.deepEqual(await retry.handler(req()),{status:'deleted'});assert.equal(retry.calls.completions.length,1);
});

test('an owner claim whose immutable binding belongs to another user cannot delete',async()=>{
 const {handler,calls}=setup({claim:async()=>({status:'claimed',authorization:'owner',binding:goodBinding})});
 await assert.rejects(handler(req('bob')),isCode('permission-denied'));assert.equal(calls.destroys.length,0);
});
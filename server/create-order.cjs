'use strict';
// Experimental trusted-server core; never expose it without verified Auth and migration.
const safeKey=value=>typeof value==='string'&&value.length>0&&value.length<=80&&!/[.#$\[\]\/\x00-\x1f\x7f~]/.test(value);
class CreateOrderError extends Error{constructor(code){super(code);this.code=code;}}
async function createOrder({actorUid,requestId,itemId,quantity,runTransaction,now=Date.now()}){
 if(!safeKey(actorUid)||!safeKey(requestId)||!safeKey(itemId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>10||typeof runTransaction!=='function'||!Number.isSafeInteger(now)||now<0)throw new CreateOrderError('invalid-argument');
 const orderId=`${actorUid}~${requestId}`;let failure='aborted';
 const result=await runTransaction(team=>{
  if(team===null){failure='missing-team';return null;}
  if(typeof team!=='object'){failure='missing-team';return;}
  const cafe=team.cafeteria||{},orders=cafe.orders||{};
  const existing=orders[orderId];
  if(existing){
   if(existing.ownerUid!==actorUid||existing.itemId!==itemId||existing.qty!==quantity){failure='request-conflict';return;}
   failure='already-created';return;
  }
  if(Object.values(orders).some(o=>o?.ownerUid===actorUid&&['pendiente','preparando','listo'].includes(o.status))){failure='active-order';return;}
  const profiles=Object.entries(team.users||{}).filter(([,p])=>p?.ownerUid===actorUid);
  if(profiles.length!==1){failure='invalid-owner';return;}
  const [profileId,profile]=profiles[0],product=cafe.menu?.[itemId];
  if(!product||product.active!==true||!Number.isSafeInteger(product.price)||product.price<0){failure='invalid-product';return;}
  const total=product.price*quantity,balance=team.rings?.[profileId];
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(balance)||balance<0){failure='invalid-balance';return;}
  if(balance<total){failure='insufficient-rings';return;}
  team.cafeteria ||= {};team.cafeteria.orders ||= {};
  team.cafeteria.orders[orderId]={id:orderId,ownerUid:actorUid,ownerProfileId:profileId,itemId,itemName:String(product.name||'Producto').slice(0,100),username:String(profile.username||profile.name||'Integrante').slice(0,100),unitPrice:product.price,qty:quantity,totalRings:total,status:'pendiente',statusChanges:0,createdAt:now,paidAt:0};
  return team;
 });
 if(result.committed)return {status:'created',orderId};
 if(failure==='already-created')return {status:'already-created',orderId};
 throw new CreateOrderError(failure);
}
module.exports={createOrder,CreateOrderError};

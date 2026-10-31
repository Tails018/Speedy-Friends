'use strict';
// Experimental trusted-server core. Never call from a browser or deploy with legacy rules.
const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 128 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(key);
class SettlementError extends Error { constructor(code) { super(code); this.code=code; } }

// runTransaction is injected by a trusted server and must atomically transact on the
// entire team node. actorUid must come from a verified authentication token.
async function settleOrder({actorUid, orderId, creatorUid, runTransaction, now = Date.now()}) {
  if (!safeKey(actorUid) || !safeKey(orderId) || !safeKey(creatorUid) || typeof runTransaction !== 'function' || !Number.isSafeInteger(now) || now < 0) throw new SettlementError('invalid-argument');
  let failure='aborted';
  const result=await runTransaction(team => {
    // The SDK may invoke the callback with null before it has fetched server state.
    if (team === null) { failure='missing-team'; return null; }
    if (typeof team !== 'object') { failure='missing-team'; return; }
    const cafe=team.cafeteria || {};
    const worker=cafe.workers?.[actorUid];
    if (actorUid !== creatorUid && !(worker?.role === 'worker' && worker.active === true)) { failure='permission-denied'; return; }
    const existing=team.economyLedger?.[orderId];
    if(existing) {
      if(existing.type !== 'cafe-order' || existing.orderId !== orderId) { failure='ledger-conflict'; return; }
      failure='already-settled'; return;
    }
    const order=cafe.orders?.[orderId];
    if(!order || order.status !== 'listo') { failure='invalid-order-state'; return; }
    if(!safeKey(order.ownerUid) || !safeKey(order.ownerProfileId) || !safeKey(order.itemId)) { failure='invalid-order'; return; }
    if(team.users?.[order.ownerProfileId]?.ownerUid !== order.ownerUid) { failure='invalid-owner'; return; }
    const product=cafe.menu?.[order.itemId];
    if(!product || product.active !== true || !Number.isSafeInteger(product.price) || product.price < 0) { failure='invalid-product'; return; }
    if(!Number.isSafeInteger(order.qty) || order.qty < 1 || order.qty > 10) { failure='invalid-quantity'; return; }
    const total=product.price * order.qty;
    const balance=team.rings?.[order.ownerProfileId];
    if(!Number.isSafeInteger(total) || !Number.isSafeInteger(balance) || balance < 0) { failure='invalid-balance'; return; }
    if(balance < total) { failure='insufficient-rings'; return; }
    team.rings[order.ownerProfileId]=balance-total;
    team.economyLedger ||= {};
    team.economyLedger[orderId]={type:'cafe-order',orderId,ownerUid:order.ownerUid,profileId:order.ownerProfileId,workerUid:actorUid,itemId:order.itemId,quantity:order.qty,unitPrice:product.price,totalRings:total,balanceBefore:balance,balanceAfter:balance-total,at:now};
    order.status='servido';order.paidAt=now;order.chargeRings=total;order.servedByUid=actorUid;
    return team;
  });
  if(result.committed) {
    const ledger=result.snapshot.val()?.economyLedger?.[orderId];
    if(!ledger) throw new SettlementError('missing-team');
    return {status:'settled',ledger};
  }
  if(failure==='already-settled') return {status:'already-settled'};
  throw new SettlementError(failure);
}
module.exports={settleOrder, SettlementError};

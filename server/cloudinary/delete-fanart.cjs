'use strict';

// Server-only building block. The caller MUST be an authenticated Firebase callable
// runtime and dependencies MUST be privileged, trusted implementations. See README.
class MediaDeleteError extends Error {
  constructor(code) { super(code); this.name='MediaDeleteError'; this.code=code; }
}
const validKey = v => typeof v === 'string' && v.length > 0 && v.length <= 128 && !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(v);
const validLock = v => typeof v === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(v);
const validPublicId = v => typeof v === 'string' && v.length > 0 && v.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(v);

/**
 * Only assetId is accepted from the callable payload. Other identifying fields
 * (including the Cloudinary public ID, resource type, owner and roles) MUST come
 * from a server-only binding and privileged atomic claim implementation.
 *
 * claimDeletion must atomically authorize the actor against trusted role data,
 * reserve an immutable generation of the server-only binding, and return one of:
 * { status:'claimed', authorization:'owner'|'admin', binding:{assetId,ownerUid,publicId,resourceType,lockId} },
 * { status:'already-deleted' }, or { status:'denied' }. A failed/unknown destroy
 * leaves the reservation retryable; never delete the database binding beforehand.
 */
function createDeleteFanartHandler({claimDeletion, destroyCloudinary, completeDeletion}) {
  if (![claimDeletion,destroyCloudinary,completeDeletion].every(f=>typeof f==='function')) throw new TypeError('trusted adapters required');
  return async function deleteFanart(request) {
    const uid=request?.auth?.uid;
    if(!validKey(uid)) throw new MediaDeleteError('unauthenticated');
    const data=request?.data;
    if(!data || typeof data!=='object' || Array.isArray(data) || Object.keys(data).length!==1 || !validKey(data.assetId)) throw new MediaDeleteError('invalid-argument');
    let claim;
    try { claim=await claimDeletion({assetId:data.assetId,actorUid:uid}); }
    catch { throw new MediaDeleteError('unavailable'); }
    if(claim?.status==='already-deleted') return {status:'already-deleted'};
    if(claim?.status!=='claimed') throw new MediaDeleteError('permission-denied');
    const b=claim.binding;
    if(!b || b.assetId!==data.assetId || !validKey(b.ownerUid) || !validPublicId(b.publicId) || !['image','video'].includes(b.resourceType) || !validLock(b.lockId)) throw new MediaDeleteError('invalid-binding');
    if(!['owner','admin'].includes(claim.authorization) || (claim.authorization==='owner' && b.ownerUid!==uid)) throw new MediaDeleteError('permission-denied');
    let outcome;
    try { outcome=await destroyCloudinary(b.publicId,{resource_type:b.resourceType,invalidate:true}); }
    catch { throw new MediaDeleteError('unavailable'); }
    if(!['ok','not found'].includes(outcome?.result)) throw new MediaDeleteError('unavailable');
    try { await completeDeletion({assetId:b.assetId,lockId:b.lockId}); }
    catch { throw new MediaDeleteError('unavailable'); }
    return {status:'deleted'};
  };
}
module.exports={createDeleteFanartHandler,MediaDeleteError};

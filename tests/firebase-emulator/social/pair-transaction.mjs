/** Prototipo: actorUid debe proceder de un token verificado, jamás del cliente. */
const uidOk=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]/\u0000-\u001f\u007f]/.test(v);
const opOk=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(v);
export function pairKey(a,b){
 if(!uidOk(a)||!uidOk(b)||a===b)throw Error('invalid-user');
 return [a,b].sort().map(v=>Buffer.from(v,'utf8').toString('base64url')).join('~');
}
export function reducePair(current,{actorUid,peerUid,action,operationId}){
 if(!opOk(operationId))return undefined;
 let key;try{key=pairKey(actorUid,peerUid);}catch{return undefined;}
 const members=[actorUid,peerUid].sort();
 const state=current??{key,members,status:'none',operations:{}};
 if(state.key!==key||!Array.isArray(state.members)||state.members[0]!==members[0]||state.members[1]!==members[1]||!state.operations||typeof state.operations!=='object')return undefined;
 const opKey='u'+Buffer.byteLength(actorUid,'utf8')+'_'+Buffer.from(actorUid,'utf8').toString('base64url')+'_'+operationId;
 const previous=state.operations[opKey];
 if(previous)return previous.action===action&&previous.peerUid===peerUid?state:undefined;
 let next;
 if(action==='send'&&state.status==='none')next={...state,status:'pending',requester:actorUid,recipient:peerUid};
 else if(action==='accept'&&state.status==='pending'&&state.recipient===actorUid&&state.requester===peerUid)next={...state,status:'friends',acceptedBy:actorUid};
 else if((action==='reject'&&state.status==='pending'&&state.recipient===actorUid&&state.requester===peerUid)||(action==='cancel'&&state.status==='pending'&&state.requester===actorUid&&state.recipient===peerUid)||(action==='remove'&&state.status==='friends')){
  next={...state,status:'none'};delete next.requester;delete next.recipient;delete next.acceptedBy;
 }else return undefined;
 next.operations={...state.operations,[opKey]:{action,peerUid}};return next;
}
/** Un servicio confiable debe fijar la referencia Admin a socialV2/pairs/<pairKey>. */
export async function applySocialOperation(pairRef,operation){
 const result=await pairRef.transaction(current=>{const next=reducePair(current,operation);return current===null && next===undefined ? null : next;},undefined,false);
 if(!result.committed || result.snapshot.val()===null)throw Error('operation-rejected');
 return result.snapshot.val();
}

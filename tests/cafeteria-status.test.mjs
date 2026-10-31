import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('marcar listo conserva el pedido activo y no cobra ni archiva', async () => {
  const writes = [];
  const order = { id: 'ticket', status: 'preparando', statusChanges: 1, totalRings: 20 };
  function ref(path) {
    return {
      child: key => ref(`${path}/${key}`),
      once: async () => ({ exists: () => true, val: () => order }),
      update: async value => { writes.push({ path, value }); },
      push: async value => { writes.push({ path, value }); }
    };
  }
  const sf = { db: { ref: () => ref('cafeteria') }, current: { uid: 'worker', isCreator: true, profile: {} } };
  const context = { window: { SpeedyFirebase: sf }, document: { dispatchEvent() {} }, CustomEvent: class {}, firebase: { database: { ServerValue: { TIMESTAMP: 123 } } }, console };
  vm.runInNewContext(readFileSync('cafeteria-core.js', 'utf8'), context);
  const result = await context.window.SpeedyCafe.setOrderStatus('ticket', 'listo');
  assert.equal(result.status, 'listo');
  assert.equal(result.statusChanges, 2);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, 'cafeteria/orders/ticket');
  assert.equal(writes[0].value.status, 'listo');
  assert.equal(writes[1].value.type, 'order_status');
  assert.ok(writes.every(write => !/ticketHistory|workerHistory|rings/.test(write.path)));
});
test('modo emulador rechaza fallos sin ejecutar escrituras antiguas', async () => {
  const writes=[];
  function ref(path){return {child:key=>ref(`${path}/${key}`),once:async()=>({exists:()=>true,val:()=>({status:'listo'})}),update:async v=>writes.push(v),transaction:async()=>{throw Error('no debe cobrar en cliente')}};}
  const sf={db:{ref:()=>ref('cafeteria')},current:{uid:'worker',isCreator:true,profile:{}}};
  const context={window:{SpeedyFirebase:sf,location:{hostname:'127.0.0.1'},SpeedyCafeEmulator:{enabled:true,serveOrder:async()=>{throw Error('backend no disponible')}}},firebase:{app:()=>({options:{projectId:'demo-speedy-integration'}})},document:{dispatchEvent(){}},CustomEvent:class{},console};
  vm.runInNewContext(readFileSync('cafeteria-core.js','utf8'),context);
  await assert.rejects(context.window.SpeedyCafe.completeOrder('ticket'),/backend no disponible/);
  assert.equal(writes.length,0);
});
test('modo emulador rechaza proyectos no demo antes de llamar al backend', async () => {
  let called=false;
  const dummy={child:()=>dummy};
  const sf={db:{ref:()=>dummy},current:{uid:'worker'}};
  const context={window:{SpeedyFirebase:sf,location:{hostname:'localhost'},SpeedyCafeEmulator:{enabled:true,serveOrder:async()=>{called=true}}},firebase:{app:()=>({options:{projectId:'speedy-friends'}})},document:{dispatchEvent(){}},CustomEvent:class{},console};
  vm.runInNewContext(readFileSync('cafeteria-core.js','utf8'),context);
  await assert.rejects(context.window.SpeedyCafe.completeOrder('ticket'),/emulador local/);
  assert.equal(called,false);
});

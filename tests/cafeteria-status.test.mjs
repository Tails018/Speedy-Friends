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

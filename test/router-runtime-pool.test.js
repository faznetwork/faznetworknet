'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const RouterRuntimePool = require('../services/RouterRuntimePool');

test('coalesces concurrent initialization for the same persisted router', async () => {
  let creates = 0;
  const runtime = { close: async () => {} };
  const pool = new RouterRuntimePool({
    createRuntime: async router => {
      creates += 1;
      await Promise.resolve();
      assert.equal(String(router.id), '11');
      return runtime;
    }
  });
  const results = await Promise.all(Array.from({ length: 12 }, () => pool.getRuntime({ id: 11 })));
  assert.equal(creates, 1);
  assert.ok(results.every(item => item === runtime));
});

test('isolates runtime instances by router ID and enforces capacity', async () => {
  const created = [];
  const pool = new RouterRuntimePool({
    maxRuntimes: 2,
    createRuntime: async router => {
      const runtime = { routerId: String(router.id), close: async () => {} };
      created.push(runtime);
      return runtime;
    }
  });
  const first = await pool.getRuntime({ id: 1 });
  const second = await pool.getRuntime({ id: 2 });
  assert.notEqual(first, second);
  assert.equal(await pool.getRuntime({ id: 1 }), first);
  await assert.rejects(pool.getRuntime({ id: 3 }), /capacity reached \(2\)/);
  assert.deepEqual(created.map(runtime => runtime.routerId), ['1', '2']);
});

test('requires a persisted router ID and a runtime factory result with close()', async () => {
  const pool = new RouterRuntimePool({ createRuntime: async () => null });
  await assert.rejects(pool.getRuntime({ host: '192.0.2.1' }), /persisted router ID is required/);
  await assert.rejects(pool.getRuntime({ id: 5 }), /must expose close/);
  assert.equal(pool.runtimes.size, 0);
  assert.equal(pool.pending.size, 0);
});

test('failed initialization is not cached and can be retried', async () => {
  let attempts = 0;
  const runtime = { close: async () => {} };
  const pool = new RouterRuntimePool({
    createRuntime: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('initialization failed');
      return runtime;
    }
  });
  await assert.rejects(pool.getRuntime({ id: 9 }), /initialization failed/);
  assert.equal(await pool.getRuntime({ id: 9 }), runtime);
  assert.equal(attempts, 2);
});

test('invalidate waits for pending creation and closes a runtime that was never published', async () => {
  let finishCreation;
  const events = [];
  const pool = new RouterRuntimePool({
    createRuntime: () => new Promise(resolve => {
      finishCreation = () => resolve({ close: async () => { events.push('close'); } });
    })
  });
  const pending = pool.getRuntime({ id: 12 });
  await Promise.resolve();
  const invalidation = pool.invalidate(12);
  finishCreation();
  await assert.rejects(pending, /was invalidated during initialization/);
  await invalidation;
  assert.deepEqual(events, ['close']);
  assert.equal(pool.runtimes.has('12'), false);
  assert.equal(pool.pending.has('12'), false);
});

test('replace closes the previous runtime before creating the replacement', async () => {
  const events = [];
  let creates = 0;
  const pool = new RouterRuntimePool({
    createRuntime: async router => {
      creates += 1;
      events.push('create:' + String(router.id) + ':' + String(router.host));
      return {
        generation: creates,
        close: async () => { events.push('close:' + creates); }
      };
    }
  });
  const first = await pool.getRuntime({ id: 13, host: '192.0.2.13' });
  const replacement = await pool.replace(13, { id: '13', host: '198.51.100.13' });
  assert.equal(first.generation, 1);
  assert.equal(replacement.generation, 2);
  assert.deepEqual(events, [
    'create:13:192.0.2.13',
    'close:1',
    'create:13:198.51.100.13'
  ]);
  assert.equal(await pool.getRuntime({ id: 13 }), replacement);
});

test('closeAll closes every runtime once and rejects future lookups', async () => {
  const closed = [];
  const pool = new RouterRuntimePool({
    createRuntime: async router => ({
      routerId: String(router.id),
      close: async () => { closed.push(String(router.id)); }
    })
  });
  await Promise.all([pool.getRuntime({ id: 1 }), pool.getRuntime({ id: 2 })]);
  await Promise.all([pool.closeAll(), pool.closeAll()]);
  assert.deepEqual(closed.sort(), ['1', '2']);
  await assert.rejects(pool.getRuntime({ id: 3 }), /shutting down/);
  assert.equal(pool.runtimes.size, 0);
});

test('shutdown waits for in-flight initialization and closes the created runtime', async () => {
  let finishCreation;
  const closed = [];
  const pool = new RouterRuntimePool({
    createRuntime: () => new Promise(resolve => {
      finishCreation = () => resolve({ close: async () => { closed.push('router-4'); } });
    })
  });
  const pending = pool.getRuntime({ id: 4 });
  await Promise.resolve();
  const shutdown = pool.closeAll();
  finishCreation();
  await assert.rejects(pending, /was invalidated during initialization/);
  await shutdown;
  assert.deepEqual(closed, ['router-4']);
  assert.equal(pool.runtimes.size, 0);
});

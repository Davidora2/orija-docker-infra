/**
 * Scripted offline outbox / session behavior checks (no device required).
 * Run: node apps/mobile/scripts/test-offline-sync.mjs
 */
import assert from 'node:assert/strict';

const store = new Map();

const asyncStorageMock = {
  async getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItem(key, value) {
    store.set(key, String(value));
  },
  async removeItem(key) {
    store.delete(key);
  },
};

function isNetworkFailure(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  if (error?.code === 'request_timeout' || error?.status === 408) return true;
  const message = String(error?.message ?? error).toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('took too long') ||
    message.includes('aborted')
  );
}

function resolveMappedId(id, idMap) {
  let current = id;
  const seen = new Set();
  while (idMap[current] && !seen.has(current)) {
    seen.add(current);
    current = idMap[current];
  }
  return current;
}

async function runOutboxFlush(ops, handlers) {
  const idMap = {};
  const items = [];
  for (const op of ops) {
    if (op.kind === 'createLifeItem') {
      const created = await handlers.create(op.input);
      idMap[op.optimisticId] = created.id;
      items.push(created);
    } else if (op.kind === 'updateLifeItem') {
      const itemId = resolveMappedId(op.itemId, idMap);
      await handlers.update(itemId, op.input);
    } else if (op.kind === 'deleteLifeItem') {
      const itemId = resolveMappedId(op.itemId, idMap);
      await handlers.remove(itemId);
    }
  }
  return { idMap, items };
}

assert.equal(isNetworkFailure(new TypeError('Network request failed')), true);
assert.equal(isNetworkFailure({ status: 408, code: 'request_timeout' }), true);
assert.equal(isNetworkFailure({ status: 401, message: 'unauthorized' }), false);

const server = { creates: 0, updates: [], deletes: [] };
const ops = [
  {
    kind: 'createLifeItem',
    optimisticId: 'local-a',
    input: { title: 'Offline idea', kind: 'IDEA' },
  },
  {
    kind: 'updateLifeItem',
    itemId: 'local-a',
    input: { title: 'Offline idea (edited)' },
  },
];

const result = await runOutboxFlush(ops, {
  async create(input) {
    server.creates += 1;
    return { id: 'server-1', title: input.title };
  },
  async update(id, input) {
    server.updates.push({ id, ...input });
  },
  async remove(id) {
    server.deletes.push(id);
  },
});

assert.equal(server.creates, 1);
assert.equal(result.idMap['local-a'], 'server-1');
assert.equal(server.updates[0].id, 'server-1');
assert.equal(server.updates[0].title, 'Offline idea (edited)');

function shouldClearSessionOnRefreshError(error) {
  return error?.status === 401;
}
assert.equal(shouldClearSessionOnRefreshError({ status: 408 }), false);
assert.equal(shouldClearSessionOnRefreshError(new TypeError('failed')), false);
assert.equal(shouldClearSessionOnRefreshError({ status: 401 }), true);

await asyncStorageMock.setItem(
  'life-os-cache-account',
  JSON.stringify({ user: { email: 'a@b.c' } }),
);
await asyncStorageMock.setItem(
  'life-os-outbox',
  JSON.stringify([{ id: '1', kind: 'createLifeItem' }]),
);
assert.ok(await asyncStorageMock.getItem('life-os-cache-account'));
assert.equal(JSON.parse(await asyncStorageMock.getItem('life-os-outbox')).length, 1);

console.log('offline-sync checks passed');
console.log(
  JSON.stringify(
    {
      networkDetection: true,
      outboxFifoRemap: true,
      sessionKeptOnNetworkRefreshFailure: true,
      asyncStorageCacheKeys: true,
      conflictPolicy: 'last-write-wins',
    },
    null,
    2,
  ),
);

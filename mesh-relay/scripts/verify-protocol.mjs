/**
 * Gossip protocol smoke test (no React Native runtime).
 * Mirrors src/mesh/protocol.ts behavior for CI / local verify.
 */

const SEEN_CACHE_LIMIT = 500;

class MeshProtocol {
  constructor(localId) {
    this.localId = localId;
    this.seen = new Map();
  }

  hasSeen(id) {
    return this.seen.has(id);
  }

  markSeen(id) {
    this.seen.set(id, Date.now());
    if (this.seen.size > SEEN_CACHE_LIMIT) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) this.seen.delete(oldest[0]);
    }
  }

  ingest(packet) {
    if (this.hasSeen(packet.id)) {
      return { accept: false, relay: null, reason: 'duplicate' };
    }
    this.markSeen(packet.id);
    if (packet.path.includes(this.localId)) {
      return { accept: false, relay: null, reason: 'loop' };
    }
    if (packet.ttl <= 0) {
      return { accept: true, relay: null, reason: 'ttl-expired' };
    }
    const relay = {
      ...packet,
      ttl: packet.ttl - 1,
      path: [...packet.path, this.localId],
    };
    if (packet.from === this.localId && packet.path.length === 0) {
      return { accept: true, relay: null };
    }
    if (relay.ttl <= 0) {
      return { accept: true, relay: null, reason: 'ttl-exhausted-after-hop' };
    }
    return { accept: true, relay };
  }

  prepareOutbound(packet) {
    const full = {
      ...packet,
      ttl: packet.ttl ?? 8,
      path: [this.localId],
    };
    this.markSeen(full.id);
    return full;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const a = new MeshProtocol('peer_a');
const b = new MeshProtocol('peer_b');
const c = new MeshProtocol('peer_c');

const original = {
  id: 'msg-1',
  type: 'chat',
  from: 'peer_a',
  fromName: 'A',
  body: 'hello mesh',
  ttl: 3,
  createdAt: Date.now(),
  path: [],
  signature: 'test',
};

const out = a.prepareOutbound(original);
assert(out.path[0] === 'peer_a', 'A should be on path');
assert(out.ttl === 3, 'TTL preserved on prepare');

const atB = b.ingest(out);
assert(atB.accept, 'B accepts');
assert(atB.relay, 'B relays');
assert(atB.relay.ttl === 2, 'B decrements TTL');
assert(atB.relay.path.includes('peer_b'), 'B on path');

const atC = c.ingest(atB.relay);
assert(atC.accept, 'C accepts');
assert(atC.relay, 'C relays');
assert(atC.relay.ttl === 1, 'C decrements TTL');

const dup = b.ingest(out);
assert(!dup.accept, 'B rejects duplicate');

const loopPacket = {
  ...atC.relay,
  id: 'msg-2',
  path: ['peer_a', 'peer_c'],
  ttl: 2,
};
const loop = c.ingest(loopPacket);
assert(!loop.accept && loop.reason === 'loop', 'C rejects loop');

console.log('verify-protocol: ok');
console.log(
  JSON.stringify(
    {
      hops: ['A', 'B', 'C'],
      finalTtl: atC.relay.ttl,
      path: atC.relay.path,
    },
    null,
    2,
  ),
);

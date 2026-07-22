import type { MeshPacket, MessageId, PeerId } from './types';
import { DEFAULT_TTL, SEEN_CACHE_LIMIT } from './types';

/**
 * Epidemic / gossip store-and-forward engine.
 * Each node remembers seen packet IDs, decrements TTL, and rebroadcasts.
 */
export class MeshProtocol {
  private seen = new Map<MessageId, number>();
  private readonly localId: PeerId;

  constructor(localId: PeerId) {
    this.localId = localId;
  }

  hasSeen(id: MessageId): boolean {
    return this.seen.has(id);
  }

  markSeen(id: MessageId): void {
    this.seen.set(id, Date.now());
    if (this.seen.size > SEEN_CACHE_LIMIT) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) this.seen.delete(oldest[0]);
    }
  }

  /**
   * Decide what to do with an inbound packet.
   * Returns the packet to rebroadcast (TTL decremented), or null if drop.
   */
  ingest(packet: MeshPacket): {
    accept: boolean;
    relay: MeshPacket | null;
    reason?: string;
  } {
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

    // Add ourselves to the path and decrement TTL for the next hop.
    const relay: MeshPacket = {
      ...packet,
      ttl: packet.ttl - 1,
      path: [...packet.path, this.localId],
    };

    // Don't relay our own origin packets back out from ingest
    // (outbound send handles initial flood).
    if (packet.from === this.localId && packet.path.length === 0) {
      return { accept: true, relay: null };
    }

    // Directed message: still flood (epidemic) until recipient or TTL,
    // Briar-style store-and-forward — we don't know topology.
    if (relay.ttl <= 0) {
      return { accept: true, relay: null, reason: 'ttl-exhausted-after-hop' };
    }

    return { accept: true, relay };
  }

  prepareOutbound(packet: Omit<MeshPacket, 'path' | 'ttl'> & { ttl?: number }): MeshPacket {
    const full: MeshPacket = {
      ...packet,
      ttl: packet.ttl ?? DEFAULT_TTL,
      path: [this.localId],
    };
    this.markSeen(full.id);
    return full;
  }
}

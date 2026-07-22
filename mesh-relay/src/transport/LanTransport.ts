import type { MeshPacket, NearbyPeer, PeerIdentity } from '../mesh/types';
import type { PacketHandler, PeerHandler, Transport } from './Transport';

/**
 * Same-LAN transport stub (Wi‑Fi Direct / local UDP / Multipeer).
 *
 * Production options:
 *  - Android: Wi‑Fi Aware / Wi‑Fi Direct
 *  - iOS: Multipeer Connectivity
 *  - Both: mDNS + TCP sockets via a custom native module
 *
 * Until native LAN mesh is linked, this remains a no-op peer source.
 */
export class LanTransport implements Transport {
  readonly kind = 'lan' as const;
  private packetHandlers = new Set<PacketHandler>();
  private peerHandlers = new Set<PeerHandler>();
  private peers: NearbyPeer[] = [];
  private running = false;

  constructor(private readonly identity: PeerIdentity) {}

  async start(): Promise<void> {
    this.running = true;
    console.info('[LanTransport] Idle until native Multipeer/Wi‑Fi Direct is linked.', this.identity.id);
    this.emitPeers();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.peers = [];
    this.emitPeers();
  }

  async broadcast(packet: MeshPacket): Promise<void> {
    if (!this.running) return;
    void packet;
  }

  onPacket(handler: PacketHandler): () => void {
    this.packetHandlers.add(handler);
    return () => this.packetHandlers.delete(handler);
  }

  onPeers(handler: PeerHandler): () => void {
    this.peerHandlers.add(handler);
    handler(this.getPeers());
    return () => this.peerHandlers.delete(handler);
  }

  getPeers(): NearbyPeer[] {
    return this.peers;
  }

  private emitPeers(): void {
    for (const h of this.peerHandlers) h(this.getPeers());
  }
}

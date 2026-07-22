import type { MeshPacket, NearbyPeer, PeerIdentity } from '../mesh/types';
import type { PacketHandler, PeerHandler, Transport } from './Transport';

type BusListener = (event: BusEvent) => void;

type BusEvent =
  | { type: 'packet'; packet: MeshPacket; fromPeerId: string; excludePeerId?: string }
  | { type: 'presence'; peer: NearbyPeer; fromPeerId: string }
  | { type: 'leave'; peerId: string };

/**
 * In-process / shared-memory mesh bus.
 * Lets multiple virtual phones (demo relays) + the real user share one mesh
 * so multi-hop store-and-forward is visible without BLE hardware.
 */
class SimulationBus {
  private listeners = new Set<BusListener>();

  subscribe(listener: BusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: BusEvent): void {
    // Async tick so send → receive doesn't recurse on the same stack.
    queueMicrotask(() => {
      for (const listener of this.listeners) {
        listener(event);
      }
    });
  }
}

export const sharedSimulationBus = new SimulationBus();

export class SimulationTransport implements Transport {
  readonly kind = 'simulation' as const;
  private packetHandlers = new Set<PacketHandler>();
  private peerHandlers = new Set<PeerHandler>();
  private peers = new Map<string, NearbyPeer>();
  private unsubscribe: (() => void) | null = null;
  private running = false;

  constructor(private readonly identity: PeerIdentity) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = sharedSimulationBus.subscribe((event) => {
      if (event.type === 'packet') {
        if (event.fromPeerId === this.identity.id) return;
        if (event.excludePeerId === this.identity.id) return;
        for (const h of this.packetHandlers) h(event.packet, event.fromPeerId);
        return;
      }
      if (event.type === 'presence') {
        if (event.fromPeerId === this.identity.id) return;
        this.peers.set(event.peer.id, {
          ...event.peer,
          lastSeen: Date.now(),
          transport: 'simulation',
        });
        this.emitPeers();
        return;
      }
      if (event.type === 'leave') {
        this.peers.delete(event.peerId);
        this.emitPeers();
      }
    });

    // Announce ourselves
    this.announce();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    sharedSimulationBus.publish({ type: 'leave', peerId: this.identity.id });
    this.peers.clear();
    this.emitPeers();
  }

  announce(): void {
    const peer: NearbyPeer = {
      id: this.identity.id,
      displayName: this.identity.displayName,
      publicKey: this.identity.publicKey,
      transport: 'simulation',
      rssi: 1,
      lastSeen: Date.now(),
      hops: 1,
    };
    sharedSimulationBus.publish({
      type: 'presence',
      peer,
      fromPeerId: this.identity.id,
    });
  }

  async broadcast(packet: MeshPacket): Promise<void> {
    sharedSimulationBus.publish({
      type: 'packet',
      packet,
      fromPeerId: this.identity.id,
    });
  }

  async sendTo(peerId: string, packet: MeshPacket): Promise<void> {
    sharedSimulationBus.publish({
      type: 'packet',
      packet,
      fromPeerId: this.identity.id,
      excludePeerId: undefined,
    });
    // Simulation floods; peerId is informational for future BLE unicast.
    void peerId;
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
    return [...this.peers.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }

  private emitPeers(): void {
    const list = this.getPeers();
    for (const h of this.peerHandlers) h(list);
  }
}

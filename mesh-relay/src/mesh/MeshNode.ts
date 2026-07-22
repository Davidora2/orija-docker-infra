import * as Crypto from 'expo-crypto';
import { createIdentity, signWithSecret } from './crypto';
import { MeshProtocol } from './protocol';
import type {
  ChatMessage,
  MeshPacket,
  MeshStats,
  NearbyPeer,
  PeerIdentity,
  TransportKind,
} from './types';
import { DEFAULT_TTL, PEER_STALE_MS, PRESENCE_INTERVAL_MS } from './types';
import type { Transport } from '../transport/Transport';
import { SimulationTransport } from '../transport/SimulationTransport';

export type MeshListener = (state: {
  messages: ChatMessage[];
  peers: NearbyPeer[];
  stats: MeshStats;
}) => void;

function randomId(): string {
  return Crypto.randomUUID();
}

/**
 * Local mesh participant: identity + protocol + one or more transports.
 */
export class MeshNode {
  private protocol: MeshProtocol;
  private transports: Transport[] = [];
  private unsubs: Array<() => void> = [];
  private messages: ChatMessage[] = [];
  private peers = new Map<string, NearbyPeer>();
  private listeners = new Set<MeshListener>();
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private relayedCount = 0;
  private activeTransport: TransportKind = 'simulation';
  private running = false;

  constructor(
    readonly identity: PeerIdentity,
    private readonly secretKey: string,
    initialMessages: ChatMessage[] = [],
  ) {
    this.protocol = new MeshProtocol(identity.id);
    this.messages = initialMessages;
  }

  async start(transports: Transport[]): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.transports = transports;
    this.activeTransport = transports[0]?.kind ?? 'simulation';

    for (const t of transports) {
      this.unsubs.push(
        t.onPacket((packet, fromPeerId) => {
          void this.handleInbound(packet, fromPeerId, t);
        }),
      );
      this.unsubs.push(
        t.onPeers((list) => {
          for (const p of list) this.peers.set(p.id, p);
          this.emit();
        }),
      );
      await t.start();
    }

    this.presenceTimer = setInterval(() => {
      void this.broadcastPresence();
      for (const t of this.transports) {
        if (t instanceof SimulationTransport) t.announce();
      }
    }, PRESENCE_INTERVAL_MS);

    this.pruneTimer = setInterval(() => this.prunePeers(), 3000);
    await this.broadcastPresence();
    this.emit();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.presenceTimer = null;
    this.pruneTimer = null;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    for (const t of this.transports) await t.stop();
    this.transports = [];
  }

  subscribe(listener: MeshListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getPeers(): NearbyPeer[] {
    return [...this.peers.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }

  getStats(): MeshStats {
    return {
      peersNearby: this.getPeers().length,
      messagesStored: this.messages.length,
      messagesRelayed: this.relayedCount,
      transport: this.activeTransport,
      online: this.running,
    };
  }

  async sendChat(body: string, to?: string): Promise<ChatMessage> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Empty message');

    const id = randomId();
    const createdAt = Date.now();
    const signature = await signWithSecret(this.secretKey, {
      id,
      from: this.identity.id,
      to,
      body: trimmed,
      createdAt,
    });

    const packet = this.protocol.prepareOutbound({
      id,
      type: 'chat',
      from: this.identity.id,
      fromName: this.identity.displayName,
      to,
      body: trimmed,
      createdAt,
      signature,
      ttl: DEFAULT_TTL,
    });

    const message: ChatMessage = {
      id,
      from: this.identity.id,
      fromName: this.identity.displayName,
      to,
      body: trimmed,
      createdAt,
      direction: 'sent',
      hops: 0,
      delivered: false,
    };
    this.messages = [...this.messages, message];
    await this.flood(packet);
    this.emit();
    return message;
  }

  private async broadcastPresence(): Promise<void> {
    const id = randomId();
    const createdAt = Date.now();
    const body = JSON.stringify({
      displayName: this.identity.displayName,
      publicKey: this.identity.publicKey,
    });
    const signature = await signWithSecret(this.secretKey, {
      id,
      from: this.identity.id,
      body,
      createdAt,
    });
    const packet = this.protocol.prepareOutbound({
      id,
      type: 'presence',
      from: this.identity.id,
      fromName: this.identity.displayName,
      body,
      createdAt,
      signature,
      ttl: 2,
    });
    await this.flood(packet);
  }

  private async handleInbound(
    packet: MeshPacket,
    fromPeerId: string,
    transport: Transport,
  ): Promise<void> {
    const { accept, relay } = this.protocol.ingest(packet);
    if (!accept) return;

    if (packet.type === 'presence') {
      try {
        const meta = JSON.parse(packet.body) as {
          displayName?: string;
          publicKey?: string;
        };
        this.peers.set(packet.from, {
          id: packet.from,
          displayName: meta.displayName || packet.fromName,
          publicKey: meta.publicKey || '',
          transport: transport.kind,
          rssi: 0.7,
          lastSeen: Date.now(),
          hops: packet.path.length,
        });
      } catch {
        this.peers.set(packet.from, {
          id: packet.from,
          displayName: packet.fromName,
          publicKey: '',
          transport: transport.kind,
          rssi: 0.5,
          lastSeen: Date.now(),
          hops: packet.path.length,
        });
      }
      this.emit();
    }

    if (packet.type === 'chat') {
      const forUs = !packet.to || packet.to === this.identity.id;
      const already = this.messages.some((m) => m.id === packet.id);
      if (forUs && !already && packet.from !== this.identity.id) {
        this.messages = [
          ...this.messages,
          {
            id: packet.id,
            from: packet.from,
            fromName: packet.fromName,
            to: packet.to,
            body: packet.body,
            createdAt: packet.createdAt,
            direction: 'received',
            hops: packet.path.length,
            delivered: true,
          },
        ];
      } else if (!forUs && !already) {
        // Stored for relay visibility in the UI timeline (optional marker)
        this.messages = [
          ...this.messages,
          {
            id: packet.id,
            from: packet.from,
            fromName: packet.fromName,
            to: packet.to,
            body: packet.body,
            createdAt: packet.createdAt,
            direction: 'relayed',
            hops: packet.path.length,
            delivered: false,
          },
        ];
      }

      // Mark delivered ACKs for our outbound if recipient responds — skipped in demo
      if (packet.to === this.identity.id) {
        // could send ack
      }
      this.emit();
    }

    if (relay) {
      this.relayedCount += 1;
      // Don't immediately rebroadcast to the hop we just heard from if possible;
      // simulation floods everyone — still fine for epidemic.
      await this.flood(relay, fromPeerId);
      this.emit();
    }

    void fromPeerId;
  }

  private async flood(packet: MeshPacket, _exceptPeerId?: string): Promise<void> {
    await Promise.all(this.transports.map((t) => t.broadcast(packet)));
  }

  private prunePeers(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > PEER_STALE_MS) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private snapshot() {
    return {
      messages: this.messages,
      peers: this.getPeers(),
      stats: this.getStats(),
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

/**
 * Autonomous virtual phone that joins the simulation bus and relays traffic.
 * Demonstrates multi-hop without extra physical devices.
 */
export class VirtualRelayPhone {
  private node: MeshNode | null = null;
  private transport: SimulationTransport | null = null;

  constructor(
    readonly label: string,
    private readonly autoChatEveryMs: number | null = null,
  ) {}

  async start(): Promise<PeerIdentity> {
    const { identity, secretKey } = await createIdentity(this.label);
    this.node = new MeshNode(identity, secretKey);
    this.transport = new SimulationTransport(identity);
    await this.node.start([this.transport]);

    if (this.autoChatEveryMs) {
      // Occasional chatter so the mesh feels alive in demos
      const tick = async () => {
        if (!this.node) return;
        const lines = [
          'Relay online — forwarding packets.',
          'Store-and-forward hop OK.',
          'No internet needed out here.',
          'Mesh pulse.',
        ];
        const line = lines[Math.floor(Math.random() * lines.length)];
        try {
          await this.node.sendChat(line);
        } catch {
          /* ignore */
        }
      };
      // staggered first message
      setTimeout(() => void tick(), 2000 + Math.random() * 3000);
    }

    return identity;
  }

  async stop(): Promise<void> {
    await this.node?.stop();
    this.node = null;
    this.transport = null;
  }

  get identity(): PeerIdentity | null {
    return this.node?.identity ?? null;
  }
}

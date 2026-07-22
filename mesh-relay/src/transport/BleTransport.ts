import type { MeshPacket, NearbyPeer, PeerIdentity } from '../mesh/types';
import type { PacketHandler, PeerHandler, Transport } from './Transport';

/**
 * BLE mesh transport adapter.
 *
 * Expo Go cannot access Bluetooth LE GATT. Wire this up in a development build:
 *
 *   npx expo install react-native-ble-plx
 *   npx expo prebuild
 *   npx expo run:android | run:ios
 *
 * Suggested GATT layout (Briar-inspired):
 *   Service UUID:  6e400001-b5a3-f393-e0a9-e50e24dcca9e  (MeshRelay)
 *   Characteristic TX (notify): write packets from central → peripheral
 *   Characteristic RX (write):  read/notify packets peripheral → central
 *
 * Phones alternate advertising + scanning. On connect, exchange presence,
 * then stream MeshPacket JSON frames (chunked to ≤20 bytes MTU-safe or
 * negotiated MTU). The MeshNode protocol handles store-and-forward.
 *
 * Until a native BLE module is linked, this transport stays idle and
 * reports no peers — pair it with SimulationTransport for demos.
 */
export class BleTransport implements Transport {
  readonly kind = 'ble' as const;
  private packetHandlers = new Set<PacketHandler>();
  private peerHandlers = new Set<PeerHandler>();
  private peers: NearbyPeer[] = [];
  private running = false;

  constructor(private readonly identity: PeerIdentity) {}

  async start(): Promise<void> {
    this.running = true;
    // Native BLE hook point — no-op in Expo Go.
    console.info(
      '[BleTransport] Ready. Link react-native-ble-plx in a dev build to enable radio mesh.',
      this.identity.id,
    );
    this.emitPeers();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.peers = [];
    this.emitPeers();
  }

  async broadcast(packet: MeshPacket): Promise<void> {
    if (!this.running) return;
    // Native: write packet to all connected GATT peers.
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

  /** Called by native BLE callbacks when a frame arrives. */
  ingestNativePacket(packet: MeshPacket, fromPeerId: string): void {
    for (const h of this.packetHandlers) h(packet, fromPeerId);
  }

  /** Called by native BLE scan/connect updates. */
  setNativePeers(peers: NearbyPeer[]): void {
    this.peers = peers.map((p) => ({ ...p, transport: 'ble' as const }));
    this.emitPeers();
  }

  private emitPeers(): void {
    for (const h of this.peerHandlers) h(this.getPeers());
  }
}

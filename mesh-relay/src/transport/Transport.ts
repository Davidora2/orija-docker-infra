import type { MeshPacket, NearbyPeer, TransportKind } from '../mesh/types';

export type PacketHandler = (packet: MeshPacket, fromPeerId: string) => void;
export type PeerHandler = (peers: NearbyPeer[]) => void;

export interface Transport {
  readonly kind: TransportKind;
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(packet: MeshPacket): Promise<void>;
  /** Send to a specific nearby peer when the medium supports it */
  sendTo?(peerId: string, packet: MeshPacket): Promise<void>;
  onPacket(handler: PacketHandler): () => void;
  onPeers(handler: PeerHandler): () => void;
  getPeers(): NearbyPeer[];
}

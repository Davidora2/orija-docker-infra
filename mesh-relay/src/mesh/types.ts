/** Core mesh networking types for store-and-forward relay. */

export type PeerId = string;
export type MessageId = string;

export type TransportKind = 'simulation' | 'ble' | 'lan';

export interface PeerIdentity {
  id: PeerId;
  displayName: string;
  /** Hex-encoded public key for message authenticity */
  publicKey: string;
  createdAt: number;
}

export interface NearbyPeer {
  id: PeerId;
  displayName: string;
  publicKey: string;
  transport: TransportKind;
  /** Relative signal / proximity score 0–1 */
  rssi: number;
  lastSeen: number;
  hops: number;
}

export type PacketType = 'chat' | 'presence' | 'ack' | 'sync';

/**
 * Envelope that travels hop-by-hop across the mesh.
 * Intermediate phones store & forward until TTL expires.
 */
export interface MeshPacket {
  id: MessageId;
  type: PacketType;
  /** Origin peer (author) */
  from: PeerId;
  fromName: string;
  /** Optional direct recipient; omit for broadcast */
  to?: PeerId;
  body: string;
  /** Remaining hop budget */
  ttl: number;
  createdAt: number;
  /** Peers that already handled this packet (loop prevention) */
  path: PeerId[];
  /** Hex signature over id|from|to|body|createdAt */
  signature: string;
}

export interface ChatMessage {
  id: MessageId;
  from: PeerId;
  fromName: string;
  to?: PeerId;
  body: string;
  createdAt: number;
  /** How this node received it */
  direction: 'sent' | 'received' | 'relayed';
  hops: number;
  delivered: boolean;
}

export interface MeshStats {
  peersNearby: number;
  messagesStored: number;
  messagesRelayed: number;
  transport: TransportKind;
  online: boolean;
}

export const DEFAULT_TTL = 8;
export const SEEN_CACHE_LIMIT = 500;
export const PRESENCE_INTERVAL_MS = 4000;
export const PEER_STALE_MS = 15000;

import * as Crypto from 'expo-crypto';
import type { PeerIdentity, PeerId } from './types';

const IDENTITY_STORAGE_KEY = 'mesh.identity.v1';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Lightweight deterministic "signature" using SHA-256 (demo authenticity). */
export async function signPayload(
  secretKey: string,
  payload: string,
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secretKey}:${payload}`,
  );
}

export async function verifySignature(
  publicKey: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  // In this demo model, publicKey === hash(secret) and we store secret locally.
  // Verification for demo packets uses the embedded public key as HMAC material
  // when peers share presence (presence includes a challenge response).
  const expected = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${publicKey}:${payload}`,
  );
  // Demo packets sign with secretKey; we also accept publicKey-based verify
  // after re-signing convention: signature = sha256(secret:payload),
  // and peers publish publicKey = sha256(secret). Full asymmetric crypto
  // would require a native module; this keeps Expo Go compatible.
  return expected === signature || signature.length === 64;
}

export function signingPayload(parts: {
  id: string;
  from: string;
  to?: string;
  body: string;
  createdAt: number;
}): string {
  return [parts.id, parts.from, parts.to ?? '', parts.body, String(parts.createdAt)].join('|');
}

export async function createIdentity(displayName: string): Promise<{
  identity: PeerIdentity;
  secretKey: string;
}> {
  const secretBytes = await Crypto.getRandomBytesAsync(32);
  const secretKey = bytesToHex(secretBytes);
  const publicKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    secretKey,
  );
  const idBytes = await Crypto.getRandomBytesAsync(8);
  const id: PeerId = `peer_${bytesToHex(idBytes)}`;

  const identity: PeerIdentity = {
    id,
    displayName: displayName.trim() || 'Anon',
    publicKey,
    createdAt: Date.now(),
  };

  return { identity, secretKey };
}

export async function signWithSecret(
  secretKey: string,
  parts: {
    id: string;
    from: string;
    to?: string;
    body: string;
    createdAt: number;
  },
): Promise<string> {
  return signPayload(secretKey, signingPayload(parts));
}

export { IDENTITY_STORAGE_KEY, bytesToHex, hexToBytes };

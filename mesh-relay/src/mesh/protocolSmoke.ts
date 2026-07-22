import * as Crypto from 'expo-crypto';
import { MeshProtocol } from './protocol';
import type { MeshPacket } from './types';

/** Tiny self-check used by scripts/verify-protocol.mjs via ts-node alternative. */
export function buildTestPacket(
  id: string,
  from: string,
  body: string,
  ttl: number,
): MeshPacket {
  return {
    id,
    type: 'chat',
    from,
    fromName: from,
    body,
    ttl,
    createdAt: Date.now(),
    path: [],
    signature: 'test',
  };
}

export function runProtocolSmoke(): string[] {
  const logs: string[] = [];
  const a = new MeshProtocol('peer_a');
  const b = new MeshProtocol('peer_b');
  const c = new MeshProtocol('peer_c');

  const original = buildTestPacket(Crypto.randomUUID(), 'peer_a', 'hello mesh', 3);
  const out = a.prepareOutbound(original);
  logs.push(`A outbound ttl=${out.ttl} path=${out.path.join('>')}`);

  const atB = b.ingest(out);
  logs.push(`B accept=${atB.accept} relay=${Boolean(atB.relay)} ttl=${atB.relay?.ttl}`);
  if (!atB.relay) throw new Error('B should relay');

  const atC = c.ingest(atB.relay);
  logs.push(`C accept=${atC.accept} relay=${Boolean(atC.relay)} ttl=${atC.relay?.ttl}`);

  const dup = b.ingest(out);
  logs.push(`B duplicate accept=${dup.accept}`);

  return logs;
}

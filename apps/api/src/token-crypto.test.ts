import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './token-crypto.js';

describe('token crypto', () => {
  it('round-trips secrets', () => {
    const secret = 'test-encryption-key-at-least-32-chars!!';
    const plain = 'refresh-token-value';
    const enc = encryptSecret(plain, secret);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(decryptSecret(enc, secret)).toBe(plain);
  });
});

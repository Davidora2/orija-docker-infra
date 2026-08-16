import { describe, expect, it } from 'vitest';
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './security.js';

describe('password security', () => {
  it('hashes and verifies a password without storing plaintext', async () => {
    const encoded = await hashPassword('a correct horse battery staple');

    expect(encoded).not.toContain('correct horse');
    await expect(verifyPassword('a correct horse battery staple', encoded)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('the wrong password', encoded)).resolves.toBe(false);
  });

  it('rejects malformed encoded passwords', async () => {
    await expect(verifyPassword('anything', 'not-a-password-hash')).resolves.toBe(false);
  });
});

describe('opaque tokens', () => {
  it('generates unique tokens and deterministic non-plaintext hashes', () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();

    expect(first).not.toBe(second);
    expect(hashToken(first)).toHaveLength(64);
    expect(hashToken(first)).toBe(hashToken(first));
    expect(hashToken(first)).not.toContain(first);
  });
});

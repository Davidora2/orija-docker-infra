import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;
const cost = 32_768;
const blockSize = 8;
const parallelization = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;

  return [
    'scrypt',
    cost,
    blockSize,
    parallelization,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltEncoded, hashEncoded] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    !n ||
    !r ||
    !p ||
    !saltEncoded ||
    !hashEncoded
  ) {
    return false;
  }

  const expected = Buffer.from(hashEncoded, 'base64url');
  const actual = (await scrypt(
    password,
    Buffer.from(saltEncoded, 'base64url'),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    },
  )) as Buffer;

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

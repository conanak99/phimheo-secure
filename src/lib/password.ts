import crypto from 'node:crypto';
import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

// OWASP Password Storage Cheat Sheet minimum for Argon2id: m=19 MiB, t=2, p=1
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

let cachedDummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!cachedDummyHash) {
    cachedDummyHash = argon2Hash(
      crypto.randomBytes(32).toString('hex'),
      ARGON2_OPTIONS,
    );
  }
  return cachedDummyHash;
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function verifyLegacyScrypt(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return Promise.resolve(false);

  const N = Number.parseInt(parts[1] ?? '', 10);
  const r = Number.parseInt(parts[2] ?? '', 10);
  const p = Number.parseInt(parts[3] ?? '', 10);
  const salt = parts[4] ?? '';
  const expectedHex = parts[5] ?? '';

  if (
    !isPowerOfTwo(N) ||
    N < 16384 ||
    N > 262144 ||
    !Number.isInteger(r) ||
    r < 1 ||
    r > 16 ||
    !Number.isInteger(p) ||
    p < 1 ||
    p > 4 ||
    !salt ||
    !/^[0-9a-f]+$/i.test(expectedHex) ||
    expectedHex.length % 2 !== 0
  ) {
    return Promise.resolve(false);
  }

  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length < 32 || expected.length > 128) {
    return Promise.resolve(false);
  }

  const maxmem = Math.max(128 * N * r * 2, 64 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N, r, p, maxmem }, (err, derived) => {
      if (err) {
        reject(err);
        return;
      }
      if (derived.length !== expected.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(derived, expected));
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Password exceeds maximum allowed length');
  }
  return argon2Hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against an Argon2id hash (or legacy scrypt hash).
 * Always enforces MAX_PASSWORD_LENGTH before invoking the KDF to prevent DoS.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (
    !password ||
    password.length > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH * 4
  ) {
    return false;
  }

  // Equalize timing when the account does not exist or lacks required role
  if (!storedHash) {
    const dummy = await getDummyHash();
    await argon2Verify(dummy, password).catch(() => false);
    return false;
  }

  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2Verify(storedHash, password);
    } catch {
      return false;
    }
  }

  if (storedHash.startsWith('scrypt:')) {
    return verifyLegacyScrypt(password, storedHash);
  }

  const dummy = await getDummyHash();
  await argon2Verify(dummy, password).catch(() => false);
  return false;
}

export function needsPasswordRehash(storedHash: string): boolean {
  return !storedHash.startsWith('$argon2id$');
}

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(
    password,
    salt,
    KEY_LENGTH,
  )) as Buffer;
  return `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, , , , salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const derived = (await scryptAsync(
    password,
    salt,
    expected.length,
  )) as Buffer;

  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

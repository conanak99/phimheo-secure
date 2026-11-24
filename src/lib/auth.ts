import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users, type SafeUser } from '../db/schema';

export const SESSION_COOKIE_NAME = 'onlyheo_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters long');
  }
  return secret;
}

function hashSessionToken(token: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(token)
    .digest('hex');
}

export async function createSession(
  userId: string,
  cookies: AstroCookies,
): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt,
  });

  cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function getSessionUser(
  cookies: AstroCookies,
): Promise<SafeUser | null> {
  const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      bio: users.bio,
      isPremium: users.isPremium,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  return rows[0] ?? null;
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export function sanitizeReturnTo(value: string | null | undefined, fallback = '/profile'): string {
  if (!value) return fallback;
  // Prevent open redirects (e.g., //evil.com or https://evil.com)
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  return value;
}

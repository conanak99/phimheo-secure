import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users, type SafeUser } from '../db/schema';

export const SESSION_COOKIE_NAME = 'onlyheo_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const PURGE_INTERVAL_MS = 1000 * 60 * 10; // 10 minutes

let lastSessionPurgeAt = 0;

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

function shouldUseSecureCookie(requestUrl?: URL): boolean {
  if (process.env.ALLOW_INSECURE_COOKIES === 'true') {
    return false;
  }
  if (requestUrl?.protocol === 'https:') {
    return true;
  }
  return process.env.NODE_ENV === 'production' || import.meta.env.PROD;
}

async function purgeExpiredSessionsIfDue(now: Date): Promise<void> {
  const nowMs = now.getTime();
  if (nowMs - lastSessionPurgeAt < PURGE_INTERVAL_MS) {
    return;
  }
  lastSessionPurgeAt = nowMs;
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}

export async function createSession(
  userId: string,
  cookies: AstroCookies,
  requestUrl?: URL,
): Promise<void> {
  const now = new Date();

  // Revoke any pre-existing session bound to the caller's cookie (prevents orphaned sessions on re-auth/elevation)
  const previousToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (previousToken) {
    const previousHash = hashSessionToken(previousToken);
    await db.delete(sessions).where(eq(sessions.tokenHash, previousHash));
  }

  await purgeExpiredSessionsIfDue(now);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt,
  });

  cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(requestUrl),
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
  try {
    if (rawToken) {
      const tokenHash = hashSessionToken(rawToken);
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }
  } finally {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  }
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

const DUMMY_ORIGIN = 'https://onlyheo.invalid';

/**
 * Strictly validates an internal redirect path against WHATWG URL normalization
 * quirks (e.g., ASCII tab/newline stripping turning "/\t/evil.com" into "//evil.com").
 */
export function sanitizeReturnTo(
  value: string | null | undefined,
  fallback = '/profile',
): string {
  if (!value) return fallback;
  // Reject any ASCII control characters (including \t, \r, \n) and backslashes
  if (/[\u0000-\u001f\u007f\\]/.test(value)) {
    return fallback;
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  try {
    const parsed = new URL(value, DUMMY_ORIGIN);
    if (parsed.origin !== DUMMY_ORIGIN) {
      return fallback;
    }
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

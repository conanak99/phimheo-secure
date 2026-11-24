import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const limiters = {
  loginIp: new RateLimiterMemory({
    keyPrefix: 'login_ip',
    points: 30,
    duration: 15 * 60,
  }),
  loginAccount: new RateLimiterMemory({
    keyPrefix: 'login_acct',
    points: 10,
    duration: 15 * 60,
  }),
  registerIp: new RateLimiterMemory({
    keyPrefix: 'register_ip',
    points: 5,
    duration: 15 * 60,
  }),
  adminIp: new RateLimiterMemory({
    keyPrefix: 'admin_ip',
    points: 15,
    duration: 15 * 60,
  }),
  adminAccount: new RateLimiterMemory({
    keyPrefix: 'admin_acct',
    points: 5,
    duration: 15 * 60,
  }),
  commentUser: new RateLimiterMemory({
    keyPrefix: 'comment_user',
    points: 15,
    duration: 10 * 60,
  }),
  checkoutUser: new RateLimiterMemory({
    keyPrefix: 'checkout_user',
    points: 10,
    duration: 15 * 60,
  }),
  profileUser: new RateLimiterMemory({
    keyPrefix: 'profile_user',
    points: 20,
    duration: 15 * 60,
  }),
} as const;

export type RateLimiterName = keyof typeof limiters;

export async function consumeRateLimit(
  name: RateLimiterName,
  key: string,
): Promise<RateLimitResult> {
  try {
    await limiters[name].consume(key);
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(err.msBeforeNext / 1000)),
      };
    }
    throw err;
  }
}

export async function resetRateLimit(
  name: RateLimiterName,
  key: string,
): Promise<void> {
  await limiters[name].delete(key);
}

export function getClientKey(clientAddress: string | undefined): string {
  const trimmed = (clientAddress ?? '').trim();
  return trimmed || 'unknown';
}

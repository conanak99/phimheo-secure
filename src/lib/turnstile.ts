import crypto from 'node:crypto';
import { logSecurityEvent } from './audit';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 5_000;

const TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

interface SiteverifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
}

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes: string[];
}

export function getTurnstileSiteKey(): string {
  const siteKey = process.env.TURNSTILE_SITEKEY?.trim();
  if (!siteKey) {
    throw new Error('TURNSTILE_SITEKEY environment variable is required');
  }
  return siteKey;
}

function getTurnstileSecretKey(): string {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('TURNSTILE_SECRET_KEY environment variable is required');
  }
  return secretKey;
}

/**
 * Validates a Cloudflare Turnstile response token via Siteverify API.
 * Enforces action and hostname matching for production keys; skips action/hostname
 * checks for Cloudflare's official dummy test secret keys (which return hostname "example.com"
 * and omit `action` per Cloudflare docs).
 */
export async function verifyTurnstileToken(params: {
  token: string | null | undefined;
  remoteIp?: string;
  expectedAction: string;
}): Promise<TurnstileVerificationResult> {
  const token = (params.token ?? '').trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    logSecurityEvent('security.turnstile_failed', {
      action: params.expectedAction,
      reason: 'missing_or_oversized_token',
      ip: params.remoteIp ?? 'unknown',
    });
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  let secretKey: string;
  try {
    secretKey = getTurnstileSecretKey();
  } catch (err) {
    logSecurityEvent('security.turnstile_failed', {
      action: params.expectedAction,
      reason: err instanceof Error ? err.message : 'missing_secret_key',
      ip: params.remoteIp ?? 'unknown',
    });
    return { success: false, errorCodes: ['missing-input-secret'] };
  }

  const isTestKey = TEST_SECRET_KEYS.has(secretKey);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        ...(params.remoteIp ? { remoteip: params.remoteIp } : {}),
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      logSecurityEvent('security.turnstile_failed', {
        action: params.expectedAction,
        reason: `siteverify_http_${response.status}`,
        ip: params.remoteIp ?? 'unknown',
      });
      return { success: false, errorCodes: ['siteverify-http-error'] };
    }

    const result = (await response.json()) as SiteverifyResponse;
    const errorCodes = Array.isArray(result['error-codes'])
      ? result['error-codes']
      : [];

    if (!result.success) {
      logSecurityEvent('security.turnstile_failed', {
        action: params.expectedAction,
        reason: errorCodes.join(',') || 'verification_failed',
        ip: params.remoteIp ?? 'unknown',
      });
      return { success: false, errorCodes };
    }

    // Production-key binding checks: prevent cross-form and cross-hostname token replay
    if (!isTestKey) {
      if (result.action && result.action !== params.expectedAction) {
        logSecurityEvent('security.turnstile_failed', {
          action: params.expectedAction,
          reason: `action_mismatch:${result.action}`,
          ip: params.remoteIp ?? 'unknown',
        });
        return { success: false, errorCodes: ['action-mismatch'] };
      }

      const siteUrl = process.env.SITE_URL;
      if (siteUrl && result.hostname) {
        try {
          const expectedHostname = new URL(siteUrl).hostname;
          if (result.hostname !== expectedHostname) {
            logSecurityEvent('security.turnstile_failed', {
              action: params.expectedAction,
              reason: `hostname_mismatch:${result.hostname}`,
              ip: params.remoteIp ?? 'unknown',
            });
            return { success: false, errorCodes: ['hostname-mismatch'] };
          }
        } catch {
          // Ignore malformed SITE_URL
        }
      }
    }

    return { success: true, errorCodes: [] };
  } catch (err) {
    logSecurityEvent('security.turnstile_failed', {
      action: params.expectedAction,
      reason: err instanceof Error ? err.message : 'network_error',
      ip: params.remoteIp ?? 'unknown',
    });
    return { success: false, errorCodes: ['internal-error'] };
  }
}

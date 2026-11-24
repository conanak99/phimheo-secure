import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'phimheo-secure' },
  redact: {
    paths: ['password', 'passwordHash', 'token', 'tokenHash', 'cookie', 'authorization'],
    remove: true,
  },
});

export type SecurityEventType =
  | 'auth.login_success'
  | 'auth.login_failed'
  | 'auth.register_success'
  | 'auth.register_conflict'
  | 'auth.admin_login_success'
  | 'auth.admin_login_failed'
  | 'auth.logout'
  | 'auth.rate_limited'
  | 'auth.session_error'
  | 'security.turnstile_failed'
  | 'admin.user_toggle_premium'
  | 'admin.user_deleted'
  | 'admin.video_toggle_premium'
  | 'admin.video_renamed'
  | 'admin.video_deleted'
  | 'comment.deleted'
  | 'payment.intent_created'
  | 'payment.webhook_verified'
  | 'payment.webhook_rejected';

export function logSecurityEvent(
  event: SecurityEventType,
  details: Record<string, string | number | boolean | null | undefined>,
): void {
  const isWarning =
    event.includes('failed') ||
    event.includes('rejected') ||
    event.includes('rate_limited') ||
    event.includes('error');

  if (isWarning) {
    logger.warn({ event, ...details });
  } else {
    logger.info({ event, ...details });
  }
}

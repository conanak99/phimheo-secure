import { defineMiddleware } from 'astro:middleware';
import { logSecurityEvent } from './lib/audit';
import { getSessionUser } from './lib/auth';

const IS_PROD = import.meta.env.PROD;

const CSP = [
  "default-src 'self'",
  // Keep strict script-src in production (allow Turnstile API script without unsafe-inline)
  IS_PROD
    ? "script-src 'self' https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SENSITIVE_PATH_PREFIXES = [
  '/admin',
  '/profile',
  '/checkout',
  '/login',
  '/api/admin/',
  '/api/auth/',
  '/api/payments/',
];

function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    context.locals.user = await getSessionUser(context.cookies);
  } catch (err) {
    context.locals.user = null;
    logSecurityEvent('auth.session_error', {
      path: context.url.pathname,
      message: err instanceof Error ? err.message : 'Unknown session error',
    });
  }

  const response = await next();

  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );

  if (IS_PROD || context.url.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  // Prevent browser or intermediary caching of sensitive/authenticated HTML & API responses
  if (
    !response.headers.has('Cache-Control') &&
    (context.locals.user !== null || isSensitivePath(context.url.pathname))
  ) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
});

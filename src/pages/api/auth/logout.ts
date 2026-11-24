import type { APIRoute } from 'astro';
import { logSecurityEvent } from '../../../lib/audit';
import { destroySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
  const userId = locals.user?.id ?? null;
  await destroySession(cookies);
  if (userId) {
    logSecurityEvent('auth.logout', { userId });
  }
  return redirect('/');
};

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';
import { logSecurityEvent } from '../../../../lib/audit';
import { parseFormData } from '../../../../lib/http';
import { isValidUuid } from '../../../../lib/queries';

export const POST: APIRoute = async ({ params, locals, request, redirect }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Forbidden: admin access required', { status: 403 });
  }

  const targetId = params.id ?? '';
  if (!isValidUuid(targetId)) {
    return new Response('Invalid user ID', { status: 400 });
  }

  const formData = await parseFormData(request);
  if (!formData) {
    return new Response('Invalid form submission', { status: 400 });
  }
  const action = formData.get('action')?.toString();

  const [target] = await db
    .select({
      id: users.id,
      isPremium: users.isPremium,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target) {
    return new Response('User not found', { status: 404 });
  }

  if (action === 'toggle-premium') {
    const nextPremium = !target.isPremium;
    await db
      .update(users)
      .set({ isPremium: nextPremium })
      .where(eq(users.id, targetId));

    logSecurityEvent('admin.user_toggle_premium', {
      actorId: locals.user.id,
      targetUserId: targetId,
      isPremium: nextPremium,
    });

    return redirect('/admin?tab=users');
  }

  if (action === 'delete') {
    // Prevent admin from accidentally deleting their own account
    if (target.id === locals.user.id) {
      return redirect('/admin?tab=users');
    }
    await db.delete(users).where(eq(users.id, targetId));

    logSecurityEvent('admin.user_deleted', {
      actorId: locals.user.id,
      targetUserId: targetId,
    });

    return redirect('/admin?tab=users');
  }

  return new Response('Invalid action', { status: 400 });
};

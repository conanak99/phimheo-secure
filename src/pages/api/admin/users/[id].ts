import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';
import { isValidUuid } from '../../../../lib/queries';

export const POST: APIRoute = async ({ params, locals, request, redirect }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Forbidden: admin access required', { status: 403 });
  }

  const targetId = params.id ?? '';
  if (!isValidUuid(targetId)) {
    return new Response('Invalid user ID', { status: 400 });
  }

  const formData = await request.formData();
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
    await db
      .update(users)
      .set({ isPremium: !target.isPremium })
      .where(eq(users.id, targetId));
    return redirect('/admin?tab=users');
  }

  if (action === 'delete') {
    // Prevent admin from accidentally deleting their own account
    if (target.id === locals.user.id) {
      return redirect('/admin?tab=users');
    }
    await db.delete(users).where(eq(users.id, targetId));
    return redirect('/admin?tab=users');
  }

  return new Response('Invalid action', { status: 400 });
};

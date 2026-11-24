import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { comments } from '../../../../db/schema';
import { sanitizeReturnTo } from '../../../../lib/auth';
import { isValidUuid } from '../../../../lib/queries';

export const POST: APIRoute = async ({ params, locals, request, redirect }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const commentId = params.id ?? '';
  if (!isValidUuid(commentId)) {
    return new Response('Invalid comment ID', { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!existing) {
    return new Response('Comment not found', { status: 404 });
  }

  // Server-side ownership / admin check (fixes IDOR)
  if (existing.userId !== locals.user.id && !locals.user.isAdmin) {
    return new Response('Forbidden: you can only delete your own comments', {
      status: 403,
    });
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  const formData = await request.formData();
  const returnTo = sanitizeReturnTo(
    formData.get('returnTo')?.toString(),
    `/videos/${existing.videoId}`,
  );
  return redirect(returnTo);
};

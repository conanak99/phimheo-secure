import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { comments } from '../../../../db/schema';
import { logSecurityEvent } from '../../../../lib/audit';
import { sanitizeReturnTo } from '../../../../lib/auth';
import { parseFormData } from '../../../../lib/http';
import { isValidUuid } from '../../../../lib/queries';

export const POST: APIRoute = async ({ params, locals, request, redirect }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const commentId = params.id ?? '';
  if (!isValidUuid(commentId)) {
    return new Response('Invalid comment ID', { status: 400 });
  }

  // Parse and validate request body BEFORE mutating the database
  const formData = await parseFormData(request);
  if (!formData) {
    return new Response('Invalid form submission', { status: 400 });
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

  logSecurityEvent('comment.deleted', {
    actorId: locals.user.id,
    actorIsAdmin: locals.user.isAdmin,
    commentId,
    videoId: existing.videoId,
  });

  const returnTo = sanitizeReturnTo(
    formData.get('returnTo')?.toString(),
    `/videos/${existing.videoId}`,
  );
  return redirect(returnTo);
};

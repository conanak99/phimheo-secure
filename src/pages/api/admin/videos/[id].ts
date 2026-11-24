import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { videos } from '../../../../db/schema';
import { sanitizeReturnTo } from '../../../../lib/auth';
import { isValidUuid } from '../../../../lib/queries';

export const POST: APIRoute = async ({ params, locals, request, redirect }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Forbidden: admin access required', { status: 403 });
  }

  const videoId = params.id ?? '';
  if (!isValidUuid(videoId)) {
    return new Response('Invalid video ID', { status: 400 });
  }

  const formData = await request.formData();
  const action = formData.get('action')?.toString();
  const returnTo = sanitizeReturnTo(
    formData.get('returnTo')?.toString(),
    '/admin?tab=videos',
  );

  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  if (!video) {
    return new Response('Video not found', { status: 404 });
  }

  if (action === 'toggle-premium') {
    await db
      .update(videos)
      .set({ isPremiumOnly: !video.isPremiumOnly })
      .where(eq(videos.id, videoId));
    return redirect(returnTo);
  }

  if (action === 'rename') {
    const title = formData.get('title')?.toString().trim() ?? '';
    if (title.length >= 2 && title.length <= 160) {
      await db.update(videos).set({ title }).where(eq(videos.id, videoId));
    }
    return redirect(returnTo);
  }

  if (action === 'delete') {
    await db.delete(videos).where(eq(videos.id, videoId));
    return redirect(returnTo);
  }

  return new Response('Invalid action', { status: 400 });
};

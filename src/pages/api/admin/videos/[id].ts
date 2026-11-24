import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { videos } from '../../../../db/schema';
import { logSecurityEvent } from '../../../../lib/audit';
import { sanitizeReturnTo } from '../../../../lib/auth';
import { parseFormData } from '../../../../lib/http';
import { isValidUuid } from '../../../../lib/queries';
import { videoTitleSchema } from '../../../../lib/validation';

export const POST: APIRoute = async ({ params, locals, request, redirect }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Forbidden: admin access required', { status: 403 });
  }

  const videoId = params.id ?? '';
  if (!isValidUuid(videoId)) {
    return new Response('Invalid video ID', { status: 400 });
  }

  const formData = await parseFormData(request);
  if (!formData) {
    return new Response('Invalid form submission', { status: 400 });
  }
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
    const nextPremiumOnly = !video.isPremiumOnly;
    await db
      .update(videos)
      .set({ isPremiumOnly: nextPremiumOnly })
      .where(eq(videos.id, videoId));

    logSecurityEvent('admin.video_toggle_premium', {
      actorId: locals.user.id,
      videoId,
      isPremiumOnly: nextPremiumOnly,
    });

    return redirect(returnTo);
  }

  if (action === 'rename') {
    const parsedTitle = videoTitleSchema.safeParse(
      formData.get('title')?.toString() ?? '',
    );
    if (parsedTitle.success) {
      await db
        .update(videos)
        .set({ title: parsedTitle.data })
        .where(eq(videos.id, videoId));

      logSecurityEvent('admin.video_renamed', {
        actorId: locals.user.id,
        videoId,
      });
    }
    return redirect(returnTo);
  }

  if (action === 'delete') {
    await db.delete(videos).where(eq(videos.id, videoId));

    logSecurityEvent('admin.video_deleted', {
      actorId: locals.user.id,
      videoId,
    });

    return redirect(returnTo);
  }

  return new Response('Invalid action', { status: 400 });
};

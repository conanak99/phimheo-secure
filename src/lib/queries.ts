import { asc, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db';
import {
  comments,
  users,
  videos,
  type PublicProfile,
  type PublicVideo,
  type SafeUser,
  type Video,
} from '../db/schema';

export type CommentWithAuthor = {
  id: string;
  videoId: string;
  userId: string;
  content: string;
  createdAt: Date;
  author: PublicProfile | null;
};

const publicVideoColumns = {
  id: videos.id,
  title: videos.title,
  description: videos.description,
  thumbnailUrl: videos.thumbnailUrl,
  isPremiumOnly: videos.isPremiumOnly,
  posterFrom: videos.posterFrom,
  posterTo: videos.posterTo,
  emoji: videos.emoji,
  duration: videos.duration,
  views: videos.views,
  createdAt: videos.createdAt,
};

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function getPublicVideos(query?: string): Promise<PublicVideo[]> {
  const trimmed = query?.trim();
  if (trimmed) {
    const pattern = `%${escapeLikePattern(trimmed)}%`;
    return db
      .select(publicVideoColumns)
      .from(videos)
      .where(ilike(videos.title, pattern))
      .orderBy(asc(videos.createdAt), asc(videos.id));
  }

  return db
    .select(publicVideoColumns)
    .from(videos)
    .orderBy(asc(videos.createdAt), asc(videos.id));
}

export async function getPremiumVideos(): Promise<PublicVideo[]> {
  return db
    .select(publicVideoColumns)
    .from(videos)
    .where(eq(videos.isPremiumOnly, true))
    .orderBy(asc(videos.createdAt), asc(videos.id));
}

export async function getPublicVideoById(
  id: string,
): Promise<PublicVideo | undefined> {
  if (!isValidUuid(id)) return undefined;
  const rows = await db
    .select(publicVideoColumns)
    .from(videos)
    .where(eq(videos.id, id))
    .limit(1);
  return rows[0];
}

export async function getFullVideoById(id: string): Promise<Video | undefined> {
  if (!isValidUuid(id)) return undefined;
  const rows = await db
    .select()
    .from(videos)
    .where(eq(videos.id, id))
    .limit(1);
  return rows[0];
}

export async function getCommentsForVideo(
  videoId: string,
): Promise<CommentWithAuthor[]> {
  if (!isValidUuid(videoId)) return [];
  const rows = await db
    .select({
      id: comments.id,
      videoId: comments.videoId,
      userId: comments.userId,
      content: comments.content,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorUsername: users.username,
      authorBio: users.bio,
      authorCreatedAt: users.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.videoId, videoId))
    .orderBy(desc(comments.createdAt), asc(comments.id));

  return rows.map((row) => ({
    id: row.id,
    videoId: row.videoId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt,
    author: row.authorId
      ? {
          id: row.authorId,
          username: row.authorUsername ?? 'Người dùng',
          bio: row.authorBio ?? '',
          createdAt: row.authorCreatedAt ?? row.createdAt,
        }
      : null,
  }));
}

export async function getPublicCommunityProfiles(): Promise<PublicProfile[]> {
  // Never select email, passwordHash, isAdmin, or isPremium for public community list.
  return db
    .select({
      id: users.id,
      username: users.username,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id));
}

// Admin-only queries (callers MUST verify locals.user?.isAdmin before invoking)
export async function getAdminDashboardData(): Promise<{
  videos: Video[];
  users: SafeUser[];
  comments: Array<{
    id: string;
    videoId: string;
    userId: string;
    content: string;
    createdAt: Date;
  }>;
}> {
  const [videoRows, userRows, commentRows] = await Promise.all([
    db.select().from(videos).orderBy(asc(videos.createdAt), asc(videos.id)),
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        bio: users.bio,
        isPremium: users.isPremium,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.id)),
    db
      .select()
      .from(comments)
      .orderBy(desc(comments.createdAt), asc(comments.id)),
  ]);

  return {
    videos: videoRows,
    users: userRows,
    comments: commentRows,
  };
}

import { asc, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db';
import {
  comments,
  payments,
  users,
  videos,
  type Payment,
  type PublicProfile,
  type PublicVideo,
  type SafeUser,
  type Video,
} from '../db/schema';
import { searchQuerySchema, uuidSchema } from './validation';

const MAX_VIDEOS_LIMIT = 100;
const MAX_COMMENTS_LIMIT = 200;
const MAX_PROFILES_LIMIT = 100;
const MAX_ADMIN_ROWS = 200;

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
  return uuidSchema.safeParse(value).success;
}

export async function getPublicVideos(
  query?: string,
  limit = MAX_VIDEOS_LIMIT,
): Promise<PublicVideo[]> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_VIDEOS_LIMIT);
  const parsedQuery = searchQuerySchema.safeParse(query ?? '');
  const trimmed = parsedQuery.success
    ? parsedQuery.data
    : (query ?? '').trim().slice(0, 100);

  if (trimmed) {
    const pattern = `%${escapeLikePattern(trimmed)}%`;
    return db
      .select(publicVideoColumns)
      .from(videos)
      .where(ilike(videos.title, pattern))
      .orderBy(asc(videos.createdAt), asc(videos.id))
      .limit(safeLimit);
  }

  return db
    .select(publicVideoColumns)
    .from(videos)
    .orderBy(asc(videos.createdAt), asc(videos.id))
    .limit(safeLimit);
}

export async function getPremiumVideos(
  limit = MAX_VIDEOS_LIMIT,
): Promise<PublicVideo[]> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_VIDEOS_LIMIT);
  return db
    .select(publicVideoColumns)
    .from(videos)
    .where(eq(videos.isPremiumOnly, true))
    .orderBy(asc(videos.createdAt), asc(videos.id))
    .limit(safeLimit);
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
  limit = MAX_COMMENTS_LIMIT,
): Promise<CommentWithAuthor[]> {
  if (!isValidUuid(videoId)) return [];
  const safeLimit = Math.min(Math.max(1, limit), MAX_COMMENTS_LIMIT);
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
    .orderBy(desc(comments.createdAt), asc(comments.id))
    .limit(safeLimit);

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

export async function getPublicCommunityProfiles(
  limit = MAX_PROFILES_LIMIT,
): Promise<PublicProfile[]> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_PROFILES_LIMIT);
  // Never select email, passwordHash, isAdmin, or isPremium for public community list.
  return db
    .select({
      id: users.id,
      username: users.username,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(safeLimit);
}

export async function getLatestPendingPaymentForUser(
  userId: string,
): Promise<Payment | undefined> {
  if (!isValidUuid(userId)) return undefined;
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return rows[0];
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
    db
      .select()
      .from(videos)
      .orderBy(asc(videos.createdAt), asc(videos.id))
      .limit(MAX_ADMIN_ROWS),
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
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(MAX_ADMIN_ROWS),
    db
      .select()
      .from(comments)
      .orderBy(desc(comments.createdAt), asc(comments.id))
      .limit(MAX_ADMIN_ROWS),
  ]);

  return {
    videos: videoRows,
    users: userRows,
    comments: commentRows,
  };
}

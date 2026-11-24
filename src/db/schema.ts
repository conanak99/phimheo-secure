import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  bio: text('bio').notNull().default(''),
  isPremium: boolean('is_premium').notNull().default(false),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  videoFilename: text('video_filename').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  isPremiumOnly: boolean('is_premium_only').notNull().default(false),
  posterFrom: text('poster_from').notNull().default('#bde9ff'),
  posterTo: text('poster_to').notNull().default('#ffb3ce'),
  emoji: text('emoji').notNull().default('🐷'),
  duration: text('duration').notNull().default('00:05'),
  views: bigint('views', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('comments_video_created_idx').on(table.videoId, table.createdAt)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Preserve payment audit records even if a user account is later deleted
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    amountVnd: integer('amount_vnd').notNull(),
    cardLast4: text('card_last4').notNull().default('hosted'),
    receiptSignature: text('receipt_signature').notNull(),
    webhookEventId: text('webhook_event_id').unique(),
    status: text('status').notNull().default('pending'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payments_user_id_idx').on(table.userId)],
);

export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'passwordHash'>;
export type PublicProfile = Pick<User, 'id' | 'username' | 'bio' | 'createdAt'>;
export type Video = typeof videos.$inferSelect;
export type PublicVideo = Omit<Video, 'videoFilename'>;
export type Comment = typeof comments.$inferSelect;
export type Payment = typeof payments.$inferSelect;

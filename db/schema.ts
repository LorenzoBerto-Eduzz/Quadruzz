import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull(),
  status: text('status', { enum: ['approved', 'removed'] }).notNull(),
  joinOrder: integer('join_order').notNull().unique(),
  displayName: text('display_name'),
  profileImageKey: text('profile_image_key'),
  lastSeenAt: integer('last_seen_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const accessRequests = sqliteTable('access_requests', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull(),
  requestedAt: integer('requested_at').notNull(),
  decidedAt: integer('decided_at'),
  decidedBy: text('decided_by'),
});

export const boardState = sqliteTable('board_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});
export const presenceSessions = sqliteTable('presence_sessions', {
  sessionId: text('session_id').primaryKey(),
  userId: text('user_id').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
}, (table) => [index('presence_sessions_user_seen_idx').on(table.userId, table.lastSeenAt)]);